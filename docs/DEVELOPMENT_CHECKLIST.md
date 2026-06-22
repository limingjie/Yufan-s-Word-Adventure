# Word Adventure — Development Checklist

**Version:** 1.0
**Date:** 2026-06-21
**Status:** Ready for Implementation

---

## Overview

This checklist breaks down the 9-week implementation plan into daily tasks. Use this to track progress and ensure nothing is missed.

---

## Week 1: Foundation & Setup

### Day 1: Project Initialization
- [ ] Create GitHub repository
- [ ] Initialize basic folder structure
  - [ ] Create `/js/`, `/js/lib/`, `/js/pages/`
  - [ ] Create `/assets/icons/`
  - [ ] Create `.gitignore` (include `config.js`)
- [ ] Create `index.html` with:
  - [ ] Supabase JS SDK CDN import
  - [ ] Main app container div
  - [ ] Link to `style.css`
  - [ ] Link to `js/app.js` (as module)
- [ ] Create `style.css` with:
  - [ ] CSS variables for colors
  - [ ] Base styles (reset, fonts, etc.)
  - [ ] Theme colors defined
- [ ] Create `README.md` with project overview and setup instructions
- [ ] Add `js/config.js` template (gitignored, explains what to fill in)

**Deliverable:** Skeleton project structure with index.html loading successfully

---

### Day 2: Supabase Project Setup
- [ ] Create Supabase account (if not exists)
- [ ] Create new Supabase project
- [ ] Note down:
  - [ ] Project URL
  - [ ] Anon key
  - [ ] Service role key
- [ ] Enable email/password auth in Supabase dashboard
  - [ ] Disable confirmations (for development)
- [ ] Fill in `js/config.js` with Supabase credentials
- [ ] Create `js/supabase.js`:
  - [ ] Import Supabase client from CDN
  - [ ] Initialize with credentials from config.js
  - [ ] Export `supabase` client object
- [ ] Test that `supabase` is accessible in browser console

**Deliverable:** Supabase project created, client initialized, testable in browser

---

### Day 3: Database Tables & RLS
- [ ] Go to Supabase dashboard → SQL Editor
- [ ] Run migration script to create all tables:
  - [ ] `profiles`
  - [ ] `words`
  - [ ] `review_schedule`
  - [ ] `test_results`
  - [ ] `achievements`
- [ ] Verify all tables created with correct columns
- [ ] Enable RLS on each table
- [ ] Create RLS policies for each table (reference DATABASE_SCHEMA.md):
  - [ ] User SELECT own data
  - [ ] User INSERT own data
  - [ ] User UPDATE own data
  - [ ] User DELETE own data
  - [ ] Parent SELECT child data (read-only)
- [ ] Test RLS policies:
  - [ ] Log in as child, verify can INSERT to `words`
  - [ ] Log in as parent, verify can SELECT child's `words` (read-only)

**Deliverable:** All database tables created, RLS policies enforced, tested

---

### Day 4: Authentication Flow
- [ ] Create two test user accounts in Supabase Auth:
  - [ ] Learner 1: `learner1@example.com` / password
  - [ ] Learner 2: `learner2@example.com` / password
- [ ] Manually create profile rows for each user:
  ```sql
  INSERT INTO profiles (id, role, display_name)
  VALUES ('learner1-uuid', 'learner', 'Learner 1'), ('learner2-uuid', 'learner', 'Learner 2')
  ```
- [ ] Create `js/auth.js`:
  - [ ] `async function login(email, password)` — calls Supabase Auth
  - [ ] `async function logout()` — Supabase Auth logout
  - [ ] `async function getCurrentUser()` — get current session
  - [ ] `async function getUserRole()` — query `profiles` table for role
  - [ ] `function redirectBasedOnRole(role)` — redirect to child or parent dashboard
- [ ] Create login page (`pages/login.js`):
  - [ ] HTML: email input, password input, sign-in button
  - [ ] Event listener on sign-in button
  - [ ] Call `login()` from auth.js
  - [ ] On success, call `redirectBasedOnRole()`
  - [ ] On error, show error message
- [ ] Test login:
  - [ ] Login as child, verify redirected to `/child/home`
  - [ ] Login as parent, verify redirected to `/parent/dashboard`
  - [ ] Logout, verify redirected to login page

**Deliverable:** Full auth flow working, users can log in/out based on role

---

### Day 5: Router Setup
- [ ] Create `js/app.js`:
  - [ ] Define routes object (map path to page module)
  - [ ] Create `render(path)` function that:
    - [ ] Imports the correct page module
    - [ ] Calls `page.render(container)` to render
  - [ ] Listen for `hashchange` event
  - [ ] On app load:
    - [ ] Check if user logged in
    - [ ] If not, redirect to `/login`
    - [ ] If yes, redirect based on role
  - [ ] Export `app` object with methods
- [ ] Test router:
  - [ ] Load app, should go to login page
  - [ ] Log in, should go to appropriate dashboard
  - [ ] Change URL hash manually (e.g., `#/child/home`), should render correctly
  - [ ] Logout, should go back to login page

**Deliverable:** Hash-based router fully functional, handles role-based redirects

---

### Day 6: Create Child Home Page Skeleton
- [ ] Create `pages/child-home.js`:
  - [ ] Export `render(container)` function
  - [ ] Fetch user session and profile
  - [ ] Fetch basic stats (XP count, word count, mastered count, due count, streak)
  - [ ] Render HTML structure:
    - [ ] Greeting card
    - [ ] Stats cards (Words Added, Mastered, Due Today)
    - [ ] Action buttons (Add Word, Review Today)
    - [ ] Due words list
    - [ ] Quick menu buttons
  - [ ] Attach event listeners to buttons
    - [ ] Add Word → navigate to `/child/add-word`
    - [ ] Review Today → navigate to `/child/review`
    - [ ] Quick menu buttons → navigate to respective pages
- [ ] Create placeholder pages for:
  - [ ] `pages/add-word.js` (minimal structure)
  - [ ] `pages/word-list.js`
  - [ ] `pages/review.js`
  - [ ] `pages/quiz.js`
  - [ ] `pages/garden.js`
  - [ ] `pages/achievements.js`
  - [ ] `pages/parent-dashboard.js`
