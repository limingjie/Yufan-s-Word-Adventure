# Vocabulary Learning App — AI Coding Guide

## Project Overview

A vocabulary learning website built for a single child (approximately age 10). The goal is to help him build English vocabulary through self-paced word collection, spaced repetition review, quizzes, and visual progress tracking. The parent has a separate view for monitoring progress.

**Design philosophy:** Simple, maintainable, and fun. This is not an enterprise product. Optimize for clarity of code and ease of future modification. Avoid over-engineering.

---

## Tech Stack

| Layer                | Choice                                        | Notes                                          |
| -------------------- | --------------------------------------------- | ---------------------------------------------- |
| Frontend             | Vanilla JS (SPA, no framework)                | Plain HTML + CSS + JS modules                  |
| Auth                 | Supabase Auth                                 | Email/password only                            |
| Database             | Supabase Postgres                             | With Row Level Security (RLS)                  |
| Backend logic        | Supabase Edge Functions (Deno)                | No separate Node server                        |
| Styling              | Plain CSS                                     | CSS variables for theming, no framework needed |
| English definitions  | Free Dictionary API (`freedictionaryapi.com`) | No key, no signup, 1,000 req/hr                |
| Chinese translations | MyMemory Translation API                      | No key, 5,000 chars/day anonymous              |
| Deployment           | Netlify or GitHub Pages                       | Static files + Supabase handles backend        |

**No build step required.** Use native ES modules (`<script type="module">`). No bundler, no npm, no React. The Supabase JS client can be loaded from a CDN.

---

## Architecture

```
Browser (Vanilla JS)
    │
    ├── Supabase Auth (login/session)
    │
    ├── Supabase Database (direct queries with RLS)
    │
    └── Supabase Edge Functions
              │
              └── /lookup-word
                        ├── freedictionaryapi.com  (English definition + part of speech)
                        └── api.mymemory.translated.net  (Chinese translation)
```

**Rule:** The browser never calls external APIs directly. All dictionary and translation calls go through a single Edge Function. This keeps the architecture clean and avoids any future key management issues even though MyMemory currently requires no key.

**Supabase JS client:** Load from CDN, no npm needed:
```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
</script>
```

---

## User Roles

There are exactly two users. No multi-tenancy needed.

### Learner
- Add words to their personal word list
- Take quizzes
- Review due words
- See his own progress, XP, level, streaks, and Word Garden

### Parent
- View all statistics and charts
- View test results
- Export data (CSV)
- Manage medals / achievements

**Implementation:** Use Supabase RLS. Each table has a `user_id` column. Policies restrict read/write to the owning user. A separate `role` field in a `profiles` table (`child` or `parent`) controls which UI views are shown.

---

## Database Schema

### `profiles`
```sql
id          uuid  PRIMARY KEY REFERENCES auth.users
role        text  CHECK (role IN ('child', 'parent'))
display_name text
created_at  timestamptz DEFAULT now()
```

### `words`
```sql
id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid  REFERENCES profiles(id)
word                text  NOT NULL
part_of_speech      text
english_definition  text
chinese_definition  text
example_sentence    text
category            text  -- e.g., 'animals', 'science', 'school'
is_favorite         boolean DEFAULT false
created_at          timestamptz DEFAULT now()
```

### `review_schedule`
```sql
id               uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id          uuid  REFERENCES words(id) ON DELETE CASCADE
next_review_date date  NOT NULL DEFAULT CURRENT_DATE
review_level     int   DEFAULT 0
ease_factor      float DEFAULT 2.5
interval_days    int   DEFAULT 1
created_at       timestamptz DEFAULT now()
```

### `test_results`
```sql
id          uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id     uuid  REFERENCES words(id) ON DELETE CASCADE
user_id     uuid  REFERENCES profiles(id)
test_type   text  CHECK (test_type IN ('meaning', 'spelling', 'listening'))
correct     boolean
response    text
tested_at   timestamptz DEFAULT now()
```

### `achievements`
```sql
id               uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id          uuid  REFERENCES profiles(id)
achievement_code text  NOT NULL
earned_at        timestamptz DEFAULT now()
```

**Achievement codes (define as constants in code):**
- `BRONZE_100`, `SILVER_500`, `GOLD_1000`, `PLATINUM_2000`
- `PERFECT_WEEK`, `SPEED_READER`, `WORD_COLLECTOR`
- `STREAK_7`, `STREAK_30`, `STREAK_100`

### `daily_stats` (optional — can be computed dynamically)
```sql
date                date  PRIMARY KEY
user_id             uuid  REFERENCES profiles(id)
words_added         int   DEFAULT 0
tests_completed     int   DEFAULT 0
reviews_completed   int   DEFAULT 0
```

---

## Spaced Repetition Logic

Use a simple, fixed-interval ladder. Do **not** implement full SM-2 unless specifically requested.

```
Level 0 (new):     review after 1 day
Level 1:           review after 3 days
Level 2:           review after 7 days
Level 3:           review after 14 days
Level 4:           review after 30 days
Level 5+:          mastered (still show in garden, rarely prompted)

On CORRECT answer:  level += 1, interval = ladder[level]
On WRONG answer:    level = 0, interval = 1
```

