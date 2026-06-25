# Word Adventure — Component Specifications

**Version:** 1.0
**Date:** 2026-06-21
**Audience:** Designers and Frontend Developers

---

## Overview

This document specifies the UI components and pages for both child and parent views. All pages are rendered as vanilla JavaScript, with CSS styling. No framework or component library.

---

## Design Principles

1. **Child-First:** Large touch targets, bright colors, friendly language, clear actions
2. **Simple:** Minimal options, intuitive navigation, no dark patterns
3. **Progress-Visible:** XP, levels, streaks, garden visible on every screen
4. **Forgiving:** Undo options, friendly error messages, no accidental data loss
5. **Parent-Focused:** Parent dashboard is information-dense, exportable

---

## Global UI Elements

### Header (All Pages)

**Position:** Top of page, fixed or sticky

**Content (Child):**
```
[Logo] Word Adventure        [XP Bar] [Level: 2] [User Menu]
                                     ████████░ 120/150 XP
```

**Content (Parent):**
```
[Logo] Word Adventure        [Parent Dashboard] [User Menu]
```

**Components:**
- Logo (clickable, returns to home)
- XP bar (shows current XP / next level threshold)
- Current level badge
- Streak counter (next to level, or in stats card)
- User menu (profile, logout)

**Styling:**
- Background: Bright blue (#007BFF or similar)
- Text: White
- XP bar: Gradient (lighter to darker blue)
- Level badge: Circular, gold background, white text

### Footer (Optional)

**Content:**
```
© 2026 Word Adventure | Privacy | Settings
```

---

## Child Pages

### 1. Login Page (`#/login`)

**Route:** `#/login` (default after logout)

**Purpose:** Email/password login for both child and parent

**Layout:**
```
┌────────────────────────────────────┐
│  [Logo] Word Adventure    │
│                                    │
│  Welcome! Sign in to your          │
│  word adventure.                   │
│                                    │
│  [Email input]                     │
│  [Password input]                  │
│  [Sign In button]                  │
│                                    │
│  Forgot password? (placeholder)    │
└────────────────────────────────────┘
```

**Components:**
- Logo (centered)
- Heading: "Welcome!"
- Email input field
- Password input field
- "Sign In" button (primary, large, full-width)
- "Forgot password?" link (disabled for now)
- Error message area (red, below form)

**Behavior:**
1. User enters email + password
2. On submit, call `supabase.auth.signInWithPassword()`
3. If success, check user role in profiles table
4. Redirect to `/child/home` or `/parent/dashboard`
5. If error, show error message (e.g., "Invalid email or password")

**Styling:**
- Max-width: 400px, centered
- Background: Light gradient (blue to white)
- Font: Large, clear
- Button: Bright blue, white text, rounded corners
- Error text: Red, bold

---

### 2. Child Home Page (`#/child/home`)

**Route:** `#/child/home` (default child landing page)

**Purpose:** Dashboard with quick stats, today's reviews, and navigation

**Layout:**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  ┌────────────────────────────────────┐   │
│  │  Welcome back, Learner!              │   │
│  │  You're on a 5-day streak! 🔥     │   │
│  └────────────────────────────────────┘   │
│                                            │
│  ┌─────────┬──────────┬──────────┐        │
│  │ Words   │ Mastered │ Reviews  │        │
│  │ Added   │ Words    │ Today    │        │
│  │   23    │    5     │    3     │        │
│  └─────────┴──────────┴──────────┘        │
│                                            │
│  [ Add a New Word ] [ Review Today ]      │
│                                            │
│  ─── Today's Reviews (3 due) ───          │
│  1. curious (Lv. 1) →                    │
│  2. garden (Lv. 2) →                     │
│  3. knowledge (Lv. 1) →                  │
│                                            │
│  ─── Quick Menu ───                       │
│  [📖 My Words] [🎮 Quiz] [🌳 Garden]     │
│  [🏆 Achievements] [⚙️ Settings]         │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Greeting Card**
   - "Welcome back, [Name]!"
   - Streak display with 🔥 emoji
   - Encouragement message

2. **Stats Cards** (3 columns, responsive to 1)
   - Words Added (total count)
   - Mastered Words (review_level >= 4 count)
   - Reviews Today (count of due words)
   - Numbers large (48px+), colored backgrounds

3. **Action Buttons** (2 primary buttons, full-width stacked)
   - "Add a New Word" (blue)
   - "Review Today" (green)
   - Disabled state if no due words

4. **Today's Reviews List**
   - Shows up to 5 due words
   - Format: `[word] (Lv. X) →`
   - Click to start review session
   - "Start Review" button at end of list

5. **Quick Menu** (4 icon buttons, grid 2x2 on mobile)
   - My Words (📖)
   - Quiz (🎮)
   - Garden (🌳)
   - Achievements (🏆)

**Behavior:**
1. On load, fetch user stats (XP, level, streak, word count, mastered count, due count)
2. Fetch up to 5 due words from `review_schedule`
3. Render all stats and lists
4. "Review Today" button navigates to `/child/review`
5. "Add a New Word" button navigates to `/child/add-word`
6. Quick menu buttons navigate to respective pages

**Styling:**
- Card-based layout with rounded corners
- Light shadows on cards
- Stat numbers: Large (48px), bold, in color
- Buttons: Varied colors (blue, green, orange, purple)
- Background: Light blue gradient
- Text: Dark blue, readable

---

### 3. Add Word Page (`#/child/add-word`)

**Route:** `#/child/add-word`

**Purpose:** Look up a word and add it to the word list

**Layout (Step 1: Input):**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  ➕ Add a New Word                        │
│                                            │
│  Enter the word you want to learn:       │
│  [Word input field]                      │
│  [AUTO-LOOKUP button] or [Manual Entry]  │
│                                            │
│  💡 Tip: Try words like "curious",       │
│  "garden", or "knowledge"!                │
│                                            │
└────────────────────────────────────────────┘
```

**Layout (Step 2: Preview):**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  ✨ Preview Your Word                    │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │  Word: curious (adjective)         │   │
│  │  Meaning:                          │   │
│  │  "Eager to know or learn"          │   │
│  │  中文: 渴望了解或学习              │   │
│  │  Example:                          │   │
│  │  "The curious boy opened the box"  │   │
│  │                                    │   │
│  │  Category: [General ▼]             │   │
│  │  ⭐ Favorite?  [☐]                │   │
│  └────────────────────────────────────┘   │
│                                            │
│  [Edit] [Save] [Cancel]                   │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Word Input**
   - Text input field
   - Placeholder: "Enter a word..."
   - Debounced auto-lookup on change (after 300ms)

2. **Lookup Actions**
   - "Auto-Lookup" button (calls Edge Function)
   - "Manual Entry" link (skip lookup, enter manually)
   - Loading spinner during lookup

3. **Preview Card** (shown after lookup or manual entry)
   - Word + part of speech (large, bold)
   - English definition (editable text field)
   - Chinese definition (editable text field, or empty)
   - Example sentence (editable text field)
   - Category dropdown (general, animals, science, school, etc.)
   - Favorite checkbox

4. **Action Buttons**
   - "Save" (primary, green)
   - "Edit" (shows editable fields)
   - "Cancel" (returns to home)

5. **Error States**
   - "Word not found. You can enter the definition yourself."
   - "Connection error. Try again or enter manually."
   - Friendly, non-technical language

**Behavior:**
1. User types word, waits 300ms
2. On auto-lookup:
   - Show loading spinner
   - Call Edge Function `POST /lookup-word`
   - If success, populate preview card
   - If not found, show "Word not found" message + manual entry form
   - If network error, show error + allow manual entry
3. User can edit any field (word, definitions, example, category)
4. On save:
   - INSERT into `words` table
   - INSERT into `review_schedule` table (level 0, 1 day interval)
   - Show toast notification: "Word saved! +1 XP"
   - Redirect to home after 2 seconds

**Styling:**
- Card-based with editable fields
- Preview card: Light background, readable text
- Editable fields: White background, blue border on focus
- Buttons: Blue (Save), Gray (Edit), Red (Cancel)

---

### 4. Word List Page (`#/child/words`)

**Route:** `#/child/words`

**Purpose:** Browse, search, and manage all words

**Layout:**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  📖 My Words (23 total)                   │
│                                            │
│  [Search: _______________] [Filter ▼]    │
│                                            │
│  ─── Recently Added ───                   │
│  ┌─────────────────────────────────────┐  │
│  │ curious (adjective)                 │ │
│  │ Eager to know or learn something   │  │
│  │ Level: 1 | Next review: 2026-06-28 │  │
│  │ ⭐ [Delete]                        │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │ knowledge (noun)                    │  │
│  │ Facts and skills acquired...       │  │
│  │ Level: 2 | Next review: 2026-07-05 │  │
│  │ [Star] [Delete]                    │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  [← Load More]                             │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Search Bar**
   - Full-width input: "Search words..."
   - Filters list real-time as user types

2. **Filter Dropdown**
   - All | By category | Favorites | Mastered | Due today

3. **Word Cards** (vertical list, or grid on desktop)
   - Word + part of speech (large, bold)
   - English definition (short, 1–2 lines)
   - Review level badge (Lv. X)
   - Next review date
   - Star button (toggle favorite)
   - Delete button (with confirmation)

4. **Empty State**
   - "No words yet. Add your first word!"
   - Link to add-word page

5. **Pagination**
   - Load 10 words initially
   - "Load More" button at bottom

**Behavior:**
1. On load, fetch user's words (latest first)
2. Search filters words in real-time
3. Filter dropdown filters by category, favorites, mastered, due today
4. Click word card to view details (or edit in modal)
5. Star button toggles `is_favorite` in database
6. Delete button shows confirmation dialog, then deletes word + review_schedule

**Styling:**
- Card-based list
- Word name: 24px bold
- Definition: 14px gray
- Badges: Small colored boxes (Lv. X)
- Buttons: Small, icon-based (⭐, 🗑️)
- Background: Light blue

---

### 5. Review Session Page (`#/child/review`)

**Route:** `#/child/review`

**Purpose:** Review due words with SRS scheduling

**Layout (Review Screen):**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  📚 Review Session                         │
│  Word 1 of 3                              │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │                                    │   │
│  │           curious                  │   │
│  │      (adjective, Level 1)          │   │
│  │                                    │   │
│  │  Definition:                       │   │
│  │  Eager to know or learn something │   │
│  │                                    │   │
│  │  中文: 渴望了解或学习              │   │
│  │                                    │   │
│  └────────────────────────────────────┘   │
│                                            │
│  [✓ Got it] [✗ Didn't get it]            │
│                                            │
└────────────────────────────────────────────┘
```

**Layout (Session Summary):**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  🎉 Review Complete!                      │
│                                            │
│  You reviewed 3 words                      │
│  Correct: 3/3 ✓ (100%)                   │
│                                            │
│  🎁 Earned: +6 XP (2 per review)          │
│  🎁 Earned: +9 XP (3 per correct)         │
│  🎁 TOTAL: +15 XP                         │
│                                            │
│  Status: Now Level 3! 🎊                  │
│                                            │
│  [← Back Home] [➡️ Take Quiz]             │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Review Card**
   - Word (large, 48px)
   - Part of speech + level
   - English definition
   - Chinese definition
   - Example sentence (if available)

2. **Progress**
   - "Word X of Y" at top
   - Progress bar

3. **Action Buttons** (2 large buttons)
   - "✓ Got it" (green, right side)
   - "✗ Didn't get it" (red, left side)
   - Large touch targets (60px+ height)

4. **Session Summary** (after all words reviewed)
   - Total reviewed count
   - Correct count + percentage
   - XP earned breakdown
   - Level up notification (if applicable)
   - Buttons: "Back Home", "Take Quiz"

**Behavior:**
1. On load, fetch due words (review_schedule.next_review_date <= TODAY)
2. Show first word
3. On "Got it":
   - Correct = true, INSERT into test_results
   - Calculate next review date (SRS ladder)
   - UPDATE review_schedule
   - Move to next word
4. On "Didn't get it":
   - Correct = false, INSERT into test_results
   - Set review_level = 0, interval = 1
   - UPDATE review_schedule
   - Move to next word
5. After all words reviewed, show summary
   - Calculate total XP gained
   - Check for new achievements
   - Check if level increased

**Styling:**
- Large, readable text
- Buttons: 60px height, full-width on mobile
- Card: Centered, with light background
- Progress bar: Animated fill

---

### 6. Quiz Session Page (`#/child/quiz`)

**Route:** `#/child/quiz`

**Purpose:** Take quizzes (meaning, spelling, listening) on any words

**Layout (Quiz Question - Meaning):**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  🎮 Quiz Challenge                         │
│  Question 1 of 5                          │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │                                    │   │
│  │  What does "curious" mean?        │   │
│  │                                    │   │
│  │  A) Worried about something        │   │
│  │  B) Eager to know or learn         │   │
│  │  C) Afraid of the dark             │   │
│  │  D) Happy and joyful               │   │
│  │                                    │   │
│  └────────────────────────────────────┘   │
│                                            │
│  [A] [B] [C] [D]                         │
│                                            │
└────────────────────────────────────────────┘
```

**Layout (Quiz Question - Spelling):**
```
┌────────────────────────────────────────────┐
│  🎮 Quiz Challenge                         │
│  Question 2 of 5                          │
│                                            │
│  Type the spelling of this word:          │
│  渴望了解或学习某事                        │
│                                            │
│  [Your answer: ___________]               │
│                                            │
│  [💡 Hint]  [Submit]                      │
│                                            │
└────────────────────────────────────────────┘
```

**Layout (Quiz Question - Listening):**
```
┌────────────────────────────────────────────┐
│  🎮 Quiz Challenge                         │
│  Question 3 of 5                          │
│                                            │
│  🔊 Listen to the word being spoken      │
│  Type the spelling:                       │
│                                            │
│  [🔊 Play] [🔊 Play] [🔊 Play]           │
│                                            │
│  [Your answer: ___________]               │
│                                            │
│  [Submit]                                 │
│                                            │
└────────────────────────────────────────────┘
```

**Layout (Quiz Result):**
```
┌────────────────────────────────────────────┐
│  ✓ Correct!                                │
│  You got it right!                         │
│                                            │
│  +3 XP                                     │
│                                            │
│  [Next Question →]                        │
│                                            │
│  ─────────────────                        │
│  ✗ Incorrect                               │
│  You said: "cureous"                      │
│  Correct: "curious"                       │
│                                            │
│  [Try Again] or [Next Question →]        │
│                                            │
└────────────────────────────────────────────┘
```

**Layout (Quiz Summary):**
```
┌────────────────────────────────────────────┐
│  🎉 Quiz Complete!                         │
│                                            │
│  Score: 4/5 (80%)                         │
│  Earned: +12 XP (3 per correct)           │
│                                            │
│  ─── Breakdown ───                         │
│  Meaning Quiz: 3/3 ✓                      │
│  Spelling Quiz: 1/2 ✓                     │
│                                            │
│  Great job! Keep it up! 🎊                │
│                                            │
│  [← Back Home] [Take Another Quiz]       │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Quiz Question Card**
   - Question type indicator (Meaning, Spelling, Listening)
   - Progress: "Question X of Y"
   - Question text or instruction

