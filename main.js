/* main.js */

// REPLACE THIS URL with your deployed Web App URL

const API_BASE = "https://script.google.com/macros/s/AKfycbzG5PhMb9a2tZl4Z3CDRUhJSLS9foN-vSRMocmD9ZUbNLw05FchyYXuDYNiMiSEURLfPQ/exec";



window.state = {

    view: "dashboard",

    data: { planner: [], tasks: [], expenses: [], habits: [], habit_logs: [], diary: [], vision: [], settings: [], funds: [], assets: [], people: [], reminders: [], vision_images: [] },

    loading: false

};

// Keep a reference for convenience
const state = window.state;

// --- UTILITIES ---

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatReminderDateTime(date) {
    const now = new Date();
    const diff = date - now;
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();
    
    if (isToday) {
        return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isTomorrow) {
        return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}



// --- API HANDLING ---

async function apiCall(action, sheet, payload = {}, id = null) {

    let url = API_BASE;

    let options = {};



    if (action === 'get') {
        // Append timestamp to prevent caching
        url = `${API_BASE}?sheet=${sheet}&action=${action}&t=${Date.now()}`;
        options = { method: "GET" };
    } else {
        // For POST, send everything in the body to ensure GAS receives it correctly
        url = API_BASE;

        // Construct the full payload expected by the backend
        const bodyData = {
            action,
            sheet,
            id,
            payload
        };

        options = {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(bodyData)
        };
    }



    try {
        console.log(`API Request [${action} ${sheet}]:`, url, options);
        const res = await fetch(url, options);
        const json = await res.json();
        console.log(`API Response [${action} ${sheet}]:`, json);

        if (!json.success) throw new Error(json.message);

        let data = json.data || [];



        return data;

    } catch (e) {

        console.error("API Error:", e);

        showToast("Error: " + e.message);

        return [];

    }

}



// --- UTILS ---

function addLongPressListener(selector, callback) {
    document.addEventListener('mousedown', (_e) => { /* delegate? no, simpler to attach to body for dynamic items? */ });

    // Delegate approach for dynamic content
    let timer;
    const start = (e) => {
        const el = e.target.closest(selector);
        if (!el) return;
        timer = setTimeout(() => callback(el), 600);
    };
    const end = () => clearTimeout(timer);

    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchend', end);
    document.addEventListener('touchmove', end); // Cancel on scroll

    document.addEventListener('mousedown', start);
    document.addEventListener('mouseup', end);
    document.addEventListener('mouseleave', end);
}

// --- ROUTING ---

async function routeTo(viewName) {

    // Hash Routing
    if (window.location.hash !== '#' + viewName) {
        history.pushState(null, null, '#' + viewName);
    }

    state.view = viewName;


    // Update Nav Active States
    document.querySelectorAll('.nav-item, .mob-item, .tab').forEach(el => {

        const target = el.dataset.target || (el.getAttribute('onclick') && el.getAttribute('onclick').match(/'([^']+)'/)[1]);

        el.classList.toggle('active', target === viewName);

    });




    const main = document.getElementById('main');
    
    // Guard: if main not found, wait and retry (max 5 times)
    if (!main) {
        if (!window._routeRetryCount) window._routeRetryCount = 0;
        if (window._routeRetryCount < 5) {
            window._routeRetryCount++;
            console.log('Main element not found, retrying... (' + window._routeRetryCount + ')');
            setTimeout(() => routeTo(viewName), 100);
        }
        return;
    }
    window._routeRetryCount = 0;

    // Page Transition
    main.classList.add('page-exit');
    main.classList.add('page-exit-active');

    setTimeout(() => {
        main.innerHTML = `<div class="skeleton-container">
          <div class="skeleton-card">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line subtitle"></div>
            <div class="skeleton-row"><div class="skeleton-circle"></div><div class="skeleton-line body"></div></div>
            <div class="skeleton-row"><div class="skeleton-circle"></div><div class="skeleton-line body short"></div></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton-line body"></div>
            <div class="skeleton-line body short"></div>
            <div class="skeleton-line body"></div>
          </div>
        </div>`;

        main.classList.remove('page-exit', 'page-exit-active');
        main.classList.add('page-enter');

        // Render New View (with error handling)
        try {
            if (viewName === 'dashboard') renderDashboard();
            else if (viewName === 'calendar') renderCalendar();
            else if (viewName === 'tasks') renderTasks();
            else if (viewName === 'finance') renderFinance();
            else if (viewName === 'habits') renderHabits();
            else if (viewName === 'diary') renderDiary();
            else if (viewName === 'vision') renderVision();
            else if (viewName === 'settings') renderSettings();
            else if (viewName === 'people') renderPeople();
        } catch (e) {
            console.error('Error rendering view ' + viewName + ':', e);
            main.innerHTML = '<div style="padding:20px; color:red">Error loading view: ' + viewName + '<br><small>' + e.message + '</small></div>';
        }

        // Initialize Lucide icons after rendering
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            requestAnimationFrame(() => lucide.createIcons());
        }

        // Enter Animation
        requestAnimationFrame(() => {
            main.classList.add('page-enter-active');
            setTimeout(() => {
                main.classList.remove('page-enter', 'page-enter-active');
            }, 300);
        });

    }, 200); // Wait for exit animation

}



async function initApp() {

    if (document.getElementById('dateToday')) {

        document.getElementById('dateToday').innerText = new Date().toDateString();

    }

    console.log('initApp: Starting...');
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        try {
            // DEBUG: Log current location for GitHub Pages subpath diagnosis
            console.log('[SW Debug] Current location:', window.location.href);
            console.log('[SW Debug] Base URL:', window.location.origin);
            console.log('[SW Debug] Pathname:', window.location.pathname);
            
            // Use absolute path for GitHub Pages compatibility
            const swPath = `${window.location.pathname.replace(/\/$/, '')}/sw.js`;
            console.log('[SW Debug] Attempting to register SW at:', swPath);
            
            const registration = await navigator.serviceWorker.register(swPath, {
                scope: `${window.location.pathname.replace(/\/$/, '')}/`
            });
            console.log('[SW Debug] Service Worker registered successfully:', registration);
            console.log('[SW Debug] Scope:', registration.scope);
        } catch (error) {
            console.error('[SW Debug] Service Worker registration failed:', error);
            console.error('[SW Debug] Error details:', error.message);
        }
    } else {
        console.warn('[SW Debug] Service Worker not supported in this browser');
    }
    
    await loadAllData();
    console.log('initApp: Data loaded.');

    routeTo('dashboard');

    // Initialize Long Press for Context Menus (Future Proofing)
    console.log('initApp: Initializing helpers...');
    try {
        addLongPressListener('.dash-card, .list-item', (el) => {
            el.style.transform = 'scale(0.98)';
            setTimeout(() => el.style.transform = '', 200);
            if (navigator.vibrate) navigator.vibrate(50);
        });
    } catch (e) { console.error('Error initializing long press:', e); }

}



