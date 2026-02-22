/* view-people.js - Enhanced People Tab with Sort, Views, and Financial Tracking */

let peopleState = {
    view: 'grid',     // grid, timeline
    sortBy: 'name',   // name, birthday, last_contact, next_interaction, favorite
    filter: '',
    expandedId: null  // Currently expanded card ID
};

// Helper: Calculate balance from people_debts
function getPersonBalance(personId) {
    const debts = state.data.people_debts || [];
    const personDebts = debts.filter(d => String(d.person_id) === String(personId));
    let balance = 0;
    personDebts.forEach(d => {
        balance += parseFloat(d.amount || 0);
    });
    return balance;
}

function renderPeople() {
    let people = (state.data.people || []).map(p => ({
        ...p,
        _balance: getPersonBalance(p.id)
    }));

    // Sort
    people.sort((a, b) => {
        // Favorites first always
        const aFav = a.is_favorite === true || a.is_favorite === 'true';
        const bFav = b.is_favorite === true || b.is_favorite === 'true';
        if (aFav !== bFav) return aFav ? -1 : 1;

        switch (peopleState.sortBy) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'birthday':
                if (!a.birthday && !b.birthday) return 0;
                if (!a.birthday) return 1;
                if (!b.birthday) return -1;
                return a.birthday.localeCompare(b.birthday);
            case 'last_contact':
                return (b.last_contact || '').localeCompare(a.last_contact || '');
            case 'next_interaction':
                if (!a.next_interaction && !b.next_interaction) return 0;
                if (!a.next_interaction) return 1;
                if (!b.next_interaction) return -1;
                return a.next_interaction.localeCompare(b.next_interaction);
            default:
                return 0;
        }
    });

    // Filter
    if (peopleState.filter) {
        people = people.filter(p => (p.name || '').toLowerCase().includes(peopleState.filter.toLowerCase()));
    }

    document.getElementById('main').innerHTML = `
      <div class="people-wrapper">
        <style>
            .people-header {
                background: linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%);
                border-radius: 20px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
            }
            .people-title {
                font-size: 28px;
                font-weight: 700;
                color: var(--text-1);
                margin: 0 0 16px 0;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .people-title i {
                color: var(--primary);
            }
            .people-controls {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                align-items: center;
                justify-content: space-between;
            }
            .people-search {
                flex: 1;
                min-width: 180px;
                max-width: 320px;
                position: relative;
            }
            .people-search input {
                width: 100%;
                padding: 10px 14px;
                padding-left: 38px;
                border: 1px solid var(--border-color);
                border-radius: 10px;
                background: var(--surface-2);
                color: var(--text-1);
                font-size: 13px;
                transition: all 0.2s;
                box-sizing: border-box;
            }
            .people-search input:focus {
                background: var(--surface-1);
                border-color: var(--primary);
            }
            .people-search input:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
            }
            .people-actions {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            .people-view-tabs {
                display: flex;
                gap: 4px;
                background: var(--bg-main);
                padding: 6px;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.05);
            }
            .people-tab {
                padding: 10px 14px;
                border: 1px solid var(--border-color);
                background: var(--surface-2);
                color: var(--text-muted);
                cursor: pointer;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
            }
            .people-tab:hover { 
                background: var(--surface-2); 
                color: var(--text-1);
            }
            .people-tab.active { 
                background: linear-gradient(135deg, var(--primary), var(--primary-dark, #4F46E5));
                color: white;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
            }
            .people-sort-select {
                padding: 10px 16px;
                border: 1px solid var(--border-color);
                border-radius: 10px;
                background: var(--surface-2);
                color: var(--text-1);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
            }
            .people-sort-select:hover {
                background: var(--surface-3);
            }
            .people-sort-select:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
            }
            .add-person-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 12px;
                background: linear-gradient(135deg, var(--primary), var(--primary-dark, #4F46E5));
                color: white;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                transition: all 0.2s;
            }
            .add-person-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(79, 70, 229, 0.5);
            }
            .person-card-new {
                background: var(--surface-1);
                border-radius: 20px;
                padding: 24px;
                border: 1px solid var(--border-color);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
            }
            .person-card-new:hover {
                transform: translateY(-6px);
                box-shadow: 0 20px 40px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
            }
            .person-avatar-lg {
                width: 56px;
                height: 56px;
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                font-weight: 700;
                background: linear-gradient(135deg, var(--primary-soft, #E0E7FF), var(--primary));
                color: var(--primary);
                box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
            }
            .person-name-lg {
                font-size: 20px;
                font-weight: 700;
                color: var(--text-1);
            }
            .person-meta {
                font-size: 14px;
                color: var(--text-muted);
                margin-top: 4px;
            }
            .streak-pill {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                background: linear-gradient(135deg, #FEF3C7, #FDE68A);
                border-radius: 24px;
                font-size: 14px;
                font-weight: 600;
                color: #92400E;
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
            }
            .balance-positive {
                color: var(--success);
                font-weight: 700;
            }
            .balance-negative {
                color: var(--error);
                font-weight: 700;
            }
            .balance-zero { color: var(--text-muted); }
            .people-timeline { position: relative; padding-left: 36px; }
            .people-timeline::before {
                content: ''; position: absolute; left: 14px; top: 0; bottom: 0;
                width: 3px; background: linear-gradient(to bottom, var(--primary), var(--border-color));
                border-radius: 2px;
            }
            .timeline-person {
                position: relative; margin-bottom: 20px; padding: 20px;
                background: var(--surface-1); border-radius: 16px; cursor: pointer;
                border: 1px solid var(--border-color);
                transition: all 0.3s;
                box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            }
            .timeline-person:hover {
                transform: translateX(8px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            }
            .timeline-person::before {
                content: ''; position: absolute; left: -28px; top: 28px;
                width: 16px; height: 16px; border-radius: 50%;
                background: var(--primary); border: 4px solid var(--bg-main);
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
            }
            .timeline-person.overdue::before { 
                background: var(--error);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
            }
            .timeline-person.upcoming::before { 
                background: var(--warning);
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
            }
            .people-list-item {
                display: flex; align-items: center; gap: 20px; padding: 20px;
                background: var(--surface-1); border-radius: 16px; margin-bottom: 16px;
                cursor: pointer; transition: all 0.3s;
                border: 1px solid var(--border-color);
                box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            }
            .people-list-item:hover { 
                background: var(--surface-2); 
                transform: translateX(8px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            }
            .people-list-avatar {
                width: 52px;
                height: 52px;
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                font-weight: 700;
                background: linear-gradient(135deg, var(--primary-soft, #E0E7FF), var(--primary));
                color: var(--primary);
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            }
            .debt-modal-amount { 
                font-size: 32px; 
                font-weight: 800; 
                text-align: center; 
                padding: 32px;
                background: linear-gradient(135deg, var(--surface-2), var(--surface-1));
                border-radius: 20px;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
            }
            .person-action-btn {
                padding: 10px 18px;
                border: none;
                border-radius: 12px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
            }
            .person-action-btn.primary {
                background: linear-gradient(135deg, var(--primary), var(--primary-dark, #4F46E5));
                color: white;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            }
            .person-action-btn.primary:hover {
                filter: brightness(1.1);
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
            }
            .person-action-btn.secondary {
                background: var(--surface-2);
                color: var(--text-1);
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .person-action-btn.secondary:hover {
                background: var(--surface-3);
                transform: translateY(-2px);
            }
            .person-action-btn.icon {
                padding: 10px;
                background: var(--surface-2);
                color: var(--text-muted);
                box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .person-action-btn.icon:hover {
                background: var(--surface-3);
                color: var(--text-1);
                transform: translateY(-2px);
            }
            .person-card-collapsed {
                max-height: 120px;
                overflow: hidden;
            }
            .person-card-expanded {
                max-height: 2000px;
            }
            .person-card-body {
                overflow: hidden;
                transition: all 0.4s ease;
            }
            .person-expand-icon {
                transition: transform 0.4s ease;
            }
            .person-card-expanded .person-expand-icon {
                transform: rotate(180deg);
            }
        </style>
        
        <div class="people-header">
            <h1 class="people-title">
                <i data-lucide="users" style="width:32px; height:32px;"></i>
                People
            </h1>
            <div class="people-controls">
                <div class="people-search">
                    <i data-lucide="search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:16px; color:var(--text-muted);"></i>
                    <input type="text" placeholder="Search people..." value="${peopleState.filter}" oninput="peopleState.filter=this.value; renderPeople()">
                </div>
                <div class="people-actions">
                    <select class="people-sort-select" onchange="peopleState.sortBy=this.value; renderPeople()">
                        <option value="favorite" ${peopleState.sortBy === 'favorite' ? 'selected' : ''}>⭐ Favorites</option>
                        <option value="name" ${peopleState.sortBy === 'name' ? 'selected' : ''}>Name</option>
                        <option value="birthday" ${peopleState.sortBy === 'birthday' ? 'selected' : ''}>Birthday</option>
                        <option value="last_contact" ${peopleState.sortBy === 'last_contact' ? 'selected' : ''}>Last Contact</option>
                        <option value="next_interaction" ${peopleState.sortBy === 'next_interaction' ? 'selected' : ''}>Next Interaction</option>
                    </select>
                    <div class="people-view-tabs">
                        <button class="people-tab ${peopleState.view === 'grid' ? 'active' : ''}" onclick="window.switchPeopleView('grid')" title="Grid View">
                            <i data-lucide="layout-grid" style="width:18px"></i>
                        </button>
                        <button class="people-tab ${peopleState.view === 'timeline' ? 'active' : ''}" onclick="window.switchPeopleView('timeline')" title="Timeline View">
                            <i data-lucide="calendar" style="width:18px"></i>
                        </button>
                    </div>
                    <button class="add-person-btn" onclick="window.openPersonModal()">
                        <i data-lucide="plus" style="width:18px"></i>
                        Add Person
                    </button>
                </div>
            </div>
        </div>

        <div style="padding: 0 4px;">
          ${peopleState.view === 'grid' ? renderPeopleGrid(people) : ''}
          ${peopleState.view === 'timeline' ? renderPeopleTimeline(people) : ''}
        </div>
    `;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

