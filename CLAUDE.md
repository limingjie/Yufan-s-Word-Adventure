# Vocab App — Project Instructions

## What this is
A vocabulary learning website for learners of any age and one parent.
Two learners + one parent. No multi-tenancy. No social features.
Designed to be fully usable on smartphones — responsive layout required throughout.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla JS, ES modules, no framework, no bundler |
| Styling | Plain CSS with CSS variables |
| Auth + DB | Supabase (JS client via CDN) |
| Backend | Supabase Edge Functions (Deno) |
| English definitions | Free Dictionary API — `https://api.freedictionaryapi.com/api/v2/entries/en/{word}` |
| Chinese translation | MyMemory API — `https://api.mymemory.translated.net/get?q={text}&langpair=en|zh-CN` |
| Deployment | Netlify (static) |

**No npm. No build step. No React. No Tailwind.**

Load Supabase from CDN:
```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
</script>
```

---

## File Structure

```
/
├── index.html           — single entry point
├── style.css            — global styles, CSS variables
├── CLAUDE.md
│
├── js/
│   ├── app.js           — hash router, auth guard, bootstraps pages
│   ├── auth.js          — login, logout, session check, role redirect
│   ├── supabase.js      — createClient, exports `supabase`
│   ├── config.js        — SUPABASE_URL and SUPABASE_ANON_KEY (gitignored)
│   │
│   ├── lib/
│   │   ├── srs.js           — spaced repetition interval logic
│   │   ├── xp.js            — XP calculation and level labels
│   │   ├── achievements.js  — achievement check logic
│   │   └── garden.js        — Word Garden SVG rendering
│   │
│   └── pages/
│       ├── login.js
│       ├── learner-home.js
│       ├── add-word.js
│       ├── word-list.js
│       ├── review.js
│       ├── quiz.js
│       ├── garden.js
│       ├── achievements.js
│       ├── leaderboard.js       — XP / mastered / streaks leaderboards
│       ├── compare.js           — head-to-head comparison
│       ├── settings.js          — learner privacy settings
│       └── parent-dashboard.js
│
└── supabase/
    └── functions/
        └── lookup-word/
            └── index.ts    — Deno Edge Function
```

---

## Routing

Hash-based. `app.js` listens to `hashchange` and `DOMContentLoaded`.

| Hash | Page | Role |
|---|---|---|
| `#/login` | Login | Public |
| `#/learner/home` | Dashboard | Learner |
| `#/learner/add-word` | Add Word | Learner |
| `#/learner/words` | Word List | Learner |
| `#/learner/review` | Review Session | Learner |
| `#/learner/quiz` | Quiz Session | Learner |
| `#/learner/garden` | Word Garden | Learner |
| `#/learner/achievements` | Medals & Badges | Learner |
| `#/learner/leaderboard` | Leaderboard (XP / Mastered / Streaks) | Learner |
| `#/learner/compare/:id` | Head-to-Head Comparison | Learner |
| `#/learner/settings` | Privacy Settings | Learner |
| `#/parent/dashboard` | Stats & Charts | Parent |
| `#/parent/words` | Learner Word List (read-only) | Parent |

Auth guard: after login, check `profiles.role`. Redirect learner to `#/learner/home`, parent to `#/parent/dashboard`. Block cross-role access.

---

## Page Module Pattern

Every page module exports a single `render(container)` function.

```js
// js/pages/example.js
export async function render(container) {
  container.innerHTML = `<h1>Page Title</h1>`
  // attach event listeners here
}
```

`app.js` calls `render(document.getElementById('app'))` on route change.
Keep all DOM manipulation inside the module that owns it.

---

## Database Schema

### `profiles`
```sql
id            uuid  PRIMARY KEY REFERENCES auth.users
role          text  CHECK (role IN ('learner', 'parent'))
display_name  text  DEFAULT 'User'
avatar_color  text  DEFAULT '#007BFF'   -- used in leaderboards
is_public     boolean DEFAULT true      -- controls leaderboard visibility
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### `words`
```sql
id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid  REFERENCES profiles(id) ON DELETE CASCADE
word                text  NOT NULL
ipa                 text                  -- e.g. /ˈkjʊəriəs/, from Free Dictionary API
part_of_speech      text
english_definition  text
chinese_definition  text
example_sentence    text
category            text  DEFAULT 'general'
is_favorite         boolean DEFAULT false
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

