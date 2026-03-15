/* ============================================================
   view-people.js — World-Class iPhone-First People View
   ============================================================ */

let peopleState = {
    view: 'grid',
    sortBy: 'overdue',
    filter: '',
    groupFilter: '',
    sheetPersonId: null,
    sheetMode: null, // 'profile' | 'add' | 'edit' | 'debt' | 'log' | 'contact'
};

/* ============================================================
   HELPERS
   ============================================================ */

function getPersonBalance(personId) {
    const debts = state.data.people_debts || [];
    return debts
        .filter(d => String(d.person_id) === String(personId))
        .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
}

function getRelativeTime(dateStr) {
    if (!dateStr) return 'Never';
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHrs < 24) return diffHrs + 'h ago';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + 'd ago';
    if (diffWeeks === 1) return '1 week ago';
    if (diffWeeks < 5) return diffWeeks + ' weeks ago';
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return diffMonths + ' months ago';
    return Math.floor(diffMonths / 12) + 'y ago';
}

function getDecayInfo(person) {
    if (!person.last_contact) {
        return { color: 'var(--pp-decay-none)', cssClass: 'decay-none', label: 'No history', pct: 0 };
    }
    const days = (new Date() - new Date(person.last_contact)) / 86400000;
    if (days <= 14) return { color: 'var(--pp-decay-active)', cssClass: 'decay-active', label: 'Active', pct: Math.max(20, 100 - (days / 14) * 30) };
    if (days <= 30) return { color: 'var(--pp-decay-fading)', cssClass: 'decay-fading', label: 'Fading', pct: Math.max(15, 70 - ((days - 14) / 16) * 40) };
    return { color: 'var(--pp-decay-risk)', cssClass: 'decay-risk', label: Math.floor(days) + 'd ago', pct: Math.max(5, 30 - Math.min(25, (days - 30) / 60 * 25)) };
}

function renderDecayRingSVG(pct, color, size) {
    const r = (size - 6) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    const cx = size / 2, cy = size / 2;
    return `<svg class="${size > 50 ? 'pp-sheet-avatar-ring' : 'pp-avatar-ring'}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle class="pp-avatar-ring-bg" cx="${cx}" cy="${cy}" r="${r}" />
        <circle class="pp-avatar-ring-fill" cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" />
    </svg>`;
}

function getContactStreak(person) {
    if (!person.notes) return 0;
    const matches = person.notes.match(/\[(\d{1,2}\/\d{1,2}\/\d{4})\]/g);
    if (!matches || matches.length < 2) return 0;
    const dates = matches.map(m => {
        const parts = m.replace(/[\[\]]/g, '').split('/');
        return new Date(parts[2], parts[0] - 1, parts[1]);
    }).sort((a, b) => b - a);

    let streak = 1;
    for (let i = 0; i < dates.length - 1; i++) {
        const diff = (dates[i] - dates[i + 1]) / 86400000;
        if (diff <= 10) streak++;
        else break;
    }
    return streak >= 2 ? streak : 0;
}

function parseInteractionHistory(notes) {
    if (!notes) return [];
    const lines = notes.split('\n');
    const entries = [];
    for (const line of lines) {
        const m = line.match(/^\[(\d{1,2}\/\d{1,2}\/\d{4})\]\s*(.*)/);
        if (m) entries.push({ date: m[1], note: m[2] || 'Interaction logged.' });
    }
    return entries.reverse();
}

function getNeedsAttention(people) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const nudges = [];

    for (const p of people) {
        // Overdue contact (30+ days)
        if (p.last_contact) {
            const days = (now - new Date(p.last_contact)) / 86400000;
            if (days >= 30) nudges.push({ person: p, type: 'overdue', days: Math.floor(days) });
        } else {
            nudges.push({ person: p, type: 'overdue', days: 999 });
        }
        // Birthday in next 7 days
        if (p.birthday) {
            const bday = new Date(p.birthday);
            const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
            if (thisYearBday < now) thisYearBday.setFullYear(now.getFullYear() + 1);
            const daysUntil = (thisYearBday - now) / 86400000;
            if (daysUntil <= 7 && daysUntil >= 0) nudges.push({ person: p, type: 'birthday', days: Math.floor(daysUntil) });
        }
        // Overdue next_interaction
        if (p.next_interaction && p.next_interaction < todayStr) {
            nudges.push({ person: p, type: 'next_overdue', days: Math.floor((now - new Date(p.next_interaction)) / 86400000) });
        }
    }
    // Sort: birthdays first, then overdue contact by days desc
    nudges.sort((a, b) => {
        if (a.type === 'birthday' && b.type !== 'birthday') return -1;
        if (b.type === 'birthday' && a.type !== 'birthday') return 1;
        return b.days - a.days;
    });
    return nudges.slice(0, 10);
}

function getUpcomingInteractions(people) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const in14 = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

    return people.filter(p => {
        if (!p.next_interaction) return false;
        // Keep if overdue or within next 14 days
        return p.next_interaction <= in14;
    }).sort((a, b) => a.next_interaction.localeCompare(b.next_interaction));
}

function getPeopleStats(people) {
    const now = new Date();
    let needsAttention = 0, upcomingBdays = 0, totalBalance = 0;
    for (const p of people) {
        const days = p.last_contact ? (now - new Date(p.last_contact)) / 86400000 : 999;
        if (days >= 30) needsAttention++;
        if (p.birthday) {
            const bday = new Date(p.birthday);
            const thisYear = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
            if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1);
            if ((thisYear - now) / 86400000 <= 7) upcomingBdays++;
        }
        totalBalance += Math.abs(getPersonBalance(p.id));
    }
    return { total: people.length, needsAttention, upcomingBdays, totalBalance };
}

function getAvatarGradient(name) {
    const gradients = [
        'linear-gradient(135deg, #6366f1, #4338ca)',
        'linear-gradient(135deg, #ec4899, #db2777)',
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)',
        'linear-gradient(135deg, #ef4444, #dc2626)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #f97316, #ea580c)',
    ];
    const hash = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
}