Store `next_review_date`, `review_level`, and `interval_days` in `review_schedule`. When the child completes a review, update these fields. "Due today" means `next_review_date <= CURRENT_DATE`.

---

## Word Lookup Flow

Two APIs are used together. Neither requires an API key. Both are called server-side from the Edge Function.

### API 1: Free Dictionary API (English definition)

```
GET https://api.freedictionaryapi.com/api/v2/entries/en/{word}
```

Parse from response:
- `[0].word` → the word
- `[0].meanings[0].partOfSpeech` → part of speech
- `[0].meanings[0].definitions[0].definition` → English definition
- `[0].meanings[0].definitions[0].example` → example sentence (may be absent)

### API 2: MyMemory Translation API (Chinese translation)

```
GET https://api.mymemory.translated.net/get?q={english_definition}&langpair=en|zh-CN
```

Translate the **English definition** (not just the word) for a more useful Chinese result. For example, translating `"eager to know or learn something"` gives better output than just translating `"curious"`.

Parse from response:
- `responseData.translatedText` → simplified Chinese translation

**Rate limits:**
- Free Dictionary API: 1,000 requests/hour, no key needed
- MyMemory: 5,000 characters/day anonymous. For a child doing 10–20 word lookups a day, this is more than sufficient. If needed, register a free email to raise the limit to 50,000 chars/day

### Full Lookup Flow

1. Child types a word (e.g., `curious`)
2. SPA calls Edge Function `POST /lookup-word` with `{ "word": "curious" }`
3. Edge Function calls Free Dictionary API → gets English definition and part of speech
4. Edge Function calls MyMemory API → translates the English definition to Chinese
5. Returns a single clean object to the browser:

```json
{
  "word": "curious",
  "part_of_speech": "adjective",
  "english_definition": "eager to know or learn something",
  "chinese_definition": "渴望了解或学习某事",
  "example_sentence": "The curious boy opened the box."
}
```

6. SPA shows a **preview card** with all fields. Child can edit any field before saving.
7. On confirm, SPA inserts into `words` table and creates a row in `review_schedule`.

**Edge cases:**
- If the Free Dictionary API returns 404 (word not found), show a friendly error and let the child enter the definition manually
- If MyMemory fails or returns a low-quality result (check `responseStatus !== 200`), leave the Chinese field blank and let the child fill it in
- Always allow manual editing of all fields before saving

---

## Quiz Types

### Meaning Quiz
- Show the word
- Present 4 multiple-choice options (1 correct + 3 random distractors from word list)
- If word list is too small for distractors, use hardcoded common words

### Spelling Quiz
- Show the Chinese definition (or English definition)
- Child types the spelling
- Compare with `word` field (case-insensitive, trim whitespace)
- Optionally show a hint: reveal one random letter

### Listening Quiz (Phase 2)
- Use browser `SpeechSynthesis` API to speak the word aloud
- Child types the spelling
- No external API needed

**Quiz session flow:**
1. Pull N words due for review (or let child choose "practice mode" for any words)
2. For each word, randomly pick quiz type
3. Track correct/incorrect, record in `test_results`
4. After session, show summary screen with XP earned

---

## Gamification

### XP System
```
Add a new word:     +1 XP
Complete a review:  +2 XP
Correct answer:     +3 XP
```

Compute XP dynamically from `words`, `test_results`, and `review_schedule` tables. No need to store a running total unless performance becomes an issue.

### Levels
```
Level 1  — Explorer       (0–49 XP)
Level 2  — Adventurer     (50–149 XP)
Level 3  — Scholar        (150–349 XP)
Level 4  — Word Master    (350–699 XP)
Level 5  — Vocabulary Wizard (700+ XP)
```

### Streaks
Track consecutive days with at least one review or test completed. Store last active date per user; compute streak on login.

### Medals (word count milestones)
```
Bronze   — 100 words
Silver   — 500 words
Gold     — 1000 words
Platinum — 2000 words
```

### Special Badges
```
Perfect Week    — 7 days with no missed reviews
Speed Reader    — 100 reviews in one day
Word Collector  — 1000 unique words added
```

---

## Word Garden (Priority Feature)

Each mastered word becomes a visual element in a garden. Render as an SVG or canvas panel.

```
1–9 mastered words   → seeds (dots)
10–49 mastered words → sprouts (small green shapes)
50–99 mastered words → flowers (simple colored blooms)
100–499 mastered words → trees
500+ mastered words  → dense forest
```

"Mastered" = `review_level >= 4`.

Implementation: query count of mastered words, render a proportional garden scene. Keep it simple — even a grid of emoji or SVG shapes is fine for v1. The child should feel their garden growing over weeks and months.

---

## Parent Dashboard

Show the following charts (use Recharts or a similar simple library):

- Words added per day (bar chart, last 30 days)
- Review completion % per week (line chart)
- Test accuracy % over time (line chart)
- Words mastered count (number card)
- Current streak (number card)

Include a data export button: download all word data as a CSV file.

---

## Edge Functions

### `POST /lookup-word`

