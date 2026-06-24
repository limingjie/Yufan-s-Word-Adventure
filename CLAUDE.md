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
| 3D Garden | Three.js (ES module from CDN) — `https://cdn.jsdelivr.net/npm/three@0.160.0/+esm` |
| Deployment | Netlify (static) |

**No npm. No build step. No React. No Tailwind.** Three.js is loaded as an ES
module from CDN (same mechanism as Supabase) — the one runtime dependency; it is
pinned to a version and only imported by `js/lib/garden3d.js`.

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
│       ├── growth.js        — Sunlight (XP) calculation + botanical Rank ladder
│       ├── coins.js         — Coin economy (computeCoins) + Garden Shop catalog
│       ├── achievements.js  — granular badge catalog + checkAndAward rules
│       ├── awards.js        — runAfterActivity(): the connector every activity calls
│       ├── celebrate.js     — instant award effects (toast/confetti/coin/badge/rankUp/combo)
│       ├── help.js          — "How do I earn?" modal (Sunlight + Coins), shared home/garden
│       ├── audio.js         — chiptune background music + critter chirps (Web Audio, no files)
│       ├── garden.js        — gardenStats() per-mastery counts (legacy 2D render kept)
│       ├── garden3d.js      — Three.js full-screen 3D voxel garden scene
│       ├── missions.js      — daily mission descriptors + render (learner home & parent dashboard)
│       └── parent-stats.js  — parent-side learner stats: fetch, Sunlight/words sort, streak
│
├── pages/
│   ├── login.js
│   ├── learner-home.js      — dashboard + missions + embedded month calendar
│   ├── word-list.js         — word list + add/edit drawer + trash section
│   ├── review.js            — SRS session; logs each review as test_type 'review'
│   ├── quiz.js
│   ├── garden.js
│   ├── achievements.js
│   ├── leaderboard.js       — Sunlight / mastered / streaks / words leaderboards
│   ├── compare.js           — head-to-head comparison (learner-vs-learner)
│   ├── settings.js          — learner privacy settings
│   ├── parent-dashboard.js  — per-learner stats, daily missions + history, compare
│   ├── parent-words.js      — word list per learner (parent can add/edit)
│   └── parent-activity.js   — per-learner test-result activity log + calendar
│
└── sql/
    ├── MIGRATION_ADD_DELETED_AT.sql        — soft-delete column + index
    ├── MIGRATION_ADD_AUDIO_URLS.sql        — audio_url_uk, audio_url_us columns
    ├── MIGRATION_ADD_WORD_DETAILS.sql      — word_forms (jsonb), synonyms, antonyms, quotes columns
    ├── MIGRATION_LEADERBOARD_RLS.sql       — RLS policies for public leaderboard
    ├── MIGRATION_ADD_AVATAR_EMOJI.sql      — profiles.avatar_emoji column
    ├── MIGRATION_ADD_REVIEW_TEST_TYPE.sql  — allow 'review' in test_results.test_type CHECK
    └── MIGRATION_ADD_GARDEN_ITEMS.sql      — garden_items table (purchased decorations/boosters)
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
| `#/learner/leaderboard` | Leaderboard (Sunlight / Mastered / Streaks / Words) | Learner |
| `#/learner/compare/:id` | Head-to-Head Comparison | Learner + Parent |
| `#/learner/settings` | Privacy Settings | Learner |
| `#/parent/dashboard` | Stats, Missions & Charts | Parent |
| `#/parent/words` | Learner Word List (add/edit) | Parent |
| `#/parent/activity` | Learner Activity Log + Calendar | Parent |

`#/learner/add-word` redirects to `#/learner/words` (alias kept for backwards compat).