2. **Meaning Quiz**
   - 4 multiple-choice buttons (A, B, C, D)
   - Distractors from word list or hardcoded common words

3. **Spelling Quiz**
   - Text input field
   - "Hint" button (reveals one random letter)
   - "Submit" button

4. **Listening Quiz**
   - Play button (uses SpeechSynthesis API)
   - Can play multiple times
   - Text input field for answer

5. **Result Feedback**
   - Checkmark (✓) or X (✗)
   - Correct answer if wrong
   - XP earned
   - "Next Question" button

6. **Quiz Summary**
   - Total score and percentage
   - XP earned breakdown
   - Buttons: "Back Home", "Another Quiz"

**Behavior:**
1. On load, prompt user: "How many questions?" (default 5)
2. Randomly select quiz type for each question (50% meaning, 25% spelling, 25% listening)
3. For meaning quiz: Pick 1 correct answer + 3 random distractors
4. For spelling/listening: Accept flexible spelling (case-insensitive, trim whitespace)
5. On submit:
   - Check answer, INSERT into test_results
   - Show result feedback
   - Award XP if correct
   - Next button → next question
6. After all questions, show summary
   - Calculate total XP
   - Check for new achievements
   - Update stats on home screen

**Styling:**
- Multiple-choice buttons: Large (60px height), colorful (A=blue, B=green, etc.)
- Text input: Readable, 32px font
- Result: Large checkmark (✓) or X (✗) with animation
- Summary: Colorful boxes with stats

