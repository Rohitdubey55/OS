/* view-pomodoro.js - Pomodoro Timer for PersonalOS */

// Pomodoro State
let pomodoroState = {
    mode: 'custom', // 'custom', 'habits', 'tasks'
    isRunning: false,
    isPaused: false,
    currentPhase: 'work', // 'work', 'shortBreak', 'longBreak'
    timeRemaining: 25 * 60, // seconds
    totalTime: 25 * 60,
    sessionsCompleted: 0,
    sessionsInCycle: 4,
    selectedHabit: null,
    selectedTask: null,
    habitSessionsTarget: 0,
    taskSessionsTarget: 0,
    isFullscreen: false,
    isBackgroundMode: false,
    linkedItemId: null,
    linkedItemType: null,
    linkedDuration: null // Store custom duration for current linked item
};

// Default Settings (loaded from sheet or these defaults)
let pomodoroSettings = {
    work_duration: 25,
    short_break: 5,
    long_break: 15,
    long_break_interval: 4,
    sound_work: 'chime.wav',
    sound_break: 'soft.wav',
    auto_start_break: false,
    background_mode: true
};

// Level & Badge System
const BADGES = [
    { type: 'first_session', name: 'First Focus', icon: '🎯', threshold: 1 },
    { type: 'sessions_10', name: 'Getting Started', icon: '🌱', threshold: 10 },
    { type: 'sessions_50', name: 'Focused Mind', icon: '🧠', threshold: 50 },
    { type: 'sessions_100', name: 'Productivity Master', icon: '⚡', threshold: 100 },
    { type: 'sessions_500', name: 'Deep Work Expert', icon: '🏆', threshold: 500 },
    { type: 'streak_7', name: 'Week Warrior', icon: '🔥', threshold: 7 },
    { type: 'streak_30', name: 'Monthly Master', icon: '💎', threshold: 30 }
];

const LEVELS = [
    { level: 1, name: 'Novice', minSessions: 0 },
    { level: 2, name: 'Apprentice', minSessions: 10 },
    { level: 3, name: 'Focuser', minSessions: 25 },
    { level: 4, name: 'Concentrator', minSessions: 50 },
    { level: 5, name: 'Productivist', minSessions: 100 },
    { level: 6, name: 'Deep Worker', minSessions: 200 },
    { level: 7, name: 'Master', minSessions: 500 }
];

// Load settings and render
function renderPomodoro() {
    // Load settings from state
    const settings = state.data.pomodoro_settings?.[0];
    if (settings) {
        pomodoroSettings = { ...pomodoroSettings, ...settings };
    }

    // Initialize time from settings ONLY IF not running and no custom duration active
    if (!pomodoroState.isRunning) {
        let workLen = pomodoroState.linkedDuration || pomodoroSettings.work_duration;
        pomodoroState.timeRemaining = workLen * 60;
        pomodoroState.totalTime = workLen * 60;
    }
    pomodoroState.sessionsInCycle = pomodoroSettings.long_break_interval;

    const main = document.getElementById('main');
    main.innerHTML = renderPomodoroHTML();

    // Initialize Icons (supports all icon packs)
    if (typeof renderAllIcons === 'function') {
        renderAllIcons();
    } else if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // Start any existing timer if it was running
    if (pomodoroState.isRunning && !pomodoroState.isPaused) {
        startTimerInterval();
    }
}

