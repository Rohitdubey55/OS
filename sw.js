const CACHE_NAME = 'personal-os-v7';

// Get the base path for GitHub Pages compatibility
const BASE_PATH = self.location.pathname.replace('/sw.js', '');

// Only include files that actually exist in the repository
const ASSETS_TO_CACHE = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/style.css`,
    `${BASE_PATH}/main.js`,
    `${BASE_PATH}/manifest.json`,
    // Views
    `${BASE_PATH}/view-dashboard.js`,
    `${BASE_PATH}/view-tasks.js`,
    `${BASE_PATH}/view-habits.js`,
    `${BASE_PATH}/view-calendar.js`,
    `${BASE_PATH}/view-finance.js`,
    `${BASE_PATH}/view-diary.js`,
    `${BASE_PATH}/view-vision.js`,
    `${BASE_PATH}/view-settings.js`,
    `${BASE_PATH}/view-people.js`,
    // Services
    `${BASE_PATH}/notification-service.js`,
    `${BASE_PATH}/ai-service.js`,
    `${BASE_PATH}/fab-menu.js`,
    // Components
    `${BASE_PATH}/components/empty-state.js`,
    // Styles
    `${BASE_PATH}/styles/design-system.css`,
    `${BASE_PATH}/styles/components.css`,
    `${BASE_PATH}/loader.css`,
    `${BASE_PATH}/settings-styles.css`,
    `${BASE_PATH}/settings-data-styles.css`,
    `${BASE_PATH}/settings-fab.css`,
    `${BASE_PATH}/fab-menu-styles.css`,
    `${BASE_PATH}/diary-views.css`,
    `${BASE_PATH}/finance-transactions.css`,
    `${BASE_PATH}/ui-polish.css`,
    `${BASE_PATH}/vision-views.css`,
    `${BASE_PATH}/vision-mobile.css`,
    `${BASE_PATH}/saas-polish.css`,
    `${BASE_PATH}/command-palette.css`
];

self.addEventListener('install', (event) => {
    console.log('[SW v7] Installing service worker...');
    console.log('[SW v7] Base path:', BASE_PATH);
    console.log('[SW v7] Full sw location:', self.location.href);
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW v7] Caching assets individually...');
            
            // Cache assets one by one to identify failures
            return Promise.all(
                ASSETS_TO_CACHE.map((url) => {
                    return cache.add(url).then(() => {
                        console.log('[SW v7] ✓ Cached:', url);
                    }).catch((err) => {
                        console.error('[SW v7] ✗ Failed to cache:', url, err);
                    });
                })
            );
        }).then(() => {
            console.log('[SW v7] Cache operation complete');
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
    console.log('[SW v7] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW v7] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW v7] Claiming clients...');
            return self.clients.claim();
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

// Push event listener for push notifications from push service
self.addEventListener('push', (event) => {
    console.log('[SW v7] Push received:', event);
    
    let data = {
        title: 'PersonalOS',
        body: 'You have a new notification',
        tag: 'pos-notification'
    };
    
    // Parse push data if available
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        tag: data.tag || 'pos-notification',
        requireInteraction: data.requireInteraction || false,
        data: data.data || {}
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Push subscription change listener
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('[SW v7] Push subscription changed');
    
    event.waitUntil(
        // Notify the app about subscription change
        self.registration.pushManager.subscribe({ userVisibleOnly: true })
            .then((subscription) => {
                // Send new subscription to server
                return fetch('/api/push-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(subscription)
                });
            })
            .catch((error) => {
                console.error('[SW v7] Failed to resubscribe:', error);
            })
    );
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
                // Use BASE_PATH for GitHub Pages compatibility
                return clients.openWindow(BASE_PATH + '/');
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