- [ ] Style child-home page:
  - [ ] Use CSS variables for colors
  - [ ] Make stats cards attractive and large
  - [ ] Make buttons touch-friendly
  - [ ] Responsive mobile-first design
- [ ] Test child-home page:
  - [ ] Log in as child
  - [ ] Verify stats display correctly
  - [ ] Click buttons, verify navigation

**Deliverable:** Child home page renders with correct stats, navigation works

---

### Day 7: Header Component & Styling
- [ ] Create reusable header component (`js/components/header.js`):
  - [ ] Displays logo, XP bar, level badge, user menu
  - [ ] XP bar shows current XP / next level XP
  - [ ] Level badge shows current level (1–5)
  - [ ] User menu has profile and logout options
- [ ] Update `style.css`:
  - [ ] Header styles (fixed/sticky positioning, color, layout)
  - [ ] Footer styles (if used)
  - [ ] Page container layout
  - [ ] Base card styles
  - [ ] Button base styles (primary, secondary, danger)
- [ ] Add header to all pages:
  - [ ] Update child-home to include header
  - [ ] Update placeholder pages to include header
- [ ] Test header:
  - [ ] Verify displays on all pages
  - [ ] Verify XP bar updates correctly
  - [ ] Verify logout works

**Deliverable:** Consistent header on all pages, styling consistent

---

## Week 2: Word Management

### Day 8: Add Word Page — Manual Entry
- [ ] Create `pages/add-word.js`:
  - [ ] Render word input form:
    - [ ] Text input for word
    - [ ] Submit button
  - [ ] On submit:
    - [ ] Render preview card with empty fields
    - [ ] Show editable form fields:
      - [ ] Word
      - [ ] Part of speech
      - [ ] English definition
      - [ ] Chinese definition
      - [ ] Example sentence
      - [ ] Category dropdown
      - [ ] Favorite checkbox
    - [ ] Save button, Cancel button
  - [ ] On save:
    - [ ] INSERT into `words` table
    - [ ] INSERT into `review_schedule` table
    - [ ] Show toast: "+1 XP"
    - [ ] Redirect to home or stay on page
- [ ] Style add-word page:
  - [ ] Clean form layout
  - [ ] Editable fields with good contrast
  - [ ] Large buttons for easy interaction
- [ ] Test add-word page:
  - [ ] Enter word manually, verify saves to database
  - [ ] Check `words` table in Supabase dashboard
  - [ ] Check `review_schedule` created with level=0

**Deliverable:** Users can add words manually to their list

---

### Day 9: Edge Function — /lookup-word
- [ ] In Supabase dashboard → Functions → Create function
  - [ ] Name: `lookup-word`
  - [ ] Runtime: Deno
  - [ ] HTTP method: POST
- [ ] Write Edge Function code (reference TECHNICAL_ARCHITECTURE.md):
  ```typescript
  // POST /lookup-word
  // Input: { word: string }
  // Step 1: Call Free Dictionary API
  // Step 2: Extract English definition + POS
  // Step 3: Call MyMemory API with English definition
  // Step 4: Extract Chinese translation
  // Step 5: Return combined object
  // Error handling: 404 → return error, other errors → partial response
  ```
- [ ] Test Edge Function:
  - [ ] Call from Postman or browser console
  - [ ] Test with valid word (e.g., "curious")
  - [ ] Test with invalid word (e.g., "xyzabc")
  - [ ] Verify response format
  - [ ] Check rate limits and error handling

**Deliverable:** Edge Function callable and returning correct data

---

### Day 10: Add Word Page — Auto-Lookup
- [ ] Update `pages/add-word.js`:
  - [ ] Add debounced auto-lookup on word input change (300ms delay)
  - [ ] Show loading spinner while fetching
  - [ ] Call Edge Function: `POST /lookup-word`
  - [ ] On success:
    - [ ] Populate preview card with data
    - [ ] Allow editing
  - [ ] On 404 error:
    - [ ] Show "Word not found" message
    - [ ] Show empty form for manual entry
  - [ ] On network error:
    - [ ] Show error message
    - [ ] Allow retry or manual entry
- [ ] Update styling:
  - [ ] Loading spinner (CSS animation)
  - [ ] Error message styling (red background)
  - [ ] Preview card styling
- [ ] Test auto-lookup:
  - [ ] Type "curious", wait for lookup, verify data populated
  - [ ] Type "xyzabc", verify 404 handling
  - [ ] Disconnect internet, test error handling
  - [ ] Edit fields before saving, verify changes are saved

**Deliverable:** Auto-lookup feature working, graceful error handling

---

### Day 11: Word List Page
- [ ] Create `pages/word-list.js`:
  - [ ] Fetch all words for current user
  - [ ] Render word cards:
    - [ ] Word + part of speech (large, bold)
    - [ ] English definition (1–2 lines)
    - [ ] Review level badge
    - [ ] Next review date
    - [ ] Star button (toggle favorite)
    - [ ] Delete button
  - [ ] Search functionality:
    - [ ] Filter words as user types in search box
    - [ ] Case-insensitive matching
  - [ ] Filter dropdown:
    - [ ] All | Favorites | Mastered | Due Today | By Category
  - [ ] Pagination:
    - [ ] Load 10 words initially
    - [ ] "Load More" button at bottom
  - [ ] Delete functionality:
    - [ ] Show confirmation dialog
    - [ ] DELETE from `words` table (cascades to `review_schedule`)
    - [ ] Refresh list
- [ ] Style word-list page:
  - [ ] Clean card layout
  - [ ] Good spacing
  - [ ] Responsive grid on desktop
- [ ] Test word-list page:
  - [ ] Add several words, verify all displayed
  - [ ] Search filters correctly
  - [ ] Filter dropdown works
  - [ ] Star button toggles `is_favorite`
  - [ ] Delete removes word from list and database

**Deliverable:** Users can browse, search, filter, and manage their words

---

