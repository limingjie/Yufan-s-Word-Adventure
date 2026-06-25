# Parent Views

> Detail doc for [CLAUDE.md](../CLAUDE.md). How the parent-facing pages share
> stats and ordering.

All parent pages (`parent-dashboard`, `parent-words`, `parent-activity`) and the compare screen order learners consistently via `js/lib/parent-stats.js`:

- `loadLearnersSorted()` — fetches learner profiles + stats, sorted by **Sunlight desc, then words desc**.
- `compareByStats(a, b)` — the shared comparator.
- `isInactive(stats)` — true when Sunlight is 0 **or** words is 0. On the dashboard, inactive learners render as a collapsed `<details>` card ("No activity yet") instead of a full card; they're also excluded from the activity chart.
- `fetchStreak(userId)` — consecutive-day activity streak (used by compare).

Navigation between parent pages is the responsibility of the top navbar (`app.js renderNavbar`); pages do **not** repeat nav links beside their `<h2>`. The dashboard's only header action is "Compare learners".
