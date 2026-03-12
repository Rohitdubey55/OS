/* notification-service.js - Notification handling for PersonalOS */

// State management
window.notificationState = {
    permission: 'default',
    scheduledNotifications: new Map(),
    lastCheck: null,
    enabled: true,
    sound: 'default',
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 8,    // 8 AM
    defaultMethod: 'both' // browser/in-app/both
};

// --- CHIMES STATE (Global) ---
window.chimeState = window.chimeState || {
    enabled: false,
    interval: 60,
    sound: 'chime.wav',
    quietStart: 22,
    quietEnd: 8,
    speakTime: true,
    waterReminder: true,
    customMessage: 'Time to drink some water and stretch!'
};

// Initialize notification service
async function initNotificationService() {
    console.log('Initializing notification service...');

    // Wait for DOM to be ready
    if (!document.getElementById('main')) {
        console.log('DOM not ready, waiting...');
        setTimeout(initNotificationService, 100);
        return;
    }

    // Check current permission (web API)
    if ('Notification' in window) {
        notificationState.permission = Notification.permission;
    }

    // Load settings from localStorage
    loadNotificationSettings();

    // ---- Capacitor LocalNotifications permission ----
    // This is separate from the web Notification API.
    // We request it immediately so the iOS popup appears on first run.
    if (window.LocalNotifications) {
        try {
            const permStatus = await window.LocalNotifications.checkPermissions();
            if (permStatus.display === 'granted') {
                notificationState.permission = 'granted';
                console.log('Native notification permission already granted');
            } else {
                console.log('Requesting native notification permission...');
                const result = await window.LocalNotifications.requestPermissions();
                if (result.display === 'granted') {
                    notificationState.permission = 'granted';
                    console.log('Native notification permission granted!');
                } else {
                    console.log('Native notification permission denied by user');
                }
            }
        } catch (e) {
            console.error('Error requesting notification permission:', e);
        }
    } else if (notificationState.permission === 'default') {
        console.log('Notification permission not yet requested (web only)');
    }

    // Start polling for due reminders
    startReminderPolling();

    // Handle visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    console.log('Notification service initialized');
}

// Load notification settings from localStorage
function loadNotificationSettings() {
    // 1. Always read localStorage first — it is updated immediately whenever the
    //    user changes a setting, so it is the most reliable source of truth.
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            notificationState.enabled = settings.enabled !== false;
            if (settings.sound) notificationState.sound = settings.sound;
            if (settings.quietHoursStart) notificationState.quietHoursStart = settings.quietHoursStart;
            if (settings.quietHoursEnd) notificationState.quietHoursEnd = settings.quietHoursEnd;
            if (settings.defaultMethod) notificationState.defaultMethod = settings.defaultMethod;
            if (settings.habitSummaryTime) notificationState.habitSummaryTime = settings.habitSummaryTime;
        } catch (e) {
            console.error('Error loading notification settings from localStorage:', e);
        }
    }

    // 2. Let Google Sheets override individual fields that are explicitly set there.
    //    Missing/empty sheet fields do NOT clobber the localStorage values.
    const sheetSettings = (typeof state !== 'undefined' && state.data && state.data.settings && state.data.settings[0]);
    if (sheetSettings) {
        if (typeof sheetSettings.notification_enabled !== 'undefined') {
            notificationState.enabled = sheetSettings.notification_enabled !== false;
        }
        if (sheetSettings.notification_sound) {
            notificationState.sound = sheetSettings.notification_sound;
        }
        if (sheetSettings.notification_method) {
            notificationState.defaultMethod = sheetSettings.notification_method;
        }
        if (sheetSettings.quiet_hours_start) {
            notificationState.quietHoursStart = parseInt(sheetSettings.quiet_hours_start);
        }
        if (sheetSettings.quiet_hours_end) {
            notificationState.quietHoursEnd = parseInt(sheetSettings.quiet_hours_end);
        }
        if (sheetSettings.habit_summary_time) {
            notificationState.habitSummaryTime = sheetSettings.habit_summary_time;
        }
    }
}

// Save notification settings to localStorage
function saveNotificationSettings() {
    const settings = {
        enabled: notificationState.enabled,
        sound: notificationState.sound,
        quietHoursStart: notificationState.quietHoursStart,
        quietHoursEnd: notificationState.quietHoursEnd,
        defaultMethod: notificationState.defaultMethod,
        habitSummaryTime: notificationState.habitSummaryTime
    };
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
}