### Day 12: SRS Logic Module
- [ ] Create `js/lib/srs.js`:
  - [ ] Define `SRS_LADDER` constant:
    ```javascript
    export const SRS_LADDER = {
      0: 1,    // New: 1 day
      1: 3,    // Level 1: 3 days
      2: 7,    // Level 2: 7 days
      3: 14,   // Level 3: 14 days
      4: 30,   // Level 4: 30 days
      5: 60    // Level 5+: mastered
    }
    ```
  - [ ] `calculateNextReview(currentLevel, correct)` function:
    - [ ] If correct: nextLevel = min(currentLevel + 1, 5)
    - [ ] If incorrect: nextLevel = 0
    - [ ] Get interval from ladder
    - [ ] Calculate next_review_date (today + interval)
    - [ ] Return object: { nextLevel, intervalDays, nextDate }
  - [ ] `isMastered(level)` function: return level >= 4
  - [ ] Export functions for use in other modules
- [ ] Test SRS logic:
  - [ ] Test with different levels and correct/incorrect
  - [ ] Verify dates calculated correctly

**Deliverable:** SRS scheduling logic module ready for use

---

### Day 13: Query Due Words
- [ ] Create utility function in `supabase.js`:
  ```javascript
  export async function getDueWords(userId) {
    return supabase
      .from('review_schedule')
      .select('word_id, next_review_date, review_level')
      .eq('user_id', userId)
      .lte('next_review_date', new Date().toISOString().split('T')[0])
      .order('next_review_date', { ascending: true })
  }
  ```
- [ ] Create utility to get word details:
  ```javascript
  export async function getWordsByIds(wordIds) {
    return supabase
      .from('words')
      .select('*')
      .in('id', wordIds)
  }
  ```
- [ ] Test queries:
  - [ ] Add words with different `next_review_date` values
  - [ ] Query due words, verify only returns words with next_review_date <= today
  - [ ] Verify data structure

**Deliverable:** Database queries for SRS working correctly

---

### Day 14: Review Session Page Structure
- [ ] Create `pages/review.js`:
  - [ ] On load:
    - [ ] Fetch due words
    - [ ] If none due, show "All caught up!" message with link to add words
    - [ ] Else, load first word
  - [ ] Render review card:
    - [ ] Word (large, 48px)
    - [ ] Part of speech + current level
    - [ ] English definition
    - [ ] Chinese definition
    - [ ] Example sentence
    - [ ] Progress: "Word X of Y"
  - [ ] Render action buttons:
    - [ ] "✓ Got it" (green)
    - [ ] "✗ Didn't get it" (red)
  - [ ] Implement next word logic:
    - [ ] On "Got it" or "Didn't get it":
      - [ ] Calculate next review date (SRS)
      - [ ] INSERT into `test_results` (correct = true/false)
      - [ ] UPDATE `review_schedule`
      - [ ] Load next word or show summary
- [ ] Style review page:
  - [ ] Large buttons with clear semantics
  - [ ] Card centered and readable
  - [ ] Progress indicator
- [ ] Test review session:
  - [ ] Start review with due words
  - [ ] Click "Got it", verify next word loads
  - [ ] Check database for inserted test_results
  - [ ] Verify review_schedule updated correctly

**Deliverable:** Review session flow working, SRS scheduling updates database

---

## Week 3: Review & Quiz

### Day 15: Review Session Summary
- [ ] Update `pages/review.js`:
  - [ ] After all words reviewed, render summary screen:
    - [ ] Total reviewed count
    - [ ] Correct count + percentage
    - [ ] XP breakdown:
      - [ ] X reviews * 2 XP = Y XP
      - [ ] Z correct * 3 XP = W XP
      - [ ] Total XP earned
    - [ ] Level up notification (if applicable)
  - [ ] Add buttons:
    - [ ] "Back Home"
    - [ ] "Take Quiz"
- [ ] Calculate and display level change:
  - [ ] Before review, get current XP
  - [ ] After review, recalculate XP
  - [ ] Compare levels, show "Level Up!" if changed
- [ ] Test review summary:
  - [ ] Complete a review session
  - [ ] Verify stats calculate correctly
  - [ ] Verify XP earned display
  - [ ] Verify level up notification

**Deliverable:** Review session complete with summary and XP earned

---

### Day 16: XP Calculation Module
- [ ] Create `js/lib/xp.js`:
  - [ ] Define level thresholds:
    ```javascript
    export const LEVEL_THRESHOLDS = {
      1: 0,      // Explorer
      2: 50,     // Adventurer
      3: 150,    // Scholar
      4: 350,    // Word Master
      5: 700     // Vocabulary Wizard
    }
    ```
  - [ ] `calculateTotalXP(userId)` async function:
    - [ ] Query word count (each word = 1 XP)
    - [ ] Query test_results count (each = 2 XP)
    - [ ] Query correct answers count (each = 3 XP)
    - [ ] Total = (words * 1) + (tests * 2) + (correct * 3)
    - [ ] Return total XP
  - [ ] `getLevel(totalXP)` function:
    - [ ] Iterate through levels, return highest level for XP
  - [ ] `getLevelInfo(level)` function:
    - [ ] Return { name, color, next_threshold }
  - [ ] Export functions
- [ ] Test XP calculations:
  - [ ] Add words, complete reviews, verify XP totals
  - [ ] Check level calculation at different XP values

**Deliverable:** XP calculation working, can determine user's level

---

### Day 17: Quiz Session Page — Meaning Quiz
- [ ] Create `pages/quiz.js`:
  - [ ] On load:
    - [ ] Prompt user: "How many questions? (default 5)"
    - [ ] Fetch random words from `words` table (any words, not just due)
    - [ ] Randomly select quiz type for each word (for now, meaning only)
  - [ ] Render meaning quiz question:
    - [ ] Show word
    - [ ] Show 4 multiple choice options (A, B, C, D)
    - [ ] Option buttons
  - [ ] On answer:
    - [ ] Check if correct
    - [ ] INSERT into `test_results`
    - [ ] Show result feedback ("✓ Correct!" or "✗ Incorrect. The answer is...")
    - [ ] Move to next question
  - [ ] After all questions:
    - [ ] Render summary (score, XP earned, breakdown by type)
    - [ ] Show "Back Home" and "Another Quiz" buttons
- [ ] Implement multiple choice logic:
  - [ ] For each word, pick correct answer + 3 random distractors
  - [ ] Shuffle options
  - [ ] Render as A, B, C, D buttons
