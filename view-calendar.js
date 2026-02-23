/* view-calendar.js */

let calState = {
  view: 'day', // 'month', 'week', 'day'
  cursor: new Date(),
};

// Drag State
let isDragging = false;
let dragEl = null;
let startY = 0;
let startTop = 0;


function renderCalendar() {
  const main = document.getElementById('main');
  const monthName = calState.cursor.toLocaleString('default', { month: 'long', year: 'numeric' });

  // 1. RENDER SCAFFOLD
  main.innerHTML = `
      <div class="cal-wrapper">
        <div class="cal-header">
          <div class="cal-title">${monthName}</div>
          
          <div class="cal-actions-row">
             <div class="cal-controls">
               <button class="cal-btn" onclick="navCal(-1)">${renderIcon('back')}</button>
               <button class="cal-btn" onclick="navCal(0)">Today</button>
               <button class="cal-btn" onclick="navCal(1)">${renderIcon('next')}</button>
             </div>
             
             <div class="cal-controls">
               <button class="cal-btn ${calState.view === 'month' ? 'active' : ''}" onclick="switchCalView('month')">Month</button>
               <button class="cal-btn ${calState.view === 'week' ? 'active' : ''}" onclick="switchCalView('week')">Week</button>
               <button class="cal-btn ${calState.view === 'day' ? 'active' : ''}" onclick="switchCalView('day')">Day</button>
             </div>
             
             <button class="btn primary" onclick="openEventModal()">${renderIcon('add', null, 'style="width:14px; margin-right:4px"')} Add Event</button>
          </div>
        </div>

        <div class="cal-body" id="calBody">
          ${getCalBodyHTML()}
        </div>
      </div>
    `;

  // Scroll to current time centered
  if (calState.view !== 'month') {
    setTimeout(() => {
      const body = document.getElementById('calBody');
      if (body) {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        const halfHeight = body.clientHeight ? body.clientHeight / 2 : 300;
        body.scrollTop = Math.max(0, minutes - halfHeight);
      }
    }, 10);
  }
}

/* --- LOGIC --- */
function switchCalView(v) { calState.view = v; renderCalendar(); }

function navCal(dir) {
  const d = new Date(calState.cursor);
  if (dir === 0) {
    calState.cursor = new Date();
  } else {
    if (calState.view === 'month') d.setMonth(d.getMonth() + dir);
    else if (calState.view === 'week') d.setDate(d.getDate() + (dir * 7));
    else d.setDate(d.getDate() + dir);
    calState.cursor = d;
  }
  renderCalendar();
}

