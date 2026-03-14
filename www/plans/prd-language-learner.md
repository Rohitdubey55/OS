# Product Requirements Document (PRD): Language Learner Tool

## 1. Overview
The **Language Learner** is an integrated tool within PersonalOS designed to help users master new languages through AI-powered interactive sessions, personalized goals, and persistent progress tracking. It leverages the user's existing "Vision" and "Habits" data to provide a context-aware learning experience.

## 2. Objectives
- Enable users to create "Language Projects" for specific languages they want to learn.
- Provide a seamless "Session" experience where users can practice speaking/writing with an AI tutor.
- Track long-term progress and store actionable insights (key learnings, next steps) for every session.
- Integrate visually into the PersonalOS dashboard with progress bars and quick-start actions.

---

## 3. Core Features

### 3.1 Project Management
- **New Project Creation**: Choose language (English, Spanish, French, German, Japanese, etc.), current proficiency level (Beginner, Intermediate, Advanced), and daily time commitment (e.g., 10, 20, 30 mins).
- **Project Progress**: A visual progress bar based on cumulative session time and proficiency milestones.
- **Multi-Project Support**: Manage multiple languages simultaneously (e.g., Learning Spanish and Japanese at once).

### 3.2 AI-Powered Interactive Sessions
- **Adaptive Tutoring**: AI starts a conversation based on the user's level and previous session insights.
- **Voice/Text Modes**: Switch between text chat and voice-based interaction (simulated or via STT/TTS).
- **Correction & Feedback**: Instant grammar, vocabulary, and pronunciation corrections displayed in the session log.
- **Contextual Learning**: AI can pull topics from the user's "Vision Board" or "Diary" to make the practice relevant (e.g., "Let's talk about your goal to become a Senior Engineer in Spanish").

### 3.3 Session Insights & Memory
- **Key Learnings**: Automatically extracted list of new words or grammar rules mastered during the session.
- **Next Steps**: AI-suggested focus areas for the next session (e.g., "Practice past tense verbs").
- **Persistent History**: Access any previous session to review conversations and learnings.

### 3.4 Dashboard & UI Integration
- **Bento Widget**: A dedicated dashboard tile showing active projects, current streaks, and a "Start Session" button.
- **Tool View**: A full-screen view for managing projects, viewing detailed statistics, and browsing session history.

---

## 4. Proposed Data Schema (Google Sheets)

### 4.1 Sheet: `language_projects`
| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique Project ID |
| language | string | Target language name |
| level | string | Beginner, Intermediate, Advanced |
| daily_goal | number | Minutes per day |
| total_minutes | number | Cumulative practice time |
| start_date | date | When the project was created |
| status | string | active, paused, completed |
| current_streak | number | Daily engagement streak |

### 4.2 Sheet: `language_sessions`
| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique Session ID |
| project_id | string | Link to `language_projects.id` |
| date | datetime | Session timestamp |
| duration | number | Minutes spent |
| transcript_json | text | JSON of the full conversation |
| key_learnings | text | Bullet points of what was learned |
| next_steps | text | AI-generated recommendations for next time |
| level_assessment | string | AI's evaluation of performance in this session |

---

## 5. UI/UX Design Specifications

### 5.1 Dashboard Widget
- **Visuals**: Circular progress rings for each language.
- **Quick Action**: A "⚡ Start Session" button that immediately opens the session UI for the most recently active project.

### 5.2 Session Interface
- **Modern Chat UI**: Clean, bubble-style chat with integrated audio playback for AI responses.
- **Feedback Overlay**: A sidebar or collapsible panel showing real-time corrections.
- **Session Stats**: Real-time timer and "Words Learned" counter.

### 5.3 History & Insights View
- **Timeline View**: A vertical timeline of all past sessions.
- **Search & Filter**: Find sessions by topic or date.
- **Learning Card**: A summary card for each project showing "Total Words Mastered" and "Grammar Progress".

---

## 6. AI Integration Strategy
- **Prompt Engineering**: Use specialized prompts to act as a supportive yet challenging tutor.
- **State Management**: Pass the "Next Steps" from the *previous* session as context to the AI when starting a *new* session.
- **Data Enrichment**: Feed the AI context from the `vision_board` to ensure conversations are personally meaningful.

---

## 7. Success Metrics
- **Engagement**: Percentage of users who meet their daily goal 5+ days a week.
- **Growth**: Number of "Key Learnings" logged per week.
- **Retention**: Average project duration (how many months users stick with a language).