// Request browser notification permission
async function requestNotificationPermission() {
    // Check if running in MIT App Inventor or similar WebView
    const isAppInventor = typeof Android !== 'undefined' || typeof window.AppInventor !== 'undefined';

    if (!('Notification' in window)) {
        // No browser Notification API - check if we can use App Inventor
        if (isAppInventor) {
            // In App Inventor WebView - enable notifications via bridge
            notificationState.permission = 'granted';
            notificationState.enabled = true;
            saveNotificationSettings();
            showToast('Notifications enabled via App Inventor!', 'success');
            return true;
        }
        showToast('This browser does not support notifications', 'error');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        notificationState.permission = permission;

        if (permission === 'granted') {
            showToast('Notifications enabled!', 'success');
            return true;
        } else if (permission === 'denied') {
            // Even if browser notifications are denied, try App Inventor
            if (isAppInventor) {
                notificationState.permission = 'granted';
                notificationState.enabled = true;
                saveNotificationSettings();
                showToast('Notifications enabled via App Inventor!', 'success');
                return true;
            }
            showToast('Notifications blocked. Please enable in browser settings.', 'error');
            return false;
        }
    } catch (e) {
        console.error('Error requesting notification permission:', e);
    }

    return false;
}

// Check if quiet hours are active
function isQuietHours() {
    const now = new Date();
    const hour = now.getHours();

    if (notificationState.quietHoursStart > notificationState.quietHoursEnd) {
        // Quiet hours span midnight (e.g., 22:00 - 08:00)
        return hour >= notificationState.quietHoursStart || hour < notificationState.quietHoursEnd;
    } else {
        // Quiet hours within same day
        return hour >= notificationState.quietHoursStart && hour < notificationState.quietHoursEnd;
    }
}

// Show browser notification
function showBrowserNotification(title, options = {}) {
    if (notificationState.permission !== 'granted') {
        console.log('Browser notifications not permitted');
        return null;
    }

    if (isQuietHours() && !options.overrideQuietHours) {
        console.log('Notification blocked due to quiet hours');
        return null;
    }

    const notification = new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: options.tag || 'personalos',
        renotify: options.renotify || true,
        body: options.body || '',
        data: options.data || {}
    });

    notification.onclick = () => {
        window.focus();
        if (options.onClick) options.onClick();
        notification.close();
    };

    return notification;
}

