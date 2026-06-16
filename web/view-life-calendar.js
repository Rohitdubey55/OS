/* view-life-calendar.js */

let currentCalendarView = 'lifetime'; // 'lifetime' or 'thisyear'
let lifeTimerInterval = null;

function clearLifeTimer() {
    if (lifeTimerInterval) {
        clearInterval(lifeTimerInterval);
        lifeTimerInterval = null;
    }
}

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

    // Calculate weeks passed since birth
    const diffTime = Math.abs(now - dob);
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

    const totalWeeks = 50 * 52;
    const remainingWeeks = totalWeeks - diffWeeks;

    // Header with Toggle (Dual-Layer Sticky Fix)
    let html = `
    <div class="memento-sticky-wrapper" style="position: sticky; top: 0; z-index: 100; background: var(--backdrop); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border-bottom: 2px solid var(--border-color);">
       <div class="calendar-header animate-enter">
       <div class="calendar-header-row">
         <div class="calendar-header-text">
            <h1 class="memento-title-text">Memento Mori</h1>
            <div class="weeks-lived-text">${diffWeeks} Weeks Lived.</div>
            <div class="remaining-text">${remainingWeeks} Unwritten Remaining.</div>
         </div>
         
         <div class="life-timer-box">
            <div class="timer-unit-container" id="lifeTimerContainer">
               <!-- To be filled by JS -->
            </div>
         </div>
       </div>

       <div style="display:flex; justify-content:center;">
          <div class="view-toggle-container">
             <button class="toggle-btn ${currentCalendarView === 'thisyear' ? 'active' : ''}" onclick="switchCalendarView('thisyear')">This Year</button>
             <button class="toggle-btn ${currentCalendarView === 'lifetime' ? 'active' : ''}" onclick="switchCalendarView('lifetime')">Lifetime</button>
          </div>
       </div>
    </div>
    </div>
    
    <div class="animation-narrator" id="animationNarrator"></div>
    
    <div class="calendar-content" style="padding: 20px; max-width: 800px; margin: 0 auto; overflow-x: auto;">
  `;

    if (currentCalendarView === 'lifetime') {
        html += renderLifetimeGrid(diffWeeks);
    } else {
        html += renderThisYearGrid(now);
    }

    html += `</div>`;

    document.getElementById('main').innerHTML = html;

    // Initialize Timer
    startLifeTimer(dob);

    // Initialize Animation Status Overlay
    const hasAnimated = sessionStorage.getItem('mementoAnimated') === 'true';
    if (currentCalendarView === 'lifetime' && !hasAnimated) {
        orchestrateNarrator(diffWeeks);
        sessionStorage.setItem('mementoAnimated', 'true');
    }
}

function startLifeTimer(dob) {
    clearLifeTimer();
    const updateTimer = () => {
        const now = new Date();
        const diff = now - dob;

        const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const container = document.getElementById('lifeTimerContainer');
        if (container) {
            container.innerHTML = `
                <div class="timer-unit">
                    <span class="timer-val">${years}</span>
                    <span class="timer-label">Years</span>
                </div>
                <div class="timer-unit">
                    <span class="timer-val">${days}</span>
                    <span class="timer-label">Days</span>
                </div>
                <div class="timer-unit">
                    <span class="timer-val">${String(seconds).padStart(2, '0')}</span>
                    <span class="timer-label">Secs</span>
                </div>
            `;
        } else {
            clearLifeTimer();
        }
    };
    updateTimer();
    lifeTimerInterval = setInterval(updateTimer, 1000);
}

function orchestrateNarrator(weeksLived) {
    const narrator = document.getElementById('animationNarrator');
    if (!narrator) return;

    // Past weeks fall (building the past)
    narrator.innerText = "Foundation Complete.";
    narrator.classList.add('visible');

    // Wait for past to finish falling (lived * 0.004s)
    setTimeout(() => {
        if (!document.getElementById('animationNarrator')) return;
        narrator.innerText = "Now Shapes the Next Chapter.";
        // Close after a few seconds
        setTimeout(() => {
            if (!document.getElementById('animationNarrator')) return;
            narrator.classList.remove('visible');
        }, 5000);
    }, (weeksLived * 4) + 1000);
}

window.switchCalendarView = function (viewType) {
    currentCalendarView = viewType;
    renderLifeCalendar();
}

function renderLifetimeGrid(weeksLived) {
    const TOTAL_YEARS = 50;
    const WEEKS_PER_YEAR = 52;
    const hasAnimated = sessionStorage.getItem('mementoAnimated') === 'true';

    let gridHtml = `<div class="life-grid-container animate-enter stagger-2" style="display: flex; flex-direction: column; gap: 3px;">`;

    const currYearIdx = Math.floor(weeksLived / WEEKS_PER_YEAR);
    const currWeekIdx = weeksLived % WEEKS_PER_YEAR;

    for (let year = 0; year < TOTAL_YEARS; year++) {
        let yearLabel = (year % 10 === 0) ? `<div style="width: 16px; font-size: 9px; color: var(--text-muted); text-align: right; padding-right: 4px; user-select:none;">${year}</div>` : `<div style="width: 16px;"></div>`;

        gridHtml += `<div style="display: flex; gap: 2px; align-items: center; justify-content:center; flex-wrap:nowrap;">`;
        gridHtml += yearLabel;

        for (let week = 0; week < WEEKS_PER_YEAR; week++) {
            const absoluteWeek = (year * WEEKS_PER_YEAR) + week;
            let statusClass = 'future';
            let titleParams = `Age ${year}, Week ${week + 1}`;

            let animationClass = '';
            let animationDelay = 0;
            let inlineStyle = '';

            if (absoluteWeek < weeksLived) {
                statusClass = 'past';
                titleParams += " (Past)";
                if (!hasAnimated) {
                    animationClass = 'animate-fall';
                    animationDelay = absoluteWeek * 0.004;
                }
            } else if (absoluteWeek === weeksLived) {
                statusClass = 'current';
                titleParams += " (Current Week)";
                if (!hasAnimated) {
                    animationClass = 'animate-fall';
                    animationDelay = absoluteWeek * 0.004;
                }
            } else {
                statusClass = 'future';
                titleParams += " (Future)";
                if (!hasAnimated) {
                    animationClass = 'animate-laser';
                    const dy = (currYearIdx - year) * 7;
                    const dx = (currWeekIdx - week) * 6;
                    inlineStyle = `--dx: ${dx}px; --dy: ${dy}px; `;
                    animationDelay = (weeksLived * 0.004) + ((absoluteWeek - weeksLived) * 0.008) + 0.2;
                }
            }

            gridHtml += `<div class="week-square ${statusClass} ${animationClass}" title="${titleParams}" style="${inlineStyle} animation-delay: ${animationDelay}s;"></div>`;
        }
        gridHtml += `</div>`;
    }

    gridHtml += `</div>
  
  <div style="margin-top: 16px; font-size: 11px; color: var(--text-secondary); text-align: center; font-style: italic; opacity: 0.8;" class="animate-enter stagger-3">Each square represents one week of your life. 50 years total.</div>

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
