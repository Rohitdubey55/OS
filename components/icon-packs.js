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
  'home': { lucide: 'home', emoji: '🏠', material: 'home' },
  'list': { lucide: 'list', emoji: '📋', material: 'view_list' },
  'calendar': { lucide: 'calendar', emoji: '📅', material: 'event' },
  'yearly': { lucide: 'calendar-days', emoji: '📆', material: 'calendar_month' },
  'insights': { lucide: 'bar-chart-3', emoji: '📊', material: 'insights' },
  'tags': { lucide: 'tags', emoji: '🏷️', material: 'label' },
  
  // Stats & Activity
  'streak': { lucide: 'flame', emoji: '🔥', material: 'local_fire_department' },
  'entries': { lucide: 'book-open', emoji: '📝', material: 'edit_note' },
  'achievements': { lucide: 'trophy', emoji: '🏆', material: 'emoji_events' },
  'mood': { lucide: 'smile', emoji: '😊', material: 'mood' },
  'words': { lucide: 'file-text', emoji: '📖', material: 'notes' },
  
  // Actions
  'edit': { lucide: 'pencil', emoji: '✏️', material: 'edit' },
  'delete': { lucide: 'trash-2', emoji: '🗑️', material: 'delete' },
  'add': { lucide: 'plus', emoji: '+', material: 'add' },
  'save': { lucide: 'check', emoji: '✓', material: 'check' },
  'cancel': { lucide: 'x', emoji: '✕', material: 'close' },
  'warning': { lucide: 'alert-triangle', emoji: '⚠️', material: 'warning' },
  'search': { lucide: 'search', emoji: '🔍', material: 'search' },
  'export': { lucide: 'download', emoji: '📤', material: 'download' },
  'write': { lucide: 'edit-3', emoji: '✍️', material: 'draw' },
  
  // Categories
  'health': { lucide: 'heart', emoji: '❤️', material: 'favorite' },
  'fitness': { lucide: 'dumbbell', emoji: '💪', material: 'fitness_center' },
  'learning': { lucide: 'book-open', emoji: '📚', material: 'menu_book' },
  'productivity': { lucide: 'rocket', emoji: '🚀', material: 'rocket_launch' },
  'spiritual': { lucide: 'sparkles', emoji: '🧘', material: 'self_improvement' },
  'water': { lucide: 'droplet', emoji: '💧', material: 'water_drop' },
  'food': { lucide: 'apple', emoji: '🍎', material: 'restaurant' },
  'running': { lucide: 'footprints', emoji: '🏃', material: 'directions_run' },
  'sleep': { lucide: 'moon', emoji: '💤', material: 'bedtime' },
  'default': { lucide: 'star', emoji: '✨', material: 'auto_awesome' },
  
  // Empty States
  'inbox-empty': { lucide: 'inbox', emoji: '📭', material: 'inbox' },
  'no-events': { lucide: 'calendar-x', emoji: '📅', material: 'event_busy' },
  'no-expenses': { lucide: 'wallet', emoji: '💰', material: 'account_balance_wallet' },
  'no-habits': { lucide: 'target', emoji: '🎯', material: 'track_changes' },
  'no-diary': { lucide: 'book', emoji: '📔', material: 'book' },
  'no-vision': { lucide: 'eye', emoji: '👁️', material: 'visibility' },
  'no-tasks': { lucide: 'check-square', emoji: '✓', material: 'task_alt' },
  'planner': { lucide: 'calendar', emoji: '📅', material: 'event' },
  
  // Finance
  'money': { lucide: 'coins', emoji: '💰', material: 'paid' },
  
  // Vision
  'goals': { lucide: 'target', emoji: '🎯', material: 'track_changes' },
  'achieved': { lucide: 'check-circle', emoji: '✅', material: 'check_circle' },
  'upload': { lucide: 'upload', emoji: '📁', material: 'folder_open' },
  'url': { lucide: 'link', emoji: '🔗', material: 'link' },
  
  // Mood faces (specific mappings)
  'mood-great': { lucide: 'grinning', emoji: '🤩', material: 'sentiment_very_satisfied' },
  'mood-good': { lucide: 'smile', emoji: '😄', material: 'sentiment_satisfied' },
  'mood-okay': { lucide: 'meh', emoji: '🙂', material: 'sentiment_neutral' },
  'mood-low': { lucide: 'frown', emoji: '😔', material: 'sentiment_dissatisfied' },
  'mood-bad': { lucide: 'frown', emoji: '😕', material: 'sentiment_very_dissatisfied' },
  'mood-sad': { lucide: 'sad-tear', emoji: '😞', material: 'sentiment_very_dissatisfied' },
  
  // Notifications
  'reminder': { lucide: 'bell', emoji: '🔔', material: 'notifications' },
  'task-due': { lucide: 'clipboard-list', emoji: '📋', material: 'task' },
  
  // Misc
  'greeting-morning': { lucide: 'sunrise', emoji: '☀️', material: 'wb_sunny' },
  'locked': { lucide: 'lock', emoji: '🔒', material: 'lock' },
  'birthday': { lucide: 'cake', emoji: '🎂', material: 'cake' },
  'chart': { lucide: 'trending-up', emoji: '📈', material: 'show_chart' },
  'frequency': { lucide: 'calendar-check', emoji: '📅', material: 'event_available' },
  'brain': { lucide: 'brain', emoji: '🧠', material: 'psychology' },
  'template': { lucide: 'file-text', emoji: '📋', material: 'description' },
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
  }
};

// Get current icon pack from settings (with fallback to emoji)
function getCurrentIconPack() {
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
    console.warn(`Icon mapping not found for: ${iconName}`);
    return { lucide: iconName, emoji: '•', material: iconName }[iconPack] || '•';
  }
  
  return mapping[iconPack] || mapping.lucide || '•';
}

// Get CSS class for icon pack
function getIconPackClass(pack = null) {
  const iconPack = pack || getCurrentIconPack();
  return ICON_PACKS[iconPack]?.cssClass || 'lucide-icon';
}

// Render icon HTML
function renderIcon(iconName, pack = null, additionalClasses = '') {
  const iconPack = pack || getCurrentIconPack();
  const icon = getIcon(iconName, iconPack);
  const cssClass = getIconPackClass(iconPack);
  
  if (iconPack === 'lucide') {
    return `<i data-lucide="${icon}" class="${cssClass} ${additionalClasses}"></i>`;
  } else if (iconPack === 'material') {
    return `<span class="material-icons-outlined ${cssClass} ${additionalClasses}">${icon}</span>`;
  } else {
    // Emoji pack
    return `<span class="${cssClass} ${additionalClasses}">${icon}</span>`;
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
window.renderIcon = renderIcon;
window.resolveLegacyEmoji = resolveLegacyEmoji;