---

### 7. Word Garden Page (`#/child/garden`)

**Route:** `#/child/garden`

**Purpose:** Visualize mastered words as a growing garden

**Layout:**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  🌳 Your Word Garden                      │
│                                            │
│  You've mastered 5 words!                  │
│  Garden Stage: Sprouts 🌱                │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │                                    │   │
│  │        🌱  🌱  🌱               │   │
│  │      🌱        🌱                │   │
│  │        🌱  🌱                    │   │
│  │                                    │   │
│  │  Keep learning to grow your       │   │
│  │  garden! Reach 50 mastered words  │   │
│  │  to unlock flowers! 🌸            │   │
│  │                                    │   │
│  └────────────────────────────────────┘   │
│                                            │
│  Progress: 5 / 50 (next stage)            │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                            │
│  ─── Mastered Words ───                    │
│  curious, garden, knowledge, happy, sad   │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Garden Visualization**
   - SVG or canvas-based garden scene
   - Stages:
     - Empty (no words)
     - Seeds (1–9 words): Small dots
     - Sprouts (10–49 words): Small green shapes
     - Flowers (50–99 words): Colorful blooms
     - Trees (100–499 words): Large trees
     - Forest (500+ words): Dense forest
   - Animated growth (scale up when new words mastered)

2. **Progress Bar**
   - Shows current stage progress (e.g., "5/50 to next stage")
   - Animated fill bar