function showToast(msg) {

    const t = document.getElementById('toast');

    if (t) {

        t.innerText = msg;

        t.style.opacity = 1;

        setTimeout(() => t.style.opacity = 0, 3000);

    } else {

        console.log("Toast:", msg);

    }

}



function isoDate() { return new Date().toISOString().slice(0, 10); }




// --- ROUTING LISTENER ---
window.addEventListener('hashchange', () => {
    const view = window.location.hash.slice(1);
    if (view && view !== state.view) {
        routeTo(view);
    }
});

// Initial Route Check
const initialHash = window.location.hash.slice(1);
if (initialHash) {
    // Override default dashboard view if hash exists
    state.view = initialHash;
}

// --- GLOBAL EVENT LISTENER ---

document.addEventListener('click', async (e) => {

    const btn = e.target.closest('[data-action]');

    if (!btn) return;



    const action = btn.dataset.action;

    const id = btn.dataset.id;

    const sheet = btn.dataset.sheet;



    /* TASKS */

    if (action === 'add-task') {

        const input = document.getElementById('inputTask');

        if (input && input.value) {

            const title = input.value;

            input.value = '';

            await apiCall('create', 'tasks', { title, status: 'pending', created_at: isoDate() });

            await refreshData('tasks');

        }

    }

    else if (action === 'add-task-rich') {

        const title = document.getElementById('newTaskTitle').value;

        const prio = document.getElementById('newTaskPriority').value;

        const date = document.getElementById('newTaskDate').value;



        if (!title) { alert("Task title required"); return; }



        document.getElementById('newTaskTitle').value = '';

        document.getElementById('addTaskForm').classList.add('hidden');

        showToast("Adding task...");



        await apiCall('create', 'tasks', {

            title: title, priority: prio, due_date: date, status: 'pending', created_at: new Date().toISOString()

        });

        await refreshData('tasks');

    }

    else if (action === 'toggle-task') {

        const task = state.data.tasks.find(t => String(t.id) === String(id));

        if (task) {

            const newStatus = task.status === 'completed' ? 'pending' : 'completed';

            task.status = newStatus;

            if (state.view === 'tasks') renderTasks(document.querySelector('input[placeholder="Search..."]')?.value || '');

            await apiCall('update', 'tasks', { status: newStatus }, id);

        }

    }

    else if (action === 'add-task-modal') {

        const title = document.getElementById('mTaskTitle').value;

        const prio = document.getElementById('mTaskPriority').value;


        if (!title) return;

        document.getElementById('universalModal').classList.add('hidden');

        document.getElementById('mTaskTitle').value = '';

        showToast("Adding task...");


        await apiCall('create', 'tasks', { title, priority: prio, status: 'pending', created_at: new Date().toISOString() });

        await refreshData('tasks');

    }



    /* FINANCE */

    else if (action === 'add-expense') {

        const amt = document.getElementById('inputExpAmt').value;

        const cat = document.getElementById('inputExpCat').value;

        if (!amt) return;

        document.getElementById('inputExpAmt').value = '';

        await apiCall('create', 'expenses', { amount: amt, category: cat, date: isoDate() });

        await refreshData('finance');

    }



    /* HABITS */

    else if (action === 'add-habit') {

        const name = document.getElementById('inputHabit').value;

        if (!name) return;

        document.getElementById('inputHabit').value = '';

        await apiCall('create', 'habits', { habit_name: name, created_at: isoDate() });

        await refreshData('habits');

    }

    else if (action === 'toggle-habit') {

        const today = isoDate();
        const existingIdx = state.data.habit_logs.findIndex(l => String(l.habit_id) === String(id) && l.date.startsWith(today));

        // 1. Optimistic Update
        if (existingIdx !== -1) {
            // Remove locally
            const toDelete = state.data.habit_logs[existingIdx];
            state.data.habit_logs.splice(existingIdx, 1);
            if (state.view === 'habits') renderHabits(); // Re-render immediately

            // API Call
            await apiCall('delete', 'habit_logs', {}, toDelete.id);
        } else {
            // Add locally
            const newLog = { id: 'temp-' + Date.now(), habit_id: id, date: today, completed: true };
            state.data.habit_logs.push(newLog);
            if (state.view === 'habits') renderHabits(); // Re-render immediately

            // API Call
            await apiCall('create', 'habit_logs', { habit_id: id, date: today, completed: true });
        }

        // 2. Background Refresh to Ensure Sync
        // We don't await this to keep UI responsive, but we trigger it
        refreshData('habit_logs').then(() => {
            if (state.view === 'habits') renderHabits();
        });

    }



    /* DIARY & VISION */

    else if (action === 'save-diary') {

        const text = document.getElementById('inputDiary').value;

        if (!text) return;

        document.getElementById('inputDiary').value = '';

        await apiCall('create', 'diary', { text, date: isoDate() });

        await refreshData('diary');

    }

    else if (action === 'add-vision') {

        const title = document.getElementById('inputVisTitle').value;

        const img = document.getElementById('inputVisImg').value;

        if (!title) return;

        await apiCall('create', 'vision_board', { title, image_url: img, created_at: isoDate() });

        await refreshData('vision');

    }



    /* CALENDAR */

    else if (action === 'open-event-modal') {

        document.getElementById('eventModal').classList.remove('hidden');

    }

    else if (action === 'save-event') {

        const title = document.getElementById('evtTitle').value;

        const date = document.getElementById('evtDate').value;

        const start = document.getElementById('evtStart').value;

        const end = document.getElementById('evtEnd').value;
        const category = document.getElementById('evtCategory')?.value || 'General';

        if (!title || !date || !start || !end) { alert("Please fill all fields"); return; }

        document.getElementById('eventModal').classList.add('hidden');

        showToast("Saving event...");

        // Store as epoch ms (number) — Google Sheets stores numbers as-is, avoiding the
        // normalizeOutput Date-stripping bug without needing a Code.gs redeploy.
        const startEpoch = new Date(`${date}T${start}:00`).getTime();
        const endEpoch = new Date(`${date}T${end}:00`).getTime();

        // Optimistic UI Update
        const tempId = 'temp-' + Date.now();
        const newEvent = {
            id: tempId,
            title: title,
            start_datetime: startEpoch,
            end_datetime: endEpoch,
            category: category
        };
        state.data.planner = state.data.planner || [];
        state.data.planner.push(newEvent);
        if (state.view === 'calendar' && typeof renderCalendar === 'function') {
            renderCalendar();
        }

        try {
            await apiCall('create', 'planner_events', {
                title: title, start_datetime: startEpoch, end_datetime: endEpoch, category: category
            });
            await refreshData('planner_events');
        } catch (e) {
            console.error("Failed to save event", e);
            state.data.planner = state.data.planner.filter(e => e.id !== tempId);
            if (state.view === 'calendar') renderCalendar();
            showToast("Failed to save event");
        }
    }



    /* Add inside main.js click listener */

    // --- SAVE PEOPLE MODAL ---
    else if (action === 'save-person-modal') {
        const name = document.getElementById('mPersonName').value;
        const rel = document.getElementById('mPersonRel').value;
        const bday = document.getElementById('mPersonBday').value;
        const notes = document.getElementById('mPersonNotes').value;

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Adding person...");

        await apiCall('create', 'people', {
            name: name, relationship: rel, birthday: bday, notes: notes,
            created_at: new Date().toISOString()
        });
        await refreshData('people');
    }

    // --- SAVE FINANCE TRANSACTION ---



    // --- SAVE FINANCE TRANSACTION ---

    else if (action === 'save-tx-modal') {

        const amt = document.getElementById('mTxAmount').value;
        const cat = document.getElementById('mTxCategory').value;
        const type = document.getElementById('mTxType').value;
        const date = document.getElementById('mTxDate').value;
        const source = document.getElementById('mTxSource')?.value || '';

        if (!amt) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast(`Adding ${type}...`);

        await apiCall('create', 'expenses', {
            amount: amt,
            category: cat,
            type: type,
            date: date,
            source: source
        });

        await refreshData('finance');

    }



    // --- SAVE FUND ---

    else if (action === 'save-fund-modal') {

        const name = document.getElementById('mFundName').value;

        const target = document.getElementById('mFundTarget').value;

        const current = document.getElementById('mFundCurrent').value;



        if (!name) return;

        document.getElementById('universalModal').classList.add('hidden');

        showToast("Adding fund...");



        await apiCall('create', 'funds', {

            fund_name: name,

            target_amount: target,

            current_amount: current

        });

        await refreshData('finance');

    }



    // --- SAVE ASSET ---

    else if (action === 'save-asset-modal') {

        const name = document.getElementById('mAssetName').value;

        const type = document.getElementById('mAssetType').value;

        const value = document.getElementById('mAssetValue').value;



        if (!name) return;

        document.getElementById('universalModal').classList.add('hidden');

        showToast("Adding asset...");



        await apiCall('create', 'assets', {

            asset_name: name,

            type: type,

            value: value

        });

        await refreshData('finance');

    }





    /* Add this inside the document.addEventListener('click') block in main.js */



    // --- SAVE VISION MODAL ---

    else if (action === 'save-vision-modal') {

        const title = document.getElementById('mVisTitle').value;

        const img = document.getElementById('mVisImg').value;

        const cat = document.getElementById('mVisCat').value;

        const date = document.getElementById('mVisDate').value;

        const notes = document.getElementById('mVisNotes').value;



        if (!title) { alert("Give your goal a title!"); return; }


        document.getElementById('universalModal').classList.add('hidden');

        showToast("Manifesting goal...");



        await apiCall('create', 'vision_board', {

            title: title,

            image_url: img,

            category: cat,

            target_date: date,

            notes: notes,

            created_at: new Date().toISOString()

        });


        await refreshData('vision');

    }





    /* Add this inside the document.addEventListener('click') block in main.js */



    // --- SAVE DIARY MODAL ---

    else if (action === 'save-diary-modal') {

        const text = document.getElementById('mDiaryText').value;

        const mood = document.getElementById('mMoodScore').value;

        const tags = document.getElementById('mDiaryTags').value;

        const date = document.getElementById('mDiaryDate').value;



        if (!text) { alert("Please write something!"); return; }


        document.getElementById('universalModal').classList.add('hidden');

        showToast("Saving entry...");



        await apiCall('create', 'diary', {

            text: text,

            mood_score: mood,

            tags: tags,

            date: date

        });


        await refreshData('diary');

    }



    /* Add this inside the document.addEventListener('click', ...) block in main.js */



    // ... previous blocks ...



    // --- SAVE HABIT MODAL ---

    // --- SAVE HABIT MODAL ---

    else if (action === 'save-habit-modal') {
        const name = document.getElementById('mHabitName').value;
        const cat = document.getElementById('mHabitCat').value;
        const freq = document.getElementById('mHabitFreq').value;
        const days = typeof getSelectedDays === 'function' ? getSelectedDays('mHabitDays') : '';
        
        // Debug: find ALL elements with mHabitTime in the modal
        const modal = document.getElementById('universalModal');
        const allTimeInputs = modal ? modal.querySelectorAll('#mHabitTime') : [];
        console.log('[Habit Save] All #mHabitTime elements in modal:', allTimeInputs.length, allTimeInputs);
        
        const timeEl = document.getElementById('mHabitTime');
        const time = timeEl ? timeEl.value : '';
        const emoji = document.getElementById('mHabitEmoji')?.value || '✨';

        console.log('[Habit Save] Current mHabitTime value:', time, 'element:', timeEl);

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Creating habit...");
        const habitPayload = {
            habit_name: name, category: cat, frequency: freq,
            days: freq === 'weekly' ? days : '',
            reminder_time: time,
            emoji: emoji,
            created_at: new Date().toISOString()
        };
        console.log('[Habit Save] Final payload:', habitPayload);
        await apiCall('create', 'habits', habitPayload);
        await refreshData('habits');
    }

    // --- SAVE TASK MODAL (from openTaskModal) ---
    else if (action === 'save-task-modal') {
        const title = document.getElementById('mTaskTitle').value;
        const desc = document.getElementById('mTaskDesc').value;
        const cat = document.getElementById('mTaskCategory').value;
        const tags = document.getElementById('mTaskTags').value;

        // Collect Subtasks (Robust)
        const subtasks = [];
        document.querySelectorAll('#mSubtaskList > div').forEach(div => {
            const txtInput = div.querySelector('.subtask-text');
            const chkInput = div.querySelector('.subtask-check');
            if (txtInput && txtInput.value.trim()) {
                subtasks.push({
                    text: txtInput.value.trim(),
                    done: chkInput ? chkInput.checked : false
                });
            }
        });

        const prio = document.getElementById('mTaskPriority').value;
        const date = document.getElementById('mTaskDate')?.value;
        const time = document.getElementById('mTaskTime')?.value;
        const recurrence = document.getElementById('mTaskRecurrence')?.value || 'none';
        const recurrenceEnd = document.getElementById('mTaskRecurrenceEnd')?.value || '';
        let recurrenceDays = '';
        if (recurrence === 'weekly') {
            const checkedBoxes = document.getElementById('universalModal').querySelectorAll('.task-day-check:checked');
            recurrenceDays = Array.from(checkedBoxes).map(cb => cb.value).join(',');
        }

        if (!title) { showToast("Title required"); return; }

        document.getElementById('universalModal').classList.add('hidden');
        showToast("Creating task...");
        await apiCall('create', 'tasks', {
            title, description: desc, category: cat, tags: tags,
            subtasks: JSON.stringify(subtasks),
            priority: prio, due_date: date || '', due_time: time || '',
            recurrence, recurrence_days: recurrenceDays, recurrence_end: recurrenceEnd,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        await refreshData('tasks');
    }




    // ============================================================
    // UPDATE HANDLERS (edit existing entries)
    // ============================================================

    else if (action === 'update-task-modal') {
        const editId = btn.dataset.editId; // from button
        const title = document.getElementById('mTaskTitle').value;
        const desc = document.getElementById('mTaskDesc').value;
        const cat = document.getElementById('mTaskCategory').value;
        const tags = document.getElementById('mTaskTags').value;

        // Collect Subtasks
        const subtasks = [];
        document.querySelectorAll('#mSubtaskList > div').forEach(div => {
            const txtInput = div.querySelector('.subtask-text');
            const chkInput = div.querySelector('.subtask-check');
            if (txtInput && txtInput.value.trim()) {
                subtasks.push({
                    text: txtInput.value.trim(),
                    done: chkInput ? chkInput.checked : false
                });
            }
        });

        const prio = document.getElementById('mTaskPriority').value;
        const date = document.getElementById('mTaskDate')?.value;
        const time = document.getElementById('mTaskTime')?.value || '';
        // Note: If time input is missing in Edit Modal, this will be empty. 
        // Ideally we should preserve original time if not changing?
        // But for now, empty is safer than null error.

        const recurrence = document.getElementById('mTaskRecurrence')?.value || 'none';
        const recurrenceEnd = document.getElementById('mTaskRecurrenceEnd')?.value || '';

        let recurrenceDays = '';
        if (recurrence === 'weekly') {
            const checkedBoxes = document.getElementById('universalModal').querySelectorAll('.task-day-check:checked');
            recurrenceDays = Array.from(checkedBoxes).map(cb => cb.value).join(',');
        }

        if (!title) return;

        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating task...");

        await apiCall('update', 'tasks', {
            title, description: desc, category: cat, tags: tags,
            subtasks: JSON.stringify(subtasks),
            priority: prio, due_date: date || '', due_time: time,
            recurrence, recurrence_days: recurrenceDays, recurrence_end: recurrenceEnd
        }, editId);

        await refreshData('tasks');
    }

    else if (action === 'update-tx-modal') {
        const editId = btn.dataset.editId;
        const amt = document.getElementById('mTxAmount').value;
        const cat = document.getElementById('mTxCategory').value;
        const type = document.getElementById('mTxType').value;
        const date = document.getElementById('mTxDate').value;
        const source = document.getElementById('mTxSource')?.value || '';

        if (!amt) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating transaction...");
        await apiCall('update', 'expenses', { amount: amt, category: cat, type: type, date: date, source: source }, editId);
        await refreshData('finance');
    }

    else if (action === 'update-fund-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mFundName').value;
        const target = document.getElementById('mFundTarget').value;
        const current = document.getElementById('mFundCurrent').value;
        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating fund...");
        await apiCall('update', 'funds', { fund_name: name, target_amount: target, current_amount: current }, editId);
        await refreshData('finance');
    }

    else if (action === 'update-asset-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mAssetName').value;
        const type = document.getElementById('mAssetType').value;
        const value = document.getElementById('mAssetValue').value;
        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating asset...");
        await apiCall('update', 'assets', { asset_name: name, type: type, value: value }, editId);
        await refreshData('finance');
    }

    else if (action === 'update-vision-modal') {
        const editId = btn.dataset.editId;
        const title = document.getElementById('mVisTitle').value;
        const img = document.getElementById('mVisImg').value;
        const cat = document.getElementById('mVisCat').value;
        const date = document.getElementById('mVisDate').value;
        const notes = document.getElementById('mVisNotes').value;
        if (!title) { alert("Give your goal a title!"); return; }
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating goal...");
        await apiCall('update', 'vision_board', { title, image_url: img, category: cat, target_date: date, notes: notes }, editId);
        await refreshData('vision');
    }

    else if (action === 'update-diary-modal') {
        const editId = btn.dataset.editId;
        const text = document.getElementById('mDiaryText').value;
        const mood = document.getElementById('mMoodScore').value;
        const tags = document.getElementById('mDiaryTags').value;
        const date = document.getElementById('mDiaryDate').value;
        if (!text) { alert("Please write something!"); return; }
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating entry...");
        await apiCall('update', 'diary', { text, mood_score: mood, tags: tags, date: date }, editId);
        await refreshData('diary');
    }

    else if (action === 'update-habit-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mHabitName').value;
        const cat = document.getElementById('mHabitCat').value;
        const freq = document.getElementById('mHabitFreq').value;
        const days = typeof getSelectedDays === 'function' ? getSelectedDays('mHabitDays') : '';
        
        // Debug: find ALL elements with mHabitTime in the modal
        const modal = document.getElementById('universalModal');
        const allTimeInputs = modal ? modal.querySelectorAll('#mHabitTime') : [];
        console.log('[Habit Update] All #mHabitTime elements in modal:', allTimeInputs.length, allTimeInputs);
        
        const timeEl = document.getElementById('mHabitTime');
        const time = timeEl ? timeEl.value : '';
        const emoji = document.getElementById('mHabitEmoji')?.value || '✨';

        console.log('[Habit Update] Current mHabitTime value:', time, 'element:', timeEl);

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating habit...");
        const updatePayload = {
            habit_name: name, category: cat, frequency: freq,
            days: freq === 'weekly' ? days : '',
            reminder_time: time,
            emoji: emoji
        };
        console.log('[Habit Update] Final payload:', updatePayload);
        await apiCall('update', 'habits', updatePayload, editId);
        await refreshData('habits');
    }

    else if (action === 'update-event-modal') {
        const editId = btn.dataset.editId;
        const title = document.getElementById('evtTitle').value;
        const date = document.getElementById('evtDate').value;
        const start = document.getElementById('evtStart').value;
        const end = document.getElementById('evtEnd').value;
        const category = document.getElementById('evtCategory')?.value || 'General';

        if (!title || !date || !start || !end) { alert("Please fill all fields"); return; }
        document.getElementById('eventModal').classList.add('hidden');
        showToast("Updating event...");

        // Store as epoch ms (number) for the same reason as save-event above
        const startEpoch = new Date(`${date}T${start}:00`).getTime();
        const endEpoch = new Date(`${date}T${end}:00`).getTime();

        // Optimistic UI Update
        const eventIndex = state.data.planner.findIndex(e => String(e.id) === String(editId));
        let originalEvent = null;
        if (eventIndex > -1) {
            originalEvent = { ...state.data.planner[eventIndex] };
            state.data.planner[eventIndex] = {
                ...state.data.planner[eventIndex],
                title: title,
                start_datetime: startEpoch,
                end_datetime: endEpoch,
                category: category
            };
            if (state.view === 'calendar' && typeof renderCalendar === 'function') {
                renderCalendar();
            }
        }

        try {
            await apiCall('update', 'planner_events', { title, start_datetime: startEpoch, end_datetime: endEpoch, category }, editId);
            await refreshData('planner_events');
        } catch (e) {
            console.error("Failed to update event", e);
            if (originalEvent && eventIndex > -1) {
                state.data.planner[eventIndex] = originalEvent;
                if (state.view === 'calendar') renderCalendar();
            }
            showToast("Failed to update event");
        }
    }

    else if (action === 'update-person-modal') {
        const editId = btn.dataset.editId;
        const name = document.getElementById('mPersonName').value;
        const rel = document.getElementById('mPersonRel').value;
        const bday = document.getElementById('mPersonBday').value;
        const notes = document.getElementById('mPersonNotes').value;

        if (!name) return;
        document.getElementById('universalModal').classList.add('hidden');
        showToast("Updating person...");

        await apiCall('update', 'people', {
            name: name, relationship: rel, birthday: bday, notes: notes
        }, editId);
        await refreshData('people');
    }




    else if (action === 'delete') {

        if (confirm('Delete this item?')) {

            await apiCall('delete', sheet, {}, id);

            await refreshData(state.view);

        }

    }

});



