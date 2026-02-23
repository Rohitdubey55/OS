/**
 * Icon Pack System
 * Provides icon mappings for multiple icon packs:
 * - lucide: Built-in Lucide icons (default)
 * - emoji: Classic emoji fallback
 * - material: Material Design Outlined icons
 */

// Icon name to pack-specific icon mappings
const ICON_MAPPINGS = {
  // Navigation
  'home': { lucide: 'home', emoji: '🏠', material: 'home', remix: 'home-3', tabler: 'home', fontawesome: 'fa-house', heroicons: 'home', feather: 'home' },
  'list': { lucide: 'list', emoji: '📋', material: 'view_list', remix: 'list-check', tabler: 'list', fontawesome: 'fa-list', heroicons: 'bars-3', feather: 'list' },
  'calendar': { lucide: 'calendar', emoji: '📅', material: 'event', remix: 'calendar-line', tabler: 'calendar', fontawesome: 'fa-calendar', heroicons: 'calendar', feather: 'calendar' },
  'yearly': { lucide: 'calendar-days', emoji: '📆', material: 'calendar_month', remix: 'calendar-event-line', tabler: 'calendar-event', fontawesome: 'fa-calendar-days', heroicons: 'calendar-days', feather: 'calendar' },
  'insights': { lucide: 'bar-chart-3', emoji: '📊', material: 'insights', remix: 'bar-chart-2-line', tabler: 'chart-bar', fontawesome: 'fa-chart-bar', heroicons: 'chart-bar', feather: 'bar-chart-2' },
  'tags': { lucide: 'tags', emoji: '🏷️', material: 'label', remix: 'price-tag-3-line', tabler: 'tags', fontawesome: 'fa-tags', heroicons: 'tag', feather: 'tag' },

  // UI Elements
  'chevron-right': { lucide: 'chevron-right', emoji: '▶', material: 'chevron_right', remix: 'arrow-right-s-line', tabler: 'chevron-right', fontawesome: 'fa-chevron-right', heroicons: 'chevron-right', feather: 'chevron-right' },
  'quick-write': { lucide: 'edit-3', emoji: '✍️', material: 'draw', remix: 'quill-pen-line', tabler: 'writing', fontawesome: 'fa-pen', heroicons: 'pencil-square', feather: 'edit-3' },
  'empty-illustration': { lucide: 'inbox', emoji: '📭', material: 'inbox', remix: 'inbox-line', tabler: 'inbox', fontawesome: 'fa-inbox', heroicons: 'inbox-stack', feather: 'inbox' },
  'header-icon': { lucide: 'hash', emoji: '#', material: 'tag', remix: 'hashtag', tabler: 'hash', fontawesome: 'fa-hashtag', heroicons: 'hashtag', feather: 'hash' },
  'overview-icon': { lucide: 'calendar', emoji: '📅', material: 'event', remix: 'calendar-line', tabler: 'calendar', fontawesome: 'fa-calendar', heroicons: 'calendar', feather: 'calendar' },
  'stat-icon': { lucide: 'flame', emoji: '🔥', material: 'local_fire_department', remix: 'fire-line', tabler: 'flame', fontawesome: 'fa-fire', heroicons: 'fire', feather: 'feather' },
  'nav-icon': { lucide: 'home', emoji: '🏠', material: 'home', remix: 'home-3', tabler: 'home', fontawesome: 'fa-house', heroicons: 'home', feather: 'home' },
  'insight-dot': { lucide: 'circle', emoji: '●', material: 'circle', remix: 'checkbox-blank-circle-line', tabler: 'circle', fontawesome: 'fa-circle', heroicons: 'circle', feather: 'circle' },
  'view-all-icon': { lucide: 'arrow-right', emoji: '➡️', material: 'arrow_forward', remix: 'arrow-right-line', tabler: 'arrow-right', fontawesome: 'fa-arrow-right', heroicons: 'arrow-right', feather: 'arrow-right' },
  'spin': { lucide: 'loader', emoji: '⌛', material: 'sync', remix: 'loader-4-line', tabler: 'loader', fontawesome: 'fa-spinner', heroicons: 'arrow-path', feather: 'loader' },

  // Stats & Activity
  'streak': { lucide: 'flame', emoji: '🔥', material: 'local_fire_department', remix: 'fire-line', tabler: 'flame', fontawesome: 'fa-fire', heroicons: 'fire', feather: 'feather' },
  'entries': { lucide: 'book-open', emoji: '📝', material: 'edit_note', remix: 'book-open-line', tabler: 'book-2', fontawesome: 'fa-book-open', heroicons: 'book-open', feather: 'book' },
  'achievements': { lucide: 'trophy', emoji: '🏆', material: 'emoji_events', remix: 'trophy-line', tabler: 'trophy', fontawesome: 'fa-trophy', heroicons: 'trophy', feather: 'award' },
  'mood': { lucide: 'smile', emoji: '😊', material: 'mood', remix: 'emotion-happy-line', tabler: 'mood-smile', fontawesome: 'fa-face-smile', heroicons: 'face-smile', feather: 'smile' },
  'words': { lucide: 'file-text', emoji: '📖', material: 'notes', remix: 'text-spacing', tabler: 'letter-a', fontawesome: 'fa-file-text', heroicons: 'document-text', feather: 'file-text' },

  // Actions
  'edit': { lucide: 'pencil', emoji: '✏️', material: 'edit', remix: 'edit-line', tabler: 'edit', fontawesome: 'fa-pen', heroicons: 'pencil-square', feather: 'edit-3' },
  'delete': { lucide: 'trash-2', emoji: '🗑️', material: 'delete', remix: 'delete-bin-line', tabler: 'trash', fontawesome: 'fa-trash', heroicons: 'trash', feather: 'trash-2' },
  'add': { lucide: 'plus', emoji: '+', material: 'add', remix: 'add-line', tabler: 'plus', fontawesome: 'fa-plus', heroicons: 'plus', feather: 'plus' },
  'save': { lucide: 'check', emoji: '✓', material: 'check', remix: 'check-line', tabler: 'check', fontawesome: 'fa-check', heroicons: 'check', feather: 'check' },
  'cancel': { lucide: 'x', emoji: '✕', material: 'close', remix: 'close-line', tabler: 'x', fontawesome: 'fa-xmark', heroicons: 'x-mark', feather: 'x' },
  'warning': { lucide: 'alert-triangle', emoji: '⚠️', material: 'warning', remix: 'error-warning-line', tabler: 'alert-triangle', fontawesome: 'fa-triangle-exclamation', heroicons: 'exclamation-triangle', feather: 'alert-triangle' },
  'search': { lucide: 'search', emoji: '🔍', material: 'search', remix: 'search-line', tabler: 'search', fontawesome: 'fa-magnifying-glass', heroicons: 'magnifying-glass', feather: 'search' },
  'export': { lucide: 'download', emoji: '📤', material: 'download', remix: 'download-2-line', tabler: 'download', fontawesome: 'fa-download', heroicons: 'arrow-down-tray', feather: 'download' },
  'write': { lucide: 'edit-3', emoji: '✍️', material: 'draw', remix: 'quill-pen-line', tabler: 'writing', fontawesome: 'fa-pen', heroicons: 'pencil-square', feather: 'edit-3' },

  // Categories
  'health': { lucide: 'heart', emoji: '❤️', material: 'favorite', remix: 'heart-line', tabler: 'heart', fontawesome: 'fa-heart', heroicons: 'heart', feather: 'heart' },
  'fitness': { lucide: 'dumbbell', emoji: '💪', material: 'fitness_center', remix: 'run-line', tabler: 'stretching', fontawesome: 'fa-dumbbell', heroicons: 'bolt', feather: 'activity' },
  'learning': { lucide: 'book-open', emoji: '📚', material: 'menu_book', remix: 'book-open-line', tabler: 'book', fontawesome: 'fa-book', heroicons: 'book-open', feather: 'book' },
  'productivity': { lucide: 'rocket', emoji: '🚀', material: 'rocket_launch', remix: 'rocket-line', tabler: 'rocket', fontawesome: 'fa-rocket', heroicons: 'rocket-launch', feather: 'send' },
  'spiritual': { lucide: 'sparkles', emoji: '🧘', material: 'self_improvement', remix: 'sparkling-line', tabler: 'sparkles', fontawesome: 'fa-sparkles', heroicons: 'sparkles', feather: 'star' },
  'water': { lucide: 'droplet', emoji: '💧', material: 'water_drop', remix: 'drop-line', tabler: 'droplet', fontawesome: 'fa-droplet', heroicons: 'droplet', feather: 'droplet' },
  'food': { lucide: 'apple', emoji: '🍎', material: 'restaurant', remix: 'restaurant-line', tabler: 'apple', fontawesome: 'fa-apple-whole', heroicons: 'apple', feather: 'aperture' },
  'running': { lucide: 'footprints', emoji: '🏃', material: 'directions_run', remix: 'run-line', tabler: 'run', fontawesome: 'fa-person-running', heroicons: 'footprints', feather: 'activity' },
  'sleep': { lucide: 'moon', emoji: '💤', material: 'bedtime', remix: 'moon-line', tabler: 'moon', fontawesome: 'fa-moon', heroicons: 'moon', feather: 'moon' },
  'default': { lucide: 'star', emoji: '✨', material: 'auto_awesome', remix: 'star-line', tabler: 'star', fontawesome: 'fa-star', heroicons: 'star', feather: 'star' },

  // Empty States
  'inbox-empty': { lucide: 'inbox', emoji: '📭', material: 'inbox', remix: 'inbox-line', tabler: 'inbox', fontawesome: 'fa-inbox', heroicons: 'inbox-stack', feather: 'inbox' },
  'no-events': { lucide: 'calendar-x', emoji: '📅', material: 'event_busy', remix: 'calendar-close-line', tabler: 'calendar-off', fontawesome: 'fa-calendar-xmark', heroicons: 'calendar-days', feather: 'calendar' },
  'no-expenses': { lucide: 'wallet', emoji: '💰', material: 'account_balance_wallet', remix: 'wallet-line', tabler: 'wallet', fontawesome: 'fa-wallet', heroicons: 'wallet', feather: 'credit-card' },
  'no-habits': { lucide: 'target', emoji: '🎯', material: 'track_changes', remix: 'focus-line', tabler: 'target', fontawesome: 'fa-bullseye', heroicons: 'target', feather: 'target' },
  'no-diary': { lucide: 'book', emoji: '📔', material: 'book', remix: 'book-line', tabler: 'book', fontawesome: 'fa-book', heroicons: 'book-open', feather: 'book' },
  'no-vision': { lucide: 'eye', emoji: '👁️', material: 'visibility', remix: 'eye-line', tabler: 'eye', fontawesome: 'fa-eye', heroicons: 'eye', feather: 'eye' },
  'no-tasks': { lucide: 'check-square', emoji: '✓', material: 'task_alt', remix: 'checkbox-line', tabler: 'check', fontawesome: 'fa-square-check', heroicons: 'check-badge', feather: 'check-square' },
  'planner': { lucide: 'calendar', emoji: '📅', material: 'event', remix: 'calendar-line', tabler: 'calendar', fontawesome: 'fa-calendar', heroicons: 'calendar', feather: 'calendar' },

  // Finance
  'money': { lucide: 'coins', emoji: '💰', material: 'paid', remix: 'coin-line', tabler: 'coins', fontawesome: 'fa-coins', heroicons: 'currency-dollar', feather: 'dollar-sign' },

  // Vision
  'goals': { lucide: 'target', emoji: '🎯', material: 'track_changes', remix: 'focus-line', tabler: 'target', fontawesome: 'fa-bullseye', heroicons: 'target', feather: 'target' },
  'achieved': { lucide: 'check-circle', emoji: '✅', material: 'check_circle', remix: 'checkbox-circle-line', tabler: 'circle-check', fontawesome: 'fa-circle-check', heroicons: 'check-circle', feather: 'check-circle' },
  'upload': { lucide: 'upload', emoji: '📁', material: 'folder_open', remix: 'upload-line', tabler: 'upload', fontawesome: 'fa-upload', heroicons: 'arrow-up-tray', feather: 'upload' },
  'url': { lucide: 'link', emoji: '🔗', material: 'link', remix: 'link', tabler: 'link', fontawesome: 'fa-link', heroicons: 'link', feather: 'link' },

  // Mood faces (specific mappings)
  'mood-great': { lucide: 'grinning', emoji: '🤩', material: 'sentiment_very_satisfied', remix: 'emotion-laugh-line', tabler: 'mood-star', fontawesome: 'fa-face-grin-stars', heroicons: 'face-frown', feather: 'star' },
  'mood-good': { lucide: 'smile', emoji: '😄', material: 'sentiment_satisfied', remix: 'emotion-happy-line', tabler: 'mood-smile', fontawesome: 'fa-face-smile', heroicons: 'face-smile', feather: 'smile' },
  'mood-okay': { lucide: 'meh', emoji: '🙂', material: 'sentiment_neutral', remix: 'emotion-normal-line', tabler: 'mood-neutral', fontawesome: 'fa-face-meh', heroicons: 'face-neutral', feather: 'meh' },
  'mood-low': { lucide: 'frown', emoji: '😔', material: 'sentiment_dissatisfied', remix: 'emotion-unhappy-line', tabler: 'mood-sad', fontawesome: 'fa-face-frown', heroicons: 'face-frown', feather: 'frown' },
  'mood-bad': { lucide: 'frown', emoji: '😕', material: 'sentiment_very_dissatisfied', remix: 'emotion-sad-line', tabler: 'mood-cry', fontawesome: 'fa-face-frown-open', heroicons: 'face-frown', feather: 'frown' },
  'mood-sad': { lucide: 'sad-tear', emoji: '😞', material: 'sentiment_very_dissatisfied', remix: 'emotion-sad-line', tabler: 'mood-cry', fontawesome: 'fa-face-sad-tear', heroicons: 'face-frown', feather: 'frown' },

  // Notifications
  'reminder': { lucide: 'bell', emoji: '🔔', material: 'notifications', remix: 'notification-line', tabler: 'bell', fontawesome: 'fa-bell', heroicons: 'bell', feather: 'bell' },
  'task-due': { lucide: 'clipboard-list', emoji: '📋', material: 'task', remix: 'questionnaire-line', tabler: 'clipboard-list', fontawesome: 'fa-clipboard-list', heroicons: 'clipboard-document-list', feather: 'clipboard' },

  // UI Elements
  'down': { lucide: 'chevron-down', emoji: '▼', material: 'expand_more', remix: 'arrow-down-s-line', tabler: 'chevron-down', fontawesome: 'fa-chevron-down', heroicons: 'chevron-down', feather: 'chevron-down' },
  'right': { lucide: 'chevron-right', emoji: '▶', material: 'chevron_right', remix: 'arrow-right-s-line', tabler: 'chevron-right', fontawesome: 'fa-chevron-right', heroicons: 'chevron-right', feather: 'chevron-right' },
  'grid': { lucide: 'layout-grid', emoji: '⊞', material: 'grid_view', remix: 'grid-line', tabler: 'layout-grid', fontawesome: 'fa-grip', heroicons: 'square-3-stack-3d', feather: 'grid' },
  'dashboard': { lucide: 'layout-dashboard', emoji: '🏠', material: 'dashboard', remix: 'dashboard-line', tabler: 'dashboard', fontawesome: 'fa-gauge-high', heroicons: 'rectangle-group', feather: 'grid' },
  'drag': { lucide: 'grip-vertical', emoji: '⋮', material: 'drag_indicator', remix: 'draggable', tabler: 'grip-vertical', fontawesome: 'fa-grip-vertical', heroicons: 'bars-3-bottom', feather: 'more-vertical' },
  'loading': { lucide: 'loader', emoji: '⌛', material: 'sync', remix: 'loader-4-line', tabler: 'loader', fontawesome: 'fa-spinner', heroicons: 'arrow-path', feather: 'loader' },
  'refresh': { lucide: 'refresh-cw', emoji: '🔄', material: 'refresh', remix: 'refresh-line', tabler: 'refresh', fontawesome: 'fa-rotate-right', heroicons: 'arrow-path', feather: 'refresh-cw' },
  'info': { lucide: 'alert-circle', emoji: 'ℹ️', material: 'info', remix: 'information-line', tabler: 'info-circle', fontawesome: 'fa-circle-info', heroicons: 'information-circle', feather: 'info' },
  'chat': { lucide: 'message-circle', emoji: '💬', material: 'chat', remix: 'chat-4-line', tabler: 'message-circle', fontawesome: 'fa-comment', heroicons: 'chat-bubble-left', feather: 'message-circle' },
  'send': { lucide: 'send', emoji: '✈️', material: 'send', remix: 'send-plane-line', tabler: 'send', fontawesome: 'fa-paper-plane', heroicons: 'paper-airplane', feather: 'send' },
  'hash': { lucide: 'hash', emoji: '#', material: 'tag', remix: 'hashtag', tabler: 'hash', fontawesome: 'fa-hashtag', heroicons: 'hashtag', feather: 'hash' },
  'check-circle': { lucide: 'check-circle', emoji: '✅', material: 'check_circle', remix: 'checkbox-circle-line', tabler: 'circle-check', fontawesome: 'fa-circle-check', heroicons: 'check-circle', feather: 'check-circle' },
  'circle': { lucide: 'circle', emoji: '○', material: 'circle', remix: 'checkbox-blank-circle-line', tabler: 'circle', fontawesome: 'fa-circle', heroicons: 'circle', feather: 'circle' },
  'priority': { lucide: 'zap', emoji: '⚡', material: 'bolt', remix: 'flashlight-line', tabler: 'bolt', fontawesome: 'fa-bolt', heroicons: 'bolt', feather: 'zap' },
  'loss': { lucide: 'trending-down', emoji: '📉', material: 'trending_down', remix: 'trending-down-line', tabler: 'trending-down', fontawesome: 'fa-chart-line', heroicons: 'arrow-trending-down', feather: 'trending-down' },
  'upload-cloud': { lucide: 'upload-cloud', emoji: '☁️', material: 'cloud_upload', remix: 'cloud-upload-line', tabler: 'cloud-upload', fontawesome: 'fa-cloud-arrow-up', heroicons: 'cloud-arrow-up', feather: 'cloud' },
  'wallet': { lucide: 'wallet', emoji: '💰', material: 'account_balance_wallet', remix: 'wallet-line', tabler: 'wallet', fontawesome: 'fa-wallet', heroicons: 'wallet', feather: 'credit-card' },
  'add': { lucide: 'plus', emoji: '➕', material: 'add', remix: 'add-line', tabler: 'plus', fontawesome: 'fa-plus', heroicons: 'plus', feather: 'plus' },
  'back': { lucide: 'arrow-left', emoji: '⬅️', material: 'arrow_back', remix: 'arrow-left-line', tabler: 'arrow-left', fontawesome: 'fa-arrow-left', heroicons: 'arrow-left', feather: 'arrow-left' },
  'next': { lucide: 'arrow-right', emoji: '➡️', material: 'arrow_forward', remix: 'arrow-right-line', tabler: 'arrow-right', fontawesome: 'fa-arrow-right', heroicons: 'arrow-right', feather: 'arrow-right' },
  'tag': { lucide: 'tag', emoji: '🏷️', material: 'local_offer', remix: 'price-tag-line', tabler: 'tag', fontawesome: 'fa-tag', heroicons: 'tag', feather: 'tag' },
  'clock': { lucide: 'clock', emoji: '🕒', material: 'schedule', remix: 'time-line', tabler: 'clock', fontawesome: 'fa-clock', heroicons: 'clock', feather: 'clock' },
  'search': { lucide: 'search', emoji: '🔍', material: 'search', remix: 'search-line', tabler: 'search', fontawesome: 'fa-magnifying-glass', heroicons: 'magnifying-glass', feather: 'search' },
  'x': { lucide: 'x', emoji: '❌', material: 'close', remix: 'close-line', tabler: 'x', fontawesome: 'fa-xmark', heroicons: 'x-mark', feather: 'x' },
  'warning': { lucide: 'alert-triangle', emoji: '⚠️', material: 'warning', remix: 'error-warning-line', tabler: 'alert-triangle', fontawesome: 'fa-triangle-exclamation', heroicons: 'exclamation-triangle', feather: 'alert-triangle' },
  'repeat': { lucide: 'repeat', emoji: '🔁', material: 'repeat', remix: 'repeat-line', tabler: 'repeat', fontawesome: 'fa-repeat', heroicons: 'arrow-path', feather: 'repeat' },
  'up': { lucide: 'chevron-up', emoji: '🔼', material: 'expand_less', remix: 'arrow-up-s-line', tabler: 'chevron-up', fontawesome: 'fa-chevron-up', heroicons: 'chevron-up', feather: 'chevron-up' },
  'alert-circle': { lucide: 'alert-circle', emoji: '🚨', material: 'error', remix: 'error-warning-line', tabler: 'alert-circle', fontawesome: 'fa-circle-exclamation', heroicons: 'exclamation-circle', feather: 'alert-circle' },
  'rupee': { lucide: 'indian-rupee', emoji: '₹', material: 'currency_rupee', remix: 'money-rupee-circle-line', tabler: 'currency-rupee', fontawesome: 'fa-indian-rupee-sign', heroicons: 'currency-rupee', feather: 'indian-rupee' },
  'star': { lucide: 'star', emoji: '⭐', material: 'star', remix: 'star-line', tabler: 'star', fontawesome: 'fa-star', heroicons: 'star', feather: 'star' },
  'target': { lucide: 'target', emoji: '🎯', material: 'adjust', remix: 'focus-line', tabler: 'target', fontawesome: 'fa-bullseye', heroicons: 'target', feather: 'target' },
  'landmark': { lucide: 'landmark', emoji: '🏛️', material: 'account_balance', remix: 'bank-line', tabler: 'building-bank', fontawesome: 'fa-landmark', heroicons: 'building-library', feather: 'home' },
  'activity': { lucide: 'activity', emoji: '📈', material: 'insights', remix: 'pulse-line', tabler: 'activity', fontawesome: 'fa-chart-simple', heroicons: 'chart-bar-square', feather: 'activity' },

  // Misc
  'greeting-morning': { lucide: 'sunrise', emoji: '☀️', material: 'wb_sunny', remix: 'sun-line', tabler: 'sun', fontawesome: 'fa-sun', heroicons: 'sun', feather: 'sun' },
  'locked': { lucide: 'lock', emoji: '🔒', material: 'lock', remix: 'lock-line', tabler: 'lock', fontawesome: 'fa-lock', heroicons: 'lock-closed', feather: 'lock' },
  'birthday': { lucide: 'cake', emoji: '🎂', material: 'cake', remix: 'cake-line', tabler: 'cake', fontawesome: 'fa-birthday-cake', heroicons: 'cake', feather: 'gift' },
  'chart': { lucide: 'trending-up', emoji: '📈', material: 'show_chart', remix: 'line-chart-line', tabler: 'trending-up', fontawesome: 'fa-chart-line', heroicons: 'arrow-trending-up', feather: 'trending-up' },
  'frequency': { lucide: 'calendar-check', emoji: '📅', material: 'event_available', remix: 'calendar-check-line', tabler: 'calendar-check', fontawesome: 'fa-calendar-check', heroicons: 'calendar-check', feather: 'calendar' },
  'brain': { lucide: 'brain', emoji: '🧠', material: 'psychology', remix: 'brain-line', tabler: 'brain', fontawesome: 'fa-brain', heroicons: 'cpu-chip', feather: 'cpu' },
  'template': { lucide: 'file-text', emoji: '📋', material: 'description', remix: 'file-text-line', tabler: 'file-description', fontawesome: 'fa-file-lines', heroicons: 'document-text', feather: 'file-text' },
  'people': { lucide: 'users', emoji: '👥', material: 'people', remix: 'team-line', tabler: 'users', fontawesome: 'fa-users', heroicons: 'users', feather: 'users' },
  'diary': { lucide: 'book', emoji: '📔', material: 'book', remix: 'book-line', tabler: 'book', fontawesome: 'fa-book', heroicons: 'book-open', feather: 'book' },
  'vision': { lucide: 'eye', emoji: '👁️', material: 'visibility', remix: 'eye-line', tabler: 'eye', fontawesome: 'fa-eye', heroicons: 'eye', feather: 'eye' },
  'habits': { lucide: 'zap', emoji: '⚡', material: 'bolt', remix: 'flashlight-line', tabler: 'bolt', fontawesome: 'fa-bolt', heroicons: 'bolt', feather: 'zap' },
  'sparkles': { lucide: 'sparkles', emoji: '✨', material: 'auto_awesome', remix: 'sparkling-line', tabler: 'sparkles', fontawesome: 'fa-sparkles', heroicons: 'sparkles', feather: 'star' },
  'user': { lucide: 'user', emoji: '👤', material: 'person', remix: 'user-line', tabler: 'user', fontawesome: 'fa-user', heroicons: 'user', feather: 'user' },
  'palette': { lucide: 'palette', emoji: '🎨', material: 'palette', remix: 'palette-line', tabler: 'palette', fontawesome: 'fa-palette', heroicons: 'paint-brush', feather: 'droplet' },
  'ai': { lucide: 'cpu', emoji: '🤖', material: 'psychology', remix: 'cpu-line', tabler: 'cpu', fontawesome: 'fa-microchip', heroicons: 'cog', feather: 'cpu' },
  'settings': { lucide: 'settings', emoji: '⚙️', material: 'settings', remix: 'settings-3-line', tabler: 'settings', fontawesome: 'fa-gear', heroicons: 'cog', feather: 'settings' },
  'layout': { lucide: 'layout', emoji: ' Bento Grid', material: 'dashboard_customize', remix: 'layout-line', tabler: 'layout', fontawesome: 'fa-grip', heroicons: 'rectangle-group', feather: 'grid' },
  'database': { lucide: 'database', emoji: '📂', material: 'storage', remix: 'database-2-line', tabler: 'database', fontawesome: 'fa-database', heroicons: 'circle-stack', feather: 'database' },
  'sun': { lucide: 'sun', emoji: '☀️', material: 'light_mode', remix: 'sun-line', tabler: 'sun', fontawesome: 'fa-sun', heroicons: 'sun', feather: 'sun' },
  'moon': { lucide: 'moon', emoji: '🌙', material: 'dark_mode', remix: 'moon-line', tabler: 'moon', fontawesome: 'fa-moon', heroicons: 'moon', feather: 'moon' },
  'plus-circle': { lucide: 'plus-circle', emoji: '➕', material: 'add_circle', remix: 'add-circle-line', tabler: 'circle-plus', fontawesome: 'fa-circle-plus', heroicons: 'plus-circle', feather: 'plus-circle' },
  'dollar-sign': { lucide: 'dollar-sign', emoji: '💵', material: 'attach_money', remix: 'money-dollar-circle-line', tabler: 'coin-dollar', fontawesome: 'fa-dollar-sign', heroicons: 'currency-dollar', feather: 'dollar-sign' },
};