### `review_schedule`
```sql
id                uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id           uuid  UNIQUE REFERENCES words(id) ON DELETE CASCADE
user_id           uuid  REFERENCES profiles(id) ON DELETE CASCADE
next_review_date  date  NOT NULL DEFAULT CURRENT_DATE
review_level      int   DEFAULT 0
ease_factor       float DEFAULT 2.5   -- reserved for future SM-2
interval_days     int   DEFAULT 1
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```

### `test_results`
```sql
id         uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id    uuid  REFERENCES words(id) ON DELETE CASCADE
user_id    uuid  REFERENCES profiles(id) ON DELETE CASCADE
test_type  text  CHECK (test_type IN ('meaning', 'spelling', 'listening'))
correct    boolean NOT NULL
response   text
tested_at  timestamptz DEFAULT now()
```

### `achievements`
```sql
id                uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id           uuid  REFERENCES profiles(id) ON DELETE CASCADE
achievement_code  text  NOT NULL
earned_at         timestamptz DEFAULT now()

UNIQUE (user_id, achievement_code)   -- prevent duplicate awards
```

### `daily_stats` (optional — can be computed dynamically)
```sql
date                date NOT NULL
user_id             uuid REFERENCES profiles(id) ON DELETE CASCADE
words_added         int  DEFAULT 0
reviews_completed   int  DEFAULT 0
tests_completed     int  DEFAULT 0
tests_correct       int  DEFAULT 0
PRIMARY KEY (date, user_id)
```

### `leaderboard_snapshots` (competition feature)
```sql
id          uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid  REFERENCES profiles(id) ON DELETE CASCADE
snapshot_date  date NOT NULL
total_xp    int   DEFAULT 0
mastered_count int DEFAULT 0
streak_days int   DEFAULT 0
created_at  timestamptz DEFAULT now()
```

### `learner_stats_cache` (competition feature — updated after each review/quiz)
```sql
user_id          uuid  PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE
total_xp         int   DEFAULT 0
current_level    int   DEFAULT 1
mastered_words_count int DEFAULT 0
current_streak   int   DEFAULT 0
updated_at       timestamptz DEFAULT now()
```

**RLS:** Enable RLS on all tables. Core policy: users can only read/write rows where `user_id = auth.uid()`. Parent role gets additional read-only access to learner data. Public leaderboard policies allow reading `profiles` and `achievements` where `is_public = true`.

---

## Word Lookup — Edge Function

`POST /lookup-word` — called from browser, never call external APIs directly from browser.

### Step 1: English definition + IPA
```
GET https://api.freedictionaryapi.com/api/v2/entries/en/{word}
```
Extract:
- `[0].meanings[0].partOfSpeech`
- `[0].meanings[0].definitions[0].definition`
- `[0].meanings[0].definitions[0].example`
- IPA: `[0].phonetics.find(p => p.text)?.text` (first phonetic entry with a text field)

### Step 2: Chinese translation
Translate the English **definition** (not the word itself) for better results:
```
GET https://api.mymemory.translated.net/get?q={english_definition}&langpair=en|zh-CN
```
Extract: `responseData.translatedText`

### Response shape
```json
{
  "word": "curious",
  "ipa": "/ˈkjʊəriəs/",
  "part_of_speech": "adjective",
  "english_definition": "eager to know or learn something",
  "chinese_definition": "渴望了解或学习某事",
  "example_sentence": "The curious boy opened the box."
}
```

### Error handling
- Dictionary API 404 → return `{ "error": "not_found" }`, browser shows manual entry form
- MyMemory failure → return result without `chinese_definition`, user fills it in manually
- Always allow manual editing of all fields before saving

---

## Spaced Repetition (SRS)

Fixed interval ladder. No SM-2.

```
Level 0 → 1 day
Level 1 → 3 days
Level 2 → 7 days
Level 3 → 14 days
Level 4 → 30 days
Level 5 → 60 days  (mastered, shown in garden, rarely prompted)

Correct answer: level = min(level + 1, 5), next_review_date = today + interval
Wrong answer:   level = 0, next_review_date = tomorrow
```

"Due today" = `next_review_date <= CURRENT_DATE`
"Mastered" = `review_level >= 4`

---

## XP & Levels

```
Add a word:       +1 XP
Complete review:  +2 XP
Correct answer:   +3 XP
```

Compute XP dynamically from DB. Do not store a running total.

