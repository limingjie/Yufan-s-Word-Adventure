# The Reward System & Achievements

> Detail doc for [CLAUDE.md](../CLAUDE.md). The connected reward backbone — two
> derived currencies plus badges, all wired through one connector.

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
SRS/mastery**). Spent in the Garden Shop (see [garden.md](garden.md)).

`placeable: true` items (road/rail/crossing/fence/station/car/train) are dragged
onto chosen blocks and remember their position (`col/grid_row/rotation` on
`garden_items`). Ground animals also keep a persisted home cell there so fences
can constrain their roaming — see [garden.md](garden.md). Removing a placed item
deletes its row, which **refunds** the coins automatically because the balance is
derived (`earned − Σ costs`).

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