3. **Mastered Words List**
   - Shows all mastered words (clickable to view details)
   - Comma-separated or tag-style

4. **Info Card**
   - Current stage name
   - Encouragement message (e.g., "Great job! Keep learning!")
   - Next stage threshold

**Behavior:**
1. On load, query mastered words (review_level >= 4)
2. Count mastered words
3. Determine garden stage based on count
4. Render SVG garden visualization for that stage
5. Show progress to next stage
6. List all mastered words

**Styling:**
- Large, colorful garden visualization
- Progress bar: Animated, filled with green
- Text: Encouraging, friendly
- Colors: Greens, blues, earth tones

---

### 8. Achievements Page (`#/child/achievements`)

**Route:** `#/child/achievements`

**Purpose:** Display earned medals and badges

**Layout:**
```
┌────────────────────────────────────────────┐
│  HEADER: XP Bar | Level | Menu             │
├────────────────────────────────────────────┤
│                                            │
│  🏆 Achievements & Medals                 │
│                                            │
│  ─── Word Count Medals ───                 │
│  ┌─────────────┬─────────────┐            │
│  │ 🥉 BRONZE   │ 🥈 SILVER   │            │
│  │ 100 words   │ 500 words   │            │
│  │ Earned!     │ Earned!     │            │
│  └─────────────┴─────────────┘            │
│                                            │
│  ┌─────────────┬─────────────┐            │
│  │ 🥇 GOLD     │ 🏅 PLATINUM │            │
│  │ 1000 words  │ 2000 words  │            │
│  │ [LOCKED]    │ [LOCKED]    │            │
│  └─────────────┴─────────────┘            │
│                                            │
│  ─── Special Badges ───                    │
│  ┌─────────────────────────────────────┐  │
│  │ 🔥 7-Day Streak                     │  │
│  │ Earned: 2026-05-15                  │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ┌─────────────────────────────────────┐  │
│  │ ⚡ Speed Reader (Locked)            │  │
│  │ 100 reviews in one day              │  │
│  │ Progress: 23/100                    │  │
│  └─────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Medal Badges** (word count milestones)
   - Grid of 4 medals: Bronze (100), Silver (500), Gold (1000), Platinum (2000)
   - Earned badges: Glowing, with earned date
   - Locked badges: Grayed out, with unlock threshold

2. **Special Badges** (achievements)
   - Cards for each special badge (Perfect Week, Speed Reader, Word Collector, Streaks)
   - Earned: Show earned date
   - Locked: Show unlock condition + progress bar if applicable

3. **Badge Details**
   - Name
   - Description
   - Earned date (if earned)
   - Unlock condition (if locked)
   - Progress (if partially earned, e.g., 7/30 days for 30-day streak)

**Behavior:**
1. On load, fetch user's achievements from `achievements` table
2. Query user stats (word count, streaks, test counts)
3. Determine which badges are earned, locked, or in progress
4. Render badges in grid/list format
5. Click badge to see details

**Styling:**
- Grid layout (2 columns on mobile, 4 on desktop)
- Earned badges: Bright colors, glowing effect
- Locked badges: Grayed out, muted colors
- Progress bars: Filled colors for in-progress badges

---

## Parent Pages

### 1. Parent Login

Same as child login page (same login form routes to different dashboard based on role).

---

### 2. Parent Dashboard (`#/parent/dashboard`)