function renderPomodoroHTML() {
    const { mode, isRunning, isPaused, currentPhase, timeRemaining, totalTime, sessionsCompleted, sessionsInCycle } = pomodoroState;
    const { work_duration, short_break, long_break, auto_start_break, background_mode } = pomodoroSettings;

    // Calculate progress percentage
    const progress = totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const mins = String(minutes).padStart(2, '0');
    const secs = String(seconds).padStart(2, '0');

    // Phase colors
    const phaseColors = {
        work: 'var(--primary)',
        shortBreak: 'var(--success)',
        longBreak: 'var(--accent)'
    };

    // Get stats
    const stats = calculatePomodoroStats();
    const userLevel = getUserLevel(stats.totalSessions);
    const nextLevel = LEVELS.find(l => l.minSessions > stats.totalSessions);

    return `
    <style>
        .pomodoro-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .pomo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }
        
        .pomo-title {
            font-size: 24px;
            font-weight: 800;
            color: var(--text-1);
        }
        
        .pomo-actions {
            display: flex;
            gap: 8px;
        }
        
        .pomo-action-btn {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: var(--surface-2);
            color: var(--text-2);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        
        .pomo-action-btn:hover {
            background: var(--surface-3);
            color: var(--text-1);
        }
        
        /* Mode Toggle */
        .mode-toggle {
            display: flex;
            background: var(--surface-3);
            border-radius: 12px;
            padding: 4px;
            margin-bottom: 24px;
        }
        
        .mode-btn {
            flex: 1;
            padding: 10px 16px;
            border: none;
            background: transparent;
            color: var(--text-3);
            font-weight: 600;
            font-size: 13px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .mode-btn.active {
            background: var(--surface-1);
            color: var(--primary);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        /* Timer Circle */
        .timer-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 32px 0;
        }
        
        .timer-circle {
            position: relative;
            width: 240px;
            height: 240px;
        }
        
        .timer-svg {
            transform: rotate(-90deg);
            width: 100%;
            height: 100%;
        }
        
        .timer-track {
            fill: none;
            stroke: var(--surface-3);
            stroke-width: 8;
        }
        
        .timer-progress {
            fill: none;
            stroke: ${phaseColors[currentPhase === 'work' ? 'work' : currentPhase === 'shortBreak' ? 'shortBreak' : 'longBreak']};
            stroke-width: 8;
            stroke-linecap: round;
            stroke-dasharray: ${2 * Math.PI * 108};
            stroke-dashoffset: ${2 * Math.PI * 108 * (1 - progress / 100)};
            transition: stroke-dashoffset 1s linear, stroke 0.3s;
        }
        
        .timer-center {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }
        
        .timer-phase {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-3);
            margin-bottom: 4px;
        }
        
        .timer-time {
            font-size: 56px;
            font-weight: 800;
            color: var(--text-1);
            line-height: 1;
            font-variant-numeric: tabular-nums;
        }
        
        .timer-sessions {
            font-size: 13px;
            color: var(--text-3);
            margin-top: 8px;
        }
        
        /* Final Minute Pulse */
        @keyframes pulse-final {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.02); opacity: 0.9; }
        }
        
        .timer-circle.final-minute {
            animation: pulse-final 2s ease-in-out infinite;
        }
        
        .timer-time.final-minute {
            color: #EF4444 !important;
        }
        
        /* Controls */
        .timer-controls {
            display: flex;
            gap: 16px;
            margin-top: 32px;
        }
        
        .control-btn {
            padding: 14px 32px;
            border-radius: 14px;
            border: none;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-width: 140px;
        }
        
        .control-btn.primary {
            background: var(--primary);
            color: white;
        }
        
        .control-btn.primary:hover {
            filter: brightness(1.1);
            transform: scale(1.02);
        }
        
        .control-btn.secondary {
            background: var(--surface-2);
            color: var(--text-1);
        }
        
        .control-btn.secondary:hover {
            background: var(--surface-3);
        }
        
        /* Presets */
        .presets {
            display: flex;
            gap: 8px;
            margin-top: 24px;
            flex-wrap: wrap;
            justify-content: center;
        }
        
        .preset-btn {
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            background: var(--surface-2);
            color: var(--text-2);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .preset-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
        }
        
        .preset-btn.active {
            background: var(--primary-soft);
            border-color: var(--primary);
            color: var(--primary);
        }
        
        /* Selection Cards */
        .selection-list {
            margin-top: 24px;
        }
        
        .selection-card {
            display: flex;
            align-items: center;
            padding: 16px;
            background: var(--surface-1);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .selection-card:hover {
            border-color: var(--primary);
            box-shadow: var(--shadow-sm);
        }
        
        .selection-card.selected {
            border-color: var(--primary);
            background: var(--primary-soft);
        }
        
        .selection-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: var(--surface-2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            margin-right: 14px;
        }
        
        .selection-info {
            flex: 1;
        }
        
        .selection-title {
            font-weight: 600;
            color: var(--text-1);
            font-size: 15px;
        }
        
        .selection-meta {
            font-size: 12px;
            color: var(--text-3);
            margin-top: 2px;
        }
        
        .selection-progress {
            background: var(--surface-3);
            height: 6px;
            border-radius: 3px;
            margin-top: 8px;
            overflow: hidden;
        }
        
        .selection-progress-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 3px;
            transition: width 0.3s;
        }
        
        /* Stats Section */
        .stats-section {
            margin-top: 32px;
        }
        
        .stats-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--text-1);
            margin-bottom: 16px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
        }
        
        .stat-card {
            background: var(--surface-1);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 16px;
        }
        
        .stat-value {
            font-size: 28px;
            font-weight: 800;
            color: var(--primary);
        }
        
        .stat-label {
            font-size: 12px;
            color: var(--text-3);
            margin-top: 4px;
        }
        
        /* Level & Badges */
        .level-section {
            margin-top: 24px;
            background: var(--surface-1);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
        }
        
        .level-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .level-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .level-badge {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        
        .level-name {
            font-weight: 700;
            color: var(--text-1);
            font-size: 16px;
        }
        
        .level-subtitle {
            font-size: 12px;
            color: var(--text-3);
        }
        
        .level-progress {
            text-align: right;
        }
        
        .level-next {
            font-size: 12px;
            color: var(--text-3);
        }
        
        .level-bar {
            width: 100px;
            height: 6px;
            background: var(--surface-3);
            border-radius: 3px;
            margin-top: 6px;
            overflow: hidden;
        }
        
        .level-bar-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 3px;
        }
        
        /* Badges */
        .badges-grid {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 16px;
        }
        
        .badge-item {
            width: 56px;
            height: 56px;
            border-radius: 14px;
            background: var(--surface-2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            position: relative;
            opacity: 0.4;
            transition: all 0.2s;
        }
        
        .badge-item.unlocked {
            opacity: 1;
            background: var(--primary-soft);
        }
        
        .badge-item.locked {
            opacity: 0.3;
        }
        
        .badge-tooltip {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: var(--surface-1);
            border: 1px solid var(--border-color);
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
            z-index: 10;
        }
        
        .badge-item:hover .badge-tooltip {
            opacity: 1;
        }
        
        /* Weekly Chart */
        .weekly-chart {
            margin-top: 24px;
            background: var(--surface-1);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
        }
        
        .chart-bars {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            height: 100px;
            gap: 8px;
        }
        
        .chart-bar-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100%;
        }
        
        .chart-bar {
            width: 100%;
            max-width: 32px;
            background: var(--surface-3);
            border-radius: 6px;
            margin-top: auto;
            transition: height 0.3s;
        }
        
        .chart-bar.today {
            background: var(--primary);
        }
        
        .chart-label {
            font-size: 11px;
            color: var(--text-3);
            margin-top: 8px;
        }
        
        .chart-value {
            font-size: 10px;
            color: var(--text-2);
            margin-bottom: 4px;
        }
        
        /* Settings Modal */
        .settings-section {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--border-color);
        }
        
        .setting-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
        }
        
        .setting-label {
            font-size: 14px;
            color: var(--text-2);
        }
        
        .setting-input {
            width: 80px;
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            background: var(--surface-2);
            color: var(--text-1);
            text-align: center;
            font-size: 14px;
        }
        
        /* Toggle Switch */
        .toggle-switch {
            position: relative;
            width: 48px;
            height: 26px;
        }
        
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--surface-3);
            border-radius: 26px;
            transition: 0.3s;
        }
        
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 20px;
            width: 20px;
            left: 3px;
            bottom: 3px;
            background: white;
            border-radius: 50%;
            transition: 0.3s;
        }
        
        input:checked + .toggle-slider {
            background: var(--primary);
        }
        
        input:checked + .toggle-slider:before {
            transform: translateX(22px);
        }
        /* Immersive Fullscreen */
        .immersive-fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #000;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            transition: all 0.5s ease;
        }
        
        .immersive-fullscreen.hidden {
            display: none;
            opacity: 0;
            pointer-events: none;
        }

        .immersive-back-btn {
            position: absolute;
            top: 40px;
            left: 20px;
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(10px);
        }

        /* Flip Clock Aesthetic */
        .flip-clock {
            display: flex;
            gap: 20px;
            margin-bottom: 40px;
        }

        .flip-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }

        .flip-label {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: rgba(255,255,255,0.5);
            font-weight: 600;
        }

        .flip-cards {
            display: flex;
            gap: 4px;
        }

        .flip-card {
            background: #1a1a1a;
            width: 80px;
            height: 120px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 80px;
            font-weight: 800;
            color: white;
            position: relative;
            box-shadow: 0 10px 20px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.05);
        }

        .flip-card::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: rgba(0,0,0,0.5);
            z-index: 2;
        }

        .flip-separator {
            font-size: 60px;
            font-weight: 800;
            margin-top: 15px;
            color: rgba(255,255,255,0.2);
        }

        .fullscreen-phase {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 4px;
            text-transform: uppercase;
            color: var(--primary);
            margin-bottom: 60px;
            text-shadow: 0 0 20px var(--primary-soft);
        }

        .fullscreen-target {
            margin-top: 40px;
            font-size: 14px;
            color: rgba(255,255,255,0.4);
            font-weight: 500;
        }
    </style>
    
    <!-- Immersive Fullscreen View -->
    <div id="pomoImmersive" class="immersive-fullscreen ${pomodoroState.isFullscreen ? '' : 'hidden'}">
        <button class="immersive-back-btn" onclick="togglePomodoroFullscreen()">
            <i data-icon="chevron-left" style="width:24px"></i>
        </button>

        <div class="fullscreen-phase">${currentPhase === 'work' ? 'FOCUS' : 'BREAK'}</div>

        <div class="flip-clock">
            <div class="flip-group">
                <div class="flip-cards">
                    <div class="flip-card" id="minTen">${mins[0]}</div>
                    <div class="flip-card" id="minOne">${mins[1]}</div>
                </div>
            </div>
            <div class="flip-separator">:</div>
            <div class="flip-group">
                <div class="flip-cards">
                    <div class="flip-card" id="secTen">${secs[0]}</div>
                    <div class="flip-card" id="secOne">${secs[1]}</div>
                </div>
            </div>
        </div>

        <div class="fullscreen-target">
            ${pomodoroState.linkedItemType === 'habit' ? 'LINKED HABIT: ' + (state.data.habits?.find(h => String(h.id) === String(pomodoroState.linkedItemId))?.habit_name || '') : ''}
            ${pomodoroState.linkedItemType === 'task' ? 'LINKED TASK: ' + (state.data.tasks?.find(t => String(t.id) === String(pomodoroState.linkedItemId))?.title || '') : ''}
        </div>
    </div>

    <div class="pomodoro-container">
        <!-- Header -->
        <div class="pomo-header">
            <h1 class="pomo-title">Pomodoro Timer</h1>
            <div class="pomo-actions">
                <button class="pomo-action-btn" onclick="openPomodoroSettings()" title="Settings">
                    <i data-icon="settings" style="width:18px"></i>
                </button>
                <button class="pomo-action-btn" onclick="togglePomodoroFullscreen()" title="Fullscreen">
                    <i data-icon="maximize" style="width:18px"></i>
                </button>
            </div>
        </div>
        
        <!-- Mode Toggle -->
        <div class="mode-toggle">
            <button class="mode-btn ${mode === 'custom' ? 'active' : ''}" onclick="setPomodoroMode('custom')">Custom</button>
            <button class="mode-btn ${mode === 'habits' ? 'active' : ''}" onclick="setPomodoroMode('habits')">Habits</button>
            <button class="mode-btn ${mode === 'tasks' ? 'active' : ''}" onclick="setPomodoroMode('tasks')">Tasks</button>
        </div>
        
        <!-- Timer Circle -->
        <div class="timer-container">
            <div class="timer-circle ${timeRemaining <= 60 && isRunning ? 'final-minute' : ''}">
                <svg class="timer-svg" viewBox="0 0 240 240">
                    <circle class="timer-track" cx="120" cy="120" r="108"></circle>
                    <circle class="timer-progress" cx="120" cy="120" r="108"></circle>
                </svg>
                <div class="timer-center">
                    <div class="timer-phase">${currentPhase === 'work' ? 'Focus Time' : currentPhase === 'shortBreak' ? 'Short Break' : 'Long Break'}</div>
                    <div class="timer-time ${timeRemaining <= 60 && isRunning ? 'final-minute' : ''}">${timeDisplay}</div>
                    <div class="timer-sessions">
            <div id="pomoLinkedContext" style="font-weight:700; color:var(--primary); margin-bottom:4px; font-size:14px;">
                ${pomodoroState.linkedItemType === 'habit' ? (state.data.habits?.find(h => String(h.id) === String(pomodoroState.linkedItemId))?.habit_name || '') : ''}
                ${pomodoroState.linkedItemType === 'task' ? (state.data.tasks?.find(t => String(t.id) === String(pomodoroState.linkedItemId))?.title || '') : ''}
            </div>
            Session ${sessionsCompleted + 1} of ${sessionsInCycle}
        </div>
                </div>
            </div>
            
            <!-- Controls -->
            <div class="timer-controls">
                ${!isRunning ? `
                    <button class="control-btn primary" onclick="startPomodoro()">
                        <i data-icon="play" style="width:18px"></i> Start
                    </button>
                ` : isPaused ? `
                    <button class="control-btn primary" onclick="resumePomodoro()">
                        <i data-icon="play" style="width:18px"></i> Resume
                    </button>
                ` : `
                    <button class="control-btn secondary" onclick="pausePomodoro()">
                        <i data-icon="pause" style="width:18px"></i> Pause
                    </button>
                `}
                ${isRunning ? `
                    <button class="control-btn secondary" onclick="resetPomodoro()">
                        <i data-icon="rotate-ccw" style="width:18px"></i> Reset
                    </button>
                ` : ''}
            </div>
            
            <!-- Presets (Custom Mode) -->
            ${mode === 'custom' ? `
                <div class="presets">
                    <button class="preset-btn ${work_duration === 25 ? 'active' : ''}" onclick="setPomodoroPreset(25, 5, 15)">25/5</button>
                    <button class="preset-btn ${work_duration === 50 ? 'active' : ''}" onclick="setPomodoroPreset(50, 10, 20)">50/10</button>
                    <button class="preset-btn" onclick="openPomodoroSettings()">Custom</button>
                </div>
            ` : ''}
        </div>
        
        <!-- Habits/Tasks Selection -->
        ${mode === 'habits' ? renderHabitsSelection() : ''}
        ${mode === 'tasks' ? renderTasksSelection() : ''}
        
        <!-- Statistics -->
        <div class="stats-section">
            <h2 class="stats-title">Today's Focus</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.todayMinutes}</div>
                    <div class="stat-label">Minutes Focused</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.todaySessions}</div>
                    <div class="stat-label">Sessions Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.streak}</div>
                    <div class="stat-label">Day Streak 🔥</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.avgPerDay}</div>
                    <div class="stat-label">Avg Sessions/Day</div>
                </div>
            </div>
        </div>
        
        <!-- Weekly Chart -->
        <div class="weekly-chart">
            <h3 class="stats-title">This Week</h3>
            <div class="chart-bars">
                ${renderWeeklyChart(stats.weeklyData)}
            </div>
        </div>
        
        <!-- Level & Badges -->
        <div class="level-section">
            <div class="level-header">
                <div class="level-info">
                    <div class="level-badge">${getLevelEmoji(userLevel.level)}</div>
                    <div>
                        <div class="level-name">Level ${userLevel.level}: ${userLevel.name}</div>
                        <div class="level-subtitle">${stats.totalSessions} total sessions</div>
                    </div>
                </div>
                ${nextLevel ? `
                    <div class="level-progress">
                        <div class="level-next">${nextLevel.minSessions - stats.totalSessions} to ${nextLevel.name}</div>
                        <div class="level-bar">
                            <div class="level-bar-fill" style="width: ${Math.min(100, (stats.totalSessions - userLevel.minSessions) / (nextLevel.minSessions - userLevel.minSessions) * 100)}%"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <h4 style="font-size:13px; color:var(--text-3); margin-bottom:12px;">Achievements</h4>
            <div class="badges-grid">
                ${BADGES.map(badge => {
        const isUnlocked = stats.totalSessions >= badge.threshold || stats.streak >= badge.threshold;
        return `
                        <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}" title="${badge.name}">
                            ${badge.icon}
                            <div class="badge-tooltip">${badge.name}</div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
        
        <!-- Settings -->
        <div class="settings-section">
            <div class="setting-row">
                <span class="setting-label">Auto-start breaks</span>
                <label class="toggle-switch">
                    <input type="checkbox" ${auto_start_break ? 'checked' : ''} onchange="updatePomodoroSetting('auto_start_break', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </div>
            <div class="setting-row">
                <span class="setting-label">Background mode</span>
                <label class="toggle-switch">
                    <input type="checkbox" ${background_mode ? 'checked' : ''} onchange="updatePomodoroSetting('background_mode', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        </div>
    </div>
    
    <!-- Settings Modal -->
    <div id="pomodoroSettingsOverlay" class="modal-overlay hidden" onclick="if(event.target === this) closePomodoroSettings()">
        <div id="pomodoroSettingsModal" class="modal-box" style="max-width:400px; padding: 24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0; font-size:18px;">Timer Settings</h2>
                <button class="btn icon" onclick="closePomodoroSettings()">
                    <i data-icon="x" style="width:20px"></i>
                </button>
            </div>
            
            <div class="setting-row">
                <span class="setting-label">Work (min)</span>
                <input type="number" class="setting-input" id="pomoWorkInput" value="${work_duration}" min="1" max="120">
            </div>
            <div class="setting-row">
                <span class="setting-label">Short Break (min)</span>
                <input type="number" class="setting-input" id="pomoShortInput" value="${short_break}" min="1" max="30">
            </div>
            <div class="setting-row">
                <span class="setting-label">Long Break (min)</span>
                <input type="number" class="setting-input" id="pomoLongInput" value="${long_break}" min="1" max="60">
            </div>
            <div class="setting-row">
                <span class="setting-label">Sessions before long break</span>
                <input type="number" class="setting-input" id="pomoIntervalInput" value="${pomodoroSettings.long_break_interval}" min="2" max="10">
            </div>
            
            <button class="btn primary" style="width:100%; margin-top:20px;" onclick="savePomodoroSettings()">Save Settings</button>
        </div>
    </div>
    `;
}

function renderHabitsSelection() {
    const habits = state.data.habits || [];
    const logs = state.data.habit_logs || [];
    const today = new Date().toISOString().slice(0, 10);

    // Filter habits with pomodoro sessions
    const pomodoroHabits = habits.filter(h => h.pomodoro_sessions > 0);

    if (pomodoroHabits.length === 0) {
        return `
            <div class="selection-list">
                <div class="empty-state" style="padding:40px; text-align:center;">
                    <p style="color:var(--text-3); margin-bottom:16px;">No habits with Pomodoro sessions</p>
                    <p style="font-size:13px; color:var(--text-muted);">Edit a habit and add "Pomodoro Sessions" to see it here</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="selection-list">
            ${pomodoroHabits.map(h => {
        const sessionsDone = logs.filter(l => String(l.habit_id) === String(h.id) && l.date === today && l.pomodoro_completed).length;
        const target = h.pomodoro_sessions || 0;
        const isSelected = pomodoroState.selectedHabit === h.id;

        return `
                    <div class="selection-card ${isSelected ? 'selected' : ''}" onclick="selectPomodoroHabit('${h.id}')">
                        <div class="selection-icon">${h.emoji || '🎯'}</div>
                        <div class="selection-info">
                            <div class="selection-title">${h.habit_name}</div>
                            <div class="selection-meta">${sessionsDone}/${target} pomodoros today</div>
                            <div class="selection-progress">
                                <div class="selection-progress-fill" style="width: ${(sessionsDone / target) * 100}%"></div>
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderTasksSelection() {
    const tasks = (state.data.tasks || []).filter(t => t.status !== 'completed' && t.pomodoro_estimate > 0);
    const today = new Date().toISOString().slice(0, 10);

    if (tasks.length === 0) {
        return `
            <div class="selection-list">
                <div class="empty-state" style="padding:40px; text-align:center;">
                    <p style="color:var(--text-3); margin-bottom:16px;">No tasks with Pomodoro estimates</p>
                    <p style="font-size:13px; color:var(--text-muted);">Add "Estimated Pomodoros" to a task to see it here</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="selection-list">
            ${tasks.map(t => {
        const isSelected = pomodoroState.selectedTask === t.id;
        return `
                    <div class="selection-card ${isSelected ? 'selected' : ''}" onclick="selectPomodoroTask('${t.id}')">
                        <div class="selection-icon">📋</div>
                        <div class="selection-info">
                            <div class="selection-title">${t.title}</div>
                            <div class="selection-meta">${t.pomodoro_estimate || 0} pomodoros estimated</div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

function renderWeeklyChart(weeklyData) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date().getDay();
    const todayIndex = today === 0 ? 6 : today - 1;

    return days.map((day, i) => {
        const sessions = weeklyData[i] || 0;
        const maxSessions = Math.max(...weeklyData, 1);
        const height = sessions > 0 ? (sessions / maxSessions) * 80 + 10 : 10;

        return `
            <div class="chart-bar-wrapper">
                <div class="chart-value">${sessions}</div>
                <div class="chart-bar ${i === todayIndex ? 'today' : ''}" style="height: ${height}px"></div>
                <div class="chart-label">${day}</div>
            </div>
        `;
    }).join('');
}

// Stats Calculation
function calculatePomodoroStats() {
    const sessions = state.data.pomodoro_sessions || [];
    const today = new Date().toISOString().slice(0, 10);

    // Today's stats
    const todaySessions = sessions.filter(s => s.date === today && s.type === 'work' && s.completed);
    const todayMinutes = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    // Weekly data
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().slice(0, 10);
        weeklyData[i] = sessions.filter(s => s.date === dateStr && s.type === 'work' && s.completed).length;
    }

    // Streak calculation
    let streak = 0;
    const checkDate = new Date();
    while (true) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        const hasSession = sessions.some(s => s.date === dateStr && s.type === 'work' && s.completed);
        if (hasSession) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else if (checkDate.toISOString().slice(0, 10) !== today) {
            break;
        } else {
            checkDate.setDate(checkDate.getDate() - 1);
        }
    }

    // Average per day (last 30 days)
    const totalSessions = sessions.filter(s => s.type === 'work' && s.completed).length;
    const avgPerDay = Math.round((totalSessions / 30) * 10) / 10;

    return {
        todaySessions: todaySessions.length,
        todayMinutes,
        weeklyData,
        streak,
        totalSessions,
        avgPerDay
    };
}

function getUserLevel(totalSessions) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (totalSessions >= LEVELS[i].minSessions) {
            return LEVELS[i];
        }
    }
    return LEVELS[0];
}

function getLevelEmoji(level) {
    const emojis = ['🌱', '📚', '🎯', '⚡', '🔥', '💎', '👑'];
    return emojis[Math.min(level - 1, emojis.length - 1)];
}

// Mode Switching
function setPomodoroMode(mode) {
    if (pomodoroState.mode !== mode && pomodoroState.isRunning) {
        clearInterval(pomodoroState.timerInterval);
        pomodoroState.isRunning = false;
        pomodoroState.isPaused = false;
    }

    pomodoroState.mode = mode;
    pomodoroState.selectedHabit = null;
    pomodoroState.selectedTask = null;
    pomodoroState.linkedItemId = null;
    pomodoroState.linkedItemType = null;
    pomodoroState.linkedDuration = null;

    // Reset to global settings if going back to custom
    if (mode === 'custom') {
        const globalWork = pomodoroSettings.work_duration || 25;
        pomodoroState.timeRemaining = globalWork * 60;
        pomodoroState.totalTime = globalWork * 60;
    }

    renderPomodoro();
}

// Timer Controls
function startPomodoro() {
    pomodoroState.isRunning = true;
    pomodoroState.isPaused = false;
    pomodoroState.currentPhase = 'work';

    startTimerInterval();
    renderPomodoro();
}

function pausePomodoro() {
    pomodoroState.isPaused = true;
    clearInterval(pomodoroState.timerInterval);
    renderPomodoro();
}

function resumePomodoro() {
    pomodoroState.isPaused = false;
    startTimerInterval();
    renderPomodoro();
}

function resetPomodoro() {
    pomodoroState.isRunning = false;
    pomodoroState.isPaused = false;
    pomodoroState.mode = 'custom';
    pomodoroState.linkedItemId = null;
    pomodoroState.linkedItemType = null;
    pomodoroState.linkedDuration = null;
    pomodoroState.selectedHabit = null;
    pomodoroState.selectedTask = null;
    pomodoroState.currentPhase = 'work';
    clearInterval(pomodoroState.timerInterval);

    // Explicitly reload global duration
    const globalWork = pomodoroSettings.work_duration || 25;
    pomodoroState.timeRemaining = globalWork * 60;
    pomodoroState.totalTime = globalWork * 60;

    renderPomodoro();
}

function startTimerInterval() {
    clearInterval(pomodoroState.timerInterval);

    pomodoroState.timerInterval = setInterval(() => {
        if (pomodoroState.timeRemaining > 0) {
            pomodoroState.timeRemaining--;

            // Final minute pulse check
            if (pomodoroState.timeRemaining === 60) {
                playNotificationSound('alert');
            }

            // Update display every second
            updateTimerDisplay();
        } else {
            // Phase completed
            completePhase();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timeEl = document.querySelector('.timer-time');
    const phaseEl = document.querySelector('.timer-phase');
    const circleEl = document.querySelector('.timer-circle');
    const progressEl = document.querySelector('.timer-progress');

    if (timeEl) {
        const minutes = Math.floor(pomodoroState.timeRemaining / 60);
        const seconds = pomodoroState.timeRemaining % 60;
        timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Final minute styling
        if (pomodoroState.timeRemaining <= 60) {
            timeEl.classList.add('final-minute');
            if (circleEl) circleEl.classList.add('final-minute');
        } else {
            timeEl.classList.remove('final-minute');
            if (circleEl) circleEl.classList.remove('final-minute');
        }
    }

    // Update progress ring
    if (progressEl) {
        const progress = pomodoroState.totalTime > 0 ? ((pomodoroState.totalTime - pomodoroState.timeRemaining) / pomodoroState.totalTime) * 100 : 0;
        const circumference = 2 * Math.PI * 108;
        progressEl.style.strokeDashoffset = circumference * (1 - progress / 100);
    }
}

function completePhase() {
    clearInterval(pomodoroState.timerInterval);

    // Play completion sound
    playNotificationSound('alert');

    if (pomodoroState.currentPhase === 'work') {
        // Work session completed
        pomodoroState.sessionsCompleted++;

        // Save session to log
        savePomodoroSession();

        // Check if linked to habit/task
        completeLinkedItem();

        // Switch to break
        if (pomodoroState.sessionsCompleted % pomodoroSettings.long_break_interval === 0) {
            pomodoroState.currentPhase = 'longBreak';
            pomodoroState.timeRemaining = pomodoroSettings.long_break * 60;
            pomodoroState.totalTime = pomodoroSettings.long_break * 60;
        } else {
            pomodoroState.currentPhase = 'shortBreak';
            pomodoroState.timeRemaining = pomodoroSettings.short_break * 60;
            pomodoroState.totalTime = pomodoroSettings.short_break * 60;
        }

        // Auto-start break if enabled
        if (pomodoroSettings.auto_start_break) {
            startTimerInterval();
        } else {
            pomodoroState.isRunning = false;
        }
    } else {
        // Break completed - back to work
        pomodoroState.currentPhase = 'work';
        pomodoroState.timeRemaining = pomodoroSettings.work_duration * 60;
        pomodoroState.totalTime = pomodoroSettings.work_duration * 60;
        pomodoroState.isRunning = false;
    }

    renderPomodoro();
}

async function savePomodoroSession() {
    const session = {
        date: new Date().toISOString().slice(0, 10),
        type: pomodoroState.currentPhase === 'work' ? 'work' : 'break',
        duration: pomodoroState.currentPhase === 'work' ? pomodoroSettings.work_duration : (pomodoroState.currentPhase === 'shortBreak' ? pomodoroSettings.short_break : pomodoroSettings.long_break),
        habit_id: pomodoroState.linkedItemType === 'habit' ? pomodoroState.linkedItemId : null,
        task_id: pomodoroState.linkedItemType === 'task' ? pomodoroState.linkedItemId : null,
        completed: true
    };

    try {
        await apiCall('create', 'pomodoro_sessions', session);
        await refreshData('pomodoro_sessions');
    } catch (e) {
        console.error('Error saving pomodoro session:', e);
    }
}

async function completeLinkedItem() {
    if (!pomodoroState.linkedItemId || !pomodoroState.linkedItemType) return;

    const today = new Date().toISOString().slice(0, 10);

    if (pomodoroState.linkedItemType === 'habit') {
        // Mark habit as done for today
        const existingLog = state.data.habit_logs?.find(
            l => String(l.habit_id) === String(pomodoroState.linkedItemId) && l.date === today
        );

        if (!existingLog) {
            await apiCall('create', 'habit_logs', {
                habit_id: pomodoroState.linkedItemId,
                date: today,
                status: 'completed',
                pomodoro_completed: true
            });
            showToast('Habit completed! 🎉', 'success');
        }
    } else if (pomodoroState.linkedItemType === 'task') {
        // Could auto-complete task or increment pomodoro count
        showToast('Pomodoro logged for task!', 'success');
    }

    await refreshData('habit_logs');
}

// Selection
function selectPomodoroHabit(habitId) {
    const habit = state.data.habits?.find(h => String(h.id) === String(habitId));
    if (!habit) return;

    // If different habit or switching to running mode, stop old timer
    if (pomodoroState.linkedItemId !== habitId && pomodoroState.isRunning) {
        clearInterval(pomodoroState.timerInterval);
        pomodoroState.isRunning = false;
        pomodoroState.isPaused = false;
    }

    pomodoroState.selectedHabit = habitId;
    pomodoroState.selectedTask = null;
    pomodoroState.linkedItemId = habitId;
    pomodoroState.linkedItemType = 'habit';
    pomodoroState.habitSessionsTarget = habit.pomodoro_sessions || 0;

    // Apply custom duration if set
    if (habit.pomodoro_length) {
        const len = parseInt(habit.pomodoro_length);
        if (len > 0) {
            pomodoroState.linkedDuration = len;
            pomodoroState.timeRemaining = len * 60;
            pomodoroState.totalTime = len * 60;
        }
    } else {
        pomodoroState.linkedDuration = null;
        // Revert to global if no custom duration
        const globalWork = pomodoroSettings.work_duration || 25;
        pomodoroState.timeRemaining = globalWork * 60;
        pomodoroState.totalTime = globalWork * 60;
    }

    renderPomodoro();
}

function selectPomodoroTask(taskId) {
    const task = state.data.tasks?.find(t => String(t.id) === String(taskId));
    if (!task) return;

    // If different task or switching to running mode, stop old timer
    if (pomodoroState.linkedItemId !== taskId && pomodoroState.isRunning) {
        clearInterval(pomodoroState.timerInterval);
        pomodoroState.isRunning = false;
        pomodoroState.isPaused = false;
    }

    pomodoroState.selectedTask = taskId;
    pomodoroState.selectedHabit = null;
    pomodoroState.linkedItemId = taskId;
    pomodoroState.linkedItemType = 'task';
    pomodoroState.taskSessionsTarget = task.pomodoro_estimate || 0;

    // Apply custom duration if set
    if (task.pomodoro_length) {
        const len = parseInt(task.pomodoro_length);
        if (len > 0) {
            pomodoroState.linkedDuration = len;
            pomodoroState.timeRemaining = len * 60;
            pomodoroState.totalTime = len * 60;
        }
    } else {
        pomodoroState.linkedDuration = null;
        // Revert to global if no custom duration
        const globalWork = pomodoroSettings.work_duration || 25;
        pomodoroState.timeRemaining = globalWork * 60;
        pomodoroState.totalTime = globalWork * 60;
    }

    renderPomodoro();
}

// Presets
function setPomodoroPreset(work, short, long) {
    pomodoroSettings.work_duration = work;
    pomodoroSettings.short_break = short;
    pomodoroSettings.long_break = long;
    pomodoroState.timeRemaining = work * 60;
    pomodoroState.totalTime = work * 60;
    renderPomodoro();
}

// Settings
function openPomodoroSettings() {
    document.getElementById('pomodoroSettingsOverlay').classList.remove('hidden');
}

function closePomodoroSettings() {
    document.getElementById('pomodoroSettingsOverlay').classList.add('hidden');
}

async function savePomodoroSettings() {
    const work = parseInt(document.getElementById('pomoWorkInput').value);
    const short = parseInt(document.getElementById('pomoShortInput').value);
    const long = parseInt(document.getElementById('pomoLongInput').value);
    const interval = parseInt(document.getElementById('pomoIntervalInput').value);

    pomodoroSettings.work_duration = work;
    pomodoroSettings.short_break = short;
    pomodoroSettings.long_break = long;
    pomodoroSettings.long_break_interval = interval;

    // Reset timer with new settings
    pomodoroState.timeRemaining = work * 60;
    pomodoroState.totalTime = work * 60;
    pomodoroState.sessionsInCycle = interval;

    // Save to sheet
    try {
        const existing = state.data.pomodoro_settings?.[0];
        if (existing) {
            await apiCall('update', 'pomodoro_settings', {
                work_duration: work,
                short_break: short,
                long_break: long,
                long_break_interval: interval
            }, existing.id);
        } else {
            await apiCall('create', 'pomodoro_settings', {
                work_duration: work,
                short_break: short,
                long_break: long,
                long_break_interval: interval,
                sound_work: pomodoroSettings.sound_work,
                sound_break: pomodoroSettings.sound_break,
                auto_start_break: pomodoroSettings.auto_start_break,
                background_mode: pomodoroSettings.background_mode
            });
        }
        await refreshData('pomodoro_settings');
    } catch (e) {
        console.error('Error saving pomodoro settings:', e);
    }

    closePomodoroSettings();
    renderPomodoro();
    showToast('Settings saved!', 'success');
}

async function updatePomodoroSetting(key, value) {
    pomodoroSettings[key] = value;

    // Save to sheet
    try {
        const existing = state.data.pomodoro_settings?.[0];
        if (existing) {
            await apiCall('update', 'pomodoro_settings', { [key]: value }, existing.id);
        } else {
            await apiCall('create', 'pomodoro_settings', {
                work_duration: pomodoroSettings.work_duration,
                short_break: pomodoroSettings.short_break,
                long_break: pomodoroSettings.long_break,
                long_break_interval: pomodoroSettings.long_break_interval,
                sound_work: pomodoroSettings.sound_work,
                sound_break: pomodoroSettings.sound_break,
                auto_start_break: pomodoroSettings.auto_start_break,
                background_mode: pomodoroSettings.background_mode,
                [key]: value
            });
        }
        await refreshData('pomodoro_settings');
    } catch (e) {
        console.error('Error updating pomodoro setting:', e);
    }
}

// Quick Start from other views
async function quickStartPomodoro(type, id) {
    // 1. Route to pomodoro
    if (typeof routeTo === 'function') {
        routeTo('pomodoro');
    }

    // 2. Set mode and select item
    let customLength = 0;
    if (type === 'habit') {
        const h = state.data.habits?.find(x => String(x.id) === String(id));
        if (h) customLength = parseInt(h.pomodoro_length);
        pomodoroState.mode = 'habits';
        selectPomodoroHabit(id);
    } else if (type === 'task') {
        const t = state.data.tasks?.find(x => String(x.id) === String(id));
        if (t) customLength = parseInt(t.pomodoro_length);
        pomodoroState.mode = 'tasks';
        selectPomodoroTask(id);
    }

    // 3. Apply custom length if available
    if (customLength > 0) {
        pomodoroState.linkedDuration = customLength;
        pomodoroState.timeRemaining = customLength * 60;
        pomodoroState.totalTime = customLength * 60;
    } else {
        pomodoroState.linkedDuration = null;
    }

    // 4. Start timer
    setTimeout(() => {
        startPomodoro();
        showToast(`Focusing on ${type}...`, 'success');
    }, 500);
}

// Fullscreen
function togglePomodoroFullscreen() {
    pomodoroState.isFullscreen = !pomodoroState.isFullscreen;

    // Save state to local persistence if needed
    renderPomodoro();
}

// Expose functions globally
window.renderPomodoro = renderPomodoro;
window.setPomodoroMode = setPomodoroMode;
window.startPomodoro = startPomodoro;
window.pausePomodoro = pausePomodoro;
window.resumePomodoro = resumePomodoro;
window.resetPomodoro = resetPomodoro;
window.selectPomodoroHabit = selectPomodoroHabit;
window.selectPomodoroTask = selectPomodoroTask;
window.setPomodoroPreset = setPomodoroPreset;
window.openPomodoroSettings = openPomodoroSettings;
window.closePomodoroSettings = closePomodoroSettings;
window.savePomodoroSettings = savePomodoroSettings;
window.updatePomodoroSetting = updatePomodoroSetting;
window.togglePomodoroFullscreen = togglePomodoroFullscreen;
window.quickStartPomodoro = quickStartPomodoro;
