# Budget Implementation Plan

## Issues to Fix

### 1. Weekly Budget Reset on Monday
**Problem**: Current code filters last 7 days instead of current week from Monday.

**Solution**: Create helper function `getWeekBounds(date)` that returns the Monday and Sunday of the week for a given date. Use this to filter weekly expenses properly.

### 2. Weekly View - Only Current Week Data
**Problem**: Weekly view should show only this week's transactions (Mon-Sun).

**Solution**: 
- Modify the filter logic to use proper Monday-based week boundaries
- Weekly view: Only current week's data (Mon-Sun)
- Monthly view: All month data including previous weeks (this already works)

### 3. Category Sum Display in Settings
**Problem**: Settings page shows category budget limits but doesn't show spending totals.

**Solution**: 
- Calculate total spent per category from expenses data
- Display both budget limit AND spent amount in the settings category list
- Show sum of all category budgets

## Implementation Details

### Files to Modify:
1. `view-finance.js` - Fix weekly filtering logic
2. `view-settings.js` - Add category spending display

### Key Functions:
- `getWeekBounds(date)` - Returns {start, end} for Monday-based week
- Update `renderFinExpenses` filter logic
- Update `initCategoryRows` to show spending totals