- [ ] Style quiz page:
  - [ ] Large buttons for options
  - [ ] Clear feedback for correct/incorrect
  - [ ] Progress indicator
- [ ] Test quiz:
  - [ ] Start quiz, answer questions
  - [ ] Verify test_results inserted with correct=true/false
  - [ ] Verify summary shows correct score

**Deliverable:** Meaning quiz type working, can answer and track results

---

### Day 18: Quiz Session Page — Spelling Quiz
- [ ] Update `pages/quiz.js`:
  - [ ] Add spelling quiz type:
    - [ ] Show English definition or Chinese definition
    - [ ] Text input for user to type spelling
    - [ ] "Hint" button (reveals one random letter)
    - [ ] "Submit" button
  - [ ] On submit:
    - [ ] Compare answer with `word` field (case-insensitive, trim)
    - [ ] INSERT into `test_results`
    - [ ] Show result feedback
    - [ ] Move to next question
  - [ ] Implement hint logic:
    - [ ] Pick random letter from word
    - [ ] Reveal in text input
    - [ ] Only allow one hint per question
- [ ] Test spelling quiz:
  - [ ] Start quiz, verify spelling questions appear
  - [ ] Answer correctly (case-insensitive test)
  - [ ] Use hint, verify letter revealed
  - [ ] Verify test_results recorded correctly

**Deliverable:** Spelling quiz type working, hint system implemented

---

### Day 19: Quiz Session Page — Listening Quiz
- [ ] Update `pages/quiz.js`:
  - [ ] Add listening quiz type:
    - [ ] Use SpeechSynthesis API
    - [ ] Render "🔊 Listen" buttons (allow multiple plays)
    - [ ] Text input for typing spelling
    - [ ] "Submit" button
  - [ ] On load of listening question:
    - [ ] Auto-play word once (or manually with Play button)
  - [ ] On submit:
    - [ ] Same logic as spelling quiz
    - [ ] Compare with `word` field
    - [ ] INSERT into `test_results`
  - [ ] Implement SpeechSynthesis:
    - [ ] Create `SpeechSynthesisUtterance` with word
    - [ ] Set language to English
    - [ ] Call `window.speechSynthesis.speak()`
- [ ] Test listening quiz:
  - [ ] Start quiz, verify listening questions appear
  - [ ] Click Play button, verify audio plays
  - [ ] Type answer and submit
  - [ ] Verify test_results recorded

**Deliverable:** Listening quiz type working, audio playback implemented

---

### Day 20: Quiz Session — Random Type Selection
- [ ] Update `pages/quiz.js`:
  - [ ] Modify quiz type selection:
    - [ ] For each question, randomly pick type:
      - [ ] 50% chance: Meaning
      - [ ] 25% chance: Spelling
      - [ ] 25% chance: Listening
  - [ ] Render appropriate question type for each word
- [ ] Test random selection:
  - [ ] Run multiple quizzes, verify mix of question types
  - [ ] Verify all types render correctly

**Deliverable:** Quiz sessions have variety with random question types

---

### Day 21: Quiz Session Summary & XP
- [ ] Update `pages/quiz.js`:
  - [ ] Calculate XP for quiz:
    - [ ] Each correct answer = 3 XP
    - [ ] Each question completion = 2 XP (separate from correct XP)
  - [ ] Render summary:
    - [ ] Total score (X/Y)
    - [ ] Accuracy percentage
    - [ ] XP breakdown by type
    - [ ] Level change notification
  - [ ] Add buttons:
    - [ ] "Back Home"
    - [ ] "Another Quiz"
- [ ] Test quiz summary:
  - [ ] Complete quiz, verify XP calculated
  - [ ] Verify breakdown shows per-type stats
  - [ ] Check for level up

**Deliverable:** Quiz sessions track XP and show detailed summary

---

## Week 4: Gamification (XP & Levels)

### Day 22: Display XP in Header
- [ ] Update header component:
  - [ ] Show XP bar: "120 / 150 XP" (current / next level)
  - [ ] Show level badge: "Level 2"
  - [ ] On navigation, update header stats
- [ ] Add function to refresh XP display:
  - [ ] Call `calculateTotalXP()` and `getLevel()`
  - [ ] Update header HTML
- [ ] Test header XP display:
  - [ ] Add words, complete reviews, verify XP updates
  - [ ] Check level badge changes correctly

**Deliverable:** Header shows current XP and level

---

### Day 23: Display XP on Home Page
- [ ] Update `pages/child-home.js`:
  - [ ] Add XP card to stats:
    - [ ] Show "Current XP: 120"
    - [ ] Show "Level: 2 Adventurer"
    - [ ] Show level name and description
  - [ ] Add visual level badge:
    - [ ] Use color coded by level
    - [ ] Show level name and icon
- [ ] Test home page XP display:
  - [ ] Verify XP displays correctly
  - [ ] Verify level displays with correct name

**Deliverable:** Home page shows XP and level prominently

---

### Day 24: Achievements Module
- [ ] Create `js/lib/achievements.js`:
  - [ ] Define achievement codes:
    ```javascript
    export const ACHIEVEMENT_CODES = {
      BRONZE_100: { name: 'Bronze Badge', threshold: 100 },
      SILVER_500: { name: 'Silver Badge', threshold: 500 },
      GOLD_1000: { name: 'Gold Badge', threshold: 1000 },
      PLATINUM_2000: { name: 'Platinum Badge', threshold: 2000 },
      PERFECT_WEEK: { name: 'Perfect Week' },
      SPEED_READER: { name: 'Speed Reader' },
      WORD_COLLECTOR: { name: 'Word Collector' },
      STREAK_7: { name: '7-Day Streak', days: 7 },
      STREAK_30: { name: '30-Day Streak', days: 30 },
      STREAK_100: { name: '100-Day Streak', days: 100 }
    }
    ```
  - [ ] `checkNewAchievements(userId)` async function:
    - [ ] Check word count milestones
    - [ ] Check streak milestones
    - [ ] Check other special achievements
    - [ ] Return array of new achievements
  - [ ] `addAchievement(userId, code)` async function:
    - [ ] INSERT into `achievements` table (if not already earned)
  - [ ] `getUserAchievements(userId)` async function:
    - [ ] SELECT all achievements for user