window.openEventModal = function (dateIso = null, startTime = "09:00") {
  // 1. Inject Modal if missing (Lazy Load)
  if (!document.getElementById('eventModal')) {
    const modalHTML = `
      <div id="eventModal" class="modal-overlay hidden" onclick="if(event.target === this) closeModal()">
        <div class="modal-box" style="padding:0; overflow:hidden;">
          <div style="background:linear-gradient(135deg, var(--surface-2), var(--surface-1)); padding:24px; border-bottom:1px solid var(--border-color);">
            <h3 style="margin:0; text-align:center; font-size:18px; color:var(--text-1);">Add New Event</h3>
          </div>
          <div style="padding:24px;">
            <div style="margin-bottom:20px;">
              <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Event Title</label>
              <div class="input-group" style="position:relative;">
                ${renderIcon('tag', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                <input class="input" id="evtTitle" placeholder="e.g., Team Sync" style="padding-left:36px; font-weight:600; font-size:1.1em; width:100%;">
              </div>
            </div>

            <!-- Category Pills -->
            <div style="margin-bottom:20px;">
              <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Category</label>
              <div id="evtCatPills" style="display:flex; flex-wrap:wrap; gap:8px;">
                ${Object.keys(CATEGORY_COLORS).map(c => `
                  <div class="cat-pill" data-val="${c}" onclick="selectCategoryPill(this)" style="cursor:pointer; padding:6px 12px; border-radius:16px; font-size:12px; font-weight:500; border:1px solid var(--border-color); background:var(--surface-base); color:var(--text-2); transition:all 0.2s;">
                    ${c}
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="evtCategory" value="Other">
            </div>

            <!-- Date & Time Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
              <div style="grid-column: 1 / -1;">
                <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Date</label>
                <div class="input-group" style="position:relative;">
                  ${renderIcon('calendar', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                  <input type="date" class="input" id="evtDate" style="padding-left:36px; width:100%;">
                </div>
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">Start Time</label>
                <div class="input-group" style="position:relative;">
                  ${renderIcon('clock', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                  <input class="input" type="time" id="evtStart" style="padding-left:36px; width:100%;">
                </div>
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:var(--text-2); display:block; margin-bottom:8px;">End Time</label>
                <div class="input-group" style="position:relative;">
                  ${renderIcon('clock', null, 'style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"')}
                  <input class="input" type="time" id="evtEnd" style="padding-left:36px; width:100%;">
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
              <button class="btn" style="flex:1;" onclick="closeModal()">Cancel</button>
              <button class="btn primary" style="flex:1;" data-action="save-event">Save Event</button>
              <button id="evtDelete" class="btn hidden" style="flex:0; background:var(--danger); color:white; border:none; padding:8px;" onclick="deleteEventFromModal()">${renderIcon('delete', null, 'style="width:18px;height:18px;"')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Add logic for pill selection
    window.selectCategoryPill = function (el) {
      document.querySelectorAll('#evtCatPills .cat-pill').forEach(p => {
        p.style.background = 'var(--surface-base)';
        p.style.color = 'var(--text-2)';
        p.style.borderColor = 'var(--border-color)';
      });
      const val = el.dataset.val;
      document.getElementById('evtCategory').value = val;
      const color = CATEGORY_COLORS[val] || 'var(--primary)';
      el.style.background = color + '20'; // roughly 12% opacity
      el.style.color = color;
      el.style.borderColor = color;
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Set values
  document.getElementById('evtDate').value = dateIso || today;
  document.getElementById('evtStart').value = startTime;

  // Auto-set end time to +1 hour
  const [sh, sm] = startTime.split(':').map(Number);
  const endH = (sh + 1) % 24;
  const endHStr = endH < 10 ? '0' + endH : endH;
  document.getElementById('evtEnd').value = `${endHStr}:${startTime.split(':')[1]}`;

  document.getElementById('evtTitle').value = ''; // Clear title
  document.getElementById('evtCategory').value = 'Other'; // Default category

  // Reset button to create mode (in case it was in edit mode)
  const saveBtn = document.querySelector('[data-action="update-event-modal"], [data-action="save-event"]');
  if (saveBtn) {
    saveBtn.setAttribute('data-action', 'save-event');
    saveBtn.removeAttribute('data-edit-id');
    saveBtn.textContent = 'Save Event';
  }

  // Hide delete button in create mode
  const deleteBtn = document.getElementById('evtDelete');
  if (deleteBtn) deleteBtn.classList.add('hidden');

  document.getElementById('eventModal').classList.remove('hidden');
  document.getElementById('evtTitle').focus();
}

window.deleteEventFromModal = async function () {
  const editId = document.querySelector('[data-action="update-event-modal"]')?.dataset?.editId;
  if (!editId) return;

  if (!confirm('Delete this event?')) return;

  try {
    await apiCall('delete', 'planner_events', null, editId);
    await refreshData('planner_events');
    closeModal();
    if (typeof renderCalendar === 'function') renderCalendar();
    showToast('Event deleted');
  } catch (e) {
    showToast('Failed to delete event');
  }
};

window.closeModal = function () {
  document.getElementById('eventModal').classList.add('hidden');
}

function handleGridClick(e, dateIso) {
  if (isDragging) return;
  // Prevent click when clicking on an existing event bubble
  if (e.target.classList.contains('event-block') || e.target.parentElement.classList.contains('event-block')) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const clickY = e.clientY - rect.top + e.currentTarget.scrollTop;
  const hours = Math.floor(clickY / 60);
  const minutes = Math.floor((clickY % 60) / 15) * 15;
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  openEventModal(dateIso, timeStr);
}

// --- CONSTANTS ---
const CATEGORY_COLORS = {
  'Work': 'var(--primary, #4F46E5)',
  'Personal': 'var(--success, #10B981)',
  'Health': 'var(--danger, #EF4444)',
  'Social': 'var(--warning, #F59E0B)',
  'Finance': 'var(--info, #3B82F6)',
  'Other': 'var(--gray-500, #6B7280)'
};

/* --- RENDERERS --- */

function getCalBodyHTML() {
  if (calState.view === 'month') return renderMonthGrid();
  return renderTimeGrid();
}

function renderMonthGrid() {
  const year = calState.cursor.getFullYear();
  const month = calState.cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startDay);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let html = `<div class="month-container" style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">`;

  // Day headers
  html += days.map(d => `<div class="day-label" style="text-align:center; font-size:12px; font-weight:600; color:var(--text-muted); padding:8px 0;">${d}</div>`).join('');

  // Day cells
  for (let i = 0; i < 42; i++) {
    const curr = new Date(gridStart);
    curr.setDate(curr.getDate() + i);
    const isToday = isSameDate(curr, new Date());
    const isCurrMonth = curr.getMonth() === month;
    const iso = curr.getFullYear() + '-' + String(curr.getMonth() + 1).padStart(2, '0') + '-' + String(curr.getDate()).padStart(2, '0');
    const dayEvents = (state.data.planner || []).filter(e => {
      if (!e.start_datetime) return false;
      try {
        const sd = extractDatetime(e.start_datetime);
        return sd.date === iso;
      } catch (err) {
        return false;
      }
    });

    // Allow clicking day cell to add event (default 9am)
    html += `
        <div class="day-cell ${isToday ? 'today' : ''} ${!isCurrMonth ? 'faded' : ''}" onclick="openEventModal('${iso}')">
            <div class="date-num">${curr.getDate()}</div>
            ${dayEvents.slice(0, 4).map(e => `
              <div class="month-event-chip" onclick="event.stopPropagation(); openEditEvent('${e.id}')" 
                   style="background:${CATEGORY_COLORS[e.category] || CATEGORY_COLORS['Other']}; color:white; font-size:10px; font-weight:600; padding:2px 4px; border-radius:4px; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${e.title}
              </div>
            `).join('')}
            ${dayEvents.length > 4 ? `<div style="font-size:10px; color:var(--text-muted)">+${dayEvents.length - 4} more</div>` : ''}
        </div>`;
  }
  return html + '</div></div>';
}

function renderTimeGrid() {
  const isWeek = calState.view === 'week';
  const daysToShow = isWeek ? 7 : 1;
  const startDate = new Date(calState.cursor);

  if (isWeek) {
    const day = startDate.getDay();
    startDate.setDate(startDate.getDate() - day);
  }

  // Header Row
  let headerHtml = `<div class="week-header"><div class="time-gutter-header"></div>`;
  for (let i = 0; i < daysToShow; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const isToday = isSameDate(d, new Date());
    headerHtml += `<div class="day-col-header ${isToday ? 'today' : ''}" style="flex:1">${d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</div>`;
  }
  headerHtml += `</div>`;

  // Body Row
  let bodyHtml = `<div class="time-body"><div class="time-gutter">
      ${Array.from({ length: 24 }, (_, i) => `<div class="time-label">${i}:00</div>`).join('')}
    </div>`;

  for (let i = 0; i < daysToShow; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    // Match events whose start date equals this day (robust: check both T and space variants)
    const dayEvents = (state.data.planner || []).filter(e => {
      if (!e.start_datetime) return false;
      try {
        const sd = extractDatetime(e.start_datetime);
        if (!sd || !sd.date) return false;
        return sd.date === iso;
      } catch (err) {
        return false;
      }
    });

    const eventsHtml = dayEvents.map(e => {
      const sd = extractDatetime(e.start_datetime);
      const ed = extractDatetime(e.end_datetime);
      const startT = sd.time || '00:00';
      const endT = ed.time || '01:00';
      const [sh, sm] = startT.split(':').map(Number);
      const [eh, em] = endT.split(':').map(Number);
      const top = (sh * 60 + sm);
      const duration = ((eh * 60 + em) - top);
      const height = Math.max(duration, 30);
      const bgColor = CATEGORY_COLORS[e.category] || CATEGORY_COLORS['Other'];

      return `<div class="event-block" data-id="${e.id}"
                   style="top:${top}px; height:${height}px; background:${bgColor}; color:white; font-weight:600; border-radius:4px;"
                   onclick="event.stopPropagation(); openEditEvent('${e.id}')">
          <span class="event-time" style="color:white; opacity:0.9;">${startT}</span> ${e.title}
        </div>`;
    }).join('');

    bodyHtml += `<div class="day-col" id="day-col-${iso}" data-date="${iso}" style="flex:1" onclick="handleGridClick(event, '${iso}')">${eventsHtml}</div>`;
  }

  setTimeout(updateCurrentTimeLine, 0);
  return `<div class="time-grid-container">${headerHtml}${bodyHtml}</div>`;
}

window.updateCurrentTimeLine = function () {
  const now = new Date();
  const todayIso = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const minutes = now.getHours() * 60 + now.getMinutes();
  const col = document.getElementById(`day-col-${todayIso}`);

  // Remove existing lines to prevent duplicates if re-called
  document.querySelectorAll('.time-now-line').forEach(el => el.remove());

  if (col) {
    const line = document.createElement('div');
    line.className = 'time-now-line';
    line.style.cssText = 'position:absolute; left:0; right:0; height:2px; background:var(--danger); z-index:50; pointer-events:none; border-radius:1px';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:absolute; left:-4px; top:-4px; width:10px; height:10px; border-radius:50%; background:var(--danger)';
    line.appendChild(dot);
    col.style.position = 'relative';
    col.appendChild(line);
    line.style.top = minutes + 'px';
  }

  // Re-schedule
  if (window._timeLineInterval) clearTimeout(window._timeLineInterval);
  window._timeLineInterval = setTimeout(updateCurrentTimeLine, 60000);
};

function isSameDate(d1, d2) {
  return d1.toDateString() === d2.toDateString();
}

// Robust datetime extractor — handles 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD' and epoch milliseconds
function extractDatetime(dtStr) {
  if (!dtStr) return { date: '', time: '' };

  // Handle epoch milliseconds (number) or epoch string
  if (typeof dtStr === 'number' || (/^\d+$/.test(String(dtStr).trim()))) {
    const date = new Date(Number(dtStr));
    if (!isNaN(date.getTime())) {
      // Use local time instead of UTC to avoid timezone offset issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
    }
  }

  const s = String(dtStr).trim();
  // Try T separator first
  const tIdx = s.indexOf('T');
  if (tIdx !== -1) {
    return { date: s.slice(0, tIdx), time: s.slice(tIdx + 1, tIdx + 6) };
  }
  // Try space separator
  const spIdx = s.indexOf(' ');
  if (spIdx !== -1) {
    return { date: s.slice(0, spIdx), time: s.slice(spIdx + 1, spIdx + 6) };
  }
  // Date only
  return { date: s.slice(0, 10), time: '' };
}

window.openEditEvent = function (id) {
  const e = (state.data.planner || []).find(x => String(x.id) === String(id));
  if (!e) return;

  // Must open modal first if it doesn't exist yet
  if (!document.getElementById('eventModal')) {
    openEventModal(); // Creates the modal skeleton
    document.getElementById('eventModal').classList.add('hidden');
  }

  const startDt = extractDatetime(e.start_datetime);
  const endDt = extractDatetime(e.end_datetime);

  const date = startDt.date || new Date().toISOString().slice(0, 10);
  const startT = startDt.time || '09:00';
  const endT = endDt.time || '10:00';

  document.getElementById('evtDate').value = date;
  document.getElementById('evtStart').value = startT;
  document.getElementById('evtEnd').value = endT;
  document.getElementById('evtTitle').value = e.title || '';
  document.getElementById('evtCategory').value = e.category || 'Other';

  // Highlight the correct pill if pills exist
  const pills = document.querySelectorAll('#evtCatPills .cat-pill');
  if (pills.length > 0) {
    pills.forEach(p => {
      p.style.background = 'var(--surface-base)';
      p.style.color = 'var(--text-2)';
      p.style.borderColor = 'var(--border-color)';
      if (p.dataset.val === (e.category || 'Other')) {
        const color = CATEGORY_COLORS[p.dataset.val] || 'var(--primary)';
        p.style.background = color + '20';
        p.style.color = color;
        p.style.borderColor = color;
      }
    });
  }

  document.getElementById('eventModal').classList.remove('hidden');

  // Change Save button to Update
  const saveBtn = document.querySelector('[data-action="save-event"], [data-action="update-event-modal"]');
  if (saveBtn) {
    saveBtn.setAttribute('data-action', 'update-event-modal');
    saveBtn.setAttribute('data-edit-id', e.id);
    saveBtn.textContent = 'Update Event';
  }

  // Show delete button in edit mode
  const deleteBtn = document.getElementById('evtDelete');
  if (deleteBtn) deleteBtn.classList.remove('hidden');

  document.getElementById('evtTitle').focus();
}

// --- DRAG AND DROP LOGIC (Mouse + Touch) ---

function _startDrag(el, clientY) {
  isDragging = true;
  dragEl = el;
  dragEl.style.zIndex = 100;
  dragEl.style.opacity = 0.8;
  dragEl.style.cursor = 'grabbing';
  startY = clientY;
  startTop = parseInt(el.style.top || 0);
  document.body.style.userSelect = 'none';
}

function _moveDrag(clientY) {
  if (!isDragging || !dragEl) return;
  const deltaY = clientY - startY;
  let newTop = startTop + deltaY;
  newTop = Math.round(newTop / 15) * 15; // Snap to 15m
  if (newTop < 0) newTop = 0;
  dragEl.style.top = `${newTop}px`;
  const h = Math.floor(newTop / 60);
  const m = newTop % 60;
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const timeSpan = dragEl.querySelector('.event-time');
  if (timeSpan) timeSpan.textContent = timeStr;
}

async function _endDrag() {
  if (!isDragging || !dragEl) return;

  const el = dragEl;
  const originalId = el.dataset.id;
  const newTop = parseInt(el.style.top || 0);

  isDragging = false;
  dragEl = null;
  el.style.zIndex = '';
  el.style.opacity = '';
  el.style.cursor = '';
  document.body.style.userSelect = '';

  // If the event wasn't really moved (just clicked/tapped)
  if (Math.abs(newTop - startTop) < 5) {
    openEditEvent(originalId);
    return;
  }

  const h = Math.floor(newTop / 60);
  const m = newTop % 60;
  const newTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const eventObj = (state.data.planner || []).find(x => String(x.id) === String(originalId));
  if (eventObj) {
    // Convert epoch milliseconds to Date for parsing
    const startDate = new Date(eventObj.start_datetime);
    const endDate = new Date(eventObj.end_datetime);
    const datePart = startDate.getFullYear() + '-' + String(startDate.getMonth() + 1).padStart(2, '0') + '-' + String(startDate.getDate()).padStart(2, '0');
    const oldStart = startDate.toTimeString().slice(0, 5);
    const [oh, om] = oldStart.split(':').map(Number);
    const oldTop = oh * 60 + om;
    const oldEnd = endDate.toTimeString().slice(0, 5);
    const [oeh, oem] = oldEnd.split(':').map(Number);
    const oldEndMin = oeh * 60 + oem;
    const duration = oldEndMin - oldTop;
    const totalStartMin = h * 60 + m;
    const totalEndMin = totalStartMin + duration;
    const eh = Math.floor(totalEndMin / 60) % 24;
    const em = totalEndMin % 60;
    const newEndTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    eventObj.start_datetime = new Date(`${datePart}T${newTime}:00`).getTime();
    eventObj.end_datetime = new Date(`${datePart}T${newEndTime}:00`).getTime();
    renderCalendar();

    const payload = { ...eventObj };
    delete payload.id;

    showToast('Saving...');
    const result = await apiCall('update', 'planner_events', payload, originalId);
    // apiCall returns [] on both success and failure (GAS API quirk - check if save went through)
    // Always do a background refresh to confirm the sheet state
    refreshData('planner_events').then(() => {
      if (typeof renderCalendar === 'function' && state.view === 'calendar') renderCalendar();
    });
  }
}

// Mouse Events
document.addEventListener('mousedown', (e) => {
  const el = e.target.closest('.event-block');
  if (el) _startDrag(el, e.clientY);
});
document.addEventListener('mousemove', (e) => _moveDrag(e.clientY));
document.addEventListener('mouseup', () => _endDrag());

// Touch Events (mobile)
document.addEventListener('touchstart', (e) => {
  const el = e.target.closest('.event-block');
  if (el) _startDrag(el, e.touches[0].clientY);
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  _moveDrag(e.touches[0].clientY);
}, { passive: false });

document.addEventListener('touchend', () => _endDrag());