**Route:** `#/parent/dashboard`

**Purpose:** Monitor child's progress with charts and stats

**Layout:**
```
┌────────────────────────────────────────────┐
│  HEADER: Logo | Parent Dashboard | Menu    │
├────────────────────────────────────────────┤
│                                            │
│  📊 Learner's Learning Dashboard             │
│  Last 30 days                              │
│                                            │
│  ─── Quick Stats ───                       │
│  ┌─────────────────────────────────────┐  │
│  │ Words Added: 23                     │  │
│  │ Mastered Words: 5                   │  │
│  │ Current Streak: 8 days              │  │
│  │ Total XP: 450                       │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  ─── Words Added per Day ───               │
│  │ [Bar Chart: 30-day bars]            │  │
│  │ (Chart.js from CDN)                 │  │
│                                            │
│  ─── Test Accuracy by Type ───             │
│  │ [Line Chart: accuracy % over time] │  │
│  │ (Meaning: 90%, Spelling: 75%,      │  │
│  │  Listening: 60%)                   │  │
│                                            │
│  ─── Review Completion ───                 │
│  │ [Line Chart: reviews/week]          │  │
│                                            │
│  [📥 Export as CSV]                       │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Quick Stats** (4 number cards)
   - Words Added (total)
   - Mastered Words (count)
   - Current Streak (days)
   - Total XP (number)

2. **Chart 1: Words Added per Day** (30-day bar chart)
   - X-axis: Dates
   - Y-axis: Count
   - Use Chart.js

3. **Chart 2: Test Accuracy by Type** (line chart)
   - X-axis: Time
   - Y-axis: Accuracy %
   - Separate lines for Meaning, Spelling, Listening
   - Use Chart.js

4. **Chart 3: Review Completion per Week** (line chart)
   - X-axis: Weeks
   - Y-axis: Reviews completed
   - Use Chart.js

5. **Export Button**
   - "📥 Export as CSV"
   - Exports all word data + test results

**Behavior:**
1. On load, fetch child's statistics for last 30 days
   - Words added per day
   - Test results (grouped by type and date)
   - Mastered word count
   - Streak length
   - Total XP
2. Render charts using Chart.js CDN
3. Export button generates CSV file with:
   - Word list (word, definition, part of speech, category, created date)
   - Test results (word, test type, correct/incorrect, date)
   - Totals (words added, tests completed, accuracy %)
4. Download CSV file to parent's device

**Styling:**
- Information-dense but organized
- Light grid background
- Charts with clear labels and legends
- Number cards: Large text, colored backgrounds
- Export button: Prominent, green

---

### 3. Parent Words View (`#/parent/words`)