window.switchPeopleView = function(view) {
    peopleState.view = view;
    renderPeople();
};

window.togglePersonCard = function(personId) {
    try {
        peopleState.expandedId = String(peopleState.expandedId) === String(personId) ? null : personId;
        renderPeople();
    } catch(e) {
        console.error('Error in togglePersonCard:', e);
    }
};

// Grid View
function renderPeopleGrid(people) {
    if (people.length === 0) return '<div class="empty-state">No contacts found</div>';
    return `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
        ${people.map(p => renderPersonCard(p, String(peopleState.expandedId) === String(p.id))).join('')}
    </div>`;
}

// List View
function renderPeopleList(people) {
    if (people.length === 0) return '<div class="empty-state">No contacts found</div>';
    return `<div class="people-list">${people.map(renderPersonListItem).join('')}</div>`;
}

// Timeline View - based on next_interaction
function renderPeopleTimeline(people) {
    // Group by month-year of next_interaction
    const today = new Date().toISOString().slice(0, 10);
    const withDates = people.filter(p => p.next_interaction);
    const withoutDates = people.filter(p => !p.next_interaction);

    // Sort by next_interaction
    withDates.sort((a, b) => (a.next_interaction || '').localeCompare(b.next_interaction || ''));

    let html = '';

    if (withDates.length > 0) {
        const grouped = {};
        withDates.forEach(p => {
            const date = new Date(p.next_interaction);
            const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(p);
        });

        Object.keys(grouped).forEach(month => {
            html += `<h3 style="margin:20px 0 10px; color:var(--text-muted); font-size:14px;">${month}</h3>`;
            html += `<div class="people-timeline">`;
            grouped[month].forEach(p => {
                const isOverdue = p.next_interaction < today;
                const isUpcoming = !isOverdue && new Date(p.next_interaction) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                html += `<div class="timeline-person ${isOverdue ? 'overdue' : (isUpcoming ? 'upcoming' : '')}" onclick="window.openEditPerson('${p.id}')">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:600;">${p.name}</div>
                        <div style="font-size:12px; color:${isOverdue ? 'var(--error)' : 'var(--text-muted)'}">
                            ${new Date(p.next_interaction).toLocaleDateString()}
                            ${isOverdue ? ' (Overdue)' : ''}
                        </div>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${p.relationship || 'Contact'}</div>
                </div>`;
            });
            html += `</div>`;
        });
    }

    if (withoutDates.length > 0) {
        html += `<h3 style="margin:20px 0 10px; color:var(--text-muted); font-size:14px;">No Next Interaction Set</h3>`;
        html += `<div class="people-timeline">`;
        withoutDates.forEach(p => {
            html += `<div class="timeline-person" onclick="window.openEditPerson('${p.id}')">
                <div style="font-weight:600;">${p.name}</div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${p.relationship || 'Contact'}</div>
            </div>`;
        });
        html += `</div>`;
    }

    return html || '<div class="empty-state">No contacts with next interaction set</div>';
}