function getContactFreqDots(person) {
    const entries = parseInteractionHistory(person.notes);
    const weeks = [];
    const now = new Date();
    for (let i = 12; i >= 0; i--) {
        const weekStart = new Date(now.getTime() - i * 7 * 86400000);
        const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
        const hasContact = entries.some(e => {
            const parts = e.date.split('/');
            const d = new Date(parts[2], parts[0] - 1, parts[1]);
            return d >= weekStart && d < weekEnd;
        });
        weeks.push(hasContact);
    }
    return weeks;
}

/* ============================================================
   MAIN RENDER
   ============================================================ */

function renderPeople() {
    let people = (state.data.people || []).map(p => ({
        ...p,
        _balance: getPersonBalance(p.id)
    }));

    // Sort
    people.sort((a, b) => {
        const aFav = a.is_favorite === true || a.is_favorite === 'true';
        const bFav = b.is_favorite === true || b.is_favorite === 'true';
        if (aFav !== bFav) return aFav ? -1 : 1;
        switch (peopleState.sortBy) {
            case 'name': return (a.name || '').localeCompare(b.name || '');
            case 'overdue':
                const getDays = (d) => d ? (new Date() - new Date(d)) / 86400000 : 9999;
                return getDays(b.last_contact) - getDays(a.last_contact);
            case 'birthday':
                if (!a.birthday && !b.birthday) return 0;
                if (!a.birthday) return 1;
                if (!b.birthday) return -1;
                return a.birthday.localeCompare(b.birthday);
            case 'last_contact': return (b.last_contact || '').localeCompare(a.last_contact || '');
            case 'next_interaction':
                if (!a.next_interaction && !b.next_interaction) return 0;
                if (!a.next_interaction) return 1;
                if (!b.next_interaction) return -1;
                return a.next_interaction.localeCompare(b.next_interaction);
            default: return 0;
        }
    });

    // Filter by search
    if (peopleState.filter) {
        people = people.filter(p => (p.name || '').toLowerCase().includes(peopleState.filter.toLowerCase()));
    }

    // Filter by group or special mode
    if (peopleState.groupFilter) {
        if (peopleState.groupFilter === 'To Contact') {
            const upcoming = getUpcomingInteractions(people);
            const upcomingIds = upcoming.map(u => String(u.id));
            people = people.filter(p => upcomingIds.includes(String(p.id)));
        } else {
            people = people.filter(p => (p.relationship || 'Other') === peopleState.groupFilter);
        }
    }

    const upcoming = getUpcomingInteractions(state.data.people || []);
    const stats = getPeopleStats(state.data.people || []);
    const nudges = getNeedsAttention(state.data.people || []);
    const allPeople = state.data.people || [];
    const groups = ['All', 'To Contact', ...new Set(allPeople.map(p => p.relationship || 'Other'))];
    const groupCounts = {};
    allPeople.forEach(p => { const g = p.relationship || 'Other'; groupCounts[g] = (groupCounts[g] || 0) + 1; });
    groupCounts['To Contact'] = upcoming.length;

    // Birthday banner
    const todayMMDD = new Date().toISOString().slice(5, 10);
    const bdays = allPeople.filter(p => p.birthday && p.birthday.slice(5, 10) === todayMMDD);

    document.getElementById('main').innerHTML = `
    <div class="people-wrapper">

        <!-- Stats Strip -->
        <div class="pp-stats-strip">
            <div class="pp-stat-card" onclick="peopleState.sortBy='name'; renderPeople()">
                <div class="pp-stat-value">${stats.total}</div>
                <div class="pp-stat-label">All</div>
            </div>
            <div class="pp-stat-card" onclick="window.openConnectSoonSheet()">
                <div class="pp-stat-value" style="${upcoming.length > 0 ? 'color: var(--primary)' : ''}">${upcoming.length}</div>
                <div class="pp-stat-label">Soon</div>
            </div>
            <div class="pp-stat-card" onclick="window.openNeedsAttentionSheet()">
                <div class="pp-stat-value" style="${stats.needsAttention > 0 ? 'color: var(--danger)' : ''}">${stats.needsAttention}</div>
                <div class="pp-stat-label">Attn</div>
            </div>
            <div class="pp-stat-card" onclick="peopleState.sortBy='birthday'; renderPeople()">
                <div class="pp-stat-value" style="${stats.upcomingBdays > 0 ? 'color: var(--warning)' : ''}">${stats.upcomingBdays}</div>
                <div class="pp-stat-label">Bdays</div>
            </div>
            <div class="pp-stat-card">
                <div class="pp-stat-value" style="font-size: 14px;">${stats.totalBalance > 0 ? '₹' + Math.round(stats.totalBalance) : '—'}</div>
                <div class="pp-stat-label">Balance</div>
            </div>
        </div>

        <!-- Birthday Banner -->
        ${bdays.length > 0 ? `
        <div class="pp-birthday-banner">
            <div class="pp-birthday-icon">🎂</div>
            <div>
                <div class="pp-birthday-title">Birthday${bdays.length > 1 ? 's' : ''} Today!</div>
                <div class="pp-birthday-names">${bdays.map(p => p.name).join(', ')} — Don't forget to wish them!</div>
            </div>
        </div>` : ''}


        <!-- Controls Bar -->
        <div class="pp-controls-bar">
            <div class="pp-search">
                <i data-lucide="search" class="pp-search-icon"></i>
                <input type="text" placeholder="Search people..." value="${peopleState.filter}" oninput="peopleState.filter=this.value; renderPeople()">
            </div>
            <div class="pp-controls-right">
                <select class="pp-sort-select" onchange="peopleState.sortBy=this.value; renderPeople()">
                    <option value="overdue" ${peopleState.sortBy === 'overdue' ? 'selected' : ''}>Overdue</option>
                    <option value="name" ${peopleState.sortBy === 'name' ? 'selected' : ''}>Name</option>
                    <option value="birthday" ${peopleState.sortBy === 'birthday' ? 'selected' : ''}>Birthday</option>
                    <option value="last_contact" ${peopleState.sortBy === 'last_contact' ? 'selected' : ''}>Last Contact</option>
                    <option value="next_interaction" ${peopleState.sortBy === 'next_interaction' ? 'selected' : ''}>Next</option>
                </select>
                <div class="pp-view-tabs">
                    <button class="pp-view-tab ${peopleState.view === 'grid' ? 'active' : ''}" onclick="window.switchPeopleView('grid')">
                        <i data-lucide="layout-grid" style="width:18px;height:18px"></i>
                    </button>
                    <button class="pp-view-tab ${peopleState.view === 'timeline' ? 'active' : ''}" onclick="window.switchPeopleView('timeline')">
                        <i data-lucide="calendar" style="width:18px;height:18px"></i>
                    </button>
                </div>
                <button class="pp-add-btn" onclick="window.openPersonModal()">
                    <i data-lucide="plus" style="width:18px;height:18px"></i>
                    <span>Add</span>
                </button>
            </div>
        </div>

        <!-- Filter Chips -->
        <div class="pp-filter-chips">
            ${groups.map(g => `
                <button class="pp-chip ${g === 'All' ? (!peopleState.groupFilter ? 'active' : '') : (peopleState.groupFilter === g ? 'active' : '')}"
                    onclick="peopleState.groupFilter = '${g === 'All' ? '' : g}'; renderPeople()">
                    ${g} ${g !== 'All' ? `<span class="pp-chip-count">${groupCounts[g] || 0}</span>` : `<span class="pp-chip-count">${allPeople.length}</span>`}
                </button>
            `).join('')}
        </div>

        <!-- Content -->
        ${people.length === 0
            ? renderPeopleEmpty()
            : (peopleState.view === 'grid' ? renderPeopleGrid(people) : renderPeopleTimeline(people))
        }

        <!-- Bottom Sheet -->
        <div class="pp-sheet-overlay" id="ppSheetOverlay" onclick="closePeopleSheet()"></div>
        <div class="pp-sheet" id="ppSheet"></div>
    </div>`;

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

/* ============================================================
   CONNECT SOON BOTTOM SHEET
   ============================================================ */

window.openConnectSoonSheet = function () {
    const upcoming = getUpcomingInteractions(state.data.people || []);
    if (upcoming.length === 0) { showToast('No contacts scheduled soon.'); return; }

    const rows = upcoming.map(u => {
        const grad = getAvatarGradient(u.name);
        const initial = (u.name || '?').charAt(0).toUpperCase();
        const todayStr = new Date().toISOString().slice(0, 10);
        let dateLabel = '', isOverdue = false;

        if (u.next_interaction === todayStr) dateLabel = 'Today';
        else if (u.next_interaction < todayStr) { dateLabel = 'Overdue'; isOverdue = true; }
        else {
            const days = Math.floor((new Date(u.next_interaction) - new Date()) / 86400000);
            dateLabel = days === 0 ? 'Tomorrow' : `In ${days + 1} days`;
        }

        return `
        <div class="pp-attn-row" onclick="closePeopleSheet(); setTimeout(() => window.openPersonSheet('${u.id}'), 350)">
            <div class="pp-attn-avatar" style="background:${grad}">${initial}</div>
            <div class="pp-attn-info">
                <div class="pp-attn-name">${u.name}</div>
                <div class="pp-attn-reason" style="${isOverdue ? 'color:var(--danger)' : ''}">${dateLabel}</div>
            </div>
            <button class="pp-attn-action" onclick="event.stopPropagation(); closePeopleSheet(); setTimeout(() => window.logContact('${u.id}'), 350)">Log</button>
        </div>`;
    }).join('');

    const html = `
        <div style="padding: 8px 16px 0;">
            <div style="font-size:17px; font-weight:800; color:var(--text-1);">Connect Soon</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Scheduled interactions for coming days</div>
        </div>
        <div class="pp-sheet-body" style="padding-top:12px;">
            ${rows}
        </div>`;
    openPeopleSheet(html);
};

/* ============================================================
   NEEDS ATTENTION BOTTOM SHEET
   ============================================================ */

window.openNeedsAttentionSheet = function () {
    const nudges = getNeedsAttention(state.data.people || []);
    if (nudges.length === 0) { showToast('Everyone is up to date!'); return; }

    const rows = nudges.map(n => {
        const p = n.person;
        const grad = getAvatarGradient(p.name);
        const initial = (p.name || '?').charAt(0).toUpperCase();
        let reason = '', actionLabel = '', actionFn = '';
        if (n.type === 'birthday') {
            reason = n.days === 0 ? 'Birthday today!' : `Birthday in ${n.days}d`;
            actionLabel = 'Wish';
            actionFn = `window.openContactOptions('${p.id}')`;
        } else if (n.type === 'overdue') {
            reason = n.days === 999 ? 'Never contacted' : `${n.days}d no contact`;
            actionLabel = 'Log';
            actionFn = `window.logContact('${p.id}')`;
        } else {
            reason = `Overdue ${n.days}d`;
            actionLabel = 'Log';
            actionFn = `window.logContact('${p.id}')`;
        }
        return `
        <div class="pp-attn-row">
            <div class="pp-attn-avatar" style="background:${grad}">${initial}</div>
            <div class="pp-attn-info">
                <div class="pp-attn-name">${p.name}</div>
                <div class="pp-attn-reason">${reason}</div>
            </div>
            <button class="pp-attn-action" onclick="event.stopPropagation(); closePeopleSheet(); setTimeout(() => ${actionFn}, 350)">${actionLabel}</button>
        </div>`;
    }).join('');

    const html = `
        <div style="padding: 8px 16px 0;">
            <div style="font-size:17px; font-weight:800; color:var(--text-1);">Needs Attention</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${nudges.length} people need a catch-up</div>
        </div>
        <div class="pp-sheet-body" style="padding-top:12px;">
            ${rows}
        </div>`;
    openPeopleSheet(html);
};

/* ============================================================
   PERSON CARDS — GRID
   ============================================================ */

function renderPeopleGrid(people) {
    return `<div class="pp-card-grid">
        ${people.map((p, i) => renderPersonCard(p, i)).join('')}
    </div>`;
}

function renderPersonCard(p, index) {
    const decay = getDecayInfo(p);
    const streak = getContactStreak(p);
    const isFav = p.is_favorite === true || p.is_favorite === 'true';
    const balance = p._balance || 0;
    const grad = getAvatarGradient(p.name);
    const initial = (p.name || '?').charAt(0).toUpperCase();

    return `
    <div class="pp-card" onclick="window.openPersonSheet('${p.id}')" style="animation-delay:${Math.min(index * 0.04, 0.3)}s">
        <div class="pp-card-top">
            <div class="pp-avatar-wrap">
                ${renderDecayRingSVG(decay.pct, decay.color, 46)}
                <div class="pp-avatar" style="background:${grad}">${initial}</div>
            </div>
            <div class="pp-card-info">
                <div class="pp-card-name-row">
                    <div class="pp-card-name">
                        ${p.name}
                        <svg class="pp-fav-star ${isFav ? 'is-fav' : ''}" onclick="event.stopPropagation(); window.toggleFavoritePerson('${p.id}', ${!isFav})" viewBox="0 0 24 24" width="16" height="16" fill="${isFav ? '#F59E0B' : 'none'}" stroke="${isFav ? '#F59E0B' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                    <div class="pp-card-quick-actions" onclick="event.stopPropagation()">
                        <button class="pp-icon-btn" onclick="window.openContactOptions('${p.id}')" title="Contact">
                            <i data-lucide="phone"></i>
                        </button>
                        <button class="pp-icon-btn" onclick="window.logContact('${p.id}')" title="Log">
                            <i data-lucide="message-circle"></i>
                        </button>
                        <button class="pp-icon-btn" onclick="window.openDebtModal('${p.id}')" title="Money">
                             <i data-lucide="indian-rupee"></i>
                        </button>
                    </div>
                </div>
                <div class="pp-card-meta">
                    <span class="pp-rel-badge">${p.relationship || 'Contact'}</span>
                    <span class="pp-last-contact ${decay.cssClass}">
                        ${getRelativeTime(p.last_contact)}
                    </span>
                    ${streak >= 2 ? `<span class="pp-streak">🔥 ${streak}</span>` : ''}
                    ${balance !== 0 ? `<span class="pp-balance-badge ${balance > 0 ? 'positive' : 'negative'}" style="margin-left:auto">${balance > 0 ? '+' : ''}₹${Math.abs(Math.round(balance))}</span>` : ''}
                </div>
            </div>
        </div>
    </div>`;
}

/* ============================================================
   TIMELINE VIEW
   ============================================================ */

function renderPeopleTimeline(people) {
    const today = new Date().toISOString().slice(0, 10);
    const withDates = people.filter(p => p.next_interaction).sort((a, b) => (a.next_interaction || '').localeCompare(b.next_interaction || ''));
    const withoutDates = people.filter(p => !p.next_interaction);

    let html = '';
    if (withDates.length > 0) {
        const grouped = {};
        withDates.forEach(p => {
            const key = new Date(p.next_interaction).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(p);
        });

        html += '<div class="pp-timeline">';
        for (const month of Object.keys(grouped)) {
            html += `<div class="pp-timeline-month">${month}</div>`;
            for (const p of grouped[month]) {
                const isOverdue = p.next_interaction < today;
                const isUpcoming = !isOverdue && new Date(p.next_interaction) <= new Date(Date.now() + 7 * 86400000);
                html += `
                <div class="pp-timeline-item ${isOverdue ? 'overdue' : (isUpcoming ? 'upcoming' : '')}" onclick="window.openPersonSheet('${p.id}')">
                    <div>
                        <div class="pp-timeline-name">${p.name}</div>
                        <div class="pp-timeline-rel">${p.relationship || 'Contact'}</div>
                    </div>
                    <div class="pp-timeline-date ${isOverdue ? 'overdue' : ''}">
                        ${new Date(p.next_interaction).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        ${isOverdue ? ' · Overdue' : ''}
                    </div>
                </div>`;
            }
        }
        html += '</div>';
    }

    if (withoutDates.length > 0) {
        html += `<div class="pp-timeline-month" style="margin-top:20px">No Date Set</div>`;
        html += '<div class="pp-timeline">';
        for (const p of withoutDates) {
            html += `
            <div class="pp-timeline-item" onclick="window.openPersonSheet('${p.id}')">
                <div>
                    <div class="pp-timeline-name">${p.name}</div>
                    <div class="pp-timeline-rel">${p.relationship || 'Contact'}</div>
                </div>
            </div>`;
        }
        html += '</div>';
    }

    return html || renderPeopleEmpty();
}

/* ============================================================
   EMPTY STATE
   ============================================================ */

function renderPeopleEmpty() {
    return `
    <div class="pp-empty">
        <div class="pp-empty-icon">👥</div>
        <div class="pp-empty-title">Your circle is empty</div>
        <div class="pp-empty-desc">Add your first contact to start tracking relationships, birthdays, and interactions.</div>
        <button class="pp-empty-btn" onclick="window.openPersonModal()">+ Add Person</button>
    </div>`;
}

/* ============================================================
   BOTTOM SHEET — CORE
   ============================================================ */

function openPeopleSheet(html) {
    const sheet = document.getElementById('ppSheet');
    const overlay = document.getElementById('ppSheetOverlay');
    if (!sheet || !overlay) return;
    sheet.innerHTML = `<div class="pp-sheet-handle"></div>` + html;
    requestAnimationFrame(() => {
        sheet.classList.add('open');
        overlay.classList.add('open');
    });
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        setTimeout(() => lucide.createIcons(), 50);
    }
}

