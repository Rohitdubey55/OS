/* empty-state.js - Reusable empty state component */

function createEmptyState(config) {
    const {
        icon = '📭',
        title = 'No data yet',
        description = 'Get started by adding your first item',
        actionLabel = '+ Add New',
        actionCallback = null
    } = config;

    const container = document.createElement('div');
    container.className = 'empty-state';

    container.innerHTML = `
    <div class="empty-state-icon">${icon}</div>
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

// Predefined empty state configurations
const EMPTY_STATES = {
    tasks: {
        icon: '✓',
        title: 'No tasks yet',
        description: 'Stay organized by adding your first task',
        actionLabel: '+ Add Task'
    },
    planner: {
        icon: '📅',
        title: 'No events planned',
        description: 'Start planning by adding your first event',
        actionLabel: '+ New Event'
    },
    expenses: {
        icon: '💰',
        title: 'No transactions',
        description: 'Track your finances by adding expenses or income',
        actionLabel: '+ Add Transaction'
    },
    habits: {
        icon: '🔥',
        title: 'No habits tracked',
        description: 'Build better habits by creating your first one',
        actionLabel: '+ New Habit'
    },
    diary: {
        icon: '📔',
        title: 'No diary entries',
        description: 'Start journaling your thoughts and experiences',
        actionLabel: '+ Write Entry'
    },
    vision: {
        icon: '👁️',
        title: 'No vision goals',
        description: 'Visualize your dreams by adding your first goal',
        actionLabel: '+ Add Vision'
    }
};