- [ ] Test achievements:
  - [ ] Add 100 words, check for BRONZE_100 achievement
  - [ ] Verify achievement inserted in database

**Deliverable:** Achievement checking logic works, can track unlocks

---

### Day 25: Streak Calculation
- [ ] Update `js/lib/achievements.js`:
  - [ ] Add streak calculation logic:
    - [ ] Query test_results for last N days
    - [ ] For each day, check if has any test result (reviewed or quizzed)
    - [ ] Count consecutive days from today backwards
    - [ ] Return streak count
  - [ ] `calculateStreak(userId)` async function
  - [ ] `updateLastActiveDate(userId)` function:
    - [ ] Store last active date in localStorage or database
    - [ ] Called after each review or quiz
- [ ] Test streak:
  - [ ] Complete a review on a certain date
  - [ ] Next day, complete another review
  - [ ] Query streak, should return 2
  - [ ] Miss a day, verify streak resets

**Deliverable:** Streak calculation working, updates after each activity

---

### Day 26: Display Streak on Home Page
- [ ] Update `pages/child-home.js`:
  - [ ] Query current streak
  - [ ] Display on greeting card:
    - [ ] "You're on a 5-day streak! 🔥"
  - [ ] Update after review/quiz
- [ ] Test streak display:
  - [ ] Complete reviews on multiple days
  - [ ] Verify streak displays and updates correctly
  - [ ] Verify 🔥 emoji displays

**Deliverable:** Home page shows current streak with emoji

---

### Day 27: Medals Page
- [ ] Create `pages/achievements.js`:
  - [ ] Display medals in grid (2-4 columns responsive)
  - [ ] For each medal (Bronze, Silver, Gold, Platinum):
    - [ ] If earned: Show glowing badge with earned date
    - [ ] If not earned: Show grayed out badge with unlock condition
  - [ ] Display special badges:
    - [ ] Perfect Week, Speed Reader, Word Collector
    - [ ] Streaks (7-day, 30-day, 100-day)
    - [ ] Show earned date or unlock condition
  - [ ] For in-progress achievements, show progress bar
- [ ] Implement badge logic:
  - [ ] Query user achievements and stats
  - [ ] Determine earned/locked/in-progress for each badge
  - [ ] Display appropriately
- [ ] Style achievements page:
  - [ ] Grid layout with cards
  - [ ] Earned badges: Glowing, colorful
  - [ ] Locked badges: Grayed out, muted
  - [ ] Progress bars for in-progress
- [ ] Test achievements page:
  - [ ] Earn an achievement, verify displays
  - [ ] Check locked badges show conditions

**Deliverable:** Achievements page displays all badges and progress

---

### Day 28: Check & Notify New Achievements
- [ ] After each review or quiz:
  - [ ] Call `checkNewAchievements(userId)`
  - [ ] For each new achievement:
    - [ ] Call `addAchievement(userId, code)`
    - [ ] Show toast notification: "🏆 Achievement Unlocked: [Name]"
  - [ ] Check for level up notification
- [ ] Test achievement notifications:
  - [ ] Earn an achievement, verify toast notification shows
  - [ ] Complete enough tests to level up, verify notification

**Deliverable:** Achievements earned and users notified in real-time

---

## Week 5: Streaks & Medals Integration

### Day 29: Validate Streak Requirements
- [ ] Refine streak calculation:
  - [ ] Query test_results for each day in past N days
  - [ ] Check if has ANY test result (quiz or review)
  - [ ] Count consecutive days from today backwards with activity
  - [ ] Handle missing day → streak breaks
- [ ] Test streak edge cases:
  - [ ] Complete activity today, verify streak = 1
  - [ ] Complete activity on day 1 and day 3 (skip day 2), verify streak = 1
  - [ ] Complete multiple activities in one day, still counts as 1 day

**Deliverable:** Streak calculation handles edge cases correctly

---

### Day 30: Word Count Milestones
- [ ] Verify medal achievements check word count:
  - [ ] After adding word, check if word count hits 100, 500, 1000, 2000
  - [ ] Unlock corresponding medal
  - [ ] Prevent duplicate medals (unique constraint in DB)
- [ ] Test milestones:
  - [ ] Manually insert 100 words, check achievement
  - [ ] Verify only one BRONZE_100 achievement even if add more checks

**Deliverable:** Word count milestones tracked, medals awarded

---

### Day 31: Special Badges (Perfect Week, Speed Reader, Word Collector)
- [ ] Implement Perfect Week:
  - [ ] Check if user has 7 consecutive days with at least one review/test
  - [ ] Award PERFECT_WEEK if true
- [ ] Implement Speed Reader:
  - [ ] Check if user completed 100+ tests in a single day
  - [ ] Award SPEED_READER if true
- [ ] Implement Word Collector:
  - [ ] Check if user has added 1000+ unique words
  - [ ] Award WORD_COLLECTOR if true
- [ ] Add these checks after each review/quiz

**Deliverable:** Special badges can be earned based on user activity

---

### Day 32: Home Page Complete
- [ ] Update `pages/child-home.js` with all gamification:
  - [ ] XP bar in header
  - [ ] Level badge
  - [ ] Streak display with 🔥
  - [ ] Recent achievement notifications
  - [ ] Stats cards updated
- [ ] Style home page:
  - [ ] Colorful and engaging
  - [ ] Large, readable text
  - [ ] Good contrast for accessibility
- [ ] Test full home page:
  - [ ] All stats display correctly
  - [ ] Refresh page, stats persist
  - [ ] Verify responsive on mobile

**Deliverable:** Child home page complete with full gamification

---

## Week 6: Word Garden

### Day 33: Query Mastered Words
- [ ] Create utility function:
  - [ ] `getMasteredWordCount(userId)` async
  - [ ] Query `review_schedule` where review_level >= 4
  - [ ] Return count
  - [ ] `getMasteredWords(userId)` returns list of mastered word objects
- [ ] Test mastered word queries:
  - [ ] Add word, complete enough reviews to reach level 4
  - [ ] Query mastered count, should be 1

**Deliverable:** Can query and count mastered words

---

