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

// Initialize notification service
async function initNotificationService() {
    console.log('Initializing notification service...');

    // Wait for DOM to be ready
    if (!document.getElementById('main')) {
        console.log('DOM not ready, waiting...');
        setTimeout(initNotificationService, 100);
        return;
    }

    // Check current permission
    if ('Notification' in window) {
        notificationState.permission = Notification.permission;
    }

    // Load settings from localStorage
    loadNotificationSettings();

    // Request permission if needed
    if (notificationState.permission === 'default') {
        console.log('Notification permission not yet requested');
    }

    // Start polling for due reminders
    startReminderPolling();

    // Handle visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    console.log('Notification service initialized');
}

// Load notification settings from localStorage
function loadNotificationSettings() {
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            notificationState.enabled = settings.enabled !== false;
            notificationState.sound = settings.sound || 'default';
            notificationState.quietHoursStart = settings.quietHoursStart || 22;
            notificationState.quietHoursEnd = settings.quietHoursEnd || 8;
            notificationState.defaultMethod = settings.defaultMethod || 'both';
        } catch (e) {
            console.error('Error loading notification settings:', e);
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
        defaultMethod: notificationState.defaultMethod
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
                    reminder_datetime: now.toISOString()
                });
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
    // Check every minute
    setInterval(() => {
        if (notificationState.enabled && !document.hidden) {
            checkAndTriggerReminders();
        }
    }, 60000);

    // Refresh the habit summary every 30 minutes
    setInterval(() => {
        if (notificationState.enabled) {
            sendUpcomingHabitSummary();
        }
    }, 30 * 60 * 1000);

    // Check & summarise immediately on start
    checkAndTriggerReminders();
    setTimeout(sendUpcomingHabitSummary, 3000); // slight delay so state.data.habits has loaded
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

// Send reminder to MIT App Inventor via WebViewString
function sendToAppInventor(reminder) {
    try {
        // Check if running in WebView (MIT App Inventor)
        const isAndroid = typeof Android !== 'undefined' && Android.setWebViewString;
        const isAppInventor = typeof window.AppInventor !== 'undefined';

        if (!isAndroid && !isAppInventor) {
            console.log('Not running in App Inventor WebView - using browser notifications instead');
            return;
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
            message = encodeURIComponent((reminder.emoji || getIcon('default')) + ' ' + reminder.habit_name);
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
            message = encodeURIComponent('📋 ' + reminder.title);
        } else {
            // Generic reminder
            const reminderTime = new Date(reminder.reminder_datetime);
            hour = reminderTime.getHours();
            minute = reminderTime.getMinutes();
            message = encodeURIComponent(reminder.title + (reminder.description ? ' - ' + reminder.description : ''));
        }

        if (isNaN(hour) || isNaN(minute)) {
            console.log('Invalid time for App Inventor notification');
            return;
        }

        // Format: ALARM|hour|minute|message
        const webViewString = `ALARM|${hour}|${String(minute).padStart(2, '0')}|${message}`;

        if (isAndroid) {
            Android.setWebViewString(webViewString);
        } else if (isAppInventor) {
            window.AppInventor.setWebViewString(webViewString);
        }

        console.log('Sent alarm to App Inventor:', webViewString);
    } catch (e) {
        console.error('Error sending to App Inventor:', e);
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
function sendUpcomingHabitSummary() {
    try {
        const isAndroid = typeof Android !== 'undefined' && Android.setWebViewString;
        const isAppInventor = typeof window.AppInventor !== 'undefined';
        if (!isAndroid && !isAppInventor) return;

        const habits = (state && state.data && state.data.habits) || [];
        if (habits.length === 0) return;

        const now = new Date();
        const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const upcoming = [];

        habits.forEach(habit => {
            if (!habit.reminder_time) return;

            const t = parseHabitTime(habit.reminder_time);
            if (!t) return;

            // Build a Date for today at the habit's time
            const habitToday = new Date(now);
            habitToday.setHours(t.hours, t.minutes, 0, 0);

            // If already passed today, check tomorrow's occurrence
            let habitTime = habitToday;
            if (habitTime <= now) {
                const habitTomorrow = new Date(habitToday);
                habitTomorrow.setDate(habitTomorrow.getDate() + 1);
                habitTime = habitTomorrow;
            }

            if (habitTime <= in24) {
                const timeLabel = `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;
                const emoji = habit.emoji || '⭐';
                const name = habit.habit_name || 'Habit';
                upcoming.push({ habitTime, line: `${emoji} ${name} ${timeLabel}` });
            }
        });

        if (upcoming.length === 0) return;

        // Sort by time
        upcoming.sort((a, b) => a.habitTime - b.habitTime);

        const lines = upcoming.map(u => u.line).join('~');
        const command = `HABIT_SUMMARY|${upcoming.length}|${lines}`;

        if (isAndroid) {
            Android.setWebViewString(command);
        } else {
            window.AppInventor.setWebViewString(command);
        }

        console.log('[HabitSummary] Sent to App Inventor:', command);
    } catch (e) {
        console.error('[HabitSummary] Error:', e);
    }
}

// Expose so screens can call it when habit data loads
window.sendUpcomingHabitSummary = sendUpcomingHabitSummary;

// Initialize on load
document.addEventListener('DOMContentLoaded', initNotificationService);
