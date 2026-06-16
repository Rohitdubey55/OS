# PersonalOS Book Summary Feature - Implementation Plan

## Feature Overview

Add a comprehensive book suggestion and summary system to PersonalOS that:
1. Provides personalized book recommendations based on user's existing data (goals, vision, habits, interests)
2. Generates 15-page AI-powered summaries focusing on life improvement and goal achievement
3. Stores summaries in Google Sheets for persistent access
4. Features a full-featured reader with extensive customization options

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERSONAL OS ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Frontend  │◄──►│  AI Service │◄──►│  Google     │◄──►│  Storage    │  │
│  │   (UI/UX)   │    │  (Gemini)   │    │  Sheets     │    │  (Sheets/   │  │
│  │             │    │             │    │  (Backend) │    │  IndexedDB) │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                                    │                    │         │
│         │    ┌──────────────────────────────┴────────────────────┘         │
│         │    │                                                               │
│         ▼    ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    NEW BOOK FEATURE COMPONENTS                       │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                     │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │    │
│  │  │  Book Library  │  │    Reader      │  │   Summary     │        │    │
│  │  │     View       │  │    View        │  │   Generator   │        │    │
│  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘        │    │
│  │          │                   │                   │                  │    │
│  │          ▼                   ▼                   ▼                  │    │
│  │  ┌────────────────────────────────────────────────────────────┐    │    │
│  │  │              Google Sheets: book_summaries                  │    │    │
│  │  │  (id, book_title, author, summary_json, created_at, etc.)  │    │    │
│  │  └────────────────────────────────────────────────────────────┘    │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Data Layer - Google Sheets Schema

### 1.1 New Sheet: `book_library`
Stores the user's book collection and reading history.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| title | string | Book title |
| author | string | Author name |
| cover_url | string | URL to book cover image |
| category | string | Genre/category (Self-Help, Business, etc.) |
| status | string | "to_read", "reading", "completed" |
| date_added | date | When added to library |
| date_completed | date | When finished reading |
| rating | number | 1-5 star rating |
| notes | text | Personal notes about the book |
| linked_goals | string | Comma-separated vision IDs this relates to |
| tags | string | User-defined tags |

### 1.2 New Sheet: `book_summaries`
Stores AI-generated summaries.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier |
| book_id | string | Reference to book_library.id |
| book_title | string | For quick access |
| author | string | Author name |
| summary_json | text | JSON containing 15-page structured summary |
| total_pages | number | Number of "pages" in summary |
| created_at | datetime | When summary was generated |
| linked_vision_ids | string | Vision/goals this applies to |
| key_takeaways | text | Bullet-point key lessons |
| action_items | text | Suggested actions based on book |

### 1.3 Sheet: `reader_settings`
User preferences for the reader view.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Always "user_prefs" |
| background_color | string | Hex color for background |
| font_color | string | Hex color for text |
| font_family | string | Font name (serif, sans-serif, etc.) |
| font_size | number | Base font size in px |
| line_spacing | number | Line height multiplier |
| fullscreen_mode | boolean | Default fullscreen preference |
| page_animation | string | "slide", "fade", "none" |
| auto_save_position | boolean | Remember last position |

### 1.4 Code.gs Changes

```javascript
// Add to SCHEMA object:
"book_library": ["id", "title", "author", "cover_url", "category", "status", "date_added", "date_completed", "rating", "notes", "linked_goals", "tags"],
"book_summaries": ["id", "book_id", "book_title", "author", "summary_json", "total_pages", "created_at", "linked_vision_ids", "key_takeaways", "action_items"],
"reader_settings": ["id", "background_color", "font_color", "font_family", "font_size", "line_spacing", "fullscreen_mode", "page_animation", "auto_save_position"]
```

---

## Phase 2: AI Service Integration

### 2.1 Book Suggestion Engine

The AI will analyze user's existing data to recommend relevant books:

```javascript
// Contexts to analyze for recommendations:
// - vision_board: user's goals and aspirations
// - habits: areas of self-improvement
// - diary: recent entries about interests
// - tasks: goal-related tasks
// - settings: interests from user profile
```

