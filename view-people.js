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
            .people-view-tabs {
                display: flex;
                gap: 4px;
                background: var(--surface-2);
                padding: 4px;
                border-radius: 10px;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
            }
            .people-tab {
                padding: 8px 14px;
                border: none;
                background: transparent;
                color: var(--text-muted);
                cursor: pointer;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s;
            }
            .people-tab:hover { 
                background: var(--surface-1); 
                color: var(--text-1);
            }
            .people-tab.active { 
                background: linear-gradient(135deg, var(--primary), var(--primary-dark, #4F46E5));
                color: white;
                box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
            }
            .people-sort-select {
                padding: 8px 14px;
                border: 1px solid var(--border-color);
                border-radius: 10px;
                background: var(--surface-1);
                color: var(--text-1);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .people-sort-select:focus {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }
            .person-card-new {
                background: var(--surface-1);
                border-radius: 16px;
                padding: 20px;
                border: 1px solid var(--border-color);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
            }
            .person-card-new:hover {
                transform: translateY(-4px);
                box-shadow: 0 10px 25px rgba(0,0,0,0.1), 0 6px 10px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
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
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
            }
            .person-name-lg {
                font-size: 18px;
                font-weight: 700;
                color: var(--text-1);
            }
            .person-meta {
                font-size: 13px;
                color: var(--text-muted);
                margin-top: 2px;
            }
            .streak-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 6px 12px;
                background: linear-gradient(135deg, #FEF3C7, #FDE68A);
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                color: #92400E;
                box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
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
            .people-timeline { position: relative; padding-left: 28px; }
            .people-timeline::before {
                content: ''; position: absolute; left: 10px; top: 0; bottom: 0;
                width: 2px; background: linear-gradient(to bottom, var(--primary), var(--border-color));
            }
            .timeline-person {
                position: relative; margin-bottom: 16px; padding: 16px;
                background: var(--surface-1); border-radius: 12px; cursor: pointer;
                border: 1px solid var(--border-color);
                transition: all 0.2s;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .timeline-person:hover {
                transform: translateX(4px);
                box-shadow: 0 4px 16px rgba(0,0,0,0.08);
            }
            .timeline-person::before {
                content: ''; position: absolute; left: -22px; top: 24px;
                width: 14px; height: 14px; border-radius: 50%;
                background: var(--primary); border: 3px solid var(--bg-main);
                box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
            }
            .timeline-person.overdue::before { 
                background: var(--error);
                box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
            }
            .timeline-person.upcoming::before { 
                background: var(--warning);
                box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
            }
            .people-list-item {
                display: flex; align-items: center; gap: 16px; padding: 16px;
                background: var(--surface-1); border-radius: 12px; margin-bottom: 10px;
                cursor: pointer; transition: all 0.2s;
                border: 1px solid var(--border-color);
                box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            }
            .people-list-item:hover { 
                background: var(--surface-2); 
                transform: translateX(4px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            }
            .people-list-avatar {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                font-weight: 700;
                background: linear-gradient(135deg, var(--primary-soft, #E0E7FF), var(--primary));
                color: var(--primary);
                box-shadow: 0 3px 8px rgba(79, 70, 229, 0.2);
            }
            .debt-modal-amount { 
                font-size: 28px; 
                font-weight: 800; 
                text-align: center; 
                padding: 24px;
                background: var(--surface-2);
                border-radius: 16px;
            }
            .person-action-btn {
                padding: 8px 14px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }
            .person-action-btn.primary {
                background: linear-gradient(135deg, var(--primary), var(--primary-dark, #4F46E5));
                color: white;
                box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
            }
            .person-action-btn.primary:hover {
                filter: brightness(1.1);
                transform: scale(1.02);
            }
            .person-action-btn.secondary {
                background: var(--surface-2);
                color: var(--text-1);
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .person-action-btn.secondary:hover {
                background: var(--surface-3);
            }
            .person-action-btn.icon {
                padding: 8px;
                background: var(--surface-2);
                color: var(--text-muted);
            }
            .person-action-btn.icon:hover {
                background: var(--surface-3);
                color: var(--text-1);
            }
            .person-card-collapsed {
                max-height: 100px;
                overflow: hidden;
            }
            .person-card-expanded {
                max-height: 2000px;
            }
            .person-card-body {
                overflow: hidden;
                transition: all 0.3s ease;
            }
            .person-expand-icon {
                transition: transform 0.3s;
            }
            .person-card-expanded .person-expand-icon {
                transform: rotate(180deg);
            }
        </style>

        <div class="header-row" style="flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <h2 class="page-title" style="margin:0;">People</h2>
            <button class="btn primary" onclick="openPersonModal()">+ Add Person</button>
          </div>
          
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select class="people-sort-select" onchange="peopleState.sortBy=this.value; renderPeople()">
                <option value="favorite" ${peopleState.sortBy === 'favorite' ? 'selected' : ''}>Favorites</option>
                <option value="name" ${peopleState.sortBy === 'name' ? 'selected' : ''}>Name</option>
                <option value="birthday" ${peopleState.sortBy === 'birthday' ? 'selected' : ''}>Birthday</option>
                <option value="last_contact" ${peopleState.sortBy === 'last_contact' ? 'selected' : ''}>Last Contact</option>
                <option value="next_interaction" ${peopleState.sortBy === 'next_interaction' ? 'selected' : ''}>Next Interaction</option>
            </select>

            <div class="people-view-tabs">
                <button class="people-tab ${peopleState.view === 'grid' ? 'active' : ''}" onclick="switchPeopleView('grid')" title="Grid View">
                    <i data-lucide="layout-grid" style="width:16px"></i>
                </button>
                <button class="people-tab ${peopleState.view === 'timeline' ? 'active' : ''}" onclick="switchPeopleView('timeline')" title="Timeline View">
                    <i data-lucide="calendar" style="width:16px"></i>
                </button>
            </div>
          </div>
        </div>

        <div class="input-group" style="margin-bottom:20px">
           <input class="input" placeholder="Search people..." value="${peopleState.filter}" oninput="peopleState.filter=this.value; renderPeople()">
        </div>

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
    peopleState.expandedId = peopleState.expandedId === personId ? null : personId;
    renderPeople();
};

// Grid View
function renderPeopleGrid(people) {
    if (people.length === 0) return '<div class="empty-state">No contacts found</div>';
    return `<div class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
        ${people.map(p => renderPersonCard(p, peopleState.expandedId === p.id)).join('')}
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
    withDates.sort((a, b) => a.next_interaction.localeCompare(b.next_interaction));

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
                html += `<div class="timeline-person ${isOverdue ? 'overdue' : (isUpcoming ? 'upcoming' : '')}" onclick="openEditPerson('${p.id}')">
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
            html += `<div class="timeline-person" onclick="openEditPerson('${p.id}')">
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
    <div class="people-list-item" onclick="openEditPerson('${p.id}')">
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
        ${balance !== 0 ? `<div class="${balanceClass}" style="font-weight:600; font-size:14px;">${balance > 0 ? '+' : ''}$${balance}</div>` : ''}
    </div>`;
}

function renderPersonCard(p, isExpanded = false) {
    const lastContact = p.last_contact ? new Date(p.last_contact).toLocaleDateString() : 'Never';
    const isFav = p.is_favorite === true || p.is_favorite === 'true';
    const balance = p._balance || 0;
    const balanceClass = balance > 0 ? 'balance-positive' : (balance < 0 ? 'balance-negative' : 'balance-zero');

    return `
    <div class="card person-card person-card-${isExpanded ? 'expanded' : 'collapsed'}" style="position:relative; border:1px solid var(--border-color); border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
       <div class="person-card-header" onclick="togglePersonCard('${p.id}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:16px; background:var(--surface-1); border-radius:13px 13px 0 0; transition:background 0.2s;">
           <div style="display:flex; gap:12px; align-items:center">
               <div class="avatar" style="width:40px; height:40px; border-radius:50%; background:var(--primary-soft); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold">
                   ${(p.name || '?').charAt(0).toUpperCase()}
               </div>
               <div>
                   <div style="font-weight:600; font-size:1.1em">${p.name}</div>
                   <div style="font-size:12px; color:var(--text-muted)">${p.relationship || 'Contact'}</div>
               </div>
           </div>
           <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn icon" onclick="event.stopPropagation(); toggleFavoritePerson('${p.id}', ${!isFav})" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                    <i data-lucide="star" style="width:18px; ${isFav ? 'fill:var(--warning); color:var(--warning)' : 'color:var(--text-muted)'}"></i>
                </button>
                <i data-lucide="chevron-down" class="person-expand-icon" style="width:20px;"></i>
            </div>"></i>
           </button>
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
            <span class="${balanceClass}" style="font-weight:600;">${balance > 0 ? 'They owe you' : 'You owe them'}: $${Math.abs(balance)}</span>
       </div>` : ''}

       ${p.notes ? `<div style="margin-top:10px; font-size:12px; background:var(--bg-main); padding:8px; border-radius:6px; font-style:italic">"${p.notes}"</div>` : ''}

       <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; border-top:1px solid var(--border-color); padding-top:10px">
           <button class="btn small secondary" onclick="event.stopPropagation(); openDebtModal('${p.id}')" title="Add Financial Transaction">
               <i data-lucide="dollar-sign" style="width:14px"></i> Money
           </button>
           <button class="btn small primary" onclick="event.stopPropagation(); logContact('${p.id}')">Log</button>
           <button class="btn icon" onclick="event.stopPropagation(); openEditPerson('${p.id}')"><i data-lucide="pencil" style="width:14px"></i></button>
           <button class="btn icon" data-action="delete" data-sheet="people" data-id="${p.id}"><i data-lucide="trash-2" style="width:14px"></i></button>
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

// Debt/Money Modal
window.openDebtModal = function(personId) {
    const p = (state.data.people || []).find(x => String(x.id) === String(personId));
    if (!p) return;

    const modal = document.getElementById('universalModal');
    const box = modal.querySelector('.modal-box');
    const debts = (state.data.people_debts || []).filter(d => String(d.person_id) === String(personId));

    // Show existing transactions
    let historyHtml = '';
    if (debts.length > 0) {
        const sortedDebts = [...debts].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
        historyHtml = `<div style="margin-top:16px;">
            <h4 style="font-size:14px; margin-bottom:8px;">Recent Transactions</h4>
            ${sortedDebts.map(d => `
                <div style="display:flex; justify-content:space-between; padding:8px; background:var(--surface-2); border-radius:4px; margin-bottom:4px; font-size:12px;">
                    <span>${new Date(d.date).toLocaleDateString()}</span>
                    <span style="font-weight:600; color:${parseFloat(d.amount) > 0 ? 'var(--success)' : 'var(--error)'}">
                        ${parseFloat(d.amount) > 0 ? '+' : ''}$${d.amount} (${d.type})
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
            $${Math.abs(p._balance || 0)}
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
      <button class="btn primary" onclick="saveDebt('${personId}')">Add Transaction</button>
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
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
        <button class="btn primary" onclick="confirmLogContact('${id}')">Yes, Log It</button>
      </div>
    `;
    modal.classList.remove('hidden');
};

window.confirmLogContact = async function (id) {
    document.getElementById('universalModal').classList.add('hidden');
    const today = new Date().toISOString();
    const dateStr = new Date().toLocaleDateString();

    const p = (state.data.people || []).find(x => String(x.id) === String(id));
    if (p) {
        p.last_contact = today;
        const logEntry = `[${dateStr}] Interaction logged.`;
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