// Available Icon Packs
const ICON_PACKS = {
  'lucide': {
    name: 'Lucide Icons',
    description: 'Modern, consistent icons',
    source: 'built-in',
    cssClass: 'lucide-icon'
  },
  'emoji': {
    name: 'Classic Emoji',
    description: 'Native system emojis',
    source: 'built-in',
    cssClass: 'emoji-icon'
  },
  'material': {
    name: 'Material Outlined',
    description: 'Material Design icons',
    source: 'external',
    cssClass: 'material-icon'
  },
  'remix': {
    name: 'Remix Icon',
    description: 'Professional neutral',
    source: 'external',
    cssClass: 'remix-icon'
  },
  'tabler': {
    name: 'Tabler Icons',
    description: 'Technical & precise',
    source: 'external',
    cssClass: 'tabler-icon'
  },
  'fontawesome': {
    name: 'Font Awesome',
    description: 'Popular icon library',
    source: 'external',
    cssClass: 'fa-icon'
  },
  'heroicons': {
    name: 'Heroicons',
    description: 'Tailwind icons',
    source: 'external',
    cssClass: 'hero-icon'
  },
  'feather': {
    name: 'Feather Icons',
    description: 'Lightweight icons',
    source: 'external',
    cssClass: 'feather-icon'
  }
};

