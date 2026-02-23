/* command-palette.js */

const COMMANDS = [
    { id: 'nav-dashboard', title: 'Go to Dashboard', icon: 'grid', action: () => routeTo('dashboard'), keywords: 'home dashboard' },
    { id: 'nav-tasks', title: 'Go to Tasks', icon: 'list', action: () => routeTo('tasks'), keywords: 'tasks todo' },
    { id: 'nav-habits', title: 'Go to Habits', icon: 'streak', action: () => routeTo('habits'), keywords: 'habits tracker' },
    { id: 'nav-finance', title: 'Go to Finance', icon: 'money', action: () => routeTo('finance'), keywords: 'money finance budget' },
    { id: 'nav-diary', title: 'Go to Diary', icon: 'diary', action: () => routeTo('diary'), keywords: 'diary journal' },
    { id: 'nav-vision', title: 'Go to Vision', icon: 'vision', action: () => routeTo('vision'), keywords: 'vision goals' },
    { id: 'nav-people', title: 'Go to People', icon: 'people', action: () => routeTo('people'), keywords: 'people contacts' },
    { id: 'nav-settings', title: 'Sidebar Settings', icon: 'settings', action: () => routeTo('settings'), keywords: 'settings config' },

    { id: 'act-new-task', title: 'Create New Task', icon: 'add', action: () => window.openTaskModal(), keywords: 'new task add' },
    { id: 'act-new-habit', title: 'Create New Habit', icon: 'plus-circle', action: () => window.openHabitModal(), keywords: 'new habit add' },
    { id: 'act-new-expense', title: 'Log Expense', icon: 'dollar-sign', action: () => window.openFinanceAction(), keywords: 'new expense cost money' },
    { id: 'act-new-diary', title: 'Write in Diary', icon: 'write', action: () => window.openDiaryModal(), keywords: 'new diary entry write' },

    { id: 'sys-reload', title: 'Reload App', icon: 'refresh', action: () => window.location.reload(), keywords: 'reload refresh' },
    { id: 'sys-theme-dark', title: 'Switch to Dark Mode', icon: 'moon', action: () => applyThemeMode('dark'), keywords: 'dark mode theme' },
    { id: 'sys-theme-light', title: 'Switch to Light Mode', icon: 'sun', action: () => applyThemeMode('light'), keywords: 'light mode theme' }
];

let _selectedIndex = 0;
let _filteredCommands = [];

document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
    }

    if (document.getElementById('commandPalette').classList.contains('hidden')) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        _selectedIndex = Math.min(_selectedIndex + 1, _filteredCommands.length - 1);
        renderCommandList();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _selectedIndex = Math.max(_selectedIndex - 1, 0);
        renderCommandList();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_filteredCommands.length > 0 && _selectedIndex < _filteredCommands.length) {
            executeCommand(_filteredCommands[_selectedIndex]);
        }
    } else if (e.key === 'Escape') {
        closeCommandPalette();
    }
});

function toggleCommandPalette() {
    const el = document.getElementById('commandPalette');
    if (el.classList.contains('hidden')) {
        openCommandPalette();
    } else {
        closeCommandPalette();
    }
}

function openCommandPalette() {
    const el = document.getElementById('commandPalette');
    el.classList.remove('hidden');
    document.getElementById('cmdInput').value = '';
    document.getElementById('cmdInput').focus();
    filterCommands('');
}

function closeCommandPalette() {
    document.getElementById('commandPalette').classList.add('hidden');
}

function filterCommands(query) {
    const q = query.toLowerCase();
    _filteredCommands = COMMANDS.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.keywords.includes(q)
    );
    _selectedIndex = 0;
    renderCommandList();
}

function renderCommandList() {
    const container = document.getElementById('cmdResults');
    container.innerHTML = '';

    if (_filteredCommands.length === 0) {
        container.innerHTML = `<div class="cmd-empty">No results found</div>`;
        return;
    }

    _filteredCommands.forEach((cmd, index) => {
        const div = document.createElement('div');
        div.className = `cmd-item ${index === _selectedIndex ? 'selected' : ''}`;
        div.onclick = () => executeCommand(cmd);
        div.innerHTML = `
            ${renderIcon(cmd.icon, null, 'style="width:18px; margin-right:12px; color:var(--text-muted)"')}
            <span class="cmd-title">${cmd.title}</span>
            ${index === _selectedIndex ? '<span class="cmd-enter">↵</span>' : ''}
        `;
        container.appendChild(div);
    });

    // Auto-scroll
    const selected = container.querySelector('.selected');
    if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
    }


}

function executeCommand(cmd) {
    if (!cmd) return;
    closeCommandPalette();
    cmd.action();
}

// Add event listener to input
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('cmdInput');
    if (input) {
        input.addEventListener('input', (e) => filterCommands(e.target.value));
    }
});