function renderPersonListItem(p) {
    const lastContact = p.last_contact ? new Date(p.last_contact).toLocaleDateString() : 'Never';
    const nextInt = p.next_interaction ? new Date(p.next_interaction).toLocaleDateString() : 'Not set';
    const isFav = p.is_favorite === true || p.is_favorite === 'true';
    const balance = p._balance || 0;
    const balanceClass = balance > 0 ? 'balance-positive' : (balance < 0 ? 'balance-negative' : 'balance-zero');

    return `
    <div class="people-list-item" onclick="window.openEditPerson('${p.id}')">
        <div class="avatar" style="width:40px; height:40px; border-radius:50%; background:var(--primary-soft); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold">
            ${(p.name || '?').charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;">
            <div style="font-weight:600;">${p.name} ${isFav ? '⭐' : ''}</div>
            <div style="font-size:12px; color:var(--text-muted);">${p.relationship || 'Contact'}</div>
        </div>
        <div style="text-align:right; font-size:12px;">
            <div>Last: ${lastContact}</div>
            <div>Next: ${nextInt}</div>
        </div>
        ${balance !== 0 ? `<div class="${balanceClass}" style="font-weight:600; font-size:14px;">${balance > 0 ? '+' : ''}₹${balance}</div>` : ''}
    </div>`;
}