// Get current icon pack from settings (with fallback to emoji)
function getCurrentIconPack() {
  // 1. Try to get from global state (Google Sheet)
  if (typeof state !== 'undefined' && state.data && state.data.settings && state.data.settings[0]) {
    const s = state.data.settings[0];
    const parts = (s.theme_mode || '').split('|');
    if (parts.length > 1) return parts[1];
  }

  // 2. Fallback to localStorage
  try {
    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    return settings.icon_pack || 'emoji';
  } catch (e) {
    return 'emoji';
  }
}

// Get icon for a given semantic name and pack
function getIcon(iconName, pack = null) {
  const iconPack = pack || getCurrentIconPack();
  const mapping = ICON_MAPPINGS[iconName];

  if (!mapping) {
    console.warn(`Icon mapping not found for: ${iconName}, falling back to emoji`);
    // Fallback to emoji for unmapped icons
    return '•';
  }

  // Try the requested pack first
  let icon = mapping[iconPack];
  
  // If icon not found in requested pack, try lucide, then emoji
  if (!icon) {
    icon = mapping.lucide || mapping.emoji;
  }
  
  // If still no icon, return a fallback
  if (!icon) {
    icon = '•';
  }
  
  return icon;
}

// Get CSS class for icon pack
function getIconPackClass(pack = null) {
  const iconPack = pack || getCurrentIconPack();
  return ICON_PACKS[iconPack]?.cssClass || 'lucide-icon';
}

