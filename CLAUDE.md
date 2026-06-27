# Vocab App — Project Instructions

## What this is
A vocabulary learning website for learners of any age and one parent.
Two learners + one parent. No multi-tenancy. No social features.
Designed to be fully usable on smartphones — responsive layout required throughout.

This file is the **index**: the locked decisions and tech stack live here (always
read), and the per-area detail lives in `docs/*.md` (read on demand — see the
**Detail docs** index at the bottom). When you work on an area, open its detail
doc first; when a change settles a fact, update the matching doc and keep this
index in sync.

---

## Key Decisions (locked — do not change without explicit confirmation)

These are settled product/architecture decisions. **Do not change, reverse, or
"refactor away" any of them without the user explicitly asking.** If a request
seems to conflict with one, call it out and confirm first. If you're unsure
whether something not listed here is also a key decision, **ask the user**.

1. **No framework, no build step, no npm.** Vanilla JS, ES modules, plain CSS. Runtime deps load from CDN only (Supabase, Three.js). Don't introduce React/Tailwind/a bundler/a package.json.
2. **Single parent + two learners.** No multi-tenancy, no auth/role beyond `learner`/`parent`, no social features.
3. **Currencies are derived, never stored as running totals.** Sunlight (`growth.js`) and Coins (`coins.js`) are computed from countable history; only coin *purchases/spends* are persisted (`garden_items`). Never add a stored balance column.
4. **One reward connector.** Every activity (add/review/quiz) goes through `runAfterActivity()` in `awards.js`, which recomputes Sunlight/Coins/badges and returns `events[]`. Don't award XP/coins/badges anywhere else.
5. **SRS is a fixed interval ladder** (0→1,1→3,2→7,3→14,4→30,5→60 days; mastered ≥ level 4). No SM-2 / ease-factor scheduling. Flashcard review always advances the ladder; in the **older-word mixed drill** (mission 5) a correct answer in *any* modality (review/meaning/spelling) advances it too. Today's-word quizzes (missions 3–4) do not.
6. **Chinese field is Chinese-only, enforced at save** (`zhOnly()` strips ASCII on save/update; not filtered while typing, to allow IME). This is anti-cheat for the spelling quiz — keep it.
7. **Daily missions complete at 85% of target, counting correct answers.** `MISSION_TARGET_PCT = 0.85`; practice/quiz/review counts are distinct words answered *correctly*. Five missions: add · review-new · meaning · spelling · **practice-older**. Missions 2–4 are today's new words; mission 5 is the older-word **mixed drill** (`pages/curve-drill.js`, ~10/10/10 review/meaning/spelling) and counts older words correct in *any* modality. Learner home and parent dashboard share `buildMissions`/`getDailyProgress` so the view is identical.
8. **Quiz hints cost coins** via hidden `SHOP` `type:'hint'` entries (non-one-off, so each use deducts a coin), styled with the golden `.coin-btn`. Meaning quiz: "Remove 2 Answers" and "Reveal Chinese Meanings" (per-option Chinese). Spelling quiz: "First & last letter".
9. **Navigation tabs are intentionally minimal.** Learner: Home · My Words · Garden · Leaderboard. Review and Awards have **no tab** (reached from Home/Garden, and the Home medal chip). Parent: Dashboard · Word Lists · Activity.
10. **Word Garden is a full-screen 3D voxel scene** rendered with Three.js (ESM from CDN), flat colours / Minecraft-style blocks — not a 2D view. The legacy 2D SVG garden is not the product. **Everything is a voxel model built in-code** (flat-colour boxes, no external assets): plants (6 growth stages mapped to mastery, with vivid bloom dots so they pop off the grass), sky critters (flapping wings), ground animals, the gnome, structures, vehicles, fences and signs. **Layout is stored, not derived:** each block has a *surface* (grass/road/rail/**crossing**/**fence**/**runway**/water/stone) and one *occupant* (plant/vehicle/structure/animal); every plant (`garden_plants`) and placeable or positioned item (`col/grid_row/rotation` on `garden_items`) remembers a fixed `(col,row)`. The field is the content bounding box + a 2-cell padding ring and auto-grows. The **placeable playset** (road/rail/**level-crossing**/**fence**/**runway**/**transit-station**/**control-tower**/car/**bus**/train/**private-jet**) is bought into a tray (shown **at the top** in Arrange mode so it isn't clipped on mobile) and dragged onto blocks; a car/bus needs a road, a train needs a rail, a station needs an adjacent road or rail and auto-rotates to face it, a control tower needs empty grass, and a private jet needs a straight runway of at least 10 connected runway blocks. Roads/rails/fences/runways auto-connect, and **vehicles are voxel models that drive or fly** their connected network — road/rail vehicles turn to face travel, arc through corners, random-turn at junctions, re-route on edits, and freeze while arranging (driving position is runtime-only); private jets animate takeoff/landing along valid runways and park on short/broken runways. The **one-surface-per-block rule still holds** — road/rail/fence/runway never share a cell; **level crossings are a dedicated `crossing` tile** that belongs to *both* road and rail networks (cars/buses drive road+crossing, trains rail+crossing) with two boom gates that lower across the road when a train is near and warning lights/crossbucks face road traffic. Road vehicles **keep right**, **queue** behind same-direction vehicles, **slow for curves**, **stop at Canada-style 3-lamp traffic lights** (red/amber/green; four approach heads on 4-way junctions) and at **stop signs** (three signs on 3-way junctions), and hold for a train at a crossing. **Trains and buses dwell at transit stations.** Runway edge lights blink at night, and the tall control tower cabin/beacon glow at night. Structures (pond/fountain/cottage — all **unlimited**, stack with persisted positions) and the gnome's cottage have night-glow windows. Ground animals (including bear and deer) have persisted home cells, can be moved in Arrange mode, and roam only inside the connected non-fence region containing their home. The Garden Shop is a **card grid grouped by category**. See [docs/garden.md](docs/garden.md).
11. **Quiz & review cover ALL of today's new words when more than 15 were added.** `deckSizeFor() = max(15, newWordsToday)`; review scope `'new'` is uncapped (`'curve'`/`'all'` stay capped at 30). Keeps the daily missions completable. **Daily practice cap (anti-grind):** a word drops out of the meaning/spelling deck after `DAILY_QUIZ_CAP = 5` attempts **per modality per day** (`getTodayAttemptCounts` filter in `startMeaning`/`startSpelling`). Throttles coin-farming by re-quizzing *without* changing the coin formula (Decision 13 holds — coins are still per-attempt, there are just fewer attempts). Flashcard review and the older-word drill self-limit via SRS due-dates, so they're exempt. Mission cards show `🎯 N% · M tries`.
12. **Word lookup uses Free Dictionary API v1** (IPA/defs/built-in Chinese, `translations=true`) with a **MyMemory fallback** for Chinese, both called directly from the browser (CORS-safe, no backend).
13. **Earn formulas are fixed.** Sunlight: +1 add / +2 review / +3 correct. Coins: +1 add / +1 answer / +1 correct / +5 badge. Gardener rank thresholds are the ESL-milestone ladder in `growth.js`.
14. **One consolidated SQL schema; no committed migration files.** `sql/SUPABASE_SETUP.sql` is the single source of truth (all tables, indexes, RLS). To change the schema, write a throwaway `sql/tmp_*.sql` (gitignored), run it in the Supabase SQL Editor, then merge the same DDL into `SUPABASE_SETUP.sql` (idempotent forms) and delete the tmp file. `sql/LEARNERS_INSERT.sql` (seed) and `sql/IMPORT_YUFAN_WORDS.sql` (one-time data) stay separate. See [docs/database.md](docs/database.md).
15. **Commit message format.** A commit message is a one-line summary, followed by detailed items each starting with `-`. Do **not** append a `Co-Authored-By` trailer (or any other trailer).

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

## Detail docs

Per-area documentation lives in `docs/`. These are **not** auto-loaded — open the
relevant one before working on that area, and update it when a fact changes.

| Doc | Read it before… | Contains |
|---|---|---|
| [docs/architecture.md](docs/architecture.md) | touching routing, app bootstrap, or adding a page/file | Full file tree, hash routes + auth guard, the `render(container)` page pattern, `js/config.js` shape, historical build order |
| [docs/database.md](docs/database.md) | any DB query, schema, or SQL migration | Every table (`profiles`, `words`, `review_schedule`, `test_results`, `achievements`, `daily_stats`, leaderboard/stats-cache), IPA storage format, soft-delete, `'review'` test_type, RLS model |
| [docs/word-lookup.md](docs/word-lookup.md) | the add-word drawer / dictionary lookup | The two-step Free Dictionary v1 + MyMemory flow, response parsing, audio probing, error handling |
| [docs/learning.md](docs/learning.md) | SRS, missions, review, or quizzes | Interval ladder, the five daily missions + 85% threshold + accuracy, mission history, meaning/spelling/listening quizzes, paid hints, deck sizing |
| [docs/rewards.md](docs/rewards.md) | anything awarding Sunlight/Coins/badges | `runAfterActivity` connector, Sunlight earn + Gardener rank ladder, Coin economy + `SHOP`, the full badge catalog + combos |
| [docs/garden.md](docs/garden.md) | the 3D Word Garden | Three.js voxel scene, due-plant inline review, top action bar, Garden Shop, critters, audio, controls/disposal |
| [docs/ui.md](docs/ui.md) | word-card UI or any styling/layout | Word-list sort/filter + card layout + body order, global UI rules, the no-purple palette, mobile-first responsiveness rules |
| [docs/parent.md](docs/parent.md) | a parent page or compare | Shared `parent-stats.js` ordering/inactive/streak helpers and navbar ownership |

`docs/archive/` holds the older, user-authored long-form docs (kept for reference;
they may have drifted from the above and from the code — these `docs/*.md` and the
code are the source of truth).