function renderPersonCard(p, isExpanded = false) {
    const lastContact = p.last_contact ? new Date(p.last_contact).toLocaleDateString() : 'Never';
    const isFav = p.is_favorite === true || p.is_favorite === 'true';
    const balance = p._balance || 0;
    const balanceClass = balance > 0 ? 'balance-positive' : (balance < 0 ? 'balance-negative' : 'balance-zero');

    return `
    <div class="card person-card person-card-${isExpanded ? 'expanded' : 'collapsed'}" style="position:relative; border:1px solid var(--border-color); border-radius:20px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.02); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%);">
       <div class="person-card-header" onclick="window.togglePersonCard('${p.id}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:20px; transition:background 0.2s;">
           <div style="display:flex; gap:14px; align-items:center">
               <div class="avatar" style="width:52px; height:52px; border-radius:16px; background:linear-gradient(135deg, var(--primary-soft), var(--primary)); color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:20px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                   ${(p.name || '?').charAt(0).toUpperCase()}
               </div>
               <div>
                   <div style="font-weight:700; font-size:18px; color:var(--text-primary); letter-spacing:-0.3px">${p.name}</div>
                   <div style="font-size:14px; color:var(--text-muted); margin-top:2px">${p.relationship || 'Contact'}</div>
               </div>
           </div>
           <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn icon" onclick="event.stopPropagation(); window.toggleFavoritePerson('${p.id}', ${!isFav})" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    <i data-lucide="star" style="width:18px; ${isFav ? 'fill:var(--warning); color:var(--warning)' : 'color:var(--text-muted)'}"></i>
                </button>
                <i data-lucide="chevron-down" class="person-expand-icon" style="width:22px; color:var(--text-muted); ${isExpanded ? 'transform:rotate(180deg);' : ''}"></i>
            </div>
        </div>
        
        <div class="person-card-body" style="${isExpanded ? 'max-height:500px; opacity:1;' : 'max-height:0; opacity:0;'} overflow:hidden; transition:all 0.3s ease; margin-top:12px; font-size:13px; color:var(--text-secondary)">
           <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px">
               <i data-lucide="clock" style="width:12px"></i> Last: ${lastContact}
           </div>
           ${p.next_interaction ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; color:var(--primary);">
               <i data-lucide="calendar" style="width:12px"></i> Next: ${new Date(p.next_interaction).toLocaleDateString()}
           </div>` : ''}
           ${p.birthday ? `<div style="display:flex; gap:6px; align-items:center"><i data-lucide="cake" style="width:12px"></i> ${new Date(p.birthday).toLocaleDateString()}</div>` : ''}
       </div>

       ${balance !== 0 ? `<div style="margin-top:10px; padding:8px; background:var(--surface-2); border-radius:6px; text-align:center;">
            <span class="${balanceClass}" style="font-weight:600;">${balance > 0 ? 'They owe you' : 'You owe them'}: ₹${Math.abs(balance)}</span>
       </div>` : ''}

       ${p.notes ? `<div style="margin-top:10px; font-size:12px; background:var(--bg-main); padding:8px; border-radius:6px; font-style:italic">"${p.notes}"</div>` : ''}

       <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; border-top:1px solid var(--border-color); padding-top:10px">
           <button class="btn small secondary" onclick="event.stopPropagation(); window.openDebtModal('${p.id}')" title="Add Financial Transaction">
               <i data-lucide="indian-rupee" style="width:14px"></i> Money
           </button>
           <button class="btn small primary" onclick="event.stopPropagation(); window.logContact('${p.id}')">Log</button>
           <button class="btn icon" onclick="event.stopPropagation(); window.openEditPerson('${p.id}')"><i data-lucide="pencil" style="width:14px"></i></button>
           <button class="btn icon" onclick="event.stopPropagation(); window.deletePerson('${p.id}')" title="Delete Person"><i data-lucide="trash-2" style="width:14px"></i></button>
       </div>
   </div>`;
}

// --- ACTIONS ---

window.openPersonModal = function () {
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
    <h3>Add Person</h3>
    <input class="input" id="mPersonName" placeholder="Name">
    <select class="input" id="mPersonRel">
        <option value="Friend">Friend</option>
        <option value="Family">Family</option>
        <option value="Network">Network</option>
        <option value="Work">Work</option>
        <option value="Other">Other</option>
    </select>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <div>
            <label style="font-size:12px; color:var(--text-muted)">Birthday</label>
            <input type="date" class="input" id="mPersonBday">
        </div>
        <div>
            <label style="font-size:12px; color:var(--text-muted)">Next Interaction</label>
            <input type="date" class="input" id="mPersonNextInt">
        </div>
    </div>
    <div style="margin-bottom:10px">
        <input class="input" id="mPersonPhone" placeholder="Phone">
    </div>
    <div style="margin-bottom:10px">
        <input class="input" id="mPersonEmail" placeholder="Email">
    </div>
    <textarea class="input" id="mPersonNotes" placeholder="Notes (Interests, details...)" rows="3"></textarea>
    
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="save-person-modal">Save</button>
    </div>
  `;
    modal.classList.remove('hidden');
};