**AI Prompt Structure for Book Suggestions:**
```
Analyze the user's goals, habits, and interests from the provided data.
Recommend 5-10 books that would help them achieve their goals.
For each book, provide:
- Title and Author
- Why it's relevant to their goals
- Key benefit they'll gain
- Category/Genre
```

### 2.2 Summary Generation Engine

**AI Prompt Structure for 15-Page Summary:**

```javascript
const SUMMARY_PROMPT = `
Generate a comprehensive 15-page summary of "{BOOK_TITLE}" by {AUTHOR}.

STRUCTURE REQUIRED (15 Sections):

Page 1-2: Book Overview
- Author background and credentials
- Main thesis and core message
- Who this book is for

Page 3-4: Key Concepts Part 1
- First 3 major concepts explained

Page 5-6: Key Concepts Part 2
- Next 3 major concepts explained

Page 7-8: Key Concepts Part 3
- Final major concepts

Page 9-10: Practical Applications
- How to apply these ideas in daily life
- Specific exercises from the book

Page 11-12: Case Studies & Examples
- Real-world applications
- Success stories from the book

Page 13: Framework/System
- The author's system/methodology distilled
- Step-by-step implementation guide

Page 14: Connecting to User's Goals
- How this applies to: {USER_GOALS_FROM_VISION}
- Specific action items for their situation

Page 15: Summary & Next Steps
- 5 key takeaways
- Recommended next steps
- Resources for deeper learning

OUTPUT FORMAT: Return as JSON with "pages" array, each page containing:
{
  "page_number": 1-15,
  "title": "Page Title",
  "content": "Full content...",
  "key_points": ["point1", "point2"],
  "action_items": ["action1"]
}

Make it actionable and focused on life improvement and goal achievement.
`;
```

### 2.3 Extend ai-service.js

Add new methods:

```javascript
// Get personalized book recommendations
generateBookRecommendations: async function(userDataContext) { ... }

// Generate 15-page summary
generateBookSummary: async function(bookTitle, author, userGoals) { ... }

// Get book details from title
getBookDetails: async function(title) { ... }
```

---

## Phase 3: Frontend Views

### 3.1 Navigation Integration

Add "Books" to the navigation menu (app.js or navigation component):

```javascript
// Add to navigation items:
{ id: 'books', icon: 'book', label: 'Books', view: 'books' }
```

### 3.2 New View: view-books.js

**Main Library Screen Features:**

1. **Header Section**
   - Page title: "Book Library"
   - Search bar for filtering books
   - Filter dropdown (All, To Read, Reading, Completed)
   - Sort options (Date Added, Title, Author, Rating)

2. **Quick Actions**
   - "Suggest Me Books to Read" button (triggers AI recommendation)
   - FAB menu: Add book manually

3. **Book Grid/List**
   - Cover image (or placeholder)
   - Title and Author
   - Status badge (To Read/Reading/Completed)
   - Quick actions: Mark status, Open summary, Delete