async function refreshData(viewContext) {

    // --- Special case: 'finance' needs to refresh expenses, funds, AND assets ---
    if (viewContext === 'finance') {
        try {
            const [expenses, funds, assets] = await Promise.all([
                apiCall('get', 'expenses'),
                apiCall('get', 'funds'),
                apiCall('get', 'assets')
            ]);
            state.data.expenses = expenses;
            state.data.funds = funds;
            state.data.assets = assets;
            if (state.view === 'finance') routeTo('finance');
        } catch (e) {
            console.error('Failed to refresh finance:', e);
        }
        return;
    }

    // Map view context to sheet names
    const sheetMap = {
        'settings': 'settings',
        'calendar': 'planner_events',
        'habits': 'habits',
        'tasks': 'tasks',
        'diary': 'diary',
        'vision': 'vision_board',
        'people': 'people'
    };

    const sheetName = sheetMap[viewContext] || viewContext;

    // Map sheet names to state keys

    const stateKeyMap = {
        'settings': 'settings',
        'planner_events': 'planner',
        'expenses': 'expenses',
        'habits': 'habits',
        'tasks': 'tasks',
        'diary': 'diary',
        'vision_board': 'vision',
        'vision_board': 'vision',
        'habit_logs': 'habit_logs',
        'people': 'people'
    };

    const stateKey = stateKeyMap[sheetName] || sheetName;

    try {
        const data = await apiCall('get', sheetName);
        state.data[stateKey] = data;
        
        // Debug: Log habits data after refresh
        if (viewContext === 'habits') {
            console.log('[Debug] Habits data from API:', JSON.stringify(data, null, 2));
        }

        // If settings were refreshed, apply them immediately
        if (viewContext === 'settings' && typeof applySettings === 'function') {
            applySettings();
            if (typeof updateTabVisibility === 'function') {
                updateTabVisibility();
            }
        }

        console.log(`Refreshed ${viewContext}:`, data);

        // Re-render the current view after data refresh
        if (viewContext === state.view || sheetName === state.view) {
            routeTo(state.view);
        }
    } catch (e) {
        console.error(`Failed to refresh ${viewContext}:`, e);
    }

}



