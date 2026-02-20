# Theme System Fix Plan (Revised)

## Current Issue
Each section/view has hardcoded colors instead of using CSS theme variables. When user changes theme, it only affects UI elements that use CSS variables, but things like task priorities, vision badges, dashboard charts still show hardcoded colors.

## Root Cause Analysis

### Views with HARDCODED colors (problem):
| File | Hardcoded Colors |
|------|-----------------|
| view-tasks.js | PRIORITY_COLOR = { P1: '#EF4444', P2: '#F59E0B', P3: '#10B981' } |
| view-vision.js | Days badge: '#EF4444' (overdue), '#10B981' (active); Delete button: '#EF4444' |
| view-dashboard.js | Chart borders: '#EF4444', background: 'rgba(239, 68, 68, 0.1)', Reset button: '#EF4444' |

### Views using CSS variables (good):
| File | CSS Variables Used |
|------|-------------------|
| view-calendar.js | var(--primary), var(--success), var(--danger), var(--warning), var(--info) |
| view-diary.js | getComputedStyle('--primary'), getComputedStyle('--border-color') |

## Fix Plan

### Step 1: Define theme-aware color palette in main.js
Create a global object that maps semantic colors to CSS variables:
```javascript
window.THEME_COLORS = {
  danger: 'var(--danger, #EF4444)',
  success: 'var(--success, #10B981)',
  warning: 'var(--warning, #F59E0B)',
  info: 'var(--info, #3B82F6)'
};
```

### Step 2: Update view-tasks.js
Replace hardcoded PRIORITY_COLOR:
- FROM: `const PRIORITY_COLOR = { P1: '#EF4444', P2: '#F59E0B', P3: '#10B981' };`
- TO: Use CSS variables `var(--danger)`, `var(--warning)`, `var(--success)`

### Step 3: Update view-vision.js
Replace hardcoded hex colors:
- Days badge overdue: '#EF4444' → `var(--danger)`
- Days badge active: '#10B981' → `var(--success)`
- Delete button: '#EF4444' → `var(--danger)`

### Step 4: Update view-dashboard.js
Replace hardcoded colors:
- Chart border: '#EF4444' → `var(--danger)`  
- Chart background: 'rgba(239, 68, 68, 0.1)' → use CSS variable with opacity
- Reset button: '#EF4444' → `var(--danger)`

### Step 5: Ensure CSS defines all semantic variables
Make sure style.css has:
- var(--danger) - Red for errors/warnings
- var(--success) - Green for success/positive
- var(--warning) - Amber for warnings
- var(--info) - Blue for information

## Implementation Priority
1. First update style.css to ensure all semantic color variables exist
2. Then update each view file to use CSS variables instead of hardcoded hex values

## Files to Modify
1. style.css - Add missing CSS variables
2. view-tasks.js - Use CSS variables for priority colors
3. view-vision.js - Use CSS variables for badges and buttons
4. view-dashboard.js - Use CSS variables for charts and buttons

## Why This Works
CSS variables like `--danger`, `--success` are already defined in theme modes (dark, light, forest, midnight). By using these variables instead of hardcoded hex colors, changing the theme will automatically update all colors throughout the app.
