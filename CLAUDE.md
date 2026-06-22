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
| Backend | None — both APIs are called directly from the browser (CORS-safe) |
| English definitions | Free Dictionary API v1 — `https://freedictionaryapi.com/api/v1/entries/en/{word}?translations=true` |
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
│   ├── db.js            — all Supabase queries (single file)
│   ├── supabase.js      — createClient, exports `supabase`
│   ├── config.js        — SUPABASE_URL and SUPABASE_ANON_KEY (gitignored)
│   │
│   └── lib/
│       ├── srs.js           — spaced repetition interval logic
│       ├── xp.js            — XP calculation and level labels
│       ├── achievements.js  — achievement check logic
│       └── garden.js        — Word Garden SVG rendering
│
├── pages/
│   ├── login.js
│   ├── learner-home.js      — dashboard + embedded month calendar
│   ├── word-list.js         — word list + add/edit drawer + trash section
│   ├── review.js
│   ├── quiz.js
│   ├── garden.js
│   ├── achievements.js
│   ├── leaderboard.js       — XP / mastered / streaks / words leaderboards
│   ├── compare.js           — head-to-head comparison
│   ├── settings.js          — learner privacy settings
│   ├── parent-dashboard.js
│   └── parent-words.js      — read-only word list for parent
│
└── sql/
    ├── MIGRATION_ADD_DELETED_AT.sql    — soft-delete column + index
    ├── MIGRATION_ADD_AUDIO_URLS.sql    — audio_url_uk, audio_url_us columns
    ├── MIGRATION_ADD_WORD_DETAILS.sql  — word_forms (jsonb), synonyms, antonyms, quotes columns
    └── MIGRATION_LEADERBOARD_RLS.sql   — RLS policies for public leaderboard
```

---

## Routing

Hash-based. `app.js` listens to `hashchange` and `DOMContentLoaded`.

| Hash | Page | Role |
|---|---|---|
| `#/login` | Login | Public |
| `#/learner/home` | Dashboard + Calendar | Learner |
| `#/learner/words` | Word List + Add/Edit Drawer | Learner |
| `#/learner/review` | Review Session | Learner |
| `#/learner/quiz` | Quiz Session | Learner |
| `#/learner/garden` | Word Garden | Learner |
| `#/learner/achievements` | Medals & Badges | Learner |
| `#/learner/leaderboard` | Leaderboard (XP / Mastered / Streaks / Words) | Learner |
| `#/learner/compare/:id` | Head-to-Head Comparison | Learner |
| `#/learner/settings` | Privacy Settings | Learner |
| `#/parent/dashboard` | Stats & Charts | Parent |
| `#/parent/words` | Learner Word List (read-only) | Parent |

`#/learner/add-word` redirects to `#/learner/words` (alias kept for backwards compat).

**Calendar is embedded in `#/learner/home`** — no separate route. Clicking a day with activity sets `sessionStorage.wordDateFilter` and navigates to `#/learner/words`, which reads and applies the filter on load.

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
ipa                 text     -- stored as usIpa$ukIpa (US first); single IPA if only one found
audio_url_us        text     -- https://api.dictionaryapi.dev/media/pronunciations/en/{word}-us.mp3
audio_url_uk        text     -- https://api.dictionaryapi.dev/media/pronunciations/en/{word}-uk.mp3
part_of_speech      text
english_definition  text     -- multi-line: one definition per line, POS-prefixed e.g. "(noun) a body of water"
chinese_definition  text
example_sentence    text
word_forms          jsonb    -- { past, pastParticiple, thirdPerson, gerund, plural, comparative, superlative }
synonyms            text     -- comma-separated, up to 12
antonyms            text     -- comma-separated, up to 8
quotes              text     -- newline-separated; each line: "quote text — reference", up to 4
category            text  DEFAULT 'general'
is_favorite         boolean DEFAULT false
deleted_at          timestamptz DEFAULT NULL  -- NULL = active; non-NULL = soft-deleted (trash)
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

Soft delete: `db.deleteWord()` sets `deleted_at = now()`. `db.restoreWord()` clears it. `db.permanentlyDeleteWord()` hard-deletes. All list queries filter `WHERE deleted_at IS NULL`. Migration: `sql/MIGRATION_ADD_DELETED_AT.sql`.

**IPA format:** `ipa` stores `usIpa$ukIpa` when both exist (even if identical — signals both were found). Stores bare IPA when only one was found. Display logic in `wordCardPronRow` handles all combinations of IPA count vs audio URL count.

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

## Word Lookup — called directly from browser

Both APIs support CORS, so `word-list.js` (the add-word drawer) calls them directly — no Edge Function needed.

### Spelling check

Before showing the save form, the user must click "Look Up". If the API returns 404, the status shows "Not found — check spelling or fill in manually" and `lookupResult` is set to `'not_found'`. On save, the user sees a confirm dialog before proceeding. If the user edits the word input after a lookup, the details panel resets and a fresh lookup is required.

### Step 1: IPA + English definition + built-in Chinese (v1 API)

```
GET https://freedictionaryapi.com/api/v1/entries/en/{word}?translations=true
```

Response shape (Wiktionary-sourced):