// Render icon HTML
function renderIcon(iconName, pack = null, customAttrs = '') {
  const iconPack = pack || getCurrentIconPack();
  const icon = getIcon(iconName, iconPack);
  const cssClass = getIconPackClass(iconPack);

  // Extract classes from customAttrs if they exist to merge with iconPack class
  let classMatch = customAttrs.match(/class=["'](.*?)["']/);
  let additionalClasses = classMatch ? classMatch[1] : '';
  let cleanedAttrs = customAttrs.replace(/class=["'].*?["']/, '').trim();

  if (iconPack === 'lucide') {
    return `<i data-lucide="${icon}" class="${cssClass} ${additionalClasses}" ${cleanedAttrs}></i>`;
  } else if (iconPack === 'material') {
    return `<span class="material-icons-outlined ${cssClass} ${additionalClasses}" ${cleanedAttrs}>${icon}</span>`;
  } else if (iconPack === 'remix') {
    // Remix icons need -line suffix added if not present
    const remixIcon = (icon.endsWith('-line') || icon.endsWith('-fill')) ? icon : `${icon}-line`;
    return `<i class="ri ri-${remixIcon} ${cssClass} ${additionalClasses}" ${cleanedAttrs}></i>`;
  } else if (iconPack === 'tabler') {
    return `<i class="ti ti-${icon} ${cssClass} ${additionalClasses}" ${cleanedAttrs}></i>`;
  } else if (iconPack === 'fontawesome') {
    return `<i class="fa-solid ${icon} ${cssClass} ${additionalClasses}" ${cleanedAttrs}></i>`;
  } else if (iconPack === 'heroicons') {
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${cssClass} ${additionalClasses}" ${cleanedAttrs}><path stroke-linecap="round" stroke-linejoin="round" d="${getHeroIconPath(icon)}" /></svg>`;
  } else if (iconPack === 'feather') {
    return `<i data-feather="${icon}" class="${cssClass} ${additionalClasses}" ${cleanedAttrs}></i>`;
  } else {
    // Emoji pack (default)
    return `<span class="${cssClass} ${additionalClasses}" ${cleanedAttrs}>${icon}</span>`;
  }
}

// Get Heroicons path for a given icon name
function getHeroIconPath(iconName) {
  const paths = {
    'home': 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    'bars-3': 'M4 6h16M4 12h16M4 18h16',
    'calendar': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    'calendar-days': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    'chart-bar': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    'tag': 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    'chevron-right': 'M9 5l7 7-7 7',
    'chevron-down': 'M19 9l-7 7-7-7',
    'arrow-right': 'M14 5l7 7m0 0l-7 7m7-7H3',
    'arrow-left': 'M10 19l-7-7m0 0l7-7m-7 7h18',
    'arrow-up': 'M5 10l7-7m0 0l7 7m-7-7v18',
    'arrow-down': 'M19 14l-7 7m0 0l-7-7m7 7V3',
    'plus': 'M12 4v16m8-8H4',
    'x-mark': 'M6 18L18 6M6 6l12 12',
    'check': 'M5 13l4 4L19 7',
    'search': 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    'pencil-square': 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    'trash': 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    'fire': 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z',
    'star': 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    'heart': 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    'bolt': 'M13 10V3L4 14h7v7l9-11h-7z',
    'bell': 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    'eye': 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    'user': 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    'clock': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    'moon': 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
    'sun': 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    'default': 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
  };
  return paths[iconName] || paths['default'];
}

/**
 * Automatically renders icons for all elements with data-icon attribute.
 * Useful for static HTML or bulk updates.
 */
function renderAllIcons() {
  const iconPack = getCurrentIconPack();
  const elements = document.querySelectorAll('[data-icon]');

  elements.forEach(el => {
    const iconName = el.getAttribute('data-icon');
    const customAttrs = Array.from(el.attributes)
      .filter(attr => attr.name !== 'data-icon')
      .map(attr => `${attr.name}="${attr.value}"`)
      .join(' ');

    el.outerHTML = renderIcon(iconName, iconPack, customAttrs);
  });

  // If Lucide is active, we still need to call createIcons for any newly injected <i> tags
  if (iconPack === 'lucide' && typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
  
  // If Feather is active, call feather.replace() for any newly injected elements
  if (iconPack === 'feather' && typeof feather !== 'undefined' && feather.replace) {
    feather.replace();
  }
}

// Legacy emoji resolver - converts old emoji to new icon name
function resolveLegacyEmoji(emoji) {
  const emojiToIconMap = {
    '🏠': 'home',
    '📋': 'list',
    '📅': 'calendar',
    '📆': 'yearly',
    '📊': 'insights',
    '🏷️': 'tags',
    '🔥': 'streak',
    '📝': 'entries',
    '🏆': 'achievements',
    '😊': 'mood',
    '📖': 'words',
    '✏️': 'edit',
    '🗑️': 'delete',
    '✓': 'save',
    '✕': 'cancel',
    '⚠️': 'warning',
    '🔍': 'search',
    '📤': 'export',
    '✍️': 'write',
    '❤️': 'health',
    '💪': 'fitness',
    '📚': 'learning',
    '🚀': 'productivity',
    '🧘': 'spiritual',
    '✨': 'default',
    '📭': 'inbox-empty',
    '💰': 'money',
    '👁️': 'no-vision',
    '📔': 'no-diary',
    '🎯': 'goals',
    '✅': 'achieved',
    '📁': 'upload',
    '🔗': 'url',
    '🤩': 'mood-great',
    '😄': 'mood-good',
    '🙂': 'mood-okay',
    '😔': 'mood-low',
    '😕': 'mood-bad',
    '😞': 'mood-sad',
    '😐': 'mood-okay',
    '📈': 'chart',
    '🧠': 'brain',
    '🔒': 'locked',
    '🎂': 'birthday',
    '☀️': 'greeting-morning',
    '🔔': 'reminder',
    '📋': 'task-due',
  };

  return emojiToIconMap[emoji] || null;
}

// Export for global use
window.ICON_MAPPINGS = ICON_MAPPINGS;
window.ICON_PACKS = ICON_PACKS;
window.getCurrentIconPack = getCurrentIconPack;
window.getIcon = getIcon;
window.getIconPackClass = getIconPackClass;
window.getHeroIconPath = getHeroIconPath;
window.renderIcon = renderIcon;
window.renderAllIcons = renderAllIcons;
window.resolveLegacyEmoji = resolveLegacyEmoji;
