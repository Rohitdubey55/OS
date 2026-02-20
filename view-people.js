/* view-people.js */

function renderPeople() {
    const people = state.data.people || [];

    // Sort: Favorites first, then by last contact (recent first)
    people.sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1; // Favorites first
        return (b.last_contact || '').localeCompare(a.last_contact || '');
    });

    document.getElementById('main').innerHTML = `
      <div class="people-wrapper">
        <div class="header-row">
          <h2 class="page-title">People</h2>
          <button class="btn primary" onclick="openPersonModal()">+ Add Person</button>
        </div>

        <div class="input-group" style="margin-bottom:20px">
           <input class="input" placeholder="Search people..." oninput="renderPeopleList(this.value)">
        </div>



        <div id="people-grid" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
           ${people.map(renderPersonCard).join('')}
        </div>
      </div>
  `;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function renderPeopleList(filter = '') {
    const people = state.data.people || [];
    const container = document.getElementById('people-grid');
    if (!container) return;

    const filtered = people.filter(p => (p.name || '').toLowerCase().includes(filter.toLowerCase()));

    container.innerHTML = filtered.length ? filtered.map(renderPersonCard).join('') : '<div class="empty-state">No contacts found</div>';
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function renderPersonCard(p) {
    const lastContact = p.last_contact ? new Date(p.last_contact).toLocaleDateString() : 'Never';
    const isFav = p.is_favorite === true || p.is_favorite === 'true';

    return `
    <div class="card person-card" style="position:relative">
       <div style="display:flex; justify-content:space-between; align-items:start">
           <div style="display:flex; gap:12px; align-items:center">
               <div class="avatar" style="width:40px; height:40px; border-radius:50%; background:var(--primary-soft); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold">
                   ${(p.name || '?').charAt(0).toUpperCase()}
               </div>
               <div>
                   <div style="font-weight:600; font-size:1.1em">${p.name}</div>
                   <div style="font-size:12px; color:var(--text-muted)">${p.relationship || 'Contact'}</div>
               </div>
           </div>
           <button class="btn icon" onclick="toggleFavoritePerson('${p.id}', ${!isFav})">
               <i data-lucide="star" style="width:16px; ${isFav ? 'fill:var(--warning); color:var(--warning)' : 'color:var(--text-muted)'}"></i>
           </button>
       </div>
       
       <div style="margin-top:12px; font-size:13px; color:var(--text-secondary)">
           <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px">
               <i data-lucide="clock" style="width:12px"></i> Last Contact: ${lastContact}
           </div>
           ${p.birthday ? `<div style="display:flex; gap:6px; align-items:center"><i data-lucide="cake" style="width:12px"></i> ${new Date(p.birthday).toLocaleDateString()}</div>` : ''}
       </div>

       ${p.notes ? `<div style="margin-top:10px; font-size:12px; background:var(--bg-main); padding:8px; border-radius:6px; font-style:italic">"${p.notes}"</div>` : ''}

       <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px; border-top:1px solid var(--border-color); padding-top:10px">
           <button class="btn small primary" onclick="logContact('${p.id}')">Log Interaction</button>
           <button class="btn icon" onclick="openEditPerson('${p.id}')"><i data-lucide="pencil" style="width:14px"></i></button>
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
    <div style="margin-bottom:10px">
        <label style="font-size:12px; color:var(--text-muted)">Birthday</label>
        <input type="date" class="input" id="mPersonBday">
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
    <input class="input" id="mPersonName" value="${(p.name || '').replace(/"/g, '&quot;')}" placeholder="Name">
    <select class="input" id="mPersonRel">
        <option value="Friend" ${p.relationship === 'Friend' ? 'selected' : ''}>Friend</option>
        <option value="Family" ${p.relationship === 'Family' ? 'selected' : ''}>Family</option>
        <option value="Network" ${p.relationship === 'Network' ? 'selected' : ''}>Network</option>
        <option value="Work" ${p.relationship === 'Work' ? 'selected' : ''}>Work</option>
        <option value="Other" ${p.relationship === 'Other' ? 'selected' : ''}>Other</option>
    </select>
    <div style="margin-bottom:10px">
        <label style="font-size:12px; color:var(--text-muted)">Birthday</label>
        <input type="date" class="input" id="mPersonBday" value="${(p.birthday || '').slice(0, 10)}">
    </div>
    <textarea class="input" id="mPersonNotes" placeholder="Notes..." rows="3">${p.notes || ''}</textarea>
    
    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
      <button class="btn" onclick="document.getElementById('universalModal').classList.add('hidden')">Cancel</button>
      <button class="btn primary" data-action="update-person-modal" data-edit-id="${p.id}">Update</button>
    </div>
  `;
    modal.classList.remove('hidden');
};

window.logContact = function (id) {
    const p = state.data.people.find(x => String(x.id) === String(id));
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

    const p = state.data.people.find(x => String(x.id) === String(id));
    if (p) {
        p.last_contact = today;
        // Append to notes for history
        const logEntry = `[${dateStr}] Interaction logged.`;
        p.notes = p.notes ? p.notes + '\n' + logEntry : logEntry;
    }

    // Refresh list if we are on people view
    if (state.view === 'people') {
        renderPeopleList(document.querySelector('.input[placeholder="Search people..."]')?.value || '');
    }

    await apiCall('update', 'people', {
        last_contact: today,
        notes: p.notes
    }, id);
    showToast(`Logged interaction with ${p.name}`);
};

window.toggleFavoritePerson = async function (id, isFav) {
    const p = state.data.people.find(x => String(x.id) === String(id));
    if (p) p.is_favorite = isFav;
    renderPeople(); // Re-sort

    await apiCall('update', 'people', { is_favorite: isFav }, id);
};