**Route:** `#/parent/words` (optional, can be part of dashboard)

**Purpose:** Browse all words added by child (view-only)

**Layout:** Similar to child word list, but view-only (no edit/delete)

```
┌────────────────────────────────────────────┐
│  HEADER: Logo | Parent Dashboard | Menu    │
├────────────────────────────────────────────┤
│                                            │
│  📖 Learner's Words (23 total)              │
│                                            │
│  [Search: _______________] [Filter ▼]    │
│                                            │
│  ─── Recently Added ───                   │
│  ┌─────────────────────────────────────┐  │
│  │ curious (adjective)                 │  │
│  │ Eager to know or learn something   │  │
│  │ Added: 2026-06-15 | Level: 1       │  │
│  │ Tests: 5 (80% correct)              │  │
│  └─────────────────────────────────────┘  │
│                                            │
│  [View Details] [Test History]            │
│                                            │
└────────────────────────────────────────────┘
```

**Components:**
1. **Search & Filter** (same as child)
2. **Word Cards** (view-only)
   - Word + definition
   - Added date
   - Current level
   - Test statistics (total tests, accuracy %)
3. **Action Links**
   - View Details (show definition, example, all test attempts)
   - Test History (timeline of test results)

---

## Responsive Design

### Mobile (< 600px)
- Single column layout
- Full-width buttons (stacked vertically)
- Smaller cards, simplified charts
- Bottom navigation bar (optional)

