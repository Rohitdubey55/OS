/* view-life-calendar.js */

let currentCalendarView = 'lifetime'; // 'lifetime' or 'thisyear'

function renderLifeCalendar() {
    const settings = state.data.settings?.[0] || {};
    const dobStr = settings.dob;

    if (!dobStr) {
        document.getElementById('main').innerHTML = `
      <div style="padding: 20px; text-align: center; margin-top: 50px;">
        <h3>Date of Birth Required</h3>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">Please set your date of birth in Settings to view your Life Calendar.</p>
        <button class="btn primary" onclick="routeTo('settings')">Go to Settings</button>
      </div>
    `;
        return;
    }

    const dob = new Date(dobStr);
    const now = new Date();
    const currentYear = now.getFullYear();
    const birthYear = dob.getFullYear();

    // Calculate weeks passed since birth
    const diffTime = Math.abs(now - dob);
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    const ageYears = Math.floor(diffWeeks / 52);

    // Header with Toggle
    let html = `
    <div class="calendar-header" style="position: sticky; top: 0; background: var(--bg-main); z-index: 10; padding: 16px 20px; border-bottom: 1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
       <div>
         <h1 style="font-size: 24px; margin:0; line-height:1.2;">Time Flow</h1>
         <div style="font-size: 13px; color: var(--text-muted);">Age: ${ageYears} &nbsp;&bull;&nbsp; ${diffWeeks} weeks lived</div>
       </div>
       <div style="display:flex; background: var(--surface-2); padding: 4px; border-radius: 12px; gap:4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
          <button class="btn ${currentCalendarView === 'thisyear' ? 'primary' : 'ghost'}" style="${currentCalendarView === 'thisyear' ? 'box-shadow: 0 2px 8px var(--primary-glow);' : ''} padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight:600;" onclick="switchCalendarView('thisyear')">This Year</button>
          <button class="btn ${currentCalendarView === 'lifetime' ? 'primary' : 'ghost'}" style="${currentCalendarView === 'lifetime' ? 'box-shadow: 0 2px 8px var(--primary-glow);' : ''} padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight:600;" onclick="switchCalendarView('lifetime')">Lifetime</button>
       </div>
    </div>
    
    <div class="calendar-content" style="padding: 20px; max-width: 800px; margin: 0 auto; overflow-x: auto;">
  `;

    if (currentCalendarView === 'lifetime') {
        html += renderLifetimeGrid(diffWeeks);
    } else {
        html += renderThisYearGrid(now);
    }

    html += `</div>`;

    document.getElementById('main').innerHTML = html;
}

window.switchCalendarView = function (viewType) {
    currentCalendarView = viewType;
    renderLifeCalendar();
}

function renderLifetimeGrid(weeksLived) {
    const TOTAL_YEARS = 50;
    const WEEKS_PER_YEAR = 52;

    let gridHtml = `
  <div style="margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); text-align: center;">Each square represents one week of your life. 50 Years total.</div>
  <div class="life-grid-container" style="display: flex; flex-direction: column; gap: 4px;">`;

    for (let year = 0; year < TOTAL_YEARS; year++) {
        // Only show year label every 5 years for a cleaner look
        let yearLabel = (year % 5 === 0) ? `<div style="width: 24px; font-size: 10px; color: var(--text-muted); text-align: right; padding-right: 6px; user-select:none;">${year}</div>` : `<div style="width: 24px;"></div>`;

        gridHtml += `<div style="display: flex; gap: 4px; align-items: center; justify-content:center; flex-wrap:nowrap;">`;
        gridHtml += yearLabel;

        for (let week = 0; week < WEEKS_PER_YEAR; week++) {
            const absoluteWeek = (year * WEEKS_PER_YEAR) + week;
            let statusClass = 'future';
            let titleParams = `Age ${year}, Week ${week + 1}`;

            if (absoluteWeek < weeksLived) {
                statusClass = 'past';
                titleParams += " (Past)";
            } else if (absoluteWeek === weeksLived) {
                statusClass = 'current';
                titleParams += " (Current Week)";
            } else {
                titleParams += " (Future)";
            }

            gridHtml += `<div class="week-square ${statusClass}" title="${titleParams}"></div>`;
        }
        gridHtml += `</div>`;
    }

    gridHtml += `</div>
  
  <div style="display:flex; justify-content:center; gap: 16px; margin-top: 24px; font-size: 12px; color: var(--text-muted);">
     <div style="display:flex; align-items:center; gap:6px;"><div class="week-square past"></div> Past</div>
     <div style="display:flex; align-items:center; gap:6px;"><div class="week-square current"></div> Current</div>
     <div style="display:flex; align-items:center; gap:6px;"><div class="week-square future"></div> Future</div>
  </div>`;

    return gridHtml;
}

function renderThisYearGrid(now) {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diffTime = Math.abs(now - startOfYear);
    const currentWeekNum = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    const WEEKS_PER_YEAR = 52;

    let gridHtml = `
  <div style="margin-bottom: 24px; font-size: 13px; color: var(--text-secondary); text-align: center;">52 Weeks of ${now.getFullYear()}</div>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(20px, 1fr)); gap: 6px; max-width: 600px; margin: 0 auto;">`;

    for (let week = 0; week < WEEKS_PER_YEAR; week++) {
        let statusClass = 'future';

        if (week < currentWeekNum) {
            statusClass = 'past';
        } else if (week === currentWeekNum) {
            statusClass = 'current';
        }

        // Scale up slightly for the 'This Year' view because there are fewer squares
        gridHtml += `<div class="week-square ${statusClass} large-square" title="Week ${week + 1}"></div>`;
    }

    gridHtml += `</div>
  <div style="display:flex; justify-content:center; gap: 16px; margin-top: 32px; font-size: 12px; color: var(--text-muted);">
     <div style="display:flex; align-items:center; gap:6px;"><div class="week-square past large-square"></div> Past</div>
     <div style="display:flex; align-items:center; gap:6px;"><div class="week-square current large-square"></div> Current</div>
     <div style="display:flex; align-items:center; gap:6px;"><div class="week-square future large-square"></div> Future</div>
  </div>`;

    return gridHtml;
}