// Show in-app toast notification
function showInAppNotification(message, type = 'info') {
    // Remove existing toast if any
    const existing = document.querySelector('.in-app-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `in-app-notification toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${getToastIcon(type)}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Get icon for toast type
function getToastIcon(type) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

// Play notification sound
function playNotificationSound(soundId = 'default') {
    // Create audio context for playing sounds
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Generate a simple beep sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = soundId === 'alert' ? 880 : 440;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.error('Error playing notification sound:', e);
    }
}

// Main function to trigger a reminder notification
function triggerReminderNotification(reminder) {
    console.log('Triggering notification for reminder:', reminder.id);

    const method = reminder.notification_method || notificationState.defaultMethod;

    // Browser notification
    if ((method === 'browser' || method === 'both') && notificationState.permission === 'granted') {
        showBrowserNotification(reminder.title, {
            body: reminder.description || getReminderTimeText(reminder),
            tag: `reminder-${reminder.id}`,
            data: { reminderId: reminder.id },
            onClick: () => handleReminderClick(reminder)
        });
    }

    // In-app notification
    if (method === 'in-app' || method === 'both') {
        showInAppNotification(reminder.title, 'info');
    }

    // Send to MIT App Inventor via WebViewString
    sendToAppInventor(reminder);

    // Play sound
    if (reminder.notification_sound !== 'none') {
        playNotificationSound(reminder.notification_sound || 'default');
    }

    // Handle repeat
    if (reminder.repeat_type && reminder.repeat_type !== 'none') {
        scheduleNextRepeat(reminder);
    }
}

// Get human-readable time text
function getReminderTimeText(reminder) {
    const time = new Date(reminder.reminder_datetime);
    const now = new Date();
    const diff = time - now;

    if (diff > 0) {
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `Due in ${minutes} minutes`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Due in ${hours} hours`;
        const days = Math.floor(hours / 24);
        return `Due in ${days} days`;
    }

    return `Due at ${time.toLocaleTimeString()}`;
}

// Handle reminder click from notification
function handleReminderClick(reminder) {
    // Navigate to the related item if linked
    if (reminder.related_item_type && reminder.related_item_id) {
        navigateTo(reminder.related_item_type);
    } else {
        navigateTo('reminders');
    }
}

// Schedule next repeat for a reminder
function scheduleNextRepeat(reminder) {
    const currentTime = new Date(reminder.reminder_datetime);
    let nextTime = new Date(currentTime);

    switch (reminder.repeat_type) {
        case 'daily':
            nextTime.setDate(nextTime.getDate() + 1);
            break;
        case 'weekly':
            nextTime.setDate(nextTime.getDate() + 7);
            break;
        case 'monthly':
            nextTime.setMonth(nextTime.getMonth() + 1);
            break;
        case 'yearly':
            nextTime.setFullYear(nextTime.getFullYear() + 1);
            break;
        case 'custom':
            if (reminder.repeat_interval) {
                nextTime.setDate(nextTime.getDate() + reminder.repeat_interval);
            }
            break;
    }

    // Update the reminder in the backend
    updateReminderNextRun(reminder.id, nextTime.toISOString());
}

// Update reminder next run time
async function updateReminderNextRun(reminderId, nextDateTime) {
    try {
        await apiCall('update', 'reminders', {
            reminder_datetime: nextDateTime
        }, reminderId);

        // Refresh local data
        await refreshData('reminders');
    } catch (e) {
        console.error('Error updating reminder next run:', e);
    }
}

// Check for due reminders
function checkAndTriggerReminders() {
    const reminders = state.data.reminders || [];
    const now = new Date();

    // Check standalone reminders
    reminders.forEach(reminder => {
        if (!reminder.is_active) return;

        const reminderTime = new Date(reminder.reminder_datetime);

        // Check if reminder is due (within 1 minute window)
        const diff = now - reminderTime;
        if (diff >= 0 && diff < 60000) {
            // Check if we haven't already triggered this reminder
            const triggeredKey = `triggered_${reminder.id}_${reminderTime.getTime()}`;
            if (!localStorage.getItem(triggeredKey)) {
                localStorage.setItem(triggeredKey, 'true');
                triggerReminderNotification(reminder);
            }
        }
    });

    // Check habits with reminder_time (daily recurring)
    const habits = state.data.habits || [];
    habits.forEach(habit => {
        if (!habit.reminder_time) return;
        if (habit.alarm_enabled === false) return; // user disabled alarm for this habit
        const timeStr = String(habit.reminder_time);

        let hours, minutes;

        // Handle Google Sheets datetime format: "1899-12-30T02:54:00"
        if (timeStr.startsWith('1899-12-30T')) {
            const timePart = timeStr.slice(11, 16); // Extract "02:54"
            const parts = timePart.split(':');
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
        }
        // Handle other ISO formats with T
        else if (timeStr.includes('T')) {
            const dt = new Date(timeStr);
            hours = dt.getHours();
            minutes = dt.getMinutes();
        }
        // Simple time string like "02:54"
        else if (timeStr.match(/^\d{2}:\d{2}/)) {
            const parts = timeStr.split(':');
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
        } else {
            return; // Invalid format
        }

        if (isNaN(hours) || isNaN(minutes)) return;

        // Debug log
        console.log('[Habit Notification] Checking:', habit.habit_name, 'time:', hours + ':' + minutes, 'now:', now.getHours() + ':' + now.getMinutes());

        if (now.getHours() === hours && now.getMinutes() === minutes) {
            const triggeredKey = `habit_triggered_${habit.id}_${now.toDateString()}_${hours}_${minutes}`;
            if (!localStorage.getItem(triggeredKey)) {
                localStorage.setItem(triggeredKey, 'true');
                triggerReminderNotification({
                    id: 'habit_' + habit.id,
                    title: (habit.emoji || getIcon('default')) + ' ' + (habit.habit_name || 'Habit Reminder'),
                    description: 'Time for your habit: ' + (habit.habit_name || ''),
                    reminder_datetime: now.toISOString(),
                    habit_name: habit.habit_name // Ensure it passes down
                });

                // Since app is open, fire foreground intrusive alarm!
                if (typeof window.openActiveHabitAlarm === 'function') {
                    window.openActiveHabitAlarm(habit.id, habit.habit_name);
                }
            }
        }
    });

    // Check tasks with due_date + due_time
    const tasks = state.data.tasks || [];
    tasks.forEach(task => {
        if (!task.due_date) return;
        if (task.status === 'completed') return;

        // Parse due_time from various formats
        let hours = null, minutes = null;
        const timeVal = String(task.due_time || '');

        if (timeVal.startsWith('1899-12-30T')) {
            // Google Sheets datetime format
            const timePart = timeVal.slice(11, 16);
            if (timePart.match(/^\d{2}:\d{2}$/)) {
                hours = parseInt(timePart.slice(0, 2), 10);
                minutes = parseInt(timePart.slice(3, 5), 10);
            }
        } else if (timeVal.includes('T')) {
            const dt = new Date(timeVal);
            if (!isNaN(dt.getTime())) {
                hours = dt.getHours();
                minutes = dt.getMinutes();
            }
        } else if (timeVal.match(/^\d{2}:\d{2}/)) {
            const parts = timeVal.split(':');
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
        }

        if (hours === null || minutes === null) return;

        try {
            // Construct the due datetime for today
            const dueDate = new Date(task.due_date + 'T' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':00');

            // Debug log
            console.log('[Task Notification] Checking:', task.title, 'due:', dueDate, 'now:', now);

            // Check if it's due now (within 1 minute window)
            const diff = now - dueDate;
            if (diff >= 0 && diff < 60000) {
                const triggeredKey = `task_triggered_${task.id}_${dueDate.getTime()}`;
                if (!localStorage.getItem(triggeredKey)) {
                    localStorage.setItem(triggeredKey, 'true');
                    triggerReminderNotification({
                        id: 'task_' + task.id,
                        title: '📋 Task Due: ' + (task.title || 'Task'),
                        description: task.description || '',
                        reminder_datetime: dueDate.toISOString()
                    });
                }
            }
        } catch (e) { /* ignore invalid dates */ }
    });

    notificationState.lastCheck = now;
}

// Start polling for reminders
function startReminderPolling() {
    // Check every minute (for browser/in-app while open)
    setInterval(() => {
        if (notificationState.enabled && !document.hidden) {
            checkAndTriggerReminders();
        }

        // Chimes polling
        checkAndTriggerChimes();

        // Habit summary polling checking the specific minute
        if (notificationState.enabled) {
            const hTimeStr = notificationState.habitSummaryTime || (state.data?.settings?.[0]?.habit_summary_time) || '08:00';
            const parts = hTimeStr.split(':');
            const targetH = parseInt(parts[0], 10);
            const targetM = parseInt(parts[1], 10);

            const now = new Date();
            if (now.getHours() === targetH && now.getMinutes() === targetM) {
                const triggeredKey = `habit_summary_sent_${now.toDateString()}`;
                if (!localStorage.getItem(triggeredKey)) {
                    localStorage.setItem(triggeredKey, 'true');
                    sendUpcomingHabitSummary();
                }
            }
        }
    }, 60000);

    // Initial checks on start
    checkAndTriggerReminders();
    checkAndTriggerChimes();
}

// Returns the correct sound filename for Capacitor LocalNotifications on iOS.
// Must be module-level so all scheduling functions can call it.
// Only .wav files are bundled in the Xcode project (chime.wav, classic.wav, beep.wav).
// iOS 10+ supports .wav directly — no .caf conversion needed.
function getNativeSoundPath(soundName) {
    if (!soundName || soundName === 'none') return null;
    if (soundName === 'default' || soundName === 'alert') return 'default';
    // Ensure .wav extension so iOS can locate the file in the app bundle
    return soundName.endsWith('.wav') ? soundName : soundName + '.wav';
}

// Sync all future habits/tasks natively so the phone rings when the app is closed
async function syncNativeNotifications() {
    if (!window.LocalNotifications || !notificationState.enabled) return;

    // Race condition fix: If settings haven't loaded from the sheet yet, delay sync
    if (!state.data.settings || state.data.settings.length === 0) {
        console.log('[Native Sync] Settings not loaded yet, delaying sync 2s...');
        setTimeout(syncNativeNotifications, 2000);
        return;
    }

    // Re-read settings now that the sheet is confirmed loaded,
    // so notificationState.sound reflects the user's latest choice.
    loadNotificationSettings();

    try {
        // Always request/check permissions — ask the user if not yet granted
        const permStatus = await window.LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
            const result = await window.LocalNotifications.requestPermissions();
            if (result.display !== 'granted') {
                console.log('[Native Sync] Notification permission denied, skipping sync');
                return;
            }
            // Update state
            notificationState.permission = 'granted';
        }

        // Clear previously scheduled notifications to avoid duplicates
        // Note: we'll only clear ones we mapped dynamically (IDs 10000+)
        const pending = await window.LocalNotifications.getPending();
        const toCancel = pending.notifications.filter(n => parseInt(n.id, 10) >= 10000);
        if (toCancel.length > 0) {
            await window.LocalNotifications.cancel({ notifications: toCancel });
        }

        const now = new Date();
        let payload = [];
        let soundOption = (window.notificationState && window.notificationState.sound) ? window.notificationState.sound : 'default';

        // 1. Habits
        const habits = state.data.habits || [];
        habits.forEach(habit => {
            if (!habit.reminder_time) return;
            if (habit.alarm_enabled === false) return; // user disabled alarm for this habit
            const timeStr = String(habit.reminder_time);
            let hours, minutes;

            if (timeStr.startsWith('1899-12-30T')) {
                const parts = timeStr.slice(11, 16).split(':');
                hours = parseInt(parts[0], 10);
                minutes = parseInt(parts[1], 10);
            } else if (timeStr.includes('T')) {
                const dt = new Date(timeStr);
                hours = dt.getHours();
                minutes = dt.getMinutes();
            } else if (timeStr.match(/^\d{2}:\d{2}/)) {
                const parts = timeStr.split(':');
                hours = parseInt(parts[0], 10);
                minutes = parseInt(parts[1], 10);
            } else {
                return;
            }

            if (isNaN(hours) || isNaN(minutes)) return;

            // Ensure we don't schedule an alarm if it's already marked completed today
            const logs = state.data.habit_logs || [];
            const todayStr = new Date().toISOString().slice(0, 10);
            const isDoneToday = logs.some(l => String(l.habit_id) === String(habit.id) && String(l.date).startsWith(todayStr));

            if (isDoneToday) return; // Skip if already crushed today!

            // Schedule for today
            const scheduleDate = new Date();
            scheduleDate.setHours(hours, minutes, 0, 0);

            // If time passed, schedule for tomorrow
            if (scheduleDate.getTime() <= now.getTime()) {
                scheduleDate.setDate(scheduleDate.getDate() + 1);
            }

            // BURST MODE: Schedule 10 notifications spaced 1 minute apart
            for (let i = 0; i < 10; i++) {
                const burstDate = new Date(scheduleDate.getTime() + (i * 60 * 1000));

                // Unique numeric ID for each burst: (habitId * 100) + 10000 + i
                const numericRoot = parseInt(String(habit.id).replace(/\D/g, '') || String(Math.floor(Math.random() * 8000)), 10);
                const burstId = (numericRoot * 100) + 10000 + i;

                const message = (habit.emoji || getIcon('default')) + ' Time for your habit: ' + (habit.habit_name || '');

                let config = {
                    title: "⏰ Habit Alarm (" + (i + 1) + "/10)",
                    body: message + " (Tap to dismiss!)",
                    id: burstId,
                    schedule: {
                        at: burstDate,
                        allowWhileIdle: false // Remove to avoid iOS crash
                    },
                    extra: { habit_id: habit.id, habit_name: habit.habit_name }
                };

                // Always set an explicit sound using helper
                config.sound = getNativeSoundPath(soundOption);

                payload.push(config);
            }
        });

        // 2. Tasks with due_time
        const tasks = state.data.tasks || [];
        tasks.forEach(task => {
            if (!task.due_date || !task.due_time || task.status === 'completed') return;

            let hours = null, minutes = null;
            const timeVal = String(task.due_time);

            if (timeVal.startsWith('1899-12-30T')) {
                const parts = timeVal.slice(11, 16).split(':');
                hours = parseInt(parts[0], 10);
                minutes = parseInt(parts[1], 10);
            } else if (timeVal.includes('T')) {
                const dt = new Date(timeVal);
                hours = dt.getHours();
                minutes = dt.getMinutes();
            } else if (timeVal.match(/^\d{2}:\d{2}/)) {
                const parts = timeVal.split(':');
                hours = parseInt(parts[0], 10);
                minutes = parseInt(parts[1], 10);
            }

            if (hours === null || minutes === null) return;

            const dueDate = new Date(task.due_date + 'T' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':00');

            // Only schedule if it's in the future
            if (dueDate.getTime() > now.getTime()) {
                const numericId = parseInt(String(task.id).replace(/\D/g, '') || String(Math.floor(Math.random() * 8000)), 10) + 20000;

                let config = {
                    title: "📋 Task Due",
                    body: task.title || 'Task Due',
                    id: numericId,
                    schedule: { at: dueDate }
                };

                // Always set an explicit sound using helper
                config.sound = getNativeSoundPath(soundOption);

                payload.push(config);
            }
        });

        // 3. Calendar / Planner events — notify 10 mins before start
        const plannerEvents = state.data.planner || [];
        plannerEvents.forEach(evt => {
            if (!evt.start_datetime || !evt.title) return;

            let startMs;
            if (typeof evt.start_datetime === 'number' || /^\d+$/.test(String(evt.start_datetime).trim())) {
                startMs = Number(evt.start_datetime);
            } else {
                const d = new Date(evt.start_datetime);
                if (isNaN(d.getTime())) return;
                startMs = d.getTime();
            }

            const alertTime = new Date(startMs - 10 * 60 * 1000); // 10 minutes before

            // Only schedule if alert time is in the future
            if (alertTime.getTime() > now.getTime()) {
                const numericId = parseInt(String(evt.id).replace(/\D/g, '') || String(Math.floor(Math.random() * 8000)), 10) + 30000;

                let config = {
                    title: "📅 Upcoming Event",
                    body: (evt.title || 'Event') + ' starts in 10 minutes',
                    id: numericId,
                    schedule: { at: alertTime }
                };

                // Always set an explicit sound using helper
                config.sound = getNativeSoundPath(soundOption);

                payload.push(config);
            }
        });

        // Batch schedule all
        if (payload.length > 0) {
            await window.LocalNotifications.schedule({ notifications: payload });
            console.log(`[Native Sync] Scheduled ${payload.length} background alarms.`);
        }

    } catch (e) {
        console.error('[Native Sync Error]', e);
    }
}

// Handle visibility change
function handleVisibilityChange() {
    if (!document.hidden) {
        // Tab became visible, check for missed reminders
        console.log('Tab became visible, checking for missed reminders...');
        checkAndTriggerReminders();
    }
}

// Cancel a scheduled notification
function cancelScheduledNotification(id) {
    if (notificationState.scheduledNotifications.has(id)) {
        clearTimeout(notificationState.scheduledNotifications.get(id));
        notificationState.scheduledNotifications.delete(id);
    }
}

// Schedule a notification for a specific time
function scheduleNotification(reminder) {
    const reminderTime = new Date(reminder.reminder_datetime).getTime();
    const now = Date.now();
    const delay = reminderTime - now;

    if (delay > 0) {
        const timeoutId = setTimeout(() => {
            triggerReminderNotification(reminder);
            notificationState.scheduledNotifications.delete(reminder.id);
        }, delay);

        notificationState.scheduledNotifications.set(reminder.id, timeoutId);
    }
}

// Send reminder via Capacitor Local Notifications
async function sendToAppInventor(reminder) {
    try {
        if (!window.LocalNotifications) {
            console.log('Capacitor LocalNotifications not available');
            return;
        }

        // Request permissions if needed
        const permStatus = await window.LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
            await window.LocalNotifications.requestPermissions();
        }

        let hour, minute, message;

        // For habits, use the reminder_time; for tasks, use due_time; for reminders, use reminder_datetime
        if (reminder.habit_name) {
            // It's a habit - use reminder_time
            const timeStr = String(reminder.reminder_time || '');
            if (timeStr.startsWith('1899-12-30T')) {
                hour = parseInt(timeStr.slice(11, 13), 10);
                minute = parseInt(timeStr.slice(14, 16), 10);
            } else if (timeStr.includes('T')) {
                const dt = new Date(timeStr);
                hour = dt.getHours();
                minute = dt.getMinutes();
            } else {
                const parts = timeStr.split(':');
                hour = parseInt(parts[0], 10);
                minute = parseInt(parts[1], 10);
            }
            message = (reminder.emoji || getIcon('default')) + ' ' + reminder.habit_name;
        } else if (reminder.title) {
            // It's a task - use due_time
            const timeStr = String(reminder.due_time || '');
            if (timeStr.startsWith('1899-12-30T')) {
                hour = parseInt(timeStr.slice(11, 13), 10);
                minute = parseInt(timeStr.slice(14, 16), 10);
            } else if (timeStr.includes('T')) {
                const dt = new Date(timeStr);
                hour = dt.getHours();
                minute = dt.getMinutes();
            } else {
                const parts = timeStr.split(':');
                hour = parseInt(parts[0], 10);
                minute = parseInt(parts[1], 10);
            }
            message = '📋 ' + reminder.title;
        } else {
            // Generic reminder
            const reminderTime = new Date(reminder.reminder_datetime);
            hour = reminderTime.getHours();
            minute = reminderTime.getMinutes();
            message = reminder.title + (reminder.description ? ' - ' + reminder.description : '');
        }

        if (isNaN(hour) || isNaN(minute)) {
            console.log('Invalid time for notification');
            return;
        }

        const scheduleDate = new Date();
        scheduleDate.setHours(hour, minute, 0, 0);

        // If time has already passed today, schedule for tomorrow
        if (scheduleDate.getTime() <= Date.now()) {
            scheduleDate.setDate(scheduleDate.getDate() + 1);
        }

        // Generate a numeric ID from the string ID
        const numericId = parseInt(String(reminder.id).replace(/\D/g, '') || String(Math.floor(Math.random() * 100000)), 10) % 2147483647;

        let soundOption = (window.notificationState && window.notificationState.sound) ? window.notificationState.sound : 'default';
        let config = {
            title: "Reminder",
            body: message,
            id: numericId,
            schedule: { at: scheduleDate },
            extra: {
                habit_id: reminder.habit_name ? reminder.id.replace('habit_', '') : undefined,
                habit_name: reminder.habit_name
            }
        };

        if (soundOption === 'none') {
            config.sound = null;
        } else {
            // Use helper to get correct sound path for iOS (.wav -> .caf)
            config.sound = getNativeSoundPath(soundOption);
        }

        await window.LocalNotifications.schedule({
            notifications: [config]
        });

        console.log('Scheduled native notification for:', message, 'at', scheduleDate);
    } catch (e) {
        console.error('Error scheduling native notification:', e);
    }
}

// ─── UPCOMING HABIT SUMMARY (next 24 hours) ───────────────────────────────────

/**
 * Parses a habit reminder_time value (handles Google Sheets formats) into {hours, minutes}.
 * Returns null if the time cannot be parsed.
 */
function parseHabitTime(timeVal) {
    const str = String(timeVal || '');
    if (!str) return null;

    let hours, minutes;

    if (str.startsWith('1899-12-30T')) {
        hours = parseInt(str.slice(11, 13), 10);
        minutes = parseInt(str.slice(14, 16), 10);
    } else if (str.includes('T')) {
        const d = new Date(str);
        if (isNaN(d)) return null;
        hours = d.getHours();
        minutes = d.getMinutes();
    } else if (/^\d{1,2}:\d{2}/.test(str)) {
        const parts = str.split(':');
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
    } else {
        return null;
    }

    if (isNaN(hours) || isNaN(minutes)) return null;
    return { hours, minutes };
}

/**
 * Builds a list of habits that are due in the next 24 hours,
 * then sends them to MIT App Inventor as a persistent summary notification.
 *
 * Signal format: HABIT_SUMMARY|count|line1~line2~line3
 * e.g.          HABIT_SUMMARY|3|🏃 Morning Run 07:00~💧 Drink Water 09:00~📖 Read 21:00
 */
async function sendUpcomingHabitSummary() {
    try {
        if (!window.LocalNotifications) return;

        const habits = (state && state.data && state.data.habits) || [];
        const tasks = (state && state.data && state.data.tasks) || [];

        const now = new Date();
        const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const upcoming = [];

        // 1. Gather Habits
        habits.forEach(habit => {
            if (!habit.reminder_time) return;
            const t = parseHabitTime(habit.reminder_time);
            if (!t) return;

            const habitToday = new Date(now);
            habitToday.setHours(t.hours, t.minutes, 0, 0);

            let habitTime = habitToday;
            if (habitTime <= now) {
                const habitTomorrow = new Date(habitToday);
                habitTomorrow.setDate(habitTomorrow.getDate() + 1);
                habitTime = habitTomorrow;
            }

            if (habitTime <= in24) {
                const timeLabel = `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;
                const emoji = habit.icon || '🔥';
                const name = habit.habit_name || 'Habit';
                upcoming.push({ time: habitTime, line: `${emoji} ${name} (${timeLabel})` });
            }
        });

        // 2. Gather High Priority Tasks
        const highTasks = tasks.filter(t => t.status !== 'completed' && t.priority === 'P1');
        const taskLines = highTasks.slice(0, 3).map(t => `📌 ${t.title}`);

        if (upcoming.length === 0 && taskLines.length === 0) return;

        // Sort habits by time
        upcoming.sort((a, b) => a.time - b.time);

        let bodyText = '';
        if (taskLines.length > 0) {
            bodyText += 'Top Tasks:\n' + taskLines.join('\n') + '\n\n';
        }
        if (upcoming.length > 0) {
            bodyText += 'Habits:\n' + upcoming.map(u => u.line).join('\n');
        }

        // Request permissions
        const permStatus = await window.LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
            await window.LocalNotifications.requestPermissions();
        }

        await window.LocalNotifications.schedule({
            notifications: [{
                id: 1000001,
                title: '🌅 Your Morning Briefing',
                body: bodyText,
                schedule: { at: new Date(Date.now() + 500) },
                sound: getNativeSoundPath(window.notificationState?.sound),
                actionTypeId: 'OPEN_DASHBOARD'
            }]
        });

        console.log('[MorningBriefing] Scheduled native notification');
    } catch (e) {
        console.error('[MorningBriefing] Error:', e);
    }
}

