const CACHE_NAME = 'personal-os-v3';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './view-dashboard.js',
    './view-tasks.js',
    './view-habits.js',
    './view-calendar.js',
    './view-finance.js',
    './view-diary.js',
    './view-vision.js',
    './view-settings.js',
    './view-reminders.js',
    './notification-service.js',
    './view-people.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const title = event.data.title;
        const options = {
            body: event.data.body,
            icon: './icon-192.png',
            badge: './icon-192.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            tag: event.data.tag || 'pos-alarm',
            requireInteraction: true
        };
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // Handle notification click - navigate to reminder or related item
    const data = event.notification.data || {};
    const reminderId = data.reminderId;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            if (windowClients.length > 0) {
                let client = windowClients[0];
                for (let i = 0; i < windowClients.length; i++) {
                    if ('focus' in windowClients[i]) {
                        client = windowClients[i];
                        break;
                    }
                }
                // Send message to client to handle navigation
                if (reminderId) {
                    client.postMessage({
                        type: 'REMINDER_CLICKED',
                        reminderId: reminderId
                    });
                }
                return client.focus();
            } else {
                return clients.openWindow('/');
            }
        })
    );
});

// Background sync for offline reminders
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-reminders') {
        event.waitUntil(syncReminders());
    }
});

async function syncReminders() {
    // Get pending reminders from IndexedDB and sync
    console.log('Background sync: Syncing reminders...');
    // This would be handled by the main app when it comes online
}
