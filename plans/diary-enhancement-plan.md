# Diary Enhancement Implementation Plan

## Current State

### Existing Diary Sheet Structure
| Column | Type | Description |
|--------|------|-------------|
| id | Number | Auto-generated unique ID |
| date | String | Entry date (YYYY-MM-DD) |
| text | String | Journal entry content |
| mood_score | Number | 1-10 mood rating |
| tags | String | Comma-separated tags |
| created_at | String | Timestamp |

---

## Phase 1: Foundation Changes (Sheet Updates)

### 1.1 New Sheets Required

#### A. `diary_templates` Sheet (for customizable prompts)
| Column | Type | Description |
|--------|------|-------------|
| id | Number | Auto-generated ID |
| title | String | Template name (e.g., "Gratitude") |
| content | String | Prompt text/template content |
| category | String | Category (e.g., "reflection", "goals", "gratitude") |
| is_default | Boolean | Whether this is a default template |
| sort_order | Number | Display order |

#### B. `diary_tags` Sheet (for tag management)
| Column | Type | Description |
|--------|------|-------------|
| id | Number | Auto-generated ID |
| name | String | Tag name |
| color | String | Hex color for tag |
| usage_count | Number | Number of times used |
| created_at | String | Creation timestamp |

#### C. `diary_settings` Sheet (for user preferences)
| Column | Type | Description |
|--------|------|-------------|
| key | String | Setting key |
| value | String | Setting value |

**Settings to store:**
- `reminder_enabled`: true/false
- `reminder_time`: HH:MM format
- `default_template_id`: ID of default template
- `streak_goal`: Number of days per week

#### D. `diary_achievements` Sheet (for gamification)
| Column | Type | Description |
|--------|------|-------------|
| id | Number | Auto-generated ID |
| type | String | Achievement type (streak, entries, mood) |
| name | String | Display name |
| description | String | Achievement description |
| target_value | Number | Target to unlock |
| unlocked_at | String | Timestamp when unlocked (null if locked) |

---

## Phase 2: UI/UX Enhancements (No Breaking Changes)

### 2.1 Rich Text Editor

**Implementation:** Replace `<textarea>` with contenteditable div
- Add formatting toolbar (bold, italic, lists, headings)
- Store as HTML in the `text` column (backward compatible - existing plain text still works)
- Sanitize HTML on display to prevent XSS

**Changes needed:**
- `view-diary.js`: Modify `openDiaryModal()` and `openEditDiary()` to include toolbar
- `diary-views.css`: Add toolbar styles
- No sheet changes needed

### 2.2 Template System

**Implementation:** Add template selector in modal
- Create default templates on first load
- Users can select template when creating new entry
- Templates stored in `diary_templates` sheet

**Changes needed:**
- `view-diary.js`: Add template selector dropdown, "Use Template" button
- `main.js`: Add template loading/saving handlers
- **Sheet:** Add `diary_templates` sheet

### 2.3 Full-Text Search

**Implementation:** Client-side filtering
- Add search input in header area
- Filter entries by matching text OR tags
- Show highlighted matches

**Changes needed:**
- `view-diary.js`: Add search input, filter logic in `renderListView()`
- `diary-views.css`: Add search input styles
- No sheet changes needed

### 2.4 Date Range Search

**Implementation:** Quick date filters
- Add "This Week", "This Month", "Last 7 Days" quick filters
- Add date picker for custom range

**Changes needed:**
- `view-diary.js`: Add filter buttons and date range picker
- No sheet changes needed

---

## Phase 3: Tag Management

### 3.1 Dedicated Tags Page

**Implementation:** New view in Diary for managing tags
- List all tags with usage count
- Color picker for each tag
- Rename, merge, delete functionality

**Changes needed:**
- `view-diary.js`: Add `renderTagsView()`, tag management modal
- `diary-views.css`: Add tag management styles
- **Sheet:** Add `diary_tags` sheet

### 3.2 Tag Suggestions

**Implementation:** Auto-complete when typing tags
- Load existing tags as user types
- Show usage count for each tag
- Allow creating new tags inline

**Changes needed:**
- `view-diary.js`: Add tag autocomplete logic
- No sheet changes needed

---

## Phase 4: Mobile Optimization

### 4.1 Swipe Gestures

**Implementation:** Touch-friendly navigation
- Swipe left/right between diary entries in list view
- Swipe to delete with confirmation

**Changes needed:**
- `view-diary.js`: Add touch event handlers
- `diary-views.css`: Add swipe animation styles

### 4.2 Larger Touch Targets

**Implementation:** Increase button sizes for mobile
- Minimum 44px touch targets
- Increased spacing between interactive elements

**Changes needed:**
- `diary-views.css`: Add mobile-specific styles with media queries
- No JS changes needed

---

## Phase 5: Cross-Feature Integration

### 5.1 Integration Data Structure