### Day 34: Garden SVG Rendering
- [ ] Create `js/lib/garden.js`:
  - [ ] Define garden stages:
    ```javascript
    export const GARDEN_STAGES = {
      empty: { name: 'Empty Garden', threshold: 0 },
      seeds: { name: 'Seeds', threshold: 1, icon: '🌱' },
      sprouts: { name: 'Sprouts', threshold: 10, icon: '🌿' },
      flowers: { name: 'Flowers', threshold: 50, icon: '🌸' },
      trees: { name: 'Trees', threshold: 100, icon: '🌳' },
      forest: { name: 'Forest', threshold: 500, icon: '🌲' }
    }
    ```
  - [ ] `getGardenStage(masteredCount)` function:
    - [ ] Return stage name based on count
  - [ ] `generateGardenSVG(stage, masteredCount)` function:
    - [ ] Return SVG markup for garden visualization
    - [ ] For seeds: Generate N dots based on count
    - [ ] For sprouts: Generate N small green shapes
    - [ ] For flowers: Generate N colorful blooms
    - [ ] For trees: Generate N tree shapes
    - [ ] For forest: Generate dense forest
- [ ] Test garden rendering:
  - [ ] Generate SVG for each stage
  - [ ] Verify appears correctly in browser

**Deliverable:** Garden SVG rendering works for all stages

---

### Day 35: Garden Page
- [ ] Create `pages/garden.js`:
  - [ ] On load:
    - [ ] Fetch mastered word count
    - [ ] Determine garden stage
    - [ ] Fetch list of mastered words
  - [ ] Render garden page:
    - [ ] Heading: "Your Word Garden"
    - [ ] Mastered word count display
    - [ ] Current stage name
    - [ ] SVG garden visualization (centered, scaled)
    - [ ] Progress bar: "X / Y (next stage)"
    - [ ] List of mastered words
    - [ ] Encouragement message
  - [ ] Make SVG interactive:
    - [ ] Hover over plants to see word (tooltip)
    - [ ] Click plant to see word details
- [ ] Style garden page:
  - [ ] Large, colorful visualization
  - [ ] Good contrast for readability
  - [ ] Progress bar animated
- [ ] Test garden page:
  - [ ] Verify garden displays for different mastered counts
  - [ ] Verify progress bar shows correct stage
  - [ ] Verify mastered words list displays

**Deliverable:** Garden page fully functional and beautiful

---

### Day 36: Garden Growth Animation
- [ ] Update garden SVG rendering:
  - [ ] When new word reaches mastery (review_level becomes 4):
    - [ ] Fetch updated mastered count
    - [ ] Render new garden SVG (with added plant)
    - [ ] Animate new plant appearing (scale-up animation)
  - [ ] Update page automatically when review_schedule is updated
- [ ] Implement update listener:
  - [ ] After review completes and SRS updates, refresh garden
  - [ ] Use Supabase real-time subscriptions (optional) or manual refresh
- [ ] Test garden growth:
  - [ ] Complete reviews to reach mastery level on new word
  - [ ] Verify garden updates with new plant
  - [ ] Verify animation plays

**Deliverable:** Garden grows with new mastered words, animated transitions

---

## Week 7: Enhanced Quizzes

### Day 37: Listening Quiz Refinement
- [ ] Test listening quiz on different browsers
- [ ] Verify SpeechSynthesis works in:
  - [ ] Chrome/Edge
  - [ ] Safari
  - [ ] Firefox
- [ ] Add fallback if SpeechSynthesis not available:
  - [ ] Show message: "Audio not available in your browser"
- [ ] Test quiz with audio:
  - [ ] Play audio, verify correct word is spoken
  - [ ] Type spelling, submit
  - [ ] Verify recorded correctly

**Deliverable:** Listening quiz works across browsers

---

### Day 38: Hint System Refinement
- [ ] Test hint system:
  - [ ] Pick random letter from word
  - [ ] Verify only one hint per question
  - [ ] Reset hint for next question
  - [ ] Spelling quiz has hint button
- [ ] Improve hint UX:
  - [ ] Show hint button disabled after used
  - [ ] Show message: "Hint used (1 available)"
  - [ ] Highlight revealed letter in input field
- [ ] Test hint across quiz types:
  - [ ] Only spelling/listening have hints
  - [ ] Multiple choice does not

**Deliverable:** Hint system fully functional and intuitive

---

### Day 39: Quiz Statistics Page (Optional)
- [ ] Create `pages/quiz-stats.js` (optional enhancement):
  - [ ] Show recent quiz results
  - [ ] Accuracy by quiz type (Meaning, Spelling, Listening)
  - [ ] Trending accuracy (chart)
  - [ ] Most missed words
  - [ ] Best performing categories
- [ ] Test quiz stats page:
  - [ ] Take multiple quizzes
  - [ ] Verify stats calculated correctly

**Deliverable:** Optional quiz stats page for deeper insights

---

### Day 40: Quiz Type Balancing
- [ ] Ensure random quiz type selection is balanced:
  - [ ] 50% Meaning, 25% Spelling, 25% Listening
  - [ ] Test over multiple quizzes to verify distribution
- [ ] Allow user to choose quiz type (optional):
  - [ ] Before quiz starts, offer "Practice Type" dropdown
  - [ ] "All Mix", "Meaning Only", "Spelling Only", "Listening Only"

**Deliverable:** Quiz types balanced and user can customize if desired

---

## Week 8: Parent Dashboard

### Day 41: Parent Dashboard Setup
- [ ] Create `pages/parent-dashboard.js`:
  - [ ] On load:
    - [ ] Verify user is parent role
    - [ ] Query learners' statistics
  - [ ] Render header: "Learner's Learning Dashboard"
  - [ ] Render quick stats cards:
    - [ ] Words Added (total)
    - [ ] Mastered Words (count)
    - [ ] Current Streak (days)
    - [ ] Total XP (number)
  - [ ] Import Chart.js from CDN
- [ ] Test parent dashboard load:
  - [ ] Log in as parent
  - [ ] Verify stats display correctly
  - [ ] Verify only parent can access `/parent/dashboard`

**Deliverable:** Parent dashboard loads with quick stats

---