### Tablet (600px – 1024px)
- 2-column grid for stats cards
- Side-by-side layout for charts
- Larger touch targets

### Desktop (> 1024px)
- Multi-column layouts
- Side-by-side charts
- More information displayed at once

---

## Color Palette

**Primary Colors:**
- Blue: #007BFF (buttons, headers)
- Green: #28A745 (success, correct answers)
- Red: #DC3545 (errors, incorrect answers)
- Yellow: #FFC107 (warnings, practice)

**Secondary Colors:**
- Light Blue: #E7F3FF (backgrounds, cards)
- Gray: #6C757D (text, borders)
- Gold: #FFD700 (achievements)

**Text:**
- Dark Blue: #003D7A (headings)
- Dark Gray: #333 (body text)
- Light Gray: #999 (hints, secondary text)

---

## Typography

- **Headings (H1–H4):** Bold, 24px–48px, dark blue
- **Body Text:** 16px, dark gray, line-height 1.5
- **Buttons:** 16px, white text, bold
- **Inputs:** 16px, dark gray, padded
- **Captions:** 12px, light gray

---

## Animation & Interactions

- **Page Transitions:** Smooth fade-in (200ms)
- **Button Hover:** Slight scale-up, shadow
- **Progress Bars:** Animated fill (300ms)
- **Quiz Feedback:** Bounce animation for correct/incorrect
- **Garden Growth:** Scale-up animation when new plants appear
- **XP Pop-up:** Floating "+X XP" text, fades out

---

## Accessibility

- **Color Contrast:** WCAG AA (at least 4.5:1 for text)
- **Touch Targets:** Minimum 48px height for buttons
- **Keyboard Navigation:** Tab through inputs and buttons
- **Screen Readers:** Alt text on images, semantic HTML
- **Focus States:** Visible outline on focused elements

---

## Error Messages

All error messages should be:
- **Friendly, not technical**
- **Actionable (tell user what to do next)**
- **Non-blaming (not "You did this wrong")**

Examples:
- ✅ "That word wasn't found. You can type the definition yourself."
- ✅ "Connection error. Please check your internet and try again."
- ✅ "Quiz answer not recognized. Make sure there are no extra spaces."
- ❌ "404: Word lookup API failed"
- ❌ "Invalid input"
- ❌ "Error: null reference"

---

## Empty States

Show friendly prompts when there's no data:

- **No words added:** "No words yet. Add your first word!"
- **No reviews due:** "Great job! All caught up. Take a quiz or add new words."
- **No achievements:** "Start reviewing to earn badges!"

---

## Loading States

- **Spinner:** Animated circle, shows while fetching
- **Skeleton:** Placeholder cards while loading
- **Progress:** "Loading... 50%" for long operations

---

## Toast Notifications

Temporary messages (3–5 second duration):
- ✅ "Word saved! +1 XP"
- ✅ "Review completed! +15 XP"
- ⚠️ "Couldn't connect to dictionary. Please try again."
- ❌ "Something went wrong. Try again."

---

## References

- Chart.js CDN: https://cdn.jsdelivr.net/npm/chart.js
- Color accessibility checker: https://webaim.org/resources/contrastchecker/
- SVG icons: https://heroicons.com/ or custom