4. **AI Suggestion Modal**
   - Displays 5-10 recommended books
   - Each card shows:
     - Cover (if available)
     - Title & Author
     - Why recommended (based on user's goals)
     - "Add to Library" button
     - "Generate Summary" button

### 3.3 New View: view-reader.js

**Reader Screen Features:**

1. **Header Bar** (collapsible)
   - Book title
   - Page indicator (Page X of 15)
   - Settings gear icon
   - Fullscreen toggle

2. **Main Content Area**
   - Rendered markdown/HTML content
   - Swipe left/right for page navigation
   - Click left/right edges for page turn

3. **Bottom Navigation**
   - Previous/Next buttons
   - Page progress dots/indicator
   - Jump to page selector

4. **Settings Panel** (slide-in drawer)
   - Background color picker (presets: White, Sepia, Dark, Black)
   - Text color picker
   - Font family selector (Serif, Sans-serif, Monospace)
   - Font size slider (12px - 28px)
   - Line spacing slider (1.0 - 2.5)
   - Page animation toggle (Slide/Fade/None)
   - Fullscreen toggle

5. **Progress Tracking**
   - Visual progress bar
   - Percentage complete
   - Time remaining estimate

### 3.4 Component: BookSuggestionModal.js

**Modal Flow:**

```
┌─────────────────────────────────────────┐
│     "Books Suggested for You"           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  📖 The 7 Habits...      │
│  │  COVER  │  Stephen R. Covey        │
│  │         │  "Aligns with your goal:  │
│  │         │   Leadership Development" │
│  │         │  [Add to Library]         │
│  └─────────┘  [Generate Summary]       │
│                                         │
│  ┌─────────┐  📖 Atomic Habits...      │
│  │  COVER  │  James Clear             │
│  │         │  "Aligns with your goal:  │
│  │         │   Build Better Habits"    │
│  │         │  [Add to Library]         │
│  └─────────┘  [Generate Summary]       │
│                                         │
│  ... more suggestions ...               │
│                                         │
└─────────────────────────────────────────┘
```

---

## Phase 4: User Flows

### 4.1 Flow: Getting Book Suggestions

```
User clicks "Suggest Me Something to Read"
           │
           ▼
┌─────────────────────────────┐
│ 1. Collect user context:    │
│    - Vision board goals    │
│    - Active habits          │
│    - Recent diary entries   │
│    - Task categories        │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. Send to AI Service       │
│    with book recommendation │
│    prompt                  │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 3. Display suggestions in   │
│    modal with reasoning     │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 4. User can:               │
│    - Add book to library    │
│    - Generate summary       │
│    - Dismiss                │
└─────────────────────────────┘
```

### 4.2 Flow: Generating a Summary

```
User clicks "Generate Summary" on a book
           │
           ▼
┌─────────────────────────────┐
│ 1. Fetch user's vision/goals│
│    to personalize summary   │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. Send to AI with prompt   │
│    for 15-page structured   │
│    summary                  │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 3. Receive JSON response   │
│    with 15 pages of content │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 4. Save to Google Sheets    │
│    (book_summaries table)   │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 5. Open reader view with   │
│    new summary              │
└─────────────────────────────┘
```

### 4.3 Flow: Reading a Summary

```
User opens book summary from library
           │
           ▼
┌─────────────────────────────┐
│ 1. Load summary JSON from  │
│    Google Sheets            │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. Apply user's reader      │
│    preferences              │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 3. Display reader interface │
│    with page navigation     │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 4. User can:               │
│    - Swipe/click to navigate│
│    - Adjust settings        │
│    - Toggle fullscreen      │
│    - Save progress          │
└─────────────────────────────┘
```

---

## Phase 5: Data Flow & State Management

### 5.1 State Structure

```javascript
// In state.data:
state.data = {
  // ... existing ...
  
  book_library: [],
  book_summaries: [],
  reader_settings: {
    background_color: '#ffffff',
    font_color: '#000000',
    font_family: 'sans-serif',
    font_size: 16,
    line_spacing: 1.5,
    fullscreen_mode: false,
    page_animation: 'slide',
    auto_save_position: true
  },
  current_book_summary: null,  // Currently viewing summary
  current_page: 0              // Current page in reader
}
```

### 5.2 API Endpoints

Existing API infrastructure (apiCall in main.js) will handle:

```javascript
// Book Library
apiCall('get', 'book_library')              // Fetch all books
apiCall('create', 'book_library', payload)  // Add book
apiCall('update', 'book_library', payload, id)  // Update book
apiCall('delete', 'book_library', {}, id)  // Delete book

// Summaries
apiCall('get', 'book_summaries')            // Fetch summaries
apiCall('create', 'book_summaries', payload)// Save summary

// Reader Settings
apiCall('get', 'reader_settings')           // Fetch settings
apiCall('update', 'reader_settings', payload, 'user_prefs')  // Save settings
```

---

## Phase 6: UI/UX Design Specifications

### 6.1 Color Palette for Reader

| Preset | Background | Text | Use Case |
|--------|------------|------|----------|
| Light | #FFFFFF | #1a1a1a | Day reading |
| Sepia | #F4ECD8 | #5B4636 | Comfort reading |
| Dark | #2D2D2D | #E0E0E0 | Evening reading |
| Black | #000000 | #CCCCCC | Night/battery save |

### 6.2 Typography Options

| Font Family | CSS Value | Vibe |
|-------------|-----------|------|
| Sans-serif | -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif | Clean, modern |
| Serif | 'Georgia', 'Times New Roman', serif | Classic, book-like |
| Monospace | 'SF Mono', 'Fira Code', monospace | Technical, minimal |

### 6.3 Reader Layout

```
┌────────────────────────────────────────────────────┐
│ ◀  The 7 Habits...           Page 3/15    ⚙  ⛶  │
├────────────────────────────────────────────────────┤
│                                                    │
│              ╔══════════════════╗                 │
│              ║   PAGE CONTENT   ║                 │
│              ║                  ║                 │
│              ║  This is where   ║                 │
│              ║  the summary     ║                 │
│              ║  text is         ║                 │
│              ║  displayed...   ║                 │
│              ║                  ║                 │
│              ╚══════════════════╝                 │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │     ● ● ● ● ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○         │ │
│  │           20% complete                      │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│        [◀ Previous]           [Next ▶]            │
└────────────────────────────────────────────────────┘
```

---

## Phase 7: Implementation Tasks

### 7.1 Backend (Code.gs)
- [ ] Add new sheets to SCHEMA object
- [ ] Add ensureSheetExists calls in init function
- [ ] Test CRUD operations for each new sheet

### 7.2 AI Service (ai-service.js)
- [ ] Add `generateBookRecommendations()` method
- [ ] Add `generateBookSummary()` method
- [ ] Add prompt templates for book features

### 7.3 Frontend Core (main.js)
- [ ] Add "books" to navigation
- [ ] Add route handling for book views
- [ ] Add API call handlers for book operations

### 7.4 Book Library View (view-books.js)
- [ ] Create main library grid/list view
- [ ] Implement search and filter functionality
- [ ] Create "Suggest Books" button and modal
- [ ] Add book status management (To Read/Reading/Completed)
- [ ] Implement book card UI

### 7.5 Reader View (view-reader.js)
- [ ] Create reader layout with page display
- [ ] Implement swipe/click navigation
- [ ] Create settings drawer component
- [ ] Add background/text color customization
- [ ] Implement font and spacing controls
- [ ] Add fullscreen mode
- [ ] Add progress tracking

### 7.6 Reader Settings
- [ ] Persist settings to Google Sheets
- [ ] Apply settings on reader load
- [ ] Add reset to defaults option

### 7.7 Integration Testing
- [ ] Test complete flow: Suggest → Add → Generate → Read
- [ ] Verify settings persist across sessions
- [ ] Test offline/online behavior

---

## Technical Considerations

### 8.1 Performance
- Cache book summaries in IndexedDB for offline access
- Lazy load cover images
- Paginate library view for large collections

### 8.2 Error Handling
- AI API failures: Show retry option with cached partial data
- Network failures: Queue operations for later sync
- Invalid data: Validate JSON structure before rendering

### 8.3 Future Enhancements (Out of Scope)
- Book purchase/Kindle integration
- Social sharing of summaries
- Audio narration of summaries
- Multi-book comparison
- Reading progress tracking across books

---

## File Structure

```
/book-library-view.js      (Main library UI)
/book-reader-view.js       (Reader with customization)
/book-components.js       (Shared components: cards, modals)
/book-ai-service.js       (AI integration specific to books)
/book-styles.css          (Reader-specific styles)
/book-library-styles.css  (Library view styles)
```

---

## Summary

This plan creates a comprehensive book suggestion and summary system that:

1. **Leverages Existing Data**: Uses vision goals, habits, and diary to personalize recommendations
2. **AI-Powered**: Generates detailed 15-page summaries focused on actionable life improvement
3. **Persistent Storage**: All data stored in Google Sheets for cross-device access
4. **Rich Reader**: Full-featured reader with extensive customization (colors, fonts, spacing, fullscreen)
5. **Seamless Integration**: Follows existing PersonalOS patterns and architecture

The implementation can be done in phases, with each phase delivering functional value.
