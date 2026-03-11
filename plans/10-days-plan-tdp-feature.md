# PRD: 10 Days Plan (TDP) Feature for Vision View

## 1. Overview

**Feature Name:** 10 Days Plan (TDP)

**Feature Type:** Recurring Planning Tool + Data Feature

**Core Functionality:** A standalone, recurring planning tool in the Vision view that allows users to create a single 10-day checklist spanning across all 5 Vision categories. The plan auto-renews every 10 days, with progress tracking and access to previous plans.

---

## 2. Problem Statement

Users need a dedicated space to plan and track their daily actions for a 10-day period, organized by the 5 Vision categories. Currently, there's no:
- Recurring planning system that renews automatically
- Progress tracking for multi-day plans
- Archive of past planning periods
- Single consolidated view of the current 10-day plan

---

## 3. User Experience

### 3.1 UI Placement
- **Location:** Vision View header area
- **Primary Button:** "TDP" button with badge showing days remaining
- **Progress Indicator:** Progress bar below the button showing completion %
- **Button Style:** Secondary style, shows "Day X of 10" badge

### 3.2 Modal Behavior
- **Trigger:** Clicking "TDP" button opens modal
- **Modal Type:** Full-screen overlay with tabs for Current/Previous plans
- **Close:** X button, click-outside, ESC key

### 3.3 Current TDP View (Main Tab)
```
┌─────────────────────────────────────────────────────────┐
│  ✕  10 Days Plan                    Day 4 of 10       │
├─────────────────────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░░░░░░░░░░  40% Complete         │
│  6 of 15 items completed                                │
├─────────────────────────────────────────────────────────┤
│  📅 Current Plan: Mar 12 - Mar 21                      │
│  Started: Mar 12  •  Ends: Mar 21  •  6 days left      │
├─────────────────────────────────────────────────────────┤
│  Personality (3/5)                          [+ Add]     │
│  ☑ Meditate for 20 min each morning                    │
│  ☑ Read 10 pages of current book                       │
│  ☐ Journal for 10 minutes                               │
│  ☐ Practice gratitude                                  │
│  ☐ ________________________________                    │
│                                                         │
│  Ouro (1/2)                                    [+ Add]  │
│  ☑ Review brand vision statement                       │
│  ☐ ________________________________                    │
│                                                         │
│  Work (2/4)                                   [+ Add]  │
│  ☑ Complete project milestone                          │
│  ☐ Send weekly status update                           │
│  ☐ Review next sprint items                            │
│  ☐ ________________________________                    │
│                                                         │
│  Enjoyment (0/2)                               [+ Add]  │
│  ☐ ________________________________                    │
│  ☐ ________________________________                    │
│                                                         │
│  Routine (0/2)                                 [+ Add]  │
│  ☐ ________________________________                    │
│  ☐ ________________________________                    │
├─────────────────────────────────────────────────────────┤
│  [+ Create Next TDP]          [Archive Current]        │
└─────────────────────────────────────────────────────────┘
```

### 3.4 Previous Plans View (Tab)
```
┌─────────────────────────────────────────────────────────┐
│  ✕  10 Days Plan                                        │
├─────────────────────────────────────────────────────────┤
│  [ Current ]  [ Previous Plans ]                        │
├─────────────────────────────────────────────────────────┤
│  📅 Mar 1 - Mar 10    (Completed: 80%)    [View]       │
│  📅 Feb 19 - Feb 28  (Completed: 60%)     [View]       │
│  📅 Feb 9 - Feb 18   (Completed: 90%)     [View]       │
│  📅 Jan 30 - Feb 8   (Completed: 45%)     [View]       │
│                                                         │
│  ──────────── View Archived Plan ────────────          │
│                                                         │
│  Personality (4/5)                          [Read-only]│
│  ☑ Meditate for 20 min each morning                    │
│  ☑ Read 10 pages of current book                       │
│  ☑ Journal for 10 minutes                              │
│  ☑ Practice gratitude                                  │
│  ☐ ________________________________                    │
│                                                         │
│  ... (all categories shown)                            │
└─────────────────────────────────────────────────────────┘
```