/* --- LOADER --- */
function updateLoader(percent, text) {
    const bar = document.querySelector('.loader-progress-bar');
    const status = document.querySelector('.loader-status');
    if (bar) bar.style.width = percent + '%';
    if (status && text) status.textContent = text;
}

async function loadAllData() {
    console.log('loadAllData: Fetching all sheets...');
    state.loading = true;
    updateLoader(5, 'Connecting...');

    // Include all sheets including settings, funds, and assets
    const sheets = ['planner_events', 'tasks', 'expenses', 'habits', 'habit_logs', 'diary', 'vision_board', 'settings', 'funds', 'assets', 'people', 'reminders', 'vision_images'];
    const keys = ['planner', 'tasks', 'expenses', 'habits', 'habit_logs', 'diary', 'vision', 'settings', 'funds', 'assets', 'people', 'reminders', 'vision_images'];

    let loaded = 0;
    const total = sheets.length;

    // Load ALL sheets in parallel with progress tracking
    const promises = sheets.map(s => {
        return apiCall('get', s).then(res => {
            loaded++;
            const pct = 10 + Math.round((loaded / total) * 80); // 10% -> 90%
            updateLoader(pct, `Fetching data... (${loaded}/${total})`);
            return res;
        });
    });

    const results = await Promise.all(promises);

    results.forEach((res, i) => { state.data[keys[i]] = res; });

    state.loading = false;
    updateLoader(95, 'Processing & Rendering...');

    console.log("Data Loaded:", state.data);

    // Apply theme settings on load
    applyThemeOnLoad();

    // Apply settings immediately after loading
    if (state.data.settings && state.data.settings.length > 0) {
        if (typeof applySettings === 'function') {
            applySettings();
        }
        if (typeof updateTabVisibility === 'function') {
            updateTabVisibility();
        }
    }

    // Hide loader smoothly
    updateLoader(100, 'Ready!');
    setTimeout(() => {
        const loader = document.getElementById('appLoader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }, 500);

}





function toggleSidebar() {

    const sidebar = document.querySelector('.sidebar');

    if (sidebar) sidebar.classList.toggle('collapsed');

}

// Apply theme settings when app loads
function applyThemeOnLoad() {
    const settings = state.data.settings?.[0];
    if (!settings) return;

    // Apply theme color
    const color = settings.theme_color || '#4F46E5';
    document.documentElement.style.setProperty('--primary', color);

    // Apply theme mode (light/dark/forest/midnight)
    const mode = settings.theme_mode || 'light';
    document.documentElement.setAttribute('data-theme', mode);

    console.log('Theme applied:', mode, color);
}

// Apply settings after saving in Settings view
function applySettings() {
    const settings = state.data.settings?.[0];
    if (!settings) return;

    // Apply theme color
    const color = settings.theme_color || '#4F46E5';
    document.documentElement.style.setProperty('--primary', color);

    // Apply theme mode (light/dark/forest/midnight)
    const mode = settings.theme_mode || 'light';
    document.documentElement.setAttribute('data-theme', mode);

    // Apply orientation lock
    const orientation = settings.orientation_lock || 'auto';
    if (orientation !== 'auto' && screen.orientation) {
        screen.orientation.lock(orientation + '-primary').catch(e => console.log('Orientation lock failed:', e));
    } else if (orientation === 'auto' && screen.orientation) {
        screen.orientation.unlock();
    }

    console.log('Theme applied:', mode, color);
}

// Refresh all data and re-render current view
window.refreshAll = async function () {
    showToast('Refreshing...');
    await loadAllData();
    // Re-render current view
    if (state.view === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    else if (state.view === 'calendar' && typeof renderCalendar === 'function') renderCalendar();
    else if (state.view === 'tasks' && typeof renderTasks === 'function') renderTasks();
    else if (state.view === 'finance' && typeof renderFinance === 'function') renderFinance();
    else if (state.view === 'habits' && typeof renderHabits === 'function') renderHabits();
    else if (state.view === 'diary' && typeof renderDiary === 'function') renderDiary();
    else if (state.view === 'vision' && typeof renderVision === 'function') renderVision();
    else if (state.view === 'people' && typeof renderPeople === 'function') renderPeople();
    showToast('Data refreshed!');
};

/* --- NOTIFICATIONS & ALARMS --- */
let notifiedItems = JSON.parse(localStorage.getItem('notifiedItems') || '[]');

/* --- AI MODAL LOGIC --- */
/* --- AI MODAL LOGIC --- */
window.openAIModal = function () {
    const modal = document.getElementById('aiModal');
    const content = document.getElementById('aiModalContent');
    if (!modal || !content) return;

    modal.classList.add('active');

    // Initial Menu View
    content.innerHTML = `
        <div class="ai-menu-view">
            <div style="text-align:center; margin-bottom:24px;">
                <div style="font-size:24px; font-weight:800; background:linear-gradient(135deg, var(--primary), var(--accent)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:8px">AI Assistant</div>
                <div style="font-size:14px; color:var(--text-muted)">How can I help you with this page?</div>
            </div>
            
            <div style="display:grid; gap:12px;">
                <button class="btn large" style="justify-content:flex-start; height:60px; background:var(--bg); color:var(--text-main); border:1px solid var(--border)" onclick="triggerAIAnalysis()">
                    <div style="width:32px; height:32px; background:var(--primary-soft); border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:12px">
                        <i data-lucide="zap" style="width:16px; color:var(--primary)"></i>
                    </div>
                    <div style="text-align:left">
                        <div style="font-weight:600">Deep Analysis</div>
                        <div style="font-size:11px; color:var(--text-muted)">Get insights & next steps</div>
                    </div>
                </button>

                <button class="btn large" style="justify-content:flex-start; height:60px; background:var(--bg); color:var(--text-main); border:1px solid var(--border)" onclick="showAIChatView()">
                    <div style="width:32px; height:32px; background:var(--primary-soft); border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:12px">
                        <i data-lucide="message-circle" style="width:16px; color:var(--primary)"></i>
                    </div>
                    <div style="text-align:left">
                        <div style="font-weight:600">Ask a Question</div>
                        <div style="font-size:11px; color:var(--text-muted)">Chat about this data</div>
                    </div>
                </button>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.triggerAIAnalysis = async function () {
    const content = document.getElementById('aiModalContent');
    content.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted)">
            <i data-lucide="loader" class="spin" style="width:32px; height:32px; margin-bottom:16px; color:var(--primary)"></i>
            <div class="typing-indicator"><span></span><span></span><span></span></div>
            <div style="margin-top:16px; font-weight:500">Analyzing ${state.view.charAt(0).toUpperCase() + state.view.slice(1)}...</div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const contextData = getAIContextData();
        const response = await AI_SERVICE.generateInsight(state.view, contextData);
        renderAIContent(response);
    } catch (e) {
        content.innerHTML = `<div style="color:var(--danger); text-align:center; padding:20px">Failed: ${e.message}</div>`;
    }
};

window.showAIChatView = function () {
    const content = document.getElementById('aiModalContent');
    content.innerHTML = `
        <div class="ai-chat-view" style="height:400px; display:flex; flex-direction:column">
            <div id="aiChatHistory" style="flex:1; overflow-y:auto; padding:10px; margin-bottom:10px; border:1px solid var(--border); border-radius:12px; background:var(--bg)">
                <div style="font-size:13px; color:var(--text-muted); text-align:center; margin-top:20px">Ask anything about your ${state.view}...</div>
            </div>
            <div style="display:flex; gap:8px">
                <input id="aiChatInput" class="input" style="margin:0" placeholder="Type your question..." onkeypress="if(event.key==='Enter') sendAIQuestion()">
                <button class="btn primary" onclick="sendAIQuestion()"><i data-lucide="send" style="width:16px"></i></button>
            </div>
        </div>
    `;
    setTimeout(() => document.getElementById('aiChatInput').focus(), 100);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.sendAIQuestion = async function () {
    const input = document.getElementById('aiChatInput');
    const history = document.getElementById('aiChatHistory');
    const question = input.value.trim();
    if (!question) return;

    // User Msg
    history.innerHTML += `
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px">
            <div style="background:var(--primary-soft); color:var(--primary-dark); padding:8px 12px; border-radius:12px 12px 0 12px; max-width:80%; font-size:14px">
                ${question}
            </div>
        </div>
    `;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    // Loading Bubble
    const loadId = 'ai-load-' + Date.now();
    history.innerHTML += `
        <div id="${loadId}" style="display:flex; justify-content:flex-start; margin-bottom:12px">
            <div style="background:var(--card-bg); border:1px solid var(--border); padding:8px 12px; border-radius:12px 12px 12px 0; max-width:80%">
                <div class="typing-indicator" style="transform:scale(0.8)"><span></span><span></span><span></span></div>
            </div>
        </div>
    `;
    history.scrollTop = history.scrollHeight;

    try {
        const contextData = getAIContextData();
        const answer = await AI_SERVICE.generateAnswer(question, state.view, contextData);

        document.getElementById(loadId).remove();

        history.innerHTML += `
            <div style="display:flex; justify-content:flex-start; margin-bottom:12px">
                <div style="background:var(--card-bg); border:1px solid var(--border); padding:8px 12px; border-radius:12px 12px 12px 0; max-width:80%; font-size:14px; line-height:1.5">
                    ${matchMd(answer)}
                </div>
            </div>
        `;
    } catch (e) {
        document.getElementById(loadId).remove();
        history.innerHTML += `<div style="color:var(--danger); font-size:12px; margin-bottom:10px">Error: ${e.message}</div>`;
    }
    history.scrollTop = history.scrollHeight;
};

// Helper for both analysis and chat
function getAIContextData() {
    if (state.view === 'dashboard') return { tasks: state.data.tasks, habits: state.data.habits };
    if (state.view === 'people') return { people: state.data.people };
    if (state.view === 'finance') return { expenses: state.data.expenses, budget: state.data.settings };
    return state.data[state.view] || {};
}

function matchMd(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function renderAIContent(mdText) {
    const content = document.getElementById('aiModalContent');
    // Parse headers, bullets, etc
    let html = mdText
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--primary);">$1</strong>')
        .replace(/### (.*?)\n/g, '<div class="ai-section-title"><i data-lucide="hash" style="width:12px"></i> $1</div>')
        .replace(/## (.*?)\n/g, '<div class="ai-title" style="font-size:18px; margin:16px 0 8px 0">$1</div>')
        .replace(/- (.*?)\n/g, '<div style="display:flex; gap:8px; margin-bottom:6px"><i data-lucide="chevron-right" style="width:14px; margin-top:4px; flex-shrink:0; color:var(--accent)"></i> <span>$1</span></div>')
        .replace(/\n\n/g, '<div style="height:12px"></div>');

    content.innerHTML = `<div class="ai-content-box">${html}</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}



window.closeAIModal = function () {
    const modal = document.getElementById('aiModal');
    if (modal) modal.classList.remove('active');
};

// Universal Modal Functions
window.openUniversalModal = function() {
    const modal = document.getElementById('universalModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeUniversalModal = function() {
    const modal = document.getElementById('universalModal');
    if (modal) modal.classList.add('hidden');
};

// Notification service is now in notification-service.js
// The old checkAlarms is kept for backwards compatibility but uses notification-service.js now

// This function is kept for backwards compatibility but delegated to notification-service
function startNotificationService() {
    // Delegated to notification-service.js which handles reminders
    console.log('Notification service loaded from notification-service.js');
    if (typeof initNotificationService === 'function') {
        initNotificationService();
    }
}

// Universal Modal Functions
function openUniversalModal() {
    const modal = document.getElementById('universalModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeUniversalModal() {
    const modal = document.getElementById('universalModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function checkAlarms() {
    const now = new Date();
    // Round down to current minute
    const currentWait = now.toISOString().slice(0, 16);
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Check Tasks (Due Today + Time matches)
    const tasks = state.data.tasks || [];
    tasks.forEach(t => {
        if (t.status !== 'completed' && t.due_date === todayStr && t.due_time === currentTime) {
            triggerAlarm(`Task Due: ${t.title}`, `It's ${t.due_time}, time to work on this!`, 'task-' + t.id);
        }
    });

    // 2. Check Habits (Scheduled Today + Time matches)
    const habits = state.data.habits || [];
    habits.forEach(h => {
        if (h.reminder_time === currentTime) {
            // Check if scheduled for today
            let isScheduled = true; // default daily
            if (h.frequency === 'weekly' && h.days) {
                const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
                // h.days like "Mon,Tue"
                isScheduled = h.days.split(',').map(s => s.trim()).includes(dayName);
            }

            if (isScheduled) {
                // Check if already done today
                const logs = state.data.habit_logs || [];
                const isDone = logs.some(l => String(l.habit_id) === String(h.id) && (l.date || '').startsWith(todayStr));

                if (!isDone) {
                    triggerAlarm(`Habit Reminder: ${h.habit_name}`, `Time to build your habit!`, 'habit-' + h.id);
                }
            }
        }
    });

    // 3. Check Planner Events (Starts within 1 min)
    const events = state.data.planner || [];
    events.forEach(e => {
        if (e.start_datetime) {
            const eventISO = new Date(e.start_datetime).toISOString().slice(0, 16);
            if (eventISO === currentWait) {
                triggerAlarm(`Event: ${e.title}`, `Starting now!`, 'event-' + e.id);
            }
        }
    });

    // 4. Schedule Native Alarms (Next 15 mins) - For Background Reliability
    scheduleNativeAlarms();
}

function scheduleNativeAlarms() {
    if (!window.AppInventor || !window.AppInventor.scheduleAlarm) return;

    const now = new Date();
    const tasks = state.data.tasks || [];

    tasks.forEach(t => {
        if (t.status !== 'completed' && t.due_date === now.toISOString().slice(0, 10)) {
            const [h, m] = t.due_time.split(':');
            const due = new Date();
            due.setHours(h, m, 0, 0);

            const diffSec = (due - now) / 1000;
            // Schedule if between 1 and 15 minutes from now
            if (diffSec > 0 && diffSec < 900) {
                window.AppInventor.scheduleAlarm(t.id, t.title, Math.floor(diffSec));
            }
        }
    });
}

function triggerAlarm(title, body, uniqueId) {
    const key = `${new Date().toISOString().slice(0, 10)}-${uniqueId}`;
    if (notifiedItems.includes(key)) return;

    // 1. Audio
    playAlarmSound();

    // 2. Browser / ServiceWorker Notification
    if ('serviceWorker' in navigator && "Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
                body: body,
                icon: './icon-192.png',
                badge: './icon-192.png',
                vibrate: [200, 100, 200],
                tag: uniqueId,
                requireInteraction: true
            });
        });
    } else if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: './icon-192.png' });
    }

    // 3. In-App Modal
    showAlarmModal(title, body);

    // 4. MIT App Inventor Bridge (WebViewString)
    if (window.AppInventor && window.AppInventor.setWebViewString) {
        window.AppInventor.setWebViewString("ALARM:" + title + "|" + body);
    } else if (window.Android && window.Android.showToast) {
        window.Android.showToast(title + ": " + body);
    }

    // Save state
    notifiedItems.push(key);
    localStorage.setItem('notifiedItems', JSON.stringify(notifiedItems));
}