**Compare is learner-vs-learner.** `#/learner/compare/:id` is not in the role route sets, so both roles reach it. A learner compares themselves against `:id`; a parent compares `:id` against the other learner (the parent dashboard's "Compare learners" button links here). `compare.js` reads the viewer's role to pick the left-hand participant and the correct back link, then orders the two by Sunlight/words. Stats come from `js/lib/parent-stats.js`.

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
avatar_emoji  text  DEFAULT NULL        -- optional emoji avatar; falls back to display-name initial. Migration: sql/MIGRATION_ADD_AVATAR_EMOJI.sql
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
test_type  text  CHECK (test_type IN ('meaning', 'spelling', 'listening', 'review'))
correct    boolean NOT NULL
response   text
tested_at  timestamptz DEFAULT now()
```

**`'review'` test_type:** `review.js` records each completed SRS review as a `test_results` row with `test_type = 'review'`, so daily missions/history can count reviews separately from meaning-quiz answers. Requires `sql/MIGRATION_ADD_REVIEW_TEST_TYPE.sql` (extends the CHECK) — apply it **before** deploying the review-logging change, or the insert is rejected. No backfill: reviews logged before this change remain `test_type = 'meaning'`, so they show under the meaning count in older history rather than under reviews. Accuracy, Sunlight, Coins, calendars and parent charts count all `test_results` regardless of type, so they are unaffected.

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

## Daily Missions

Defined in `js/lib/missions.js`; progress data comes from `db.getDailyProgress(userId)`. Shown interactively on `#/learner/home` and read-only on the parent dashboard (`renderMissionList(missions, { readOnly: true })`).

Five missions per day (`MISSION_NEW_WORDS = 15`, `MISSION_REVIEW_CURVE = 30`):

1. **Add 15 new words** — always unlocked.
2. **Review today's new words** ┐
3. **Meaning quiz (today's words)** ├─ unlock once mission 1 is met; targets scale to the number of words added today.
4. **Spelling quiz (today's words)** ┘
5. **Review older words** — always unlocked; target is min(30, still-due curve words).

Missions 2–4 only count `test_results` rows for **today's** new words; mission 5 counts older words. Reviews count via `test_type = 'review'` (see `test_results` note above).

### Mission history (parent dashboard)

`db.getMissionHistory(userId, days = 14)` returns one row per day (newest first) reconstructed from `words.created_at` and `test_results`: `{ date, wordsAdded, reviewsNew, reviewsCurve, meaning, spelling, totalTests, hasActivity, coreDone }`. Each parent dashboard card has a lazy-loaded "View mission history" toggle that renders the days with activity.

`coreDone` reflects the add goal **plus** the three new-word practice missions only — the "review older words" mission is excluded because its point-in-time due-state can't be reconstructed historically.

---

## Parent Views

All parent pages (`parent-dashboard`, `parent-words`, `parent-activity`) and the compare screen order learners consistently via `js/lib/parent-stats.js`:

- `loadLearnersSorted()` — fetches learner profiles + stats, sorted by **Sunlight desc, then words desc**.
- `compareByStats(a, b)` — the shared comparator.
- `isInactive(stats)` — true when Sunlight is 0 **or** words is 0. On the dashboard, inactive learners render as a collapsed `<details>` card ("No activity yet") instead of a full card; they're also excluded from the activity chart.
- `fetchStreak(userId)` — consecutive-day activity streak (used by compare).

Navigation between parent pages is the responsibility of the top navbar (`app.js renderNavbar`); pages do **not** repeat nav links beside their `<h2>`. The dashboard's only header action is "Compare learners".

---

## The Reward System (connected backbone)

Two currencies + granular badges + instant effects, all wired through one
connector. Every activity page (add word, finish review, finish quiz) calls
`runAfterActivity(hints)` in `js/lib/awards.js`, which recomputes Sunlight,
Coins and badges in one place and returns an `events[]` array that
`js/lib/celebrate.js` renders. **Both currencies are derived from countable
history — never stored as a running total** (only coin *purchases* are stored).

```
activity → awards.runAfterActivity() → { Sunlight↑ rank, Coins↑ balance, new badges }
                                      → events[] → celebrate.js (confetti/coin/badge/rankUp)
```

### Sunlight ☀️ & Gardener Ranks (`js/lib/growth.js`)

Sunlight is the permanent progress currency (drives ranks + leaderboard, never
spent). Same earn formula as the old XP; thresholds unchanged (ESL milestones).

```
Add a word:       +1 Sunlight
Complete review:  +2 Sunlight
Correct answer:   +3 Sunlight
```

Ranks are botanical and describe the *gardener* (kept distinct from per-word
plant stages in `srs.js`):

| Rank | Name | Min ☀️ | | Rank | Name | Min ☀️ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🌱 Sprout Scout | 0 | | 6 | 🌳 Grove Guardian | 3,000 |
| 2 | 🪴 Seedling Sitter | 50 | | 7 | 🍀 Green Thumb | 6,000 |
| 3 | 🌿 Leaf Learner | 200 | | 8 | 🏡 Garden Master | 15,000 |
| 4 | 🌻 Bud Tender | 500 | | 9 | 🦋 Nature Sage | 30,000 |
| 5 | 🐝 Garden Keeper | 1,200 | | 10 | 👑 Master Botanist | 80,000 |

### Coins 🪙 (`js/lib/coins.js`)

The spendable garden currency. `balance = earned − Σ(purchased item costs)`;
earned is derived (`computeCoins`), purchases live in `garden_items`.

```
+1 🪙 per word added · +1 🪙 per answer · +1 🪙 per correct · +5 🪙 per badge
```

`SHOP` catalog maps `item_code → { name, icon, cost, layer, type }`.
`type: 'decoration'` (a 3D prop) or `'booster'` (**cosmetic-only — never touches
SRS/mastery**). Spent in the Garden Shop (see Word Garden).

---

## Achievements / Badges (`js/lib/achievements.js`)

Many small, garden-themed, quickly-earned badges (stored in `achievements`,
UNIQUE per code; each is also worth +5 🪙). `ACHIEVEMENTS[code]` carries
`{ icon, label, desc, category, tier }`; the Awards page groups by `category`.
`checkAndAward(stats)` reads stats built by `runAfterActivity`
(`wordsAdded`, `masteredCount`, `streak`, `correctTotal`, `maxCombo`,
`perfectSession`, `allMissions`, `sessionType`) and inserts any newly-passed
rule, returning the new codes.

| Category | Codes (thresholds) |
|---|---|
| Words | FIRST_SEED(1) · SPROUTS_10 · PATCH_25 · GARDEN_50 · GROVE_100 · ORCHARD_250 · FOREST_500 · JUNGLE_1000 |
| Blooms (mastered) | FIRST_BLOOM(1) · BLOOMS_5/10/25/50/100 |
| Streaks | STREAK_3/7/14/30/60/100 |
| Practice | SHARP_25/100/500 (correct) · FIRST_REVIEW · FIRST_QUIZ |
| Skill | HOT_5/10/20 (combo) · PERFECT_REVIEW · PERFECT_QUIZ · GREEN_THUMB_DAY (all daily missions) |

In-session **combos** (5/10/20 correct in a row) fire a `comboPopup` every time;
the first ever also unlocks the matching HOT_x badge. Badges are checked after
every word add, review, and quiz (via `runAfterActivity`).

---

## Word Garden (`#/learner/garden`)

Full-screen (minus navbar) **3D scene** rendered with Three.js
(`js/lib/garden3d.js`). Flat colours, **no gradients** — a Minecraft-style grid
of dirt+grass **voxel blocks**, one plant per block. The renderer is transparent
so the **flat** CSS sky colour on `.garden-fs` shows behind it (sky tint warms
with Gardener rank and goes dark when the 🌙 theme is owned).

- **Plants** are billboard sprites on blocks — emoji = SRS stage (`masteryEmoji`),
  bigger as mastered. Due plants droop, desaturate, float a 💧. Tapping a due
  plant runs a **quick inline review right in the popup** (Water it → I knew it /
  Forgot): it calls `completeReview` + `recordTestResult` + `runAfterActivity`,
  then `controller.growPlant()` regrows the sprite and the top-bar counts/wallet
  update live — no jump to the review page. (The top-bar "Review all →" still
  opens a full session.)
- **Top action bar** merges everything: rank + Sunlight, per-mastery counts
  (🌱🌿🌷🌳🏆 from `gardenStats`), the 🪙 wallet, 🛒 Shop, 🔊 music toggle,
  `?` help, the "💧 N need watering → Review" CTA, plus Add and Quiz.
- **Garden Shop** (bottom sheet) spends coins via `buyGardenItem()`. Items
  **stack** — buy as many butterflies as you can afford (decorations show ×count;
  boosters are one-off). Each purchase adds one instance live
  (`controller.addDecoration`) and persists (`getGardenItems`). Boosters are
  cosmetic only.
- **Critters** (butterflies/bees/bird) wander slowly with random behaviour —
  free flight, landing on a plant, or grouping up — show speech bubbles, and make
  their natural sound on a per-critter cooldown (bees buzz, birds tweet,
  butterflies silent).
- **Audio** (`js/lib/audio.js`): NES-style chiptune loop (4 phrases, ~12s) + a
  buzzing `bee()` and tweeting `bird()` via Web Audio (no files). Starts on first
  tap (autoplay rules); on/off persists in localStorage; 🔊 toggle in the top bar.
- **Help** (`js/lib/help.js`): the `?` button (home + garden) opens a modal
  explaining how Sunlight and Coins are earned.
- **Controls:** pointer-based — 1 finger orbit, 2-finger pinch zoom, tap to
  select, idle auto-spin (no extra addon; avoids a 2nd Three.js copy). Scene is
  disposed + music stopped on navigation (RAF/GL freed) via a `hashchange` listener.

`js/lib/garden.js` still exports `gardenStats(words)` (per-mastery counts).

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
7. `learner-home.js` — Sunlight, Coins, streak, due review count, embedded month calendar
8. `achievements.js` — check and display badges
9. `garden.js` — SVG Word Garden
10. `parent-dashboard.js` — Chart.js charts, CSV export
11. Listening quiz — `SpeechSynthesis`, no API needed
12. `leaderboard.js` + `compare.js` + `settings.js` — competition features (Phase 7.5)
    - Requires `leaderboard_snapshots` and `learner_stats_cache` tables in Supabase
    - Update `profiles` RLS to expose public learner stats
