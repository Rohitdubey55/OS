const CACHE_NAME = 'personal-os-v5';

// Get the base path for GitHub Pages compatibility
const BASE_PATH = self.location.pathname.replace('/sw.js', '');

const ASSETS_TO_CACHE = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/style.css`,
    `${BASE_PATH}/main.js`,
    `${BASE_PATH}/view-dashboard.js`,
    `${BASE_PATH}/view-tasks.js`,
    `${BASE_PATH}/view-habits.js`,
    `${BASE_PATH}/view-calendar.js`,
    `${BASE_PATH}/view-finance.js`,
    `${BASE_PATH}/view-diary.js`,
    `${BASE_PATH}/view-vision.js`,
    `${BASE_PATH}/view-settings.js`,
    `${BASE_PATH}/view-reminders.js`,
    `${BASE_PATH}/notification-service.js`,
    `${BASE_PATH}/view-people.js`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/sw.js`
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    console.log('[SW] Base path:', BASE_PATH);
    console.log('[SW] Assets to cache:', ASSETS_TO_CACHE);
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => {
            console.log('[SW] All assets cached successfully');
            return self.skipWaiting();
        }).catch((error) => {
            console.error('[SW] Failed to cache assets:', error);
            // Continue even if caching fails - allows app to work
            return self.skipWaiting();
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