### 3.5 Create New TDP Modal
```
┌─────────────────────────────────────────────────────────┐
│  ✕  Create New 10 Days Plan                            │
├─────────────────────────────────────────────────────────┤
│  📅 Plan Duration: Mar 22 - Mar 31                      │
│  (Automatically calculated, starts after current ends) │
├─────────────────────────────────────────────────────────┤
│  Personality                                    [+ Add]│
│  ☐ ________________________________                    │
│  ☐ [+ Add Item]                                        │
│                                                         │
│  Ouro                                      [+ Add]     │
│  ☐ [+ Add Item]                                        │
│                                                         │
│  Work                                       [+ Add]    │
│  ☐ [+ Add Item]                                        │
│                                                         │
│  Enjoyment                                 [+ Add]    │
│  ☐ [+ Add Item]                                        │
│                                                         │
│  Routine                                     [+ Add]   │
│  ☐ [+ Add Item]                                        │
├─────────────────────────────────────────────────────────┤
│  [ Cancel ]                      [ Create Plan ]       │
└─────────────────────────────────────────────────────────┘
```

### 3.6 Interactions
- **Add Item:** Click "+ Add" or press Enter in input field
- **Delete Item:** Swipe left or click trash icon (current plan only)
- **Check/Uncheck:** Click checkbox to toggle
- **View Previous:** Click on archived plan to view (read-only)
- **Create Next:** Button to start new 10-day plan
- **Auto-prompt:** When current plan reaches day 10, prompt to create next

---

## 4. Functional Requirements

### 4.1 Core Features

| ID | Requirement | Description |
|----|-------------|-------------|
| F1 | TDP Button | Display "TDP" button with "Day X of 10" badge |
| F2 | Progress Bar | Show completion % and item count |
| F3 | Days Remaining | Display "X days left" in current plan |
| F4 | Modal Trigger | Open modal on button click |
| F5 | Current Tab | Show active 10-day plan with all categories |
| F6 | Add Items | Add new checklist items to any category |
| F7 | Delete Items | Remove items (current plan only) |
| F8 | Toggle Complete | Check/uncheck items |
| F9 | Previous Tab | View archived plans (read-only) |
| F10 | Create Next | Start new 10-day plan when prompted |
| F11 | Auto-prompt | Ask user to create new TDP after 10 days |
| F12 | Data Persistence | Save all plans to localStorage |
| F13 | Plan History | Keep unlimited history of past plans |

### 4.2 Recurring Logic

| Scenario | Behavior |
|----------|----------|
| Day 10 of current TDP | Show "Create Next TDP" button prominently |
| Day 10 completed | Auto-prompt modal on next TDP click |
| No current TDP | Show "Create First TDP" CTA |
| Current TDP exists | Show current with progress |

### 4.3 Data Model

```javascript
// TDP Data Structure
{
  "current_plan_id": "plan_uuid_123",
  "plans": {
    "plan_uuid_123": {
      "id": "plan_uuid_123",
      "start_date": "2026-03-12",
      "end_date": "2026-03-21",
      "status": "active", // "active" | "completed" | "archived"
      "created_at": "2026-03-12T08:00:00Z",
      "categories": {
        "Personality": [
          { "id": "item_1", "text": "Meditate for 20 min", "completed": true },
          { "id": "item_2", "text": "Read 10 pages", "completed": true }
        ],
        "Ouro": [
          { "id": "item_3", "text": "Review goals", "completed": false }
        ],
        "Work": [],
        "Enjoyment": [],
        "Routine": []
      }
    },
    "plan_uuid_122": {
      "id": "plan_uuid_122",
      "start_date": "2026-03-01",
      "end_date": "2026-03-10",
      "status": "completed",
      "categories": {
        // ... archived data
      }
    }
  },
  "settings": {
    "auto_remind": true,
    "remind_on_day": 10
  }
}
```

### 4.4 Categories (Fixed)
1. **Personality** - Self-improvement, mindset, beliefs
2. **Ouro** - Brand/identity related
3. **Work** - Career, projects, professional goals
4. **Enjoyment** - Fun, hobbies, leisure activities
5. **Routine** - Daily habits, health, maintenance

---

## 5. Progress Calculation

```javascript
function calculateProgress(plan) {
  let totalItems = 0;
  let completedItems = 0;
  
  Object.values(plan.categories).forEach(items => {
    items.forEach(item => {
      totalItems++;
      if (item.completed) completedItems++;
    });
  });
  
  const percentage = totalItems > 0 
    ? Math.round((completedItems / totalItems) * 100) 
    : 0;
    
  return {
    total: totalItems,
    completed: completedItems,
    percentage: percentage
  };
}

function getDayOfPlan(plan) {
  const today = new Date();
  const start = new Date(plan.start_date);
  const dayOfPlan = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(dayOfPlan, 1), 10);
}

function getDaysRemaining(plan) {
  const today = new Date();
  const end = new Date(plan.end_date);
  const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  return Math.max(daysLeft, 0);
}
```