| Level | Name | XP |
|---|---|---|
| 1 | Explorer | 0–49 |
| 2 | Adventurer | 50–149 |
| 3 | Scholar | 150–349 |
| 4 | Word Master | 350–699 |
| 5 | Vocabulary Wizard | 700+ |

---

## Achievements

| Code | Trigger |
|---|---|
| `BRONZE_100` | 100 words added |
| `SILVER_500` | 500 words added |
| `GOLD_1000` | 1000 words added |
| `PLATINUM_2000` | 2000 words added |
| `STREAK_7` | 7-day streak |
| `STREAK_30` | 30-day streak |
| `STREAK_100` | 100-day streak |
| `PERFECT_WEEK` | 7 days with no missed reviews |
| `SPEED_READER` | 100 reviews in one day |
| `WORD_COLLECTOR` | 1000 unique words |

Check achievements after every word add or review completion.

---

## Word Garden

Query count of mastered words (`review_level >= 4`). Render as SVG in `#/learner/garden`.

```
0–9 mastered    → seeds (small dots)
10–49 mastered  → sprouts (small green shapes)
50–99 mastered  → flowers (colored blooms)
100–499 mastered → trees
500+  mastered  → dense forest
```

Keep v1 simple — a grid of SVG shapes is fine.

---

## Quiz Types

### Meaning Quiz
- Show the word
- 4 options: 1 correct + 3 random distractors from word list
- If word list < 4 words, pad with hardcoded common words

### Spelling Quiz
- Show the Chinese definition (or English if no Chinese)
- User types the spelling
- Compare case-insensitive, trimmed

### Listening Quiz (Phase 2)
- Use browser `SpeechSynthesis` API — no external API needed
- Speak the word, user types spelling

---

## UI Rules

- **Learner-facing views:** large text, large touch targets (min 44px), friendly empty states, no dense tables
- **Parent dashboard:** can be more information-dense; use Chart.js from CDN for charts
- **Empty states:** always show a prompt to act, never a blank screen (e.g. "No words yet — add your first word!")
- **Errors:** plain language, never technical (e.g. "That word wasn't found. You can type the definition yourself.")
- **Language:** all UI in English; Chinese appears only in word definition fields

### Responsiveness

The app must be fully usable on a smartphone. Apply these rules everywhere:

- `index.html` must include `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Write CSS mobile-first: base styles target narrow screens, `@media (min-width: 640px)` for wider layouts
- Use `max-width` + `margin: auto` on a single `.container` wrapper — never fixed pixel widths on layout elements
- Flex and grid layouts only; no absolute positioning for flow elements
- Tap targets (buttons, links, inputs) must be at least 44×44px
- Font sizes: minimum 16px for body text (prevents iOS auto-zoom on input focus), 20px+ for primary actions
- Avoid hover-only interactions — all interactions must work with touch
- Quiz answer buttons and review cards must be full-width on mobile, multi-column on desktop
- IPA text may use a smaller font (14px) but must remain readable

---

## Environment / Config

`js/config.js` is gitignored. Structure:
```js
export const SUPABASE_URL = 'https://xxxx.supabase.co'
export const SUPABASE_ANON_KEY = 'your-anon-key'
```

The anon key is safe to expose in browser. RLS enforces security.
No other secrets needed — both dictionary APIs require no keys.

---

## Build Order

Build in this sequence. The app should be usable at every step.

1. `index.html` + `style.css` + `app.js` hash router skeleton
2. `supabase.js` + `config.js` + Supabase project setup (tables, RLS, users)
3. `auth.js` + `login.js` — auth flow, role-based redirect
4. `add-word.js` — manual entry first, then wire up Edge Function
5. `word-list.js` — display saved words, search
6. `review.js` — SRS session, update `review_schedule` on completion
7. `quiz.js` — meaning quiz first, spelling quiz second
8. `learner-home.js` — XP, streak, due review count
9. `achievements.js` — check and display badges
10. `garden.js` — SVG Word Garden
11. `parent-dashboard.js` — Chart.js charts, CSV export
12. Listening quiz — `SpeechSynthesis`, no API needed
13. `leaderboard.js` + `compare.js` + `settings.js` — competition features (Phase 7.5)
    - Requires `leaderboard_snapshots` and `learner_stats_cache` tables in Supabase
    - Update `profiles` RLS to expose public learner stats