### Day 42: Chart 1 — Words Added per Day (30-day)
- [ ] In `pages/parent-dashboard.js`:
  - [ ] Query words added per day for last 30 days:
    ```javascript
    SELECT DATE(created_at), COUNT(*) FROM words
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ```
  - [ ] Parse results into chart format
  - [ ] Render bar chart using Chart.js:
    - [ ] X-axis: Dates
    - [ ] Y-axis: Word count
    - [ ] Bar color: Blue
  - [ ] Display on dashboard
- [ ] Test chart:
  - [ ] Add words on different days
  - [ ] Verify chart displays correct counts

**Deliverable:** 30-day word count bar chart displays on parent dashboard

---

### Day 43: Chart 2 — Test Accuracy by Type (Line Chart)
- [ ] In `pages/parent-dashboard.js`:
  - [ ] Query test results for last 30 days:
    ```javascript
    SELECT DATE(tested_at), test_type,
           COUNT(*) total,
           SUM(CASE WHEN correct THEN 1 ELSE 0 END) correct_count
    FROM test_results
    WHERE tested_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(tested_at), test_type
    ```
  - [ ] Calculate accuracy % for each type per day
  - [ ] Render line chart using Chart.js:
    - [ ] X-axis: Dates
    - [ ] Y-axis: Accuracy %
    - [ ] Separate lines for Meaning, Spelling, Listening
    - [ ] Different colors per type
  - [ ] Display on dashboard
- [ ] Test chart:
  - [ ] Take quizzes with different types
  - [ ] Verify accuracy calculates correctly
  - [ ] Verify chart displays trends

**Deliverable:** Test accuracy line chart displays on parent dashboard

---

### Day 44: Chart 3 — Review Completion per Week
- [ ] In `pages/parent-dashboard.js`:
  - [ ] Query reviews per week for last 12 weeks:
    ```javascript
    SELECT DATE_TRUNC('week', tested_at) week,
           COUNT(*) review_count
    FROM test_results
    WHERE tested_at >= NOW() - INTERVAL '12 weeks'
    GROUP BY DATE_TRUNC('week', tested_at)
    ```
  - [ ] Render line chart using Chart.js:
    - [ ] X-axis: Weeks
    - [ ] Y-axis: Reviews completed
    - [ ] Line color: Green
  - [ ] Display on dashboard
- [ ] Test chart:
  - [ ] Complete reviews on different weeks
  - [ ] Verify chart displays review counts per week

**Deliverable:** Review completion line chart displays on parent dashboard

---

### Day 45: CSV Export Functionality
- [ ] In `pages/parent-dashboard.js`:
  - [ ] Add "📥 Export as CSV" button
  - [ ] On click:
    - [ ] Query all child's words + review schedule
    - [ ] Query all child's test results
    - [ ] Format as CSV:
      ```
      Word,Part of Speech,English Definition,Chinese Definition,
      Category,Words Added Date,Current Level,Next Review,
      Total Tests,Tests Correct,Accuracy %
      ```
    - [ ] Generate CSV blob
    - [ ] Trigger download with filename: `learner_words_export_[date].csv`
- [ ] Implement CSV generation:
  - [ ] Use JavaScript to build CSV string
  - [ ] Escape special characters
  - [ ] Create blob and download
- [ ] Test CSV export:
  - [ ] Click export button
  - [ ] Verify file downloads
  - [ ] Open in Excel/Sheets, verify data correct

**Deliverable:** Parent can export all data as CSV

---

## Week 9: Polish & Testing

### Day 46: Edge Cases & Error Handling
- [ ] Test edge cases:
  - [ ] Empty word list (no words added yet)
  - [ ] No reviews due today
  - [ ] Network disconnection during review
  - [ ] Invalid API response from Free Dictionary or MyMemory
  - [ ] User deletes word during active session
  - [ ] Multiple tabs open (session sync)
- [ ] Improve error messages:
  - [ ] Network error: "Check your internet connection"
  - [ ] API error: "That word wasn't found. Try another or enter manually."
  - [ ] Database error: "Something went wrong. Please try again."
- [ ] Test empty states:
  - [ ] "No words yet. Add your first word!"
  - [ ] "No reviews due today. Great job!"
  - [ ] "No achievements yet. Start learning!"
- [ ] Fix any bugs discovered

**Deliverable:** App handles edge cases gracefully

---

### Day 47: Responsive Design
- [ ] Test on different screen sizes:
  - [ ] Mobile (375px – 600px)
  - [ ] Tablet (600px – 1024px)
  - [ ] Desktop (1024px+)
- [ ] Test on different devices:
  - [ ] iPhone
  - [ ] Android phone
  - [ ] iPad
  - [ ] Desktop browsers
- [ ] Verify:
  - [ ] Touch targets are large enough (48px+)
  - [ ] Text is readable (at least 16px)
  - [ ] Buttons don't overflow on small screens
  - [ ] Charts scale properly
  - [ ] Header and footer work well
- [ ] Fix responsive issues:
  - [ ] Media queries for mobile
  - [ ] Adjust button sizes
  - [ ] Stack columns on mobile

**Deliverable:** App works well on all screen sizes

---

### Day 48: Accessibility Audit
- [ ] Check color contrast:
  - [ ] Use WebAIM contrast checker
  - [ ] Text vs background at least 4.5:1
  - [ ] Fix any contrast issues
- [ ] Keyboard navigation:
  - [ ] Tab through all pages
  - [ ] Can reach all buttons via keyboard
  - [ ] Focus indicators visible
- [ ] Screen reader testing:
  - [ ] Test with NVDA (Windows) or VoiceOver (Mac)
  - [ ] Verify semantic HTML used
  - [ ] Alt text on images
  - [ ] Form labels present
- [ ] Fix accessibility issues

**Deliverable:** App meets WCAG AA accessibility standards

---

### Day 49: Performance Optimization
- [ ] Audit performance:
  - [ ] Use Chrome DevTools Lighthouse
  - [ ] Check page load time
  - [ ] Check FCP (First Contentful Paint)
  - [ ] Check TTI (Time to Interactive)
- [ ] Optimize:
  - [ ] Minimize CSS (remove unused rules)
  - [ ] Cache API responses (localStorage)
  - [ ] Lazy load images
  - [ ] Reduce database queries where possible
  - [ ] Optimize SVG (garden visualization)