- US IPA: `pronunciations.find(p => p.type === "ipa" && p.tags?.includes("General American"))?.text`
- UK IPA: `pronunciations.find(p => p.type === "ipa" && p.tags?.includes("Received Pronunciation"))?.text`
- Stored as `usIpa$ukIpa` in `ipa` field (US first)
- Audio URLs: probed with GET + body-cancel (CORS allows GET, not HEAD). Stored only if server returns 200.
  - `https://api.dictionaryapi.dev/media/pronunciations/en/{word}-us.mp3`
  - `https://api.dictionaryapi.dev/media/pronunciations/en/{word}-uk.mp3`
- Part of speech: `entries[0].partOfSpeech`
- Definitions: collected across all `entries[]`, up to 2 per POS entry, max 8 total — stored newline-separated in `english_definition`, each prefixed with "(noun) ", "(verb) ", etc.
- Example: first `senses[].examples[0]` found across all senses
- Word forms: extracted from `entries[0].forms[]`, filtered by tag rules → `word_forms` JSONB
- Synonyms: from `senses[].synonyms[]`, deduped, max 12, comma-separated
- Antonyms: from `senses[].antonyms[]`, deduped, max 8, comma-separated
- Quotes: from `senses[].quotes[]`, max 4, stored as `text — reference` per line
- Chinese: `entries[0].senses[0].translations.find(t => t.language.code.startsWith("zh"))?.word`
  - Format is `Traditional /Simplified` — extract the part after `/`
  - Only present for some words (Wiktionary coverage)

### Step 2: Chinese fallback — MyMemory (when v1 has no Chinese)
```
GET https://api.mymemory.translated.net/get?q={word}&langpair=en|zh-CN
```
Extract: `responseData.translatedText`

### Error handling

- Dictionary API 404 → show "not found" message, user fills in manually
- MyMemory failure → non-fatal, user fills in Chinese manually
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

Levels are tied to ESL fluency milestones (~10 XP per word interaction, ~25 XP per mastered word).

| Level | Name | Min XP | ESL milestone |
| --- | --- | --- | --- |
| 1 | Seedling | 0 | Just starting |
| 2 | Explorer | 50 | ~50 words |
| 3 | Adventurer | 200 | ~150 words |
| 4 | Word Collector | 500 | ~300 words |
| 5 | Scholar | 1,200 | A1 — survival vocabulary (~500 words) |
| 6 | Linguist | 3,000 | A2 — everyday topics (~1,000 words) |
| 7 | Word Builder | 6,000 | B1 — general fluency (~2,000 words) |
| 8 | Word Master | 15,000 | B2 — academic/professional (~3,500 words) |
| 9 | Vocabulary Wizard | 30,000 | C1 — advanced (~6,000 words) |
| 10 | Word Champion | 80,000 | C2 — near-native (~10,000+ words) |

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

## Word Card UI (`word-list.js`)

### Sort & Filter controls

- **Sort button:** single `[By Date ▾]` dropdown cycling through Date / A–Z / Level (replaced 3 separate buttons)
- **Date filter:** `📅 Date` button opens an inline calendar picker; selecting a date filters words by `created_at`; active filter shown as a chip with ✕ to clear
- Calendar picker computes word activity from already-loaded `allWords` — no extra DB call

### Word card layout

Each `.word-card` has a collapsible body (click to expand). Header is a single flex row:

```
[word title]  [· pos · 🔊 US /ipa/ · 🔊 UK /ipa/]  [SRS badge]  [✏️]  [✕]
```

The pronunciation span uses `pronHtmlFor(src, ipa, role)` which renders:

- **With audio:** `btn btn-secondary btn-sm` chip + monospace font (matches drawer lookup chips)
- **IPA only, no audio:** dimmed non-interactive span
- **Single IPA stored:** reused as label for both US and UK chips

### Word card body order

1. Word forms chips (past, past part., 3rd, -ing, pl., comp., superl.) — **top**
2. English definitions (numbered list if multi-line, plain text if single)
3. Chinese definition
4. Example sentence (italic)
5. Synonyms / Antonyms (comma-separated, small text)
6. Quotes (up to 2, blockquote style)
7. Category (if not "general")

---

## Quiz Types

### Meaning Quiz
- Show the word
- 4 options: 1 correct + 3 random distractors from word list
- Option text = **single best definition** via `pickBestDef()`: picks the longest line from `english_definition`, strips the leading "(pos) " tag — prevents the full multi-definition dump from making the answer obvious
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
4. `word-list.js` — word list + add/edit drawer (replaces separate add-word page)
5. `review.js` — SRS session, update `review_schedule` on completion
6. `quiz.js` — meaning quiz first, spelling quiz second
7. `learner-home.js` — XP, streak, due review count, embedded month calendar
8. `achievements.js` — check and display badges
9. `garden.js` — SVG Word Garden
10. `parent-dashboard.js` — Chart.js charts, CSV export
11. Listening quiz — `SpeechSynthesis`, no API needed
12. `leaderboard.js` + `compare.js` + `settings.js` — competition features (Phase 7.5)
    - Requires `leaderboard_snapshots` and `learner_stats_cache` tables in Supabase
    - Update `profiles` RLS to expose public learner stats