Input: `{ word: string }`

Steps:
1. Call `https://api.freedictionaryapi.com/api/v2/entries/en/{word}`
2. Extract: word, part of speech, English definition, example sentence
3. Call `https://api.mymemory.translated.net/get?q={english_definition}&langpair=en|zh-CN`
4. Extract: `responseData.translatedText`
5. Return combined object

Error handling:
- Dictionary API 404 → return `{ error: "not_found" }`, let browser show manual entry form
- MyMemory failure → return result without `chinese_definition`, browser shows empty field for manual input

No API keys are required. No secrets to manage in Supabase for this function.

---

## UI Pages / Routes

```
/login                     — Login screen (child or parent)
/child/home                — Dashboard: XP, streak, due reviews, quick stats
/child/add-word            — Word lookup + add form
/child/words               — Word list with search/filter
/child/review              — Spaced repetition review session
/child/quiz                — Quiz session
/child/garden              — Word Garden visualization
/child/achievements        — Medals and badges
/parent/dashboard          — Statistics and charts
/parent/words              — Full word list view
/parent/export             — Data export
```

---

## File Structure (Vanilla JS)

```
/
├── index.html                  — Single entry point, loads app.js as module
├── style.css                   — Global styles, CSS variables for theming
│
├── js/
│   ├── app.js                  — Router: reads URL hash, renders the right page
│   ├── supabase.js             — Supabase client init (import from CDN)
│   ├── auth.js                 — Login, logout, session check, role redirect
│   │
│   ├── lib/
│   │   ├── srs.js              — Spaced repetition interval logic
│   │   ├── xp.js               — XP and level calculation
│   │   ├── achievements.js     — Achievement check logic
│   │   └── garden.js           — Word Garden SVG rendering logic
│   │
│   └── pages/
│       ├── child-home.js       — Dashboard: XP, streak, due reviews
│       ├── add-word.js         — Word lookup + preview + save
│       ├── word-list.js        — Full word list with search/filter
│       ├── review.js           — Spaced repetition session
│       ├── quiz.js             — Quiz session (meaning + spelling)
│       ├── garden.js           — Word Garden page
│       ├── achievements.js     — Medals and badges page
│       └── parent-dashboard.js — Charts, stats, export
│
└── assets/
    └── icons/                  — Simple SVG icons if needed
```

**Routing:** Use URL hash (`#/child/home`, `#/add-word`, etc.). `app.js` listens to `hashchange` and calls the appropriate page module's `render(container)` function.

**Page pattern:** Each page module exports a single `render(container)` function that sets `container.innerHTML` and attaches event listeners. Keep DOM manipulation inside the page module that owns it.

**No build step.** Load everything as ES modules. Example:

```html
<!-- index.html -->
<script type="module" src="./js/app.js"></script>
```

---

## Auth Guard

Wrap child routes and parent routes separately. After login, check the `role` field in `profiles`. Redirect to the appropriate dashboard. Prevent a child from accessing parent routes and vice versa.

---

## Environment Variables

Store in a `config.js` file that is **gitignored**:

```js
// js/config.js  — DO NOT COMMIT THIS FILE
export const SUPABASE_URL = 'https://xxxx.supabase.co'
export const SUPABASE_ANON_KEY = 'your-anon-key'
```

The Supabase anon key is safe to expose in a browser — it is designed to be public. RLS policies on the database enforce actual security.

No other secrets are needed. Both dictionary APIs (Free Dictionary API and MyMemory) require no keys. The Edge Function for `/lookup-word` calls them directly without credentials.

---

## Implementation Order (Recommended)

Build in this sequence so the app is always in a usable state:

1. **Project scaffold** — `index.html`, `style.css`, `app.js` with hash router, Supabase CDN import
2. **Supabase setup** — create project, tables, RLS policies, two user accounts
3. **Auth flow** — login page, session handling, role-based redirect
4. **Add Word page** — manual entry first, then wire up Edge Function for auto-lookup
5. **Word List page** — display saved words, basic search
6. **Review session** — SRS logic, update `review_schedule` on completion
7. **Quiz session** — meaning quiz first, then spelling quiz
8. **XP + Level display** — compute from DB, show on home screen
9. **Streaks and medals** — check on session load
10. **Word Garden** — SVG visualization, mastered word count drives it
11. **Parent Dashboard** — charts (use Chart.js from CDN) and CSV export
12. **Listening Quiz** — use browser `SpeechSynthesis`, no API needed

---

## Notes and Constraints

- This app is for **one child and one parent only**. Do not build multi-user or classroom features.
- Keep the UI bright, friendly, and uncluttered. Large touch targets. No dense tables or small text in child-facing views.
- The child should never see a blank or broken screen. Always show a friendly empty state with a prompt to action (e.g., "No words yet — add your first word!").
- Error messages must be plain, helpful, and not technical (e.g., "That word wasn't found. You can type the definition yourself.").
- All child-facing text should be in English. Chinese appears only in word definitions and the Chinese translation field.
- The parent dashboard can be more information-dense.
- Do not add social features, sharing, or any network connectivity beyond Supabase and the API calls described above.