window.openEditPerson = function (id) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (!p) return;
    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
    <h3>Edit Person</h3>
    <input class="input" id="mPersonName" value="${(p.name || '').replace(/"/g, '"')}" placeholder="Name">
    <select class="input" id="mPersonRel">
        <option value="Friend" ${p.relationship === 'Friend' ? 'selected' : ''}>Friend</option>
        <option value="Family" ${p.relationship === 'Family' ? 'selected' : ''}>Family</option>
        <option value="Network" ${p.relationship === 'Network' ? 'selected' : ''}>Network</option>
        <option value="Work" ${p.relationship === 'Work' ? 'selected' : ''}>Work</option>
        <option value="Other" ${p.relationship === 'Other' ? 'selected' : ''}>Other</option>
    </select>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <div>
            <label style="font-size:12px; color:var(--text-muted)">Birthday</label>
            <input type="date" class="input" id="mPersonBday" value="${(p.birthday || '').slice(0, 10)}">
        </div>
        <div>
            <label style="font-size:12px; color:var(--text-muted)">Next Interaction</label>
            <input type="date" class="input" id="mPersonNextInt" value="${(p.next_interaction || '').slice(0, 10)}">
        </div>
    </div>
    <div style="margin-bottom:10px">
        <input class="input" id="mPersonPhone" value="${p.phone || ''}" placeholder="Phone">
    </div>
    <div style="margin-bottom:10px">
        <input class="input" id="mPersonEmail" value="${p.email || ''}" placeholder="Email">
    </div>
    <textarea class="input" id="mPersonNotes" placeholder="Notes..." rows="3">${p.notes || ''}</textarea>
    
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="update-person-modal" data-edit-id="${p.id}">Update</button>
    </div>
  `;
    modal.classList.remove('hidden');
};

// Delete Person
window.deletePerson = async function(id) {
    if (!confirm('Are you sure you want to delete this person? This will also delete all their debt records.')) return;
    
    try {
        await apiCall('people', 'delete', { id: String(id) });
        // Also delete related debts
        const debts = (state.data.people_debts || []).filter(d => String(d.person_id) === String(id));
        for (const debt of debts) {
            await apiCall('people_debts', 'delete', { id: String(debt.id) });
        }
        await refreshData('people');
        showToast('Person deleted successfully');
    } catch (e) {
        console.error('Delete error:', e);
        showToast('Failed to delete person');
    }
};

// Debt/Money Modal
window.openDebtModal = function(personId) {
    const p = (state.data.people || []).find(x => String(x.id) === String(personId));
    if (!p) return;
    
    // Calculate balance
    const debts = (state.data.people_debts || []).filter(d => String(d.person_id) === String(personId));
    let balance = 0;
    debts.forEach(d => { balance += parseFloat(d.amount || 0); });
    p._balance = balance;

    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    // Show existing transactions
    let historyHtml = '';
    if (debts.length > 0) {
        const sortedDebts = [...debts].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
        historyHtml = `<div style="margin-top:16px;">
            <h4 style="font-size:14px; margin-bottom:8px;">Recent Transactions</h4>
            ${sortedDebts.map(d => `
                <div style="display:flex; justify-content:space-between; padding:8px; background:var(--surface-2); border-radius:4px; margin-bottom:4px; font-size:12px;">
                    <span>${d.date ? new Date(d.date).toLocaleDateString() : 'Unknown'}</span>
                    <span style="font-weight:600; color:${parseFloat(d.amount) > 0 ? 'var(--success)' : 'var(--error)'}">
                        ${parseFloat(d.amount) > 0 ? '+' : ''}₹${d.amount} (${d.type})
                    </span>
                </div>
            `).join('')}
        </div>`;
    }

    box.innerHTML = `
    <h3>💰 Money with ${p.name}</h3>
    <div class="debt-modal-amount">
        <span class="${p._balance > 0 ? 'balance-positive' : (p._balance < 0 ? 'balance-negative' : 'balance-zero')}">
            ${p._balance > 0 ? 'They owe you' : (p._balance < 0 ? 'You owe them' : 'Settled')}
            ₹${Math.abs(p._balance || 0)}
        </span>
    </div>
    
    <div style="margin-bottom:10px">
        <label style="font-size:12px; color:var(--text-muted)">Amount</label>
        <input type="number" class="input" id="mDebtAmount" placeholder="0.00" step="0.01">
    </div>
    <div style="margin-bottom:10px">
        <label style="font-size:12px; color:var(--text-muted)">Type</label>
        <select class="input" id="mDebtType">
            <option value="given">Given (They owe me)</option>
            <option value="taken">Taken (I owe them)</option>
        </select>
    </div>
    <div style="margin-bottom:10px">
        <label style="font-size:12px; color:var(--text-muted)">Date</label>
        <input type="date" class="input" id="mDebtDate" value="${new Date().toISOString().slice(0, 10)}">
    </div>
    <div style="margin-bottom:10px">
        <label style="font-size:12px; color:var(--text-muted)">Notes</label>
        <input class="input" id="mDebtNotes" placeholder="Optional notes">
    </div>
    
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" onclick="window.saveDebt('${personId}')">Add Transaction</button>
    </div>
    ${historyHtml}
    `;
    modal.classList.remove('hidden');
};

window.saveDebt = async function(personId) {
    const amount = parseFloat(document.getElementById('mDebtAmount').value);
    const type = document.getElementById('mDebtType').value;
    const date = document.getElementById('mDebtDate').value;
    const notes = document.getElementById('mDebtNotes').value;

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount');
        return;
    }

    // Convert to signed amount: given = positive, taken = negative
    const signedAmount = type === 'given' ? amount : -amount;

    const newDebt = {
        id: 'temp-' + Date.now(),
        person_id: personId,
        amount: signedAmount,
        type: type,
        date: date,
        notes: notes
    };

    if (!state.data.people_debts) state.data.people_debts = [];
    state.data.people_debts.push(newDebt);

    document.getElementById('universalModal').classList.add('hidden');
    await apiCall('create', 'people_debts', newDebt);
    showToast('Transaction added');
    renderPeople();
};

window.logContact = function (id) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (!p) return;

    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');

    box.innerHTML = `
      <h3>Log Interaction</h3>
      <p style="margin-bottom:20px; color:var(--text-secondary)">Log that you caught up with <b>${p.name}</b> today?</p>
      <div style="margin-bottom:15px;">
        <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">Add a note (optional)</label>
        <textarea class="input" id="mLogNote" placeholder="What did you talk about?" rows="3"></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" onclick="window.confirmLogContact('${id}')">Log Interaction</button>
      </div>
    `;
    modal.classList.remove('hidden');
};

window.confirmLogContact = async function (id) {
    const noteInput = document.getElementById('mLogNote');
    const note = noteInput ? noteInput.value.trim() : '';
    
    document.getElementById('universalModal').classList.add('hidden');
    const today = new Date().toISOString();
    const dateStr = new Date().toLocaleDateString();

    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (p) {
        p.last_contact = today;
        const logEntry = note 
            ? `[${dateStr}] ${note}` 
            : `[${dateStr}] Interaction logged.`;
        p.notes = p.notes ? p.notes + '\n' + logEntry : logEntry;

        await apiCall('update', 'people', {
            last_contact: today,
            notes: p.notes
        }, id);
        showToast(`Logged interaction with ${p.name}`);
    }
    renderPeople();
};

window.toggleFavoritePerson = async function (id, isFav) {
    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (p) p.is_favorite = isFav;
    renderPeople();

    await apiCall('update', 'people', { is_favorite: isFav }, id);
};
