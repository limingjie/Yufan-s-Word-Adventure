# Architecture

> Detail doc for [CLAUDE.md](../CLAUDE.md). Covers file layout, routing, the page
> module pattern, environment/config, and the historical build order.

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
│   ├── learner-home.js      — dashboard + missions + medal chip (→Awards) + embedded month calendar
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
    ├── SUPABASE_SETUP.sql      — full consolidated schema (all tables, indexes, RLS). Single source of truth; run once.
    ├── LEARNERS_INSERT.sql     — seed profiles; run separately after creating Auth users (FK to auth.users)
    └── IMPORT_YUFAN_WORDS.sql  — one-time data import (119 words for a specific learner UUID)
```

**Schema-change workflow (locked):** there are no committed migration files.
To alter the schema, write a throwaway `sql/tmp_*.sql` (gitignored), run it in
the Supabase SQL Editor, then merge the same DDL into `SUPABASE_SETUP.sql`
(idempotent forms) and delete the tmp file. Only `SUPABASE_SETUP.sql` is committed.

---

## Routing

Hash-based. `app.js` listens to `hashchange` and `DOMContentLoaded`.

| Hash | Page | Role |
|---|---|---|
| `#/login` | Login | Public |
| `#/learner/home` | Dashboard + Calendar | Learner |
| `#/learner/words` | Word List + Add/Edit Drawer | Learner |
| `#/learner/review` | Review Session | Learner — **no nav tab** (reached from Home missions & Garden) |
| `#/learner/quiz` | Quiz Session | Learner |
| `#/learner/garden` | Word Garden | Learner |
| `#/learner/achievements` | Medals & Badges | Learner — **no nav tab** (reached from the Home header medal chip) |
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

**Learner nav tabs** (`app.js renderNavbar`): Home · My Words · Garden · Leaderboard. **Review and Awards deliberately have no tab** — reviews are launched from the Home missions and the Garden's "💧 … Review all →" CTA (plus the Garden's inline quick-review); Awards (`#/learner/achievements`) is opened from the **medal chip** in the Home header (`🏅 N`, linking to the Awards page, count from `getBadgeCount()`). Both routes remain in `LEARNER_ROUTES`/`ROUTES` so they stay directly reachable.

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
