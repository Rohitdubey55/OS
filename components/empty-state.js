/* empty-state.js - Reusable empty state component with icon pack support */

function createEmptyState(config) {
    const {
        icon = 'inbox-empty',
        title = 'No data yet',
        description = 'Get started by adding your first item',
        actionLabel = '+ Add New',
        actionCallback = null
    } = config;

    const container = document.createElement('div');
    container.className = 'empty-state';

    // Use renderIcon if available, otherwise fall back to emoji
    let iconHtml;
    if (typeof renderIcon === 'function') {
        iconHtml = renderIcon(icon, null, 'empty-illustration');
    } else {
        // Fallback to legacy emoji mapping
        const fallbackIcons = {
            'inbox-empty': '📭',
            'no-tasks': '✓',
            'planner': '📅',
            'no-expenses': '💰',
            'no-habits': '🔥',
            'no-diary': '📔',
            'no-vision': '👁️'
        };
        iconHtml = fallbackIcons[icon] || '📭';
    }

    container.innerHTML = `
    <div class="empty-state-icon">${iconHtml}</div>
    <h3 class="empty-state-title">${title}</h3>
    <p class="empty-state-description">${description}</p>
    ${actionCallback ? `
      <button class="empty-state-action btn-primary" onclick="(${actionCallback.toString()})()">
        ${actionLabel}
      </button>
    ` : ''}
  `;

    return container;
}

// Predefined empty state configurations (using semantic icon names)
const EMPTY_STATES = {
    tasks: {
        icon: 'no-tasks',
        title: 'No tasks yet',
        description: 'Stay organized by adding your first task',
        actionLabel: '+ Add Task'
    },
    planner: {
        icon: 'planner',
        title: 'No events planned',
        description: 'Start planning by adding your first event',
        actionLabel: '+ New Event'
    },
    expenses: {
        icon: 'no-expenses',
        title: 'No transactions',
        description: 'Track your finances by adding expenses or income',
        actionLabel: '+ Add Transaction'
    },
    habits: {
        icon: 'no-habits',
        title: 'No habits tracked',
        description: 'Build better habits by creating your first one',
        actionLabel: '+ New Habit'
    },
    diary: {
        icon: 'no-diary',
        title: 'No diary entries',
        description: 'Start journaling your thoughts and experiences',
        actionLabel: '+ Write Entry'
    },
    vision: {
        icon: 'no-vision',
        title: 'No vision goals',
        description: 'Visualize your dreams by adding your first goal',
        actionLabel: '+ Add Vision'
    }
};

// Export for backward compatibility
window.EMPTY_STATES = EMPTY_STATES;
window.createEmptyState = createEmptyState;