- [ ] Test performance:
  - [ ] Load times under 3 seconds
  - [ ] Smooth animations (60 FPS)
  - [ ] No lag when clicking buttons
- [ ] Fix performance issues

**Deliverable:** App loads and runs performantly

---

### Day 50: Browser Compatibility
- [ ] Test on different browsers:
  - [ ] Chrome (latest)
  - [ ] Safari (latest)
  - [ ] Firefox (latest)
  - [ ] Edge (latest)
- [ ] Verify:
  - [ ] All features work
  - [ ] No console errors
  - [ ] Styling consistent
  - [ ] SpeechSynthesis works (or graceful fallback)
  - [ ] Charts display correctly
- [ ] Fix browser compatibility issues:
  - [ ] Polyfills if needed (unlikely for modern browsers)
  - [ ] Test on older browser versions if required

**Deliverable:** App works on all major browsers

---

### Day 51: User Testing with Child
- [ ] Have child use app for 1–2 hours
- [ ] Observe:
  - [ ] Are they engaged?
  - [ ] Do they understand the UI?
  - [ ] Are any features confusing?
  - [ ] Do they like the colors and design?
  - [ ] Are buttons easy to tap?
- [ ] Get feedback:
  - [ ] What's your favorite feature?
  - [ ] What would you change?
  - [ ] Is the garden fun?
  - [ ] Are quizzes too easy/hard?
- [ ] Make adjustments:
  - [ ] Adjust colors if requested
  - [ ] Simplify UI if confusing
  - [ ] Adjust quiz difficulty
  - [ ] Fix any UX issues discovered

**Deliverable:** Child user feedback incorporated

---

### Day 52: Final Testing & QA
- [ ] Full end-to-end testing:
  - [ ] Create new account (child)
  - [ ] Add 20 words
  - [ ] Complete reviews on multiple days
  - [ ] Take quizzes, earn achievements
  - [ ] Reach new levels
  - [ ] Grow garden
  - [ ] View achievements page
- [ ] Parent testing:
  - [ ] Log in as parent
  - [ ] View dashboard charts
  - [ ] Export CSV
  - [ ] Verify parent can't edit child data
- [ ] Security testing:
  - [ ] Verify RLS policies work
  - [ ] Child can't access parent dashboard
  - [ ] Parent can't modify child words
  - [ ] Logout works, session cleared

**Deliverable:** App fully tested and ready for launch

---

### Day 53: Documentation & Deployment Prep
- [ ] Write setup instructions:
  - [ ] How to set up Supabase project
  - [ ] How to configure environment variables
  - [ ] How to deploy to Netlify or GitHub Pages
  - [ ] How to add initial users
- [ ] Prepare deployment:
  - [ ] Build static files (if applicable)
  - [ ] Minify CSS
  - [ ] Set up deployment pipeline
  - [ ] Configure custom domain
  - [ ] Set up HTTPS
- [ ] Create admin guide:
  - [ ] How to monitor usage
  - [ ] How to fix issues
  - [ ] How to add new users
- [ ] Prepare user manual for parent:
  - [ ] How to log in
  - [ ] How to view dashboard
  - [ ] How to export data
  - [ ] How to contact support

**Deliverable:** Documentation complete, deployment ready

---

### Day 54: Deployment & Launch
- [ ] Deploy frontend:
  - [ ] Push to GitHub
  - [ ] Deploy to Netlify or GitHub Pages
  - [ ] Verify all pages load
  - [ ] Verify API calls work
- [ ] Deploy backend:
  - [ ] Verify Edge Function deployed
  - [ ] Test API calls from production
- [ ] Final smoke test:
  - [ ] Create account
  - [ ] Add word (test API lookup)
  - [ ] Complete review
  - [ ] Take quiz
  - [ ] View all pages
  - [ ] Parent dashboard
  - [ ] Export CSV
- [ ] Launch:
  - [ ] Notify parent with login credentials
  - [ ] Provide support contact info
  - [ ] Monitor for any issues

**Deliverable:** App deployed and live

---

### Day 55: Post-Launch Monitoring
- [ ] Monitor for issues:
  - [ ] Check Supabase logs for errors
  - [ ] Check CDN performance
  - [ ] Monitor API usage (Free Dictionary, MyMemory)
- [ ] Gather initial feedback:
  - [ ] Child's experience
  - [ ] Parent's dashboard usefulness
  - [ ] Any bugs or issues?
- [ ] Make quick fixes if needed:
  - [ ] Bug fixes
  - [ ] Performance improvements
  - [ ] UX adjustments
- [ ] Plan Phase 2 enhancements:
  - [ ] Features for future releases
  - [ ] User feedback incorporation
  - [ ] Performance optimizations

**Deliverable:** App live and stable, ready for ongoing use

---

## Summary

**Total Tasks:** 183 individual checkboxes across 55 days of work
**Estimated Duration:** 9 weeks (Week 1–9)
**Team Size:** 1–2 developers (frontend + backend setup)
**Key Milestones:**
- Week 1: Foundation complete
- Week 2: Word management working
- Week 3: Review & quiz sessions complete
- Week 4: Gamification visible
- Week 5: Streaks & medals working
- Week 6: Garden visualization
- Week 7: Enhanced quizzes
- Week 8: Parent dashboard
- Week 9: Polish, test, launch

---

## Daily Standup Template

Use this at the end of each day:

```
**Date:** [Date]
**Completed Today:**
- [Task 1] ✓
- [Task 2] ✓
- [Task 3] ✓

**Blockers:** [Any issues?]
**Tomorrow's Focus:** [Next tasks]
```

---

## Resources & References

- Supabase Docs: https://supabase.com/docs
- Chart.js: https://www.chartjs.org/
- Free Dictionary API: https://freedictionaryapi.com/
- MyMemory API: https://mymemory.translated.net/
- ES Modules: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- SpeechSynthesis API: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- WCAG Accessibility: https://www.w3.org/WAI/WCAG21/quickref/

---

## Key Contacts & Escalation

- **Supabase Support:** https://supabase.com/support
- **API Issues:** Free Dictionary or MyMemory documentation
- **Deployment Issues:** Netlify or GitHub Pages support
- **UX/Design Questions:** Review COMPONENT_SPECS.md

---