---

## 6. Technical Implementation Notes

### 6.1 Files to Modify
- `view-vision.js` - Add TDP button, modal rendering, data functions
- `vision-views.css` - Add TDP-specific styles
- `main.js` or state - Add TDP state management

### 6.2 Storage
- localStorage key: `vision_tdp_data`
- Auto-sync with app state if available
- Support JSON serialization

### 6.3 UI Components
1. **TDP Header Button** - Icon + "Day X of 10" badge
2. **Progress Bar** - Visual progress indicator
3. **Days Remaining Badge** - Shows "X days left"
4. **Modal Container** - Full-screen overlay
5. **Tab Navigation** - Current / Previous tabs
6. **Category Cards** - Collapsible category sections
7. **Checklist Items** - Checkbox + text + delete
8. **Add Item Input** - Inline text input
9. **Create Button** - Primary CTA for new plan

---

## 7. User Flows

### Flow 1: First Time User
1. User opens Vision view
2. User sees "TDP" button with "Create First Plan" prompt
3. User clicks "TDP"
4. Modal shows "Create New TDP" view
5. User adds items to each category
6. User clicks "Create Plan"
7. TDP button now shows "Day 1 of 10"

### Flow 2: Daily Usage
1. User opens Vision
2. TDP button shows "Day X of 10" and progress %
3. User clicks TDP
4. Modal shows current plan
5. User checks off completed items
6. Progress bar updates in real-time

### Flow 3: Day 10 Completion
1. User opens TDP on day 10
2. Banner shows "Plan ending tomorrow!"
3. "Create Next TDP" button is prominent
4. User clicks to create next plan
5. Previous plan moves to archive

### Flow 4: Viewing History
1. User clicks TDP
2. User switches to "Previous" tab
3. User sees list of past plans with completion %
4. User clicks on a plan to view details
5. Details shown in read-only mode

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| No current TDP | Show "Create First TDP" CTA |
| Empty categories | Show placeholder with "+ Add first item" |
| All items completed | Show celebration message |
| Past plan dates | Calculate correct day number from start_date |
| >10 days since start | Cap at "Day 10" but allow editing |
| No previous plans | Show "No previous plans yet" message |
| Very long item text | Truncate with ellipsis, full on hover |
| Delete item confirmation | None for single items, bulk needs confirm |

---

## 9. Design Considerations

### 9.1 Visual Style
- Match existing Vision Board aesthetic
- Use primary color for progress bar fill
- Category colors: Match Vision category colors
- Completed items: Strikethrough + muted text

### 9.2 Button Badge States
| State | Badge Text | Color |
|-------|------------|-------|
| Day 1-9 | "Day X of 10" | Primary |
| Day 10 | "Last Day!" | Warning |
| No Plan | "Start TDP" | Accent |

### 9.3 Progress Bar States
| Progress | Color | Message |
|----------|-------|---------|
| 0-25% | Warning | "Just started!" |
| 26-50% | Primary | "Making progress" |
| 51-75% | Primary | "More than halfway!" |
| 76-99% | Success | "Almost there!" |
| 100% | Success | "🎉 Complete!" |

### 9.4 Accessibility
- Keyboard navigation (Tab, Enter, Space)
- ARIA labels for all interactive elements
- Screen reader announcements for status changes

---

## 10. Out of Scope (v1)

- Linking TDP items to Vision goals
- Sharing TDP with others
- Export/import functionality
- Recurring templates
- Notifications/reminders (beyond in-app prompt)
- Integration with Tasks view
- Drag-and-drop reordering

---

## 11. Success Metrics

- TDP button click rate
- Average items per TDP
- Completion rate of TDPs
- Percentage of users creating next TDP
- Average completion percentage
- Return usage rate

---

## 12. Future Enhancements (Post-v1)

- Templates for common 10-day plans
- Link TDP items to Vision goals
- Progress visualization across multiple TDPs
- Share TDP summary
- Integration with calendar
- Push notifications for incomplete items
- Drag-and-drop reordering
- Bulk add items
- Categories completion order