function playAlarmSound() {
    const audio = document.getElementById('alarmSound');
    if (!audio) return;

    const settings = state.data.settings?.[0] || { volume: 100, sound: 'classic' };

    // Map sound names to files (using mixkit assets for demo)
    const sounds = {
        'classic': 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
        'digital': 'https://assets.mixkit.co/active_storage/sfx/2190/2190-preview.mp3',
        'gentle': 'https://assets.mixkit.co/active_storage/sfx/1126/1126-preview.mp3',
        'system': 'https://assets.mixkit.co/active_storage/sfx/995/995-preview.mp3'
    };

    const src = sounds[settings.sound] || sounds['classic'];
    if (audio.src !== src) audio.src = src;

    audio.volume = (settings.volume || 100) / 100;
    audio.currentTime = 0;
    audio.play().catch(e => console.log("Audio play failed", e));
}

// Global test function for Settings page
window.testAlarmSound = function () {
    // Read directly from inputs for live preview
    const volume = Number(document.getElementById('alertVolume').value);
    const sound = document.getElementById('alertSound').value;

    // Mock state for playAlarmSound to use
    const originalSettings = state.data.settings?.[0];
    state.data.settings = [{ volume, sound }];

    playAlarmSound();

    // Restore state after short delay
    setTimeout(() => {
        if (state.data.settings && state.data.settings[0]) {
            state.data.settings[0] = originalSettings;
        }
    }, 1000);
}

function showAlarmModal(title, body) {
    // Check if modal already exists
    if (document.querySelector('.alarm-modal-overlay')) return;

    const modal = document.createElement('div');
    modal.className = 'alarm-modal-overlay';
    modal.innerHTML = `
        <div class="alarm-modal-box">
            <div style="font-size:48px; margin-bottom:16px">⏰</div>
            <h2 style="margin:0 0 10px 0; color:var(--text-main)">${title}</h2>
            <p style="margin:0 0 24px 0; color:var(--text-secondary); line-height:1.5">${body}</p>
            <button class="btn primary" style="width:100%; padding:12px; font-size:16px" onclick="this.closest('.alarm-modal-overlay').remove(); stopAlarmSound()">Dismiss</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function stopAlarmSound() {
    const audio = document.getElementById('alarmSound');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

// Start on init
// Wait for DOM to be ready before starting notification service
function waitAndStart() {
    const mainEl = document.getElementById('main');
    if (!mainEl) {
        setTimeout(waitAndStart, 100);
        return;
    }
    startNotificationService();
}
setTimeout(waitAndStart, 500);