**New columns in Diary sheet (optional, stored as JSON in single column):**
| Column | Type | Description |
|--------|------|-------------|
| context_data | String | JSON string with linked data |

**Context data structure:**
```json
{
  "tasks": ["task_id1", "task_id2"],
  "habits": ["habit_id1"],
  "expenses": ["expense_id1"],
  "people": ["person_id1"]
}
```

### 5.2 Task Integration

**Implementation:** Show completed tasks for the day
- Query tasks with same date and status="completed"
- Display in entry modal as "Today I accomplished:"
- Allow clicking to add to entry

**Changes needed:**
- `view-diary.js`: Add `getDayTasks(date)` function, display in modal
- No sheet changes needed

### 5.3 Habit Integration

**Implementation:** Show habit completion status
- Query habit_logs for the date
- Display "Today's habits:" section in modal

**Changes needed:**
- `view-diary.js`: Add `getDayHabits(date)` function
- No sheet changes needed

### 5.4 Finance Summary

**Implementation:** Quick expense summary
- Calculate total expenses for the day
- Show top spending categories
- Display in modal context section

**Changes needed:**
- `view-diary.js`: Add `getDayExpenses(date)` function
- No sheet changes needed

### 5.5 Calendar Events

**Implementation:** Show day's events
- Query planner_events for the date
- Display in modal context section

**Changes needed:**
- `view-diary.js`: Add `getDayEvents(date)` function
- No sheet changes needed

### 5.6 People Mentions

**Implementation:** Quick-tag people
- People mentioned in text auto-linked
- Show suggested people to tag
- Click to add #person tag

**Changes needed:**
- `view-diary.js`: Add people suggestion logic
- **Sheet:** Need `diary_people` linking or use existing `people` sheet

---

## Phase 6: Gamification

### 6.1 Streak Tracking

**Implementation:** Track consecutive writing days
- Calculate streak from entry dates
- Display current streak in header
- Show streak milestone badges

**Changes needed:**
- `view-diary.js`: Add streak calculation, display in header
- **Sheet:** Add `diary_settings` sheet for storing streak data

### 6.2 Achievement System

**Implementation:** Unlock badges for milestones
- Track: streak days, total entries, mood improvements
- Display achievements in dedicated section

**Changes needed:**
- `view-diary.js`: Add achievements view, unlock logic
- **Sheet:** Add `diary_achievements` sheet

### 6.3 Writing Goals

**Implementation:** Weekly word count targets
- Set target (e.g., 3 entries per week)
- Progress indicator in header
- Completion celebration

**Changes needed:**
- `view-diary.js`: Add goal tracking, progress display
- **Sheet:** Store in `diary_settings`

---

## Phase 7: Additional Features

### 7.1 Export Functionality

**Implementation:** Export entries
- Export all entries as JSON
- Export as Markdown (.md) file
- Export as PDF (via print)

**Changes needed:**
- `view-diary.js`: Add export buttons and functions
- `main.js`: Add export handlers
- No sheet changes needed

### 7.2 Reminders

**Implementation:** Daily writing reminders
- Use existing notification service
- Read reminder settings from `diary_settings`

**Changes needed:**
- `notification-service.js`: Add diary reminder logic
- `view-diary.js`: Add reminder settings UI
- **Sheet:** Use `diary_settings` sheet

### 7.3 Word Count Stats

**Implementation:** Track writing metrics
- Word count per entry
- Total words this month/year
- Average entry length

**Changes needed:**
- `view-diary.js`: Calculate and display stats
- No sheet changes needed

---

## Implementation Order

### Priority 1 (Foundation)
1. Add new sheets to Google Sheet
2. Rich text editor
3. Full-text search

### Priority 2 (User Experience)
4. Template system
5. Date range filters
6. Mobile optimization

### Priority 3 (Organization)
7. Tag management page
8. Tag autocomplete
9. Cross-feature integration

### Priority 4 (Engagement)
10. Streak tracking
11. Achievement system
12. Writing goals

### Priority 5 (Polish)
13. Export functionality
14. Reminders
15. Word count stats

---

## Backward Compatibility Notes

1. **Plain text entries** - Existing entries work as-is; HTML stored as-is
2. **Tag format** - Keep comma-separated for backward, add structured tag storage
3. **No breaking changes** - All new features add to existing functionality
4. **Graceful degradation** - Features requiring new columns fall back gracefully

---

## Testing Checklist

- [ ] Existing entries display correctly after HTML storage
- [ ] Templates can be created, edited, deleted
- [ ] Search finds entries by text and tags
- [ ] Date filters work correctly
- [ ] Mobile swipe gestures work
- [ ] Cross-feature data displays correctly
- [ ] Achievements unlock properly
- [ ] Export produces valid files
- [ ] Streak calculates correctly
- [ ] Settings persist across sessions
