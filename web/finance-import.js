/* finance-import.js — "Import statement" for Finance → Expenses.
 *
 * Upload a bank statement (.xls / .xlsx / .csv — built for Axis Bank, works with
 * most Indian bank exports), and every debit is turned into a ready-to-review
 * expense: cleaned payee name, category, weekly/monthly budget scope.
 *
 * How a row gets its category (first match wins):
 *   1. a decision you already made for that exact bank reference
 *   2. a rule you taught it for that payee (remembered on this device)
 *   3. never-an-expense patterns (FD sweeps, refunds, card bills, investments)
 *   4. how you categorised that payee in earlier expenses (works across devices)
 *   5. keyword guesses (Zomato → Food & Dining, IRCTC → Travel …)
 * Credits are never imported. Rows that look already logged are unticked.
 * Nothing leaves the device except the expenses you press Import on.
 */
(function () {
  'use strict';

  const XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const RULES_KEY = 'os.fin.import.rules';
  const WEEKLY_CATS = ['food & dining', 'food', 'groceries', 'fuel', 'fun', 'miscellaneous', 'daily needs', 'shopping', 'snacks'];

  /* ── Decisions Rohit gave for the Oct-2026 Axis statement (by bank ref) ── */
  const REF_DECISIONS = {
    '627859940400': { cat: 'Car', scope: 'monthly', note: 'Car purchase — my share' },
    '627862241261': { skip: 'Car — paid by family in cash (₹20k brother + ₹14k father)' },
    '627862470997': { cat: 'Car', scope: 'monthly', note: 'Car' },
    '628099337434': { cat: 'Gifts', scope: 'monthly', note: "Brother's birthday gift" },
    '628099340728': { cat: 'Gifts', scope: 'monthly', note: "Brother's birthday gift" },
    '665397422683': { cat: 'GST', scope: 'monthly', note: 'GST expenses' },
    '629161934803': { skip: 'Lent to Razan — not an expense' },
    '664826332277': { cat: 'Fun', scope: 'weekly' },
    '665397418704': { cat: 'GST', scope: 'monthly', note: 'GST charges' },
    '665165520370': { skip: 'Refunded' },
    '961689241123': { skip: 'Already in app — Rent' },
    '231016720768': { skip: 'Already in app — Train ticket up and down' },
    '232128867823': { skip: 'Already in app — Train ticket up and down' },
    '627523015849': { skip: 'Already in app — Kaleji roll' },
    '104046600899': { skip: 'Already in app — Electricity' },
    '665174903264': { skip: 'Already in app — Gaon (logged 19 Oct)' },
    '613388651806': { skip: 'Moved to own Kotak account' }
  };
  /* Standing payee rules (lower-case cleaned payee name). */
  const PAYEE_SEED = {
    'sumit kumar duby': { cat: 'Gaon', scope: 'monthly' },
    'paras nath doobe': { cat: 'Gaon', scope: 'monthly', note: 'Monthly transfer to Gaon' },
    'advisebrain': { cat: 'GST', scope: 'monthly', note: 'GST charges' },
    'indian clearing corp': { skip: 'Investment (stocks / mutual funds)' },
    'kotak mahindra bank': { skip: 'Kotak credit-card bill / own transfer' }
  };
  /* Patterns that are never spending. */
  const NEVER = [
    [/flexi|sweep|autosweep|fixed deposit|\bFD\b/i, 'FD sweep — your own money moving'],
    [/credit ?card|cc bill|card payment/i, 'Credit-card bill — log card spends instead'],
    [/zerodha|groww|indian clearing|iccl|nsdl cas|mutual fund|\bsip\b/i, 'Investment'],
  ];
  /* Keyword → category guesses. */
  const KEYWORDS = [
    [/zomato|swiggy|eternal|blinkit|zepto|domino|pizza|cafe|restaurant|eating|sweets|dhaba|potato|bakery|kitchen|food/i, 'Food & Dining'],
    [/bigbasket|grofers|dmart|grocery|kirana|milk|dairy/i, 'Groceries'],
    [/irctc|\buber\b|\bola\b|rapido|redbus|makemytrip|indigo|air india|goibibo|railway|metro/i, 'Travel'],
    [/flipkart|amazon|myntra|ajio|meesho|nykaa|croma/i, 'Shopping'],
    [/filling|petrol|fuel|hpcl|iocl|bpcl|indian oil|bharat petroleum|service station/i, 'Fuel'],
    [/power|electric|bijli|uppcl|airtel|\bjio\b|vodafone|\bvi\b|broadband|recharge|water bill|gas bill/i, 'Bills & Utilities'],
    [/google|netflix|spotify|youtube|prime video|hotstar|apple\.com|microsoft|openai|anthropic|notion|canva/i, 'Subscriptions'],
    [/automobile|motors|car wash|tyre|garage|fastag|parking/i, 'Car'],
    [/pharma|medical|chemist|hospital|clinic|apollo|1mg|netmeds/i, 'Health'],
    [/\bgst\b|\btax\b|advisebrain/i, 'GST'],
  ];
  const BRANDS = [
    [/zomato|eternal/i, 'Zomato'], [/irctc/i, 'IRCTC'], [/flipkart/i, 'Flipkart'], [/amazon/i, 'Amazon'],
    [/uttar pradesh power|uppcl/i, 'UPPCL Electricity'], [/airtel/i, 'Airtel'], [/google workspace/i, 'Google Workspace'],
    [/indian cl/i, 'Indian Clearing Corp'], [/kotak mahindra/i, 'Kotak Mahindra Bank'], [/advisebrain/i, 'AdviseBrain'],
    [/swiggy/i, 'Swiggy'], [/blinkit/i, 'Blinkit'], [/bhim/i, 'BHIM'], [/bank account x+/i, 'Bank transfer']
  ];

  /* ── State ─────────────────────────────────────────────────────────── */
  let S = null;   // { file, rows:[], filter, q, saving }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const inr2 = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const toast = (m) => (typeof showToast === 'function' ? showToast(m) : console.log(m));
  const keyOf = label => String(label || '').toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();

  function loadRules() { try { return JSON.parse(localStorage.getItem(RULES_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveRule(key, rule) {
    try { const r = loadRules(); r[key] = Object.assign({}, r[key] || {}, rule); localStorage.setItem(RULES_KEY, JSON.stringify(r)); } catch (e) { }
  }

  function titleCase(s) {
    return String(s).toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\bUpi\b/g, 'UPI');
  }

  /* ── Parsing ───────────────────────────────────────────────────────── */
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = XLSX_SRC; s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('Could not load the spreadsheet reader'));
      document.head.appendChild(s);
    });
  }

  function parseDate(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
    const s = String(v).trim();
    let m = /^(\d{1,2})[-\/. ](\d{1,2}|[A-Za-z]{3})[-\/. ](\d{2,4})/.exec(s);
    if (m) {
      const mon = isNaN(+m[2]) ? 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m[2].toLowerCase()) / 3 : (+m[2] - 1);
      let y = +m[3]; if (y < 100) y += 2000;
      if (mon >= 0) return new Date(y, mon, +m[1]);
    }
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[₹,\s]/g, '')); return isNaN(n) ? 0 : n; };

  function findColumns(header) {
    const h = header.map(c => String(c || '').trim().toLowerCase());
    const pick = (re, not) => h.findIndex(c => re.test(c) && !(not && not.test(c)));
    return {
      date: pick(/^(tran(saction)?|txn|value)? ?date$|^date$/),
      desc: pick(/particular|narration|description|remarks|details|payee|merchant|^name$/),
      dr: pick(/^dr$|debit|withdraw/),
      cr: pick(/^cr$|credit|deposit/),
      amt: pick(/^amount|amount \(inr\)/),
      type: pick(/^(dr\/cr|cr\/dr|type)$/),
      ref: pick(/ref|chq|cheque/, /particular/),
      cat: pick(/^category$/),
      scope: pick(/^scope$|^budget$/),
      count: pick(/^count$|^include$/),
      note: pick(/^note$/)
    };
  }

  function splitPayee(raw) {
    const p = raw.split('/').map(x => x.trim());
    let name = raw, ref = '';
    if (/^UPI\//i.test(raw)) { name = p[3] || raw; ref = p[2] || ''; }
    else if (/^(ECOM PUR|POS)\//i.test(raw)) { name = p[1] || raw; ref = p[p.length - 1] || ''; }
    else if (/^(NEFT|IMPS|RTGS)\//i.test(raw)) { name = p[2] || raw; ref = p[1] || ''; }
    else if (/^BRN-|^Flexi/i.test(raw)) { name = 'Flexi FD'; }
    const probe = /^(UPI|ECOM PUR|POS|NEFT|IMPS|RTGS)\//i.test(raw) ? name : raw;   // never match on the bank's name
    for (const [re, b] of BRANDS) if (re.test(probe)) return { label: b, ref, name };
    name = name.replace(/^(mr|mrs|ms|m\/s)\.?\s+/i, '')
      .replace(/\s+(so|do|wo|s\/o|d\/o|w\/o)\b.*$/i, '')
      .replace(/\s+(private|pvt)\b.*$/i, '')
      .replace(/\s+(limited|ltd|limite|l)$/i, '')
      .replace(/\s{2,}/g, ' ').trim();
    if (!/[a-z]/.test(name)) name = titleCase(name);
    return { label: name || raw, ref, name: probe };
  }

  function parseSheet(XLSX, wb) {
    let grid = null, hi = -1, cols = null;
    const seen = [];
    for (const name of wb.SheetNames) {              // any sheet, not just the first
      const g = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      for (let i = 0; i < Math.min(g.length, 80); i++) {
        const c = findColumns(g[i]);
        if (c.date >= 0 && c.desc >= 0 && (c.dr >= 0 || c.amt >= 0)) { grid = g; hi = i; cols = c; break; }
      }
      if (grid) break;
      const firstRow = g.find(r => r.filter(x => String(x).trim()).length >= 3);
      if (firstRow) seen.push(firstRow.filter(x => String(x).trim()).slice(0, 6).join(', '));
    }
    if (!grid) throw new Error("Couldn't find the transactions table — it needs a Date column, a Particulars / Narration / Payee column and a Debit (or Amount) column." + (seen.length ? ' Found: ' + seen[0] : ''));
    let period = '';
    for (let i = 0; i < hi; i++) { const t = grid[i].join(' '); const m = /from\s*:?\s*([\d\-\/]+)\s*to\s*:?\s*([\d\-\/]+)/i.exec(t); if (m) period = m[1] + ' – ' + m[2]; }
    const out = [];
    for (let i = hi + 1; i < grid.length; i++) {
      const r = grid[i];
      const d = parseDate(r[cols.date]);
      const raw = String(r[cols.desc] || '').replace(/\s+/g, ' ').trim();
      if (!d || !raw) continue;
      let dr = cols.dr >= 0 ? num(r[cols.dr]) : 0, cr = cols.cr >= 0 ? num(r[cols.cr]) : 0;
      if (cols.dr < 0 && cols.amt >= 0) {
        const a = num(r[cols.amt]); const t = cols.type >= 0 ? String(r[cols.type]).toLowerCase() : '';
        if (/cr/.test(t) || (!t && a > 0 && cols.cr < 0 && false)) cr = Math.abs(a); else dr = Math.abs(a);
      }
      if (!dr && !cr) continue;
      const { label, ref, name } = splitPayee(raw);
      const row = { i: out.length, date: d, raw, label, probe: name || raw, ref: ref || (cols.ref >= 0 ? String(r[cols.ref] || '').trim() : ''), dr, cr };
      // A sheet that already says what each row is (e.g. the cleaned sheet): honour it.
      if (cols.cat >= 0 || cols.count >= 0) {
        const cnt = cols.count >= 0 ? String(r[cols.count]).trim().toLowerCase() : '';
        const note = cols.note >= 0 ? String(r[cols.note] || '').trim() : '';
        row.preset = {
          skip: /^(no|n|false|0)$/.test(cnt) ? (note || 'Marked as not counted') : '',
          cat: cols.cat >= 0 ? String(r[cols.cat] || '').trim() : '',
          scope: cols.scope >= 0 && /week/i.test(String(r[cols.scope])) ? 'weekly' : 'monthly',
          note: /^(already|car —|lent|refund)|confirm|probably/i.test(note) ? '' : note
        };
        row.label = raw;
      }
      out.push(row);
    }
    return { rows: out, period };
  }

  /* ── Classification ────────────────────────────────────────────────── */
  function appCategories() {
    let cats = [];
    try { cats = (typeof getAllFinanceCategories === 'function') ? getAllFinanceCategories() : []; } catch (e) { }
    return cats;
  }
  function matchCat(cat, cats) {
    if (!cat) return '';
    const lc = cat.toLowerCase();
    const exact = cats.find(c => c.toLowerCase() === lc);
    if (exact) return exact;
    const first = lc.split(/[ &]/)[0];
    const near = cats.find(c => c.toLowerCase().split(/[ &]/)[0] === first);
    return near || cat;
  }
  function scopeFor(cat, amt) { return WEEKLY_CATS.includes(String(cat).toLowerCase()) && amt < 1500 ? 'weekly' : 'monthly'; }

  // Payee → its most-used category / scope in expenses already in the app (ties → most recent).
  function historyMap() {
    const tally = {};
    (window.state?.data?.expenses || []).filter(e => e.type === 'expense').sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((e, n) => {
      const k = keyOf(String(e.description || '').split(' — ')[0]);
      if (!k || !e.category) return;
      const t = tally[k] = tally[k] || {};
      const id = e.category + '|' + (e.budget_scope === 'weekly' ? 'weekly' : 'monthly');
      t[id] = { c: ((t[id] && t[id].c) || 0) + 1, n };
    });
    const m = {};
    Object.entries(tally).forEach(([k, t]) => {
      const best = Object.entries(t).sort((a, b) => b[1].c - a[1].c || b[1].n - a[1].n)[0][0].split('|');
      m[k] = { cat: best[0], scope: best[1] };
    });
    return m;
  }

  function classify(rows) {
    const cats = appCategories();
    const rules = loadRules();
    const hist = historyMap();
    const existing = (window.state?.data?.expenses || []).filter(e => e.type === 'expense');

    // Refund pairs: a credit that says refund/reversal cancels an equal debit in the 5 days before it.
    rows.forEach(r => {
      if (r.cr && /refund|reversal|\brev\b/i.test(r.raw)) {
        const hit = rows.find(x => x.dr && !x.pair && Math.abs(x.dr - r.cr) < 0.01 && (r.date - x.date) >= 0 && (r.date - x.date) <= 5 * 864e5);
        if (hit) { hit.pair = true; r.pair = true; }
      }
    });

    rows.forEach(r => {
      r.amount = r.dr || r.cr; r.key = keyOf(r.label);
      r.cat = ''; r.scope = (r.dr && r.dr < 500) ? 'weekly' : 'monthly'; r.note = ''; r.skip = ''; r.src = ''; r.on = false; r.dup = '';
      if (r.cr) { r.skip = r.pair ? 'Refund' : 'Money in — not an expense'; r.src = 'credit'; return; }
      if (r.pair) { r.skip = 'Refunded later'; r.src = 'auto'; return; }
      const apply = (d, src) => { if (d.skip) r.skip = d.skip; if (d.cat) r.cat = matchCat(d.cat, cats); if (d.scope) r.scope = d.scope; if (d.note) r.note = d.note; r.src = src; };
      if (r.preset) apply(r.preset, 'you');
      else if (REF_DECISIONS[r.ref]) apply(REF_DECISIONS[r.ref], 'you');
      else if (rules[r.key]) apply(rules[r.key], 'rule');
      else {
        const nv = NEVER.find(([re]) => re.test(r.raw));
        const seed = PAYEE_SEED[r.key] || Object.entries(PAYEE_SEED).find(([k]) => r.key.startsWith(k))?.[1];
        if (seed && seed.skip) apply(seed, 'rule');
        else if (nv) { r.skip = nv[1]; r.src = 'auto'; }
        else if (seed) apply(seed, 'rule');
        else if (hist[r.key]) apply(hist[r.key], 'history');
        else {
          const kw = KEYWORDS.find(([re]) => re.test(r.probe + ' ' + r.label));
          if (kw) { r.cat = matchCat(kw[1], cats); r.scope = scopeFor(kw[1], r.amount); r.src = 'guess'; }
        }
      }
      if (r.skip) return;
      if (r.cat && r.src === 'guess') r.scope = scopeFor(r.cat, r.amount);
      // Already logged?
      const ds = iso(r.date);
      const same = existing.find(e => Math.abs(Number(e.amount) - r.amount) < 0.01 && String(e.date).slice(0, 10) === ds && keyOf(String(e.description || '').split(' — ')[0]) === r.key);
      if (same) { r.skip = 'Already imported'; r.src = 'dup'; return; }
      const near = existing.find(e => Math.abs(Number(e.amount) - r.amount) < 0.01 && Math.abs(new Date(String(e.date).slice(0, 10)) - new Date(ds)) <= 3 * 864e5);
      if (near) { r.dup = `Looks already logged: ${near.category || 'expense'} on ${String(near.date).slice(5, 10).split('-').reverse().join('/')}${near.description ? ' · ' + near.description : ''}`; }
      r.on = !r.dup;
    });
    return rows;
  }

  /* ── View model helpers ────────────────────────────────────────────── */
  const needs = r => !r.skip && (!r.cat || r.src === 'guess' && false);
  const picked = () => S.rows.filter(r => !r.skip && r.on);
  function counts() {
    const imp = picked();
    return {
      imp, total: imp.reduce((s, r) => s + r.amount, 0),
      wk: imp.filter(r => r.scope === 'weekly').reduce((s, r) => s + r.amount, 0),
      mo: imp.filter(r => r.scope !== 'weekly').reduce((s, r) => s + r.amount, 0),
      review: S.rows.filter(r => !r.skip && (!r.cat || r.dup)).length,
      skipped: S.rows.filter(r => r.skip).length,
      debits: S.rows.filter(r => r.dr).length
    };
  }
  function visibleRows() {
    let rows = S.rows;
    if (S.filter === 'import') rows = rows.filter(r => !r.skip);
    else if (S.filter === 'review') rows = rows.filter(r => !r.skip && (!r.cat || r.dup));
    else if (S.filter === 'skipped') rows = rows.filter(r => r.skip);
    const q = S.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => [r.label, r.raw, r.cat, r.note, r.amount].some(v => String(v).toLowerCase().includes(q)));
    return rows;
  }

  /* ── Rendering ─────────────────────────────────────────────────────── */
  function shell(inner) {
    let el = document.getElementById('fimpRoot');
    if (!el) { el = document.createElement('div'); el.id = 'fimpRoot'; document.body.appendChild(el); }
    el.innerHTML = `<style>${CSS}</style><div class="fimp-backdrop" onclick="fimpClose()"></div><div class="fimp" role="dialog" aria-label="Import bank statement">${inner}</div>`;
    document.body.classList.add('fimp-open');
    if (window.lucide?.createIcons) lucide.createIcons();
  }
  const ic = (n, cls = '') => `<i data-lucide="${n}" class="fimp-ic ${cls}"></i>`;

  function renderUpload(err) {
    shell(`
      <div class="fimp-head"><div><div class="fimp-title">Import bank statement</div><div class="fimp-sub">Turn a statement into categorised weekly / monthly expenses</div></div>
        <button class="fimp-x" onclick="fimpClose()" aria-label="Close">${ic('x')}</button></div>
      <div class="fimp-body fimp-upbody">
        <label class="fimp-drop" id="fimpDrop">
          <input type="file" accept=".xls,.xlsx,.csv" onchange="fimpPick(this.files[0])" hidden>
          <div class="fimp-drop-ic">${ic('file-spreadsheet')}</div>
          <div class="fimp-drop-t">Drop your statement here or <u>browse</u></div>
          <div class="fimp-drop-s">.xls, .xlsx or .csv · Axis Bank format works out of the box</div>
        </label>
        ${err ? `<div class="fimp-err">${ic('alert-circle')} ${esc(err)}</div>` : ''}
        <div class="fimp-how">
          <div class="fimp-how-i"><b>1</b><div><strong>Cleans it up</strong><span>Payee names, bank refs and dates are tidied; credits are left out.</span></div></div>
          <div class="fimp-how-i"><b>2</b><div><strong>Skips what isn't spending</strong><span>FD sweeps, refunds, card-bill payments, investments and anything already in the app.</span></div></div>
          <div class="fimp-how-i"><b>3</b><div><strong>You review, it learns</strong><span>Fix a category once and it's remembered for that payee next month.</span></div></div>
        </div>
        <div class="fimp-priv">${ic('lock')} The file is read on this device. Only the expenses you import are saved.</div>
      </div>`);
    const drop = document.getElementById('fimpDrop');
    ['dragenter', 'dragover'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('on'); }));
    ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.remove('on'); }));
    drop.addEventListener('drop', ev => { const f = ev.dataTransfer.files[0]; if (f) fimpPick(f); });
  }

  function rowHTML(r) {
    const d = r.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const badge = r.skip
      ? `<span class="fimp-b skip">${esc(r.skip)}</span>`
      : (r.dup ? `<span class="fimp-b warn" title="${esc(r.dup)}">${ic('copy')} ${esc(r.dup)}</span>`
        : (!r.cat ? `<span class="fimp-b need">Needs a category</span>`
          : (r.src === 'guess' ? `<span class="fimp-b guess">Auto-guessed</span>` : r.src === 'history' ? `<span class="fimp-b hist">From your history</span>` : r.src === 'rule' ? `<span class="fimp-b hist">Your rule</span>` : '')));
    if (r.skip) {
      return `<div class="fimp-row is-skip" data-i="${r.i}">
        <div class="fimp-ck"></div>
        <div class="fimp-date">${d}</div>
        <div class="fimp-who"><div class="fimp-lbl ro">${esc(r.label)}</div><div class="fimp-raw"><span class="fimp-mdate">${d} · </span>${esc(r.raw)}</div><div class="fimp-badges">${badge}</div></div>
        <div class="fimp-ctl">${r.cr ? '' : `<button class="fimp-link" onclick="fimpUnskip(${r.i})">Import anyway</button>`}</div>
        <div class="fimp-amt ${r.cr ? 'in' : ''}">${r.cr ? '+' : ''}${inr2(r.amount)}</div></div>`;
    }
    return `<div class="fimp-row ${r.on ? '' : 'is-off'} ${!r.cat ? 'is-need' : ''}" data-i="${r.i}">
      <label class="fimp-ck"><input type="checkbox" ${r.on ? 'checked' : ''} onchange="fimpToggle(${r.i}, this.checked)"><span></span></label>
      <div class="fimp-date">${d}</div>
      <div class="fimp-who">
        <input class="fimp-lbl" value="${esc(r.label)}" onchange="fimpSet(${r.i}, 'label', this.value)" aria-label="Payee">
        <div class="fimp-raw"><span class="fimp-mdate">${d} · </span>${esc(r.raw)}</div>
        ${(r.note || r.showNote) ? `<input class="fimp-note" id="fimpNote${r.i}" value="${esc(r.note)}" placeholder="Add a note…" onchange="fimpSet(${r.i}, 'note', this.value)" aria-label="Note">` : ''}
        <div class="fimp-badges">${badge}${(r.note || r.showNote) ? '' : `<button class="fimp-link sm" onclick="fimpNote(${r.i})">+ Note</button>`}<button class="fimp-link sm" onclick="fimpSkip(${r.i})">Not an expense</button></div>
      </div>
      <div class="fimp-ctl">
        <input class="fimp-cat ${!r.cat ? 'empty' : ''}" list="fimpCats" value="${esc(r.cat)}" placeholder="Category" onchange="fimpSet(${r.i}, 'cat', this.value)" aria-label="Category">
        <div class="fimp-seg" role="group" aria-label="Budget">
          <button class="${r.scope === 'weekly' ? 'on' : ''}" onclick="fimpSet(${r.i}, 'scope', 'weekly')" title="Counts toward the weekly budget">Weekly</button>
          <button class="${r.scope !== 'weekly' ? 'on' : ''}" onclick="fimpSet(${r.i}, 'scope', 'monthly')" title="Counts toward the monthly budget">Monthly</button>
        </div>
      </div>
      <div class="fimp-amt">${inr2(r.amount)}</div></div>`;
  }

  function renderReview() {
    const c = counts();
    const rows = visibleRows();
    const allCats = [...new Set([...appCategories(), ...S.rows.map(r => r.cat).filter(Boolean), 'Food & Dining', 'Groceries', 'Travel', 'Shopping', 'Fuel', 'Bills & Utilities', 'Subscriptions', 'Car', 'Rent', 'Gaon', 'GST', 'Gifts', 'Fun', 'Health', 'Miscellaneous'])].sort((a, b) => a.localeCompare(b));
    const byCat = {}; c.imp.forEach(r => { byCat[r.cat || 'Uncategorised'] = (byCat[r.cat || 'Uncategorised'] || 0) + r.amount; });
    const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const max = catEntries.length ? catEntries[0][1] : 1;
    const tabs = [['import', 'To import', S.rows.filter(r => !r.skip).length], ['review', 'Needs review', c.review], ['skipped', 'Skipped', c.skipped], ['all', 'All', S.rows.length]];
    const missing = c.imp.filter(r => !r.cat).length;
    const sc = document.querySelector('.fimp-list')?.scrollTop || 0;
    shell(`
      <div class="fimp-head">
        <div><div class="fimp-title">Review ${c.debits} debits</div><div class="fimp-sub">${esc(S.file)}${S.period ? ' · ' + esc(S.period) : ''}</div></div>
        <div class="fimp-head-r"><button class="fimp-btn ghost sm" onclick="fimpRestart()">${ic('upload')} Another file</button><button class="fimp-x" onclick="fimpClose()" aria-label="Close">${ic('x')}</button></div>
      </div>
      <div class="fimp-stats">
        <div class="fimp-stat"><span>Importing</span><b>${inr(c.total)}</b><em>${c.imp.length} expenses</em></div>
        <div class="fimp-stat"><span>Weekly budget</span><b>${inr(c.wk)}</b><em>${c.imp.filter(r => r.scope === 'weekly').length} day-to-day</em></div>
        <div class="fimp-stat"><span>Monthly budget</span><b>${inr(c.mo)}</b><em>${c.imp.filter(r => r.scope !== 'weekly').length} bills & big ones</em></div>
        <div class="fimp-stat ${c.review ? 'warn' : ''}"><span>Needs review</span><b>${c.review}</b><em>${c.skipped} skipped</em></div>
      </div>
      ${catEntries.length ? `<div class="fimp-cats">${catEntries.map(([k, v]) => `<button class="fimp-catchip" onclick="fimpSearch('${esc(k).replace(/'/g, '&#39;')}')"><span>${esc(k)}</span><b>${inr(v)}</b><i style="width:${Math.max(6, Math.round(v / max * 100))}%"></i></button>`).join('')}</div>` : ''}
      <div class="fimp-bar">
        <div class="fimp-tabs">${tabs.map(([k, l, n]) => `<button class="${S.filter === k ? 'on' : ''}" onclick="fimpFilter('${k}')">${l}<em>${n}</em></button>`).join('')}</div>
        <div class="fimp-search">${ic('search')}<input id="fimpQ" type="search" placeholder="Search payee, category, amount" value="${esc(S.q)}" oninput="fimpSearch(this.value, true)"></div>
      </div>
      <datalist id="fimpCats">${allCats.map(k => `<option value="${esc(k)}">`).join('')}</datalist>
      <div class="fimp-list">${rows.length ? rows.map(rowHTML).join('') : `<div class="fimp-empty">${S.filter === 'review' ? '🎉 Nothing left to review.' : 'Nothing here.'}</div>`}</div>
      <div class="fimp-foot">
        <div class="fimp-foot-l">${missing ? `<span class="fimp-warn">${ic('alert-triangle')} ${missing} ticked ${missing === 1 ? 'row has' : 'rows have'} no category — ${missing === 1 ? 'it' : 'they'}'ll be saved as Uncategorized</span>` : `<span class="fimp-ok">${ic('check-circle-2')} Every row has a category</span>`}</div>
        <div class="fimp-foot-r"><button class="fimp-btn ghost" onclick="fimpClose()">Cancel</button>
          <button class="fimp-btn primary" id="fimpGo" ${c.imp.length ? '' : 'disabled'} onclick="fimpImport()">Import ${c.imp.length} expense${c.imp.length === 1 ? '' : 's'} · ${inr(c.total)}</button></div>
      </div>`);
    const l = document.querySelector('.fimp-list'); if (l) l.scrollTop = sc;
  }

  /* ── Actions ───────────────────────────────────────────────────────── */
  window.fimpOpen = function () { S = null; renderUpload(); };
  window.fimpRestart = function () { S = null; renderUpload(); };
  window.fimpClose = function () {
    if (S && S.saving) return;
    document.getElementById('fimpRoot')?.remove(); document.body.classList.remove('fimp-open'); S = null;
  };
  window.fimpPick = async function (file) {
    if (!file) return;
    shell(`<div class="fimp-body fimp-loading"><div class="fimp-spin"></div><div>Reading ${esc(file.name)}…</div></div>`);
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', raw: false });
      const { rows, period } = parseSheet(XLSX, wb);
      if (!rows.length) throw new Error('No transactions found in this file.');
      S = { file: file.name, period, rows: classify(rows), filter: 'import', q: '', saving: false };
      if (!S.rows.some(r => !r.skip)) S.filter = 'all';
      renderReview();
    } catch (e) { console.error(e); renderUpload(e.message || String(e)); }
  };
  window.fimpFilter = function (f) { S.filter = f; renderReview(); };
  let qT = null;
  window.fimpSearch = function (q, typing) {
    S.q = q; clearTimeout(qT);
    if (!typing) { if (S.filter === 'skipped') S.filter = 'import'; return renderReview(); }
    qT = setTimeout(() => { renderReview(); const el = document.getElementById('fimpQ'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 220);
  };
  window.fimpToggle = function (i, on) { S.rows[i].on = on; renderReview(); };
  window.fimpSet = function (i, field, val) {
    const r = S.rows[i]; val = String(val).trim();
    if (field === 'label') { r.label = val || r.label; return; }
    if (field === 'note') { r.note = val; return; }
    r[field] = val; r.src = 'you'; r.touched = true;
    if (field === 'cat' && val) {
      r.on = true;
      if (!r.touched_scope) r.scope = scopeFor(val, r.amount);
    }
    if (field === 'scope') r.touched_scope = true;
    // Same payee, not hand-edited yet → follow along, and remember the rule.
    let n = 0;
    S.rows.forEach(x => { if (x !== r && !x.skip && !x.touched && x.key === r.key && !REF_DECISIONS[x.ref]) { x[field] = val; if (field === 'cat') { x.src = 'rule'; if (!x.dup) x.on = true; } n++; } });
    const rule = {}; rule[field] = val; saveRule(r.key, rule);
    renderReview();
    if (n) toast(`Also applied to ${n} more from ${r.label}`);
  };
  window.fimpNote = function (i) { S.rows[i].showNote = true; renderReview(); const el = document.getElementById('fimpNote' + i); if (el) el.focus(); };
  window.fimpSkip = function (i) {
    const r = S.rows[i];
    const why = prompt(`Why isn't "${r.label}" ${inr2(r.amount)} an expense?`, 'Transfer / not spending');
    if (why === null) return;
    r.skip = why || 'Not an expense'; r.on = false; r.src = 'you';
    if (confirm(`Always skip payments to ${r.label}?`)) saveRule(r.key, { skip: r.skip });
    renderReview();
  };
  window.fimpUnskip = function (i) {
    const r = S.rows[i]; r.skip = ''; r.on = true; r.dup = ''; r.src = 'you'; r.touched = true;
    saveRule(r.key, { skip: '' });
    if (S.filter === 'skipped') S.filter = 'import';
    renderReview();
  };
  window.fimpImport = async function () {
    const list = picked();
    if (!list.length || S.saving) return;
    S.saving = true;
    const btn = document.getElementById('fimpGo');
    let done = 0; const failed = [];
    const upd = () => { if (btn) { btn.disabled = true; btn.innerHTML = `<span class="fimp-spin sm"></span> Saving ${done} of ${list.length}…`; } };
    upd();
    const created = [];
    let next = 0;
    async function worker() {
      while (next < list.length) {
        const r = list[next++];
        const payload = {
          type: 'expense', amount: Math.round(r.amount * 100) / 100, date: iso(r.date),
          category: r.cat || 'Uncategorized', budget_scope: r.scope === 'weekly' ? 'weekly' : 'monthly',
          description: r.note && r.note !== r.label && r.note !== r.cat ? `${r.label} — ${r.note}` : r.label
        };
        try {
          const res = await apiCall('create', 'expenses', payload);
          created.push(Object.assign({ id: res?.id || res?.data?.id }, payload, res?.data || {}));
        } catch (e) { console.error('import row failed', r, e); failed.push(r); }
        done++; upd();
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    S.saving = false;
    try {
      if (window.state?.data) state.data.expenses = (state.data.expenses || []).concat(created.filter(x => x.id));
    } catch (e) { }
    const ok = list.length - failed.length;
    if (failed.length) {
      failed.forEach(r => { r.on = true; });
      list.filter(r => !failed.includes(r)).forEach(r => { r.skip = 'Imported just now'; r.on = false; });
      renderReview();
      toast(`Imported ${ok}; ${failed.length} failed — they're still ticked, try again`);
      return;
    }
    shell(`<div class="fimp-body fimp-done">
      <div class="fimp-done-ic">${ic('check')}</div>
      <div class="fimp-title">Imported ${ok} expenses</div>
      <div class="fimp-sub">${inr(list.reduce((s, r) => s + r.amount, 0))} added to Finance · ${inr(list.filter(r => r.scope === 'weekly').reduce((s, r) => s + r.amount, 0))} weekly, ${inr(list.filter(r => r.scope !== 'weekly').reduce((s, r) => s + r.amount, 0))} monthly</div>
      <div class="fimp-done-btns"><button class="fimp-btn ghost" onclick="fimpRestart()">Import another</button><button class="fimp-btn primary" onclick="fimpClose()">Done</button></div>
    </div>`);
    if (typeof refreshData === 'function') refreshData('finance');
    else if (typeof renderFinanceContent === 'function') renderFinanceContent();
  };

  /* expose for testing */
  window._fimp = { parseSheet, classify, splitPayee, state: () => S };

  const CSS = `
body.fimp-open { overflow:hidden; }
#fimpRoot { position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center; }
.fimp-backdrop { position:absolute; inset:0; background:rgba(15,23,42,.45); backdrop-filter:blur(3px); }
.fimp { position:relative; width:min(1100px, calc(100vw - 32px)); height:min(860px, calc(100vh - 32px)); background:var(--surface-1,#fff); color:var(--text-1,#111827); border:1px solid var(--border-color,#e5e7eb); border-radius:18px; box-shadow:0 24px 64px rgba(15,23,42,.28); display:flex; flex-direction:column; overflow:hidden; font-size:14px; }
#fimpRoot input { margin:0; min-height:0; height:auto; box-shadow:none; }
.fimp-ic { width:16px; height:16px; flex-shrink:0; }
.fimp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px 22px 14px; border-bottom:1px solid var(--border-color,#e5e7eb); }
.fimp-head-r { display:flex; gap:8px; align-items:center; }
.fimp-title { font-size:18px; font-weight:700; letter-spacing:-.01em; }
.fimp-sub { font-size:12.5px; color:var(--text-3,#6b7280); margin-top:3px; }
.fimp-x { width:34px; height:34px; border-radius:9px; border:1px solid var(--border-color,#e5e7eb); background:var(--surface-1,#fff); color:var(--text-2,#374151); display:grid; place-items:center; cursor:pointer; }
.fimp-x:hover { background:var(--surface-2,#f3f4f6); }
.fimp-body { flex:1; overflow:auto; padding:22px; }
.fimp-upbody { display:flex; flex-direction:column; gap:18px; max-width:760px; width:100%; margin:0 auto; }
.fimp-drop { border:2px dashed var(--border-strong,#cbd5e1); border-radius:16px; padding:46px 20px; text-align:center; cursor:pointer; background:var(--surface-2,#f8fafc); transition:border-color .15s, background .15s; display:block; }
.fimp-drop:hover, .fimp-drop.on { border-color:var(--primary,#4f46e5); background:color-mix(in srgb, var(--primary,#4f46e5) 6%, var(--surface-1,#fff)); }
.fimp-drop-ic { width:54px; height:54px; border-radius:14px; margin:0 auto 12px; display:grid; place-items:center; background:color-mix(in srgb, var(--primary,#4f46e5) 12%, transparent); color:var(--primary,#4f46e5); }
.fimp-drop-ic .fimp-ic { width:26px; height:26px; }
.fimp-drop-t { font-size:16px; font-weight:650; }
.fimp-drop-t u { color:var(--primary,#4f46e5); text-decoration:none; }
.fimp-drop-s { font-size:12.5px; color:var(--text-3,#6b7280); margin-top:5px; }
.fimp-err { display:flex; gap:8px; align-items:center; padding:11px 14px; border-radius:11px; background:#FEF3F2; color:#B42318; font-size:13px; }
.fimp-how { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.fimp-how-i { display:flex; gap:10px; padding:14px; border:1px solid var(--border-color,#e5e7eb); border-radius:13px; background:var(--surface-1,#fff); }
.fimp-how-i b { width:24px; height:24px; border-radius:50%; background:var(--surface-3,#e5e7eb); display:grid; place-items:center; font-size:12px; flex-shrink:0; }
.fimp-how-i strong { display:block; font-size:13px; margin-bottom:3px; }
.fimp-how-i span { font-size:12px; color:var(--text-3,#6b7280); line-height:1.45; }
.fimp-priv { display:flex; gap:7px; align-items:center; justify-content:center; font-size:12px; color:var(--text-3,#6b7280); }
.fimp-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:var(--text-3,#6b7280); }
.fimp-spin { width:28px; height:28px; border-radius:50%; border:3px solid var(--surface-3,#e5e7eb); border-top-color:var(--primary,#4f46e5); animation:fimpSpin .8s linear infinite; display:inline-block; }
.fimp-spin.sm { width:14px; height:14px; border-width:2px; vertical-align:-2px; border-color:rgba(255,255,255,.4); border-top-color:#fff; }
@keyframes fimpSpin { to { transform:rotate(360deg); } }
.fimp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:14px 22px 0; }
.fimp-stat { border:1px solid var(--border-color,#e5e7eb); border-radius:12px; padding:10px 13px; background:var(--surface-1,#fff); }
.fimp-stat span { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-3,#6b7280); font-weight:650; }
.fimp-stat b { display:block; font-size:20px; font-weight:750; letter-spacing:-.02em; margin-top:3px; font-variant-numeric:tabular-nums; }
.fimp-stat em { font-style:normal; font-size:11.5px; color:var(--text-3,#6b7280); }
.fimp-stat.warn b { color:#B54708; }
.fimp-cats { display:flex; gap:7px; padding:12px 22px 0; overflow-x:auto; scrollbar-width:none; }
.fimp-cats::-webkit-scrollbar { display:none; }
.fimp-catchip { position:relative; flex-shrink:0; display:flex; gap:7px; align-items:baseline; border:1px solid var(--border-color,#e5e7eb); background:var(--surface-1,#fff); border-radius:999px; padding:6px 12px 8px; font-size:12px; color:var(--text-2,#374151); cursor:pointer; overflow:hidden; }
.fimp-catchip b { color:var(--text-1,#111827); font-variant-numeric:tabular-nums; }
.fimp-catchip i { position:absolute; left:0; bottom:0; height:3px; background:var(--primary,#4f46e5); opacity:.55; }
.fimp-bar { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 22px; border-bottom:1px solid var(--border-color,#e5e7eb); flex-wrap:wrap; }
.fimp-tabs { display:inline-flex; background:var(--surface-2,#f3f4f6); border:1px solid var(--border-color,#e5e7eb); border-radius:10px; padding:3px; gap:2px; }
.fimp-tabs button { border:none; background:transparent; padding:6px 11px; border-radius:7px; font-size:12.5px; font-weight:600; color:var(--text-3,#6b7280); cursor:pointer; display:inline-flex; gap:6px; align-items:center; white-space:nowrap; }
.fimp-tabs button em { font-style:normal; font-size:11px; background:var(--surface-3,#e5e7eb); color:var(--text-2,#374151); border-radius:999px; padding:0 6px; min-width:18px; text-align:center; }
.fimp-tabs button.on { background:var(--surface-1,#fff); color:var(--text-1,#111827); box-shadow:var(--shadow-xs, 0 1px 2px rgba(0,0,0,.06)); }
.fimp-search { display:flex; align-items:center; gap:7px; border:1px solid var(--border-color,#e5e7eb); border-radius:10px; padding:0 10px; background:var(--surface-1,#fff); color:var(--text-3,#6b7280); min-width:240px; }
.fimp-search input { border:none !important; outline:none; background:transparent !important; box-shadow:none !important; padding:8px 0 !important; font:inherit; font-size:13px; color:var(--text-1,#111827); width:100%; }
.fimp-list { flex:1; overflow:auto; padding:8px 14px 14px; }
.fimp-row { display:grid; grid-template-columns:28px 58px minmax(0,1fr) 300px 104px; gap:12px; align-items:center; padding:8px 10px; border-radius:12px; border:1px solid transparent; }
.fimp-row + .fimp-row { border-top-color:var(--border-color,#eef0f3); border-top-left-radius:0; border-top-right-radius:0; }
.fimp-row:hover { background:var(--surface-2,#f8fafc); }
.fimp-row.is-need { background:color-mix(in srgb, #F79009 6%, transparent); }
.fimp-row.is-off .fimp-who, .fimp-row.is-off .fimp-amt, .fimp-row.is-off .fimp-ctl { opacity:.5; }
.fimp-row.is-skip { opacity:.72; }
.fimp-ck input { position:absolute; opacity:0; pointer-events:none; }
.fimp-ck { position:relative; display:block; width:20px; height:20px; cursor:pointer; }
.fimp-ck span { position:absolute; inset:0; border-radius:6px; border:1.5px solid var(--border-strong,#cbd5e1); background:var(--surface-1,#fff); transition:all .12s; }
.fimp-ck input:checked + span { background:var(--primary,#4f46e5); border-color:var(--primary,#4f46e5); }
.fimp-ck input:checked + span::after { content:''; position:absolute; left:6px; top:2px; width:5px; height:10px; border:solid #fff; border-width:0 2px 2px 0; transform:rotate(45deg); }
.fimp-date { font-size:12.5px; color:var(--text-3,#6b7280); font-variant-numeric:tabular-nums; white-space:nowrap; }
.fimp-who { min-width:0; }
.fimp-lbl { display:block; width:100%; font:inherit; font-weight:650; font-size:14px; line-height:1.3; color:var(--text-1,#111827); border:1px solid transparent !important; background:transparent; border-radius:7px; padding:2px 6px !important; margin-left:-6px !important; }
.fimp-lbl:not(.ro):hover, .fimp-note:hover { border-color:var(--border-color,#e5e7eb) !important; }
.fimp-lbl:focus, .fimp-note:focus { border-color:var(--primary,#4f46e5) !important; }
.fimp-lbl.ro { padding-left:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fimp-lbl:not(.ro):hover, .fimp-note:hover { border-color:var(--border-color,#e5e7eb); }
.fimp-lbl:focus, .fimp-note:focus { outline:none; border-color:var(--primary,#4f46e5); background:var(--surface-1,#fff); }
.fimp-note { display:block; width:100%; font:inherit; font-size:12.5px; color:var(--text-2,#374151); border:1px solid transparent !important; background:transparent; border-radius:7px; padding:2px 6px !important; margin:2px 0 0 -6px !important; }
.fimp-note::placeholder { color:var(--text-3,#9ca3af); opacity:.7; }
.fimp-raw { font-size:11px; color:var(--text-3,#9ca3af); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-left:6px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
.fimp-mdate { display:none; }
.fimp-badges { display:flex; flex-wrap:wrap; gap:6px 10px; align-items:center; margin-top:3px; }
.fimp-badges:empty { display:none; }
.fimp-b { display:inline-flex; gap:4px; align-items:center; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; background:var(--surface-3,#eef0f3); color:var(--text-2,#374151); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fimp-b .fimp-ic { width:12px; height:12px; }
.fimp-b.need { background:#FEF0C7; color:#93370D; }
.fimp-b.warn { background:#FEF0C7; color:#93370D; }
.fimp-b.guess { background:color-mix(in srgb, var(--primary,#4f46e5) 10%, transparent); color:var(--primary,#4f46e5); }
.fimp-b.hist { background:#D1FADF; color:#05603A; }
.fimp-b.skip { background:var(--surface-3,#eef0f3); color:var(--text-3,#6b7280); }
.fimp-link { border:none; background:none; color:var(--primary,#4f46e5); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; padding:2px 0; }
.fimp-link.sm { font-size:11px; color:var(--text-3,#6b7280); font-weight:550; opacity:0; transition:opacity .12s; }
.fimp-row:hover .fimp-link.sm, .fimp-link.sm:focus { opacity:1; }
.fimp-ctl { display:flex; gap:8px; align-items:center; justify-content:flex-end; }
.fimp-cat { width:150px; font:inherit; font-size:13px; padding:7px 10px !important; border-radius:9px; border:1px solid var(--border-color,#e5e7eb); background:var(--surface-1,#fff); color:var(--text-1,#111827); }
.fimp-cat.empty { border-color:#F79009; background:#FFFAEB; }
.fimp-cat:focus { outline:none; border-color:var(--primary,#4f46e5); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary,#4f46e5) 18%, transparent); }
.fimp-seg { display:inline-flex; background:var(--surface-2,#f3f4f6); border:1px solid var(--border-color,#e5e7eb); border-radius:9px; padding:2px; }
.fimp-seg button { border:none; background:transparent; font:inherit; font-size:12px; font-weight:600; color:var(--text-3,#6b7280); padding:5px 9px; border-radius:7px; cursor:pointer; }
.fimp-seg button.on { background:var(--surface-1,#fff); color:var(--text-1,#111827); box-shadow:0 1px 2px rgba(0,0,0,.08); }
.fimp-amt { text-align:right; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
.fimp-amt.in { color:var(--success,#059669); }
.fimp-empty { text-align:center; padding:50px 0; color:var(--text-3,#6b7280); }
.fimp-foot { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px 22px; border-top:1px solid var(--border-color,#e5e7eb); background:var(--surface-1,#fff); flex-wrap:wrap; }
.fimp-foot-l { font-size:12.5px; }
.fimp-foot-r { display:flex; gap:8px; margin-left:auto; }
.fimp-warn { display:inline-flex; gap:6px; align-items:center; color:#B54708; }
.fimp-ok { display:inline-flex; gap:6px; align-items:center; color:var(--success,#059669); }
.fimp-btn { display:inline-flex; gap:7px; align-items:center; justify-content:center; font:inherit; font-size:13.5px; font-weight:650; border-radius:10px; padding:10px 16px; cursor:pointer; border:1px solid transparent; white-space:nowrap; }
.fimp-btn.sm { padding:7px 11px; font-size:12.5px; }
.fimp-btn.primary { background:var(--primary,#4f46e5); color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.1); }
.fimp-btn.primary:disabled { opacity:.6; cursor:default; }
.fimp-btn.ghost { background:var(--surface-1,#fff); color:var(--text-2,#374151); border-color:var(--border-color,#e5e7eb); }
.fimp-btn.ghost:hover { background:var(--surface-2,#f3f4f6); }
.fimp-done { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:8px; }
.fimp-done-ic { width:64px; height:64px; border-radius:50%; background:#D1FADF; color:#05603A; display:grid; place-items:center; margin-bottom:8px; }
.fimp-done-ic .fimp-ic { width:30px; height:30px; }
.fimp-done-btns { display:flex; gap:10px; margin-top:16px; }
@media (max-width: 760px) {
  #fimpRoot { align-items:stretch; }
  .fimp { width:100vw; height:100%; border-radius:0; border:none; }
  .fimp-head { padding:14px 16px 12px; padding-top:max(14px, env(safe-area-inset-top)); }
  .fimp-head .fimp-btn.sm { display:none; }
  .fimp-stats { grid-template-columns:repeat(2,1fr); padding:12px 16px 0; gap:8px; }
  .fimp-stat { padding:8px 11px; }
  .fimp-stat b { font-size:16px; }
  .fimp-stat em { display:none; }
  .fimp-cats { padding:10px 16px 0; }
  .fimp-bar { padding:10px 16px; }
  .fimp-tabs { width:100%; overflow-x:auto; }
  .fimp-search { min-width:0; width:100%; }
  .fimp-list { padding:6px 8px 10px; }
  .fimp-row { grid-template-columns:24px minmax(0,1fr) auto; grid-template-areas:"ck who amt" "ck ctl ctl"; gap:6px 10px; padding:12px 8px; }
  .fimp-row .fimp-ck { grid-area:ck; align-self:start; margin-top:4px; }
  .fimp-row .fimp-date { display:none; }
  .fimp-mdate { display:inline; font-family:inherit; font-weight:600; }
  .fimp-row .fimp-who { grid-area:who; }
  .fimp-row .fimp-amt { grid-area:amt; align-self:start; padding-top:3px; }
  .fimp-row .fimp-ctl { grid-area:ctl; justify-content:flex-start; }
  .fimp-row.is-skip .fimp-ctl:empty { display:none; }
  .fimp-cat { flex:1; width:auto; min-width:0; }
  .fimp-link.sm { opacity:1; }
  .fimp-how { grid-template-columns:1fr; }
  .fimp-foot { padding:12px 16px; padding-bottom:max(12px, env(safe-area-inset-bottom)); }
  .fimp-foot-l { width:100%; }
  .fimp-foot-r { width:100%; }
  .fimp-foot-r .fimp-btn.primary { flex:1; }
}
`;
})();