// --- CHIMES & REMINDERS ---
// --- CENTRALIZED AUDIO UTILITY (iOS Compatible) ---
window.playNativeSound = async function (filename) {
    if (!filename || filename === 'none') return;

    // 1. Native Capacitor Audio (iOS/Android)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeAudio) {
        try {
            const assetId = filename.replace('.wav', '');
            await window.Capacitor.Plugins.NativeAudio.preload({
                assetId: assetId,
                assetPath: 'assets/sounds/' + filename,
                audioChannelNum: 1,
                isUrl: false
            });
            await window.Capacitor.Plugins.NativeAudio.play({ assetId: assetId });
            console.log(`[Audio] Native play success: ${filename}`);
            return;
        } catch (e) {
            console.error(`[Audio] NativeAudio failed for ${filename}, falling back:`, e);
        }
    }

    // 2. Web Audio Fallback (Browser)
    try {
        const audio = new Audio('assets/sounds/' + filename);
        await audio.play();
        console.log(`[Audio] Web play success: ${filename}`);
    } catch (e) {
        console.error(`[Audio] Web playback failed for ${filename}:`, e);
    }
};

async function checkAndTriggerChimes() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if (!window.chimeState || !window.chimeState.enabled) return;

    const interval = window.chimeState.interval || 60;
    const qStart = window.chimeState.quietStart;
    const qEnd = window.chimeState.quietEnd;

    // Quiet hours cross midnight (e.g. 22 to 08)
    let isQuiet = false;
    if (qStart > qEnd) {
        if (hour >= qStart || hour < qEnd) isQuiet = true;
    } else {
        if (hour >= qStart && hour < qEnd) isQuiet = true;
    }

    if (isQuiet) return;

    if (minute % interval !== 0) return;

    const cacheKey = `chime_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}_${hour}_${minute}`;
    if (localStorage.getItem(cacheKey)) return;
    localStorage.setItem(cacheKey, 'true');

    console.log(`[Chimes] Triggering interval chime for ${hour}:${minute}`);

    let timeString = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let msg = `It is ${timeString}.`;
    let subMsg = window.chimeState.waterReminder ? window.chimeState.customMessage : '';

    // 1. Play native sound (iOS Fixed)
    if (window.chimeState.sound && window.chimeState.sound !== 'none') {
        window.playNativeSound(window.chimeState.sound);
    }

    // 2. TTS (SSML Fixed)
    if (window.chimeState.speakTime && 'speechSynthesis' in window) {
        const textToSpeak = (msg + " " + subMsg).trim();
        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
    }

    // 3. UI Background Toast
    const finalMsg = window.chimeState.waterReminder ? window.chimeState.customMessage : msg;
    showInAppNotification("🔔 " + finalMsg, "info");

    // 4. Native Push Notification
    if (window.LocalNotifications && notificationState.permission === 'granted') {
        window.LocalNotifications.schedule({
            notifications: [{
                id: 40000 + hour + minute,
                title: "🔔 " + msg,
                body: finalMsg,
                schedule: { at: new Date(Date.now() + 500) },
                sound: getNativeSoundPath(window.chimeState?.sound)
            }]
        });
    }
}

// Expose so screens can call it when habit data loads
window.sendUpcomingHabitSummary = sendUpcomingHabitSummary;
window.syncNativeNotifications = syncNativeNotifications;

// Initialize on load
document.addEventListener('DOMContentLoaded', initNotificationService);