function closePeopleSheet() {
    const sheet = document.getElementById('ppSheet');
    const overlay = document.getElementById('ppSheetOverlay');
    if (!sheet || !overlay) return;
    sheet.classList.remove('open');
    overlay.classList.remove('open');
    peopleState.sheetPersonId = null;
    peopleState.sheetMode = null;
    setTimeout(() => { sheet.innerHTML = ''; }, 400);
}
window.closePeopleSheet = closePeopleSheet;

/* ============================================================
   BOTTOM SHEET — PERSON PROFILE
   ============================================================ */

window.openPersonSheet = function (id) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (!p) return;
    peopleState.sheetPersonId = id;
    peopleState.sheetMode = 'profile';

    const decay = getDecayInfo(p);
    const balance = getPersonBalance(id);
    const isFav = p.is_favorite === true || p.is_favorite === 'true';
    const grad = getAvatarGradient(p.name);
    const initial = (p.name || '?').charAt(0).toUpperCase();
    const streak = getContactStreak(p);
    const history = parseInteractionHistory(p.notes);
    const freqDots = getContactFreqDots(p);
    const debts = (state.data.people_debts || []).filter(d => String(d.person_id) === String(id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Contact chips
    let chips = '';
    if (p.phone) chips += `<a class="pp-contact-chip" href="tel:${p.phone}"><i data-lucide="phone" style="width:14px;height:14px"></i> ${p.phone}</a>`;
    if (p.email) chips += `<a class="pp-contact-chip" href="mailto:${p.email}"><i data-lucide="mail" style="width:14px;height:14px"></i> ${p.email}</a>`;
    if (p.birthday) chips += `<span class="pp-contact-chip"><i data-lucide="cake" style="width:14px;height:14px"></i> ${new Date(p.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;
    if (p.next_interaction) chips += `<span class="pp-contact-chip"><i data-lucide="calendar" style="width:14px;height:14px"></i> Next: ${new Date(p.next_interaction).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;

    const html = `
        <div class="pp-sheet-header" style="position:relative">
            <div class="pp-sheet-avatar-wrap">
                ${renderDecayRingSVG(decay.pct, decay.color, 62)}
                <div class="pp-sheet-avatar" style="background:${grad}">${initial}</div>
            </div>
            <div>
                <div class="pp-sheet-name">
                    ${p.name}
                    ${streak >= 2 ? `<span class="pp-streak" style="margin-left:8px">🔥 ${streak}</span>` : ''}
                </div>
                <div class="pp-sheet-rel">${p.relationship || 'Contact'} · Last contact ${getRelativeTime(p.last_contact)}</div>
            </div>
            <button class="pp-sheet-close" onclick="closePeopleSheet()">
                <i data-lucide="x" style="width:18px;height:18px"></i>
            </button>
        </div>

        ${chips ? `<div class="pp-sheet-chips">${chips}</div>` : ''}

        <div class="pp-sheet-body">
            <!-- Contact Frequency -->
            <div class="pp-sheet-section">
                <div class="pp-sheet-section-title">Contact Frequency (13 Weeks)</div>
                <div class="pp-freq-dots">
                    ${freqDots.map(active => `<div class="pp-freq-dot ${active ? 'active' : ''}"></div>`).join('')}
                </div>
            </div>

            <!-- Debt Summary -->
            ${balance !== 0 || debts.length > 0 ? `
            <div class="pp-sheet-section">
                <div class="pp-sheet-section-title">Money</div>
                <div class="pp-debt-summary">
                    <div class="pp-debt-amount ${balance > 0 ? 'positive' : (balance < 0 ? 'negative' : 'zero')}">
                        ${balance > 0 ? '+' : ''}₹${Math.abs(Math.round(balance))}
                    </div>
                    <div class="pp-debt-label">${balance > 0 ? 'They owe you' : (balance < 0 ? 'You owe them' : 'Settled')}</div>
                </div>
                ${debts.slice(0, 5).map(d => `
                <div class="pp-debt-item">
                    <span>${d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}${d.notes ? ' · ' + d.notes : ''}</span>
                    <span class="pp-debt-item-amount ${parseFloat(d.amount) > 0 ? 'positive' : 'negative'}">${parseFloat(d.amount) > 0 ? '+' : ''}₹${Math.abs(parseFloat(d.amount))}</span>
                </div>`).join('')}
            </div>` : ''}

            <!-- Interaction History -->
            ${history.length > 0 ? `
            <div class="pp-sheet-section">
                <div class="pp-sheet-section-title">History</div>
                ${history.slice(0, 10).map(h => `
                <div class="pp-history-item">
                    <div class="pp-history-dot"></div>
                    <div>
                        <div class="pp-history-date">${h.date}</div>
                        <div class="pp-history-note">${h.note}</div>
                    </div>
                </div>`).join('')}
            </div>` : ''}

            <!-- Notes (non-log) -->
            ${p.notes && !p.notes.startsWith('[') ? `
            <div class="pp-sheet-section">
                <div class="pp-sheet-section-title">Notes</div>
                <div style="font-size:14px; color:var(--text-1); line-height:1.5; white-space:pre-wrap;">${p.notes}</div>
            </div>` : ''}
        </div>

        <div class="pp-sheet-actions">
            <button class="pp-sheet-action-btn action-log" onclick="closePeopleSheet(); setTimeout(() => window.logContact('${p.id}'), 400)">
                <i data-lucide="message-circle" style="width:20px;height:20px"></i>
                Log
            </button>
            <button class="pp-sheet-action-btn action-money" onclick="closePeopleSheet(); setTimeout(() => window.openDebtModal('${p.id}'), 400)">
                <i data-lucide="indian-rupee" style="width:20px;height:20px"></i>
                Money
            </button>
            <button class="pp-sheet-action-btn action-edit" onclick="closePeopleSheet(); setTimeout(() => window.openEditPerson('${p.id}'), 400)">
                <i data-lucide="pencil" style="width:20px;height:20px"></i>
                Edit
            </button>
            <button class="pp-sheet-action-btn action-delete" onclick="closePeopleSheet(); setTimeout(() => window.deletePerson('${p.id}'), 400)">
                <i data-lucide="trash-2" style="width:20px;height:20px"></i>
                Delete
            </button>
        </div>`;

    openPeopleSheet(html);
};

/* ============================================================
   CONTACT OPTIONS SHEET (Call / Message / WhatsApp / Instagram)
   ============================================================ */

window.openContactOptions = function (id) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (!p) return;
    peopleState.sheetMode = 'contact';

    const grad = getAvatarGradient(p.name);
    const initial = (p.name || '?').charAt(0).toUpperCase();
    const phone = String(p.phone || '').replace(/[\s\-()]/g, '');
    const hasPhone = phone.length > 0;
    const hasEmail = !!(String(p.email || '').trim());

    // Build contact options
    let options = '';

    // Call
    options += `
    <a class="pp-contact-option" ${hasPhone ? `href="tel:${phone}"` : 'style="opacity:0.4; pointer-events:none;"'}>
        <div class="pp-contact-option-icon" style="background: linear-gradient(135deg, #10B981, #059669);">
            <i data-lucide="phone" style="width:22px;height:22px;color:white"></i>
        </div>
        <div class="pp-contact-option-info">
            <div class="pp-contact-option-title">Call</div>
            <div class="pp-contact-option-sub">${hasPhone ? phone : 'No phone number'}</div>
        </div>
        <i data-lucide="chevron-right" style="width:18px;height:18px;color:var(--text-muted)"></i>
    </a>`;

    // Message (SMS)
    options += `
    <a class="pp-contact-option" ${hasPhone ? `href="sms:${phone}"` : 'style="opacity:0.4; pointer-events:none;"'}>
        <div class="pp-contact-option-icon" style="background: linear-gradient(135deg, #6366f1, #4338ca);">
            <i data-lucide="message-square" style="width:22px;height:22px;color:white"></i>
        </div>
        <div class="pp-contact-option-info">
            <div class="pp-contact-option-title">Message</div>
            <div class="pp-contact-option-sub">${hasPhone ? 'Send SMS' : 'No phone number'}</div>
        </div>
        <i data-lucide="chevron-right" style="width:18px;height:18px;color:var(--text-muted)"></i>
    </a>`;

    // WhatsApp
    options += `
    <a class="pp-contact-option" ${hasPhone ? `href="https://wa.me/${phone.replace('+', '')}" target="_blank"` : 'style="opacity:0.4; pointer-events:none;"'}>
        <div class="pp-contact-option-icon" style="background: linear-gradient(135deg, #25D366, #128C7E);">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </div>
        <div class="pp-contact-option-info">
            <div class="pp-contact-option-title">WhatsApp</div>
            <div class="pp-contact-option-sub">${hasPhone ? 'Open chat' : 'No phone number'}</div>
        </div>
        <i data-lucide="chevron-right" style="width:18px;height:18px;color:var(--text-muted)"></i>
    </a>`;

    // Instagram
    options += `
    <a class="pp-contact-option" ${p.instagram ? `href="https://instagram.com/${p.instagram.replace('@', '')}" target="_blank"` : 'style="opacity:0.4; pointer-events:none;"'}>
        <div class="pp-contact-option-icon" style="background: linear-gradient(135deg, #E1306C, #C13584, #833AB4);">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        </div>
        <div class="pp-contact-option-info">
            <div class="pp-contact-option-title">Instagram</div>
            <div class="pp-contact-option-sub">${p.instagram ? '@' + p.instagram.replace('@', '') : 'Not set'}</div>
        </div>
        <i data-lucide="chevron-right" style="width:18px;height:18px;color:var(--text-muted)"></i>
    </a>`;

    // Email
    options += `
    <a class="pp-contact-option" ${hasEmail ? `href="mailto:${p.email}"` : 'style="opacity:0.4; pointer-events:none;"'}>
        <div class="pp-contact-option-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
            <i data-lucide="mail" style="width:22px;height:22px;color:white"></i>
        </div>
        <div class="pp-contact-option-info">
            <div class="pp-contact-option-title">Email</div>
            <div class="pp-contact-option-sub">${hasEmail ? p.email : 'Not set'}</div>
        </div>
        <i data-lucide="chevron-right" style="width:18px;height:18px;color:var(--text-muted)"></i>
    </a>`;

    const html = `
        <div style="padding: 16px 20px 8px;">
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:4px;">
                <div class="pp-nudge-avatar" style="background:${grad}; width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:white;">${initial}</div>
                <div>
                    <div style="font-size:20px; font-weight:800; color:var(--text-1);">Contact ${p.name}</div>
                    <div style="font-size:13px; color:var(--text-muted);">Choose how to reach out</div>
                </div>
            </div>
        </div>
        <div style="padding: 8px 20px 20px; padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)); display:flex; flex-direction:column; gap:8px;">
            ${options}
        </div>`;

    openPeopleSheet(html);
};

/* ============================================================
   FORM SHEETS — ADD / EDIT PERSON
   ============================================================ */

window.openPersonModal = function () {
    peopleState.sheetMode = 'add';
    const html = `
        <div class="pp-form-title">Add Person</div>
        <div class="pp-form-body">
            <div class="pp-form-group">
                <label class="pp-form-label">Name</label>
                <input class="pp-form-input" id="ppName" placeholder="Name" autocomplete="off">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Relationship</label>
                <select class="pp-form-input" id="ppRel">
                    <option value="Friend">Friend</option>
                    <option value="Family">Family</option>
                    <option value="Network">Network</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="pp-form-row">
                <div class="pp-form-group">
                    <label class="pp-form-label">Birthday</label>
                    <input type="date" class="pp-form-input" id="ppBday">
                </div>
                <div class="pp-form-group">
                    <label class="pp-form-label">Next Interaction</label>
                    <input type="date" class="pp-form-input" id="ppNextInt">
                </div>
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Phone</label>
                <input class="pp-form-input" id="ppPhone" placeholder="Phone number" type="tel">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Email</label>
                <input class="pp-form-input" id="ppEmail" placeholder="Email" type="email">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Instagram</label>
                <input class="pp-form-input" id="ppInstagram" placeholder="@username">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Notes</label>
                <textarea class="pp-form-input" id="ppNotes" placeholder="Interests, details..." rows="3" style="min-height:80px; resize:vertical;"></textarea>
            </div>
        </div>
        <div class="pp-form-actions">
            <button class="pp-form-cancel" onclick="closePeopleSheet()">Cancel</button>
            <button class="pp-form-submit" onclick="window.savePerson()">Save</button>
        </div>`;
    openPeopleSheet(html);
    setTimeout(() => { const el = document.getElementById('ppName'); if (el) el.focus(); }, 500);
};

window.openEditPerson = function (id) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (!p) return;
    peopleState.sheetMode = 'edit';
    peopleState.sheetPersonId = id;

    const html = `
        <div class="pp-form-title">Edit Person</div>
        <div class="pp-form-body">
            <div class="pp-form-group">
                <label class="pp-form-label">Name</label>
                <input class="pp-form-input" id="ppName" value="${(p.name || '').replace(/"/g, '&quot;')}" placeholder="Name">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Relationship</label>
                <select class="pp-form-input" id="ppRel">
                    ${['Friend', 'Family', 'Network', 'Work', 'Other'].map(r => `<option value="${r}" ${p.relationship === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
            </div>
            <div class="pp-form-row">
                <div class="pp-form-group">
                    <label class="pp-form-label">Birthday</label>
                    <input type="date" class="pp-form-input" id="ppBday" value="${(p.birthday || '').slice(0, 10)}">
                </div>
                <div class="pp-form-group">
                    <label class="pp-form-label">Next Interaction</label>
                    <input type="date" class="pp-form-input" id="ppNextInt" value="${(p.next_interaction || '').slice(0, 10)}">
                </div>
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Phone</label>
                <input class="pp-form-input" id="ppPhone" value="${p.phone || ''}" placeholder="Phone number" type="tel">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Email</label>
                <input class="pp-form-input" id="ppEmail" value="${p.email || ''}" placeholder="Email" type="email">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Instagram</label>
                <input class="pp-form-input" id="ppInstagram" value="${p.instagram || ''}" placeholder="@username">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Notes</label>
                <textarea class="pp-form-input" id="ppNotes" placeholder="Notes..." rows="3" style="min-height:80px; resize:vertical;">${p.notes || ''}</textarea>
            </div>
        </div>
        <div class="pp-form-actions">
            <button class="pp-form-cancel" onclick="closePeopleSheet()">Cancel</button>
            <button class="pp-form-submit" onclick="window.updatePerson('${p.id}')">Update</button>
        </div>`;
    openPeopleSheet(html);
};

/* ============================================================
   SAVE / UPDATE PERSON (Optimistic)
   ============================================================ */

window.savePerson = async function () {
    const name = (document.getElementById('ppName')?.value || '').trim();
    if (!name) { showToast('Name is required'); return; }

    const newPerson = {
        id: 'temp-' + Date.now(),
        name,
        relationship: document.getElementById('ppRel')?.value || 'Other',
        birthday: document.getElementById('ppBday')?.value || '',
        next_interaction: document.getElementById('ppNextInt')?.value || '',
        phone: document.getElementById('ppPhone')?.value || '',
        email: document.getElementById('ppEmail')?.value || '',
        instagram: document.getElementById('ppInstagram')?.value || '',
        notes: document.getElementById('ppNotes')?.value || '',
        last_contact: '',
        is_favorite: false,
        created_at: new Date().toISOString()
    };

    // Optimistic
    if (!state.data.people) state.data.people = [];
    state.data.people.push(newPerson);
    closePeopleSheet();
    renderPeople();
    showToast('Person added');
    if (typeof triggerHapticBuzz === 'function') triggerHapticBuzz();

    try {
        const result = await apiCall('create', 'people', newPerson);
        if (result && result.id) {
            const idx = state.data.people.findIndex(x => x.id === newPerson.id);
            if (idx !== -1) state.data.people[idx].id = result.id;
        }
    } catch (e) {
        console.error('Save person error:', e);
        showToast('Failed to save — will retry');
    }
};

window.updatePerson = async function (id) {
    const name = (document.getElementById('ppName')?.value || '').trim();
    if (!name) { showToast('Name is required'); return; }

    const updates = {
        name,
        relationship: document.getElementById('ppRel')?.value || 'Other',
        birthday: document.getElementById('ppBday')?.value || '',
        next_interaction: document.getElementById('ppNextInt')?.value || '',
        phone: document.getElementById('ppPhone')?.value || '',
        email: document.getElementById('ppEmail')?.value || '',
        instagram: document.getElementById('ppInstagram')?.value || '',
        notes: document.getElementById('ppNotes')?.value || ''
    };

    // Optimistic
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (p) Object.assign(p, updates);
    closePeopleSheet();
    renderPeople();
    showToast('Person updated');

    try {
        await apiCall('update', 'people', updates, id);
    } catch (e) {
        console.error('Update person error:', e);
        showToast('Failed to update');
    }
};

/* ============================================================
   DELETE PERSON (Optimistic)
   ============================================================ */

window.deletePerson = async function (id) {
    if (!confirm('Delete this person and all their records?')) return;

    // Optimistic
    const removedPerson = (state.data.people || []).find(x => String(x.id) === String(id));
    state.data.people = (state.data.people || []).filter(x => String(x.id) !== String(id));
    const removedDebts = (state.data.people_debts || []).filter(d => String(d.person_id) === String(id));
    state.data.people_debts = (state.data.people_debts || []).filter(d => String(d.person_id) !== String(id));
    renderPeople();
    showToast('Person deleted');
    if (typeof triggerHapticBuzz === 'function') triggerHapticBuzz();

    try {
        await apiCall('people', 'delete', { id: String(id) });
        for (const debt of removedDebts) {
            await apiCall('people_debts', 'delete', { id: String(debt.id) });
        }
    } catch (e) {
        console.error('Delete error:', e);
        // Revert
        if (removedPerson) state.data.people.push(removedPerson);
        removedDebts.forEach(d => state.data.people_debts.push(d));
        renderPeople();
        showToast('Delete failed — reverted');
    }
};

/* ============================================================
   DEBT / MONEY SHEET
   ============================================================ */

window.openDebtModal = function (personId) {
    const p = (state.data.people || []).find(x => String(x.id) === String(personId));
    if (!p) return;
    peopleState.sheetMode = 'debt';

    const debts = (state.data.people_debts || []).filter(d => String(d.person_id) === String(personId));
    let balance = debts.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const sortedDebts = [...debts].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

    const html = `
        <div class="pp-form-title" style="display:flex;align-items:center;gap:8px;">
            <i data-lucide="indian-rupee" style="width:22px;height:22px;color:var(--primary)"></i>
            Money with ${p.name}
        </div>
        <div class="pp-form-body">
            <div class="pp-debt-summary">
                <div class="pp-debt-amount ${balance > 0 ? 'positive' : (balance < 0 ? 'negative' : 'zero')}">
                    ${balance > 0 ? '+' : ''}₹${Math.abs(Math.round(balance))}
                </div>
                <div class="pp-debt-label">${balance > 0 ? 'They owe you' : (balance < 0 ? 'You owe them' : 'Settled')}</div>
            </div>

            <div class="pp-form-group">
                <label class="pp-form-label">Amount</label>
                <input type="number" class="pp-form-input" id="ppDebtAmt" placeholder="0.00" step="0.01" inputmode="decimal">
            </div>
            <div class="pp-form-group">
                <label class="pp-form-label">Type</label>
                <select class="pp-form-input" id="ppDebtType">
                    <option value="given">Given (They owe me)</option>
                    <option value="taken">Taken (I owe them)</option>
                </select>
            </div>
            <div class="pp-form-row">
                <div class="pp-form-group">
                    <label class="pp-form-label">Date</label>
                    <input type="date" class="pp-form-input" id="ppDebtDate" value="${new Date().toISOString().slice(0, 10)}">
                </div>
                <div class="pp-form-group">
                    <label class="pp-form-label">Notes</label>
                    <input class="pp-form-input" id="ppDebtNotes" placeholder="Optional">
                </div>
            </div>

            ${sortedDebts.length > 0 ? `
            <div style="margin-top:16px;">
                <div class="pp-sheet-section-title">Recent</div>
                ${sortedDebts.map(d => `
                <div class="pp-debt-item">
                    <span>${d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}${d.notes ? ' · ' + d.notes : ''}</span>
                    <span class="pp-debt-item-amount ${parseFloat(d.amount) > 0 ? 'positive' : 'negative'}">${parseFloat(d.amount) > 0 ? '+' : ''}₹${Math.abs(parseFloat(d.amount))}</span>
                </div>`).join('')}
            </div>` : ''}
        </div>
        <div class="pp-form-actions">
            <button class="pp-form-cancel" onclick="closePeopleSheet()">Cancel</button>
            <button class="pp-form-submit" onclick="window.saveDebt('${personId}')">Add Transaction</button>
        </div>`;
    openPeopleSheet(html);
};

window.saveDebt = async function (personId) {
    const amount = parseFloat(document.getElementById('ppDebtAmt')?.value);
    const type = document.getElementById('ppDebtType')?.value;
    const date = document.getElementById('ppDebtDate')?.value;
    const notes = document.getElementById('ppDebtNotes')?.value;

    if (!amount || amount <= 0) { showToast('Enter a valid amount'); return; }

    const signedAmount = type === 'given' ? amount : -amount;
    const newDebt = {
        id: 'temp-' + Date.now(),
        person_id: personId,
        amount: signedAmount,
        type,
        date,
        notes
    };

    // Optimistic
    if (!state.data.people_debts) state.data.people_debts = [];
    state.data.people_debts.push(newDebt);
    closePeopleSheet();
    renderPeople();
    showToast('Transaction added');
    if (typeof triggerHapticBuzz === 'function') triggerHapticBuzz();

    try {
        const result = await apiCall('create', 'people_debts', newDebt);
        if (result && result.id) {
            const idx = state.data.people_debts.findIndex(x => x.id === newDebt.id);
            if (idx !== -1) state.data.people_debts[idx].id = result.id;
        }
    } catch (e) {
        console.error('Save debt error:', e);
    }
};

/* ============================================================
   LOG CONTACT SHEET
   ============================================================ */

window.logContact = function (id) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (!p) return;
    peopleState.sheetMode = 'log';

    const grad = getAvatarGradient(p.name);
    const initial = (p.name || '?').charAt(0).toUpperCase();

    const html = `
        <div style="padding: 16px 20px 0;">
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
                <div style="width:48px; height:48px; border-radius:14px; background:${grad}; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:800; color:white;">${initial}</div>
                <div>
                    <div style="font-size:18px; font-weight:800; color:var(--text-1);">Log Interaction</div>
                    <div style="font-size:13px; color:var(--text-muted);">Record that you caught up with ${p.name}</div>
                </div>
            </div>
        </div>
        <div class="pp-form-body" style="padding-top:0">
            <div class="pp-form-group">
                <label class="pp-form-label">What did you talk about? (optional)</label>
                <textarea class="pp-form-input" id="ppLogNote" placeholder="Quick note..." rows="3" style="min-height:80px; resize:vertical;"></textarea>
            </div>
        </div>
        <div class="pp-form-actions">
            <button class="pp-form-cancel" onclick="closePeopleSheet()">Cancel</button>
            <button class="pp-form-submit" onclick="window.confirmLogContact('${id}')">Log Contact</button>
        </div>`;
    openPeopleSheet(html);
};

window.confirmLogContact = async function (id) {
    const noteInput = document.getElementById('ppLogNote');
    const note = noteInput ? noteInput.value.trim() : '';

    const today = new Date().toISOString();
    const dateStr = new Date().toLocaleDateString();

    // Optimistic
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (p) {
        p.last_contact = today;
        const logEntry = note ? `[${dateStr}] ${note}` : `[${dateStr}] Interaction logged.`;
        p.notes = p.notes ? p.notes + '\n' + logEntry : logEntry;
    }
    closePeopleSheet();
    renderPeople();
    showToast(`Logged interaction with ${p?.name || 'contact'}`);
    if (typeof triggerHapticBuzz === 'function') triggerHapticBuzz();

    try {
        await apiCall('update', 'people', {
            last_contact: today,
            notes: p?.notes || ''
        }, id);
    } catch (e) {
        console.error('Log contact error:', e);
    }
};

/* ============================================================
   FAVORITE TOGGLE (Optimistic)
   ============================================================ */

window.toggleFavoritePerson = async function (id, isFav) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (p) p.is_favorite = isFav;
    renderPeople();
    if (typeof triggerHapticBuzz === 'function') triggerHapticBuzz();

    try {
        await apiCall('update', 'people', { is_favorite: isFav }, id);
    } catch (e) {
        console.error('Favorite toggle error:', e);
    }
};

/* ============================================================
   VIEW SWITCHING
   ============================================================ */

window.switchPeopleView = function (view) {
    peopleState.view = view;
    renderPeople();
};
