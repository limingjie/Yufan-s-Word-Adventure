# Learning: SRS, Daily Missions & Quizzes

> Detail doc for [CLAUDE.md](../CLAUDE.md). The learning loop: spaced repetition,
> daily missions, and the quiz types. See also [rewards.md](rewards.md) for what
> activities award.

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

**What advances the ladder.** Reaching mastery takes ~4 correct reviews over
~25 days, so most retention work is re-practising *older* words. A flashcard
review (`completeReview`) always advances the ladder. Meaning/spelling quizzes
on **today's** new words do **not** (those are pure same-day practice — missions
3–4). But in the **older-word mixed drill** (mission 5), every modality advances
the ladder: a correct recall in review *or* meaning *or* spelling counts and
reschedules the word. Quiz pages take `advanceSrs` for this (`pages/quiz.js`).

---

## Daily Missions

Defined in `js/lib/missions.js`; progress data comes from `db.getDailyProgress(userId)`. Shown interactively on `#/learner/home` and read-only on the parent dashboard (`renderMissionList(missions, { readOnly: true })`).

Five missions per day (`MISSION_NEW_WORDS = 15`, `MISSION_REVIEW_CURVE = 30`):

1. **Add 15 new words** — always unlocked.
2. **Review today's new words** ┐
3. **Meaning quiz (today's words)** ├─ unlock once mission 1 is met; targets scale to the number of words added today.
4. **Spelling quiz (today's words)** ┘
5. **Practice older words** — always unlocked; the older-word **mixed drill** (see below); target is min(30, still-due curve words).

Missions 2–4 only count `test_results` rows for **today's** new words (mission 2 via `test_type = 'review'`, missions 3–4 via `'meaning'`/`'spelling'`). Mission 5 counts **older** words (created before today) answered correctly in **any** of the three modalities — `getDailyProgress.reviewsCurveDone` is the distinct-older-word union across `review`/`meaning`/`spelling`. The progress number is always **distinct words answered *correctly* today** — a wrong answer does not advance the goal, so failing words lowers the count and the 85% threshold has to be earned.

### Older-word mixed drill (mission 5)

`pages/curve-drill.js` (route `#/learner/curve-drill`, no nav tab — reached from the mission card). It pulls the SRS-due older words (`getWordsForReviewToday('curve')`, capped at 30), **round-robins** them across three back-to-back phases — flashcard review → meaning quiz → spelling quiz (≈10/10/10, balanced even when fewer are due, e.g. 12 → 4/4/4) — and shows **one** result screen with a single `runAfterActivity` for the whole drill. A shared coin wallet carries hint spending across phases. Every phase runs with `advanceSrs`, so each due word climbs the ladder once. The drill reuses the same renderers as the standalone pages: `runReviewSession` (exported from `pages/review.js`) and `startMeaning`/`startSpelling` (exported from `pages/quiz.js`, which take an injected `deck` + `wallet` + `advanceSrs` + `onComplete`).

**Completion threshold: 85%.** A mission is "done" once `current >= ceil(target × MISSION_TARGET_PCT)` (`MISSION_TARGET_PCT = 0.85`, exported from `missions.js` as `missionThreshold(target)`) — a little slack so a missed word or two doesn't block the day. The displayed target stays the full number; the progress bar snaps to full when the 85% mark is reached. The rule is applied in `buildMissions` (learner home + parent dashboard share it, so the view is identical) and mirrored in `getMissionHistory`'s `coreDone`.

**Per-mission color (themed).** Each card is tinted by its `data-key` via a `--mc` CSS variable (left accent stripe + icon chip + progress bar): add = blue, reviewNew = teal, meaning = rose, spelling = orange, reviewCurve = green. The `.mission-card[data-key]` attribute selector outranks the state classes so the stripe keeps its color in every state.

**Today's accuracy + effort in the description.** `getDailyProgress` also returns today's accuracy per tested mission (`reviewsNewAcc`, `reviewsCurveAcc`, `meaningAcc`, `spellingAcc` — % correct over *attempts*, scoped the same way as each mission's count, `null` when nothing attempted yet) plus the matching attempt totals (`reviewsNewTries`, `meaningTries`, `spellingTries`, `reviewsCurveTries`). `buildMissions` carries these as `accuracy`/`attempts` and the mission subtitle appends `🎯 N% · M tries` (the `add` mission has none). Shown on both learner home and parent dashboard.

### Mission history (parent dashboard)

`db.getMissionHistory(userId, days = 14)` returns one row per day (newest first) reconstructed from `words.created_at` and `test_results`: `{ date, wordsAdded, reviewsNew, reviewsCurve, meaning, spelling, totalTests, hasActivity, coreDone }`. Each parent dashboard card has a lazy-loaded "View mission history" toggle that renders the days with activity.

`coreDone` reflects the add goal **plus** the three new-word practice missions only — the "review older words" mission is excluded because its point-in-time due-state can't be reconstructed historically.

---

## Quiz Types

Every review and quiz session shows a **live accuracy rate** in the in-session header (e.g. `7 correct · 88%`, computed from answers so far), and the completion screen shows the final `X / Y correct (pct%)`.

**Deck size:** a quiz is normally 15 words, but if more than 15 new words were added today the deck grows to cover **all** of today's new words (`deckSizeFor()` = `max(15, newWordsToday)`), so the day's practice missions stay completable. Review scope `'new'` is already uncapped (`getWordsForReviewToday('new')`); the `'curve'`/`'all'` review queues stay capped at 30.

**Daily practice cap (anti-grind):** in the meaning/spelling selector & mission decks, a word that's already been quizzed `DAILY_QUIZ_CAP = 5` times **today in that modality** drops out of the deck (`db.getTodayAttemptCounts(testType)` → filter in `startMeaning`/`startSpelling` when no `opts.deck`). When everything is capped, the quiz shows a "Great practising!" screen pointing to the older-word drill. This throttles the "re-quiz the same words to farm coins" loop **without touching the coin formula** — coins are still earned per attempt (Decision 13 intact); there are simply fewer attempts to make. Flashcard *review* needs no cap: a rating advances SRS and pushes `next_review_date` out, so each word self-limits to ~once/day. The older-word drill passes its own `opts.deck` (SRS-due words, also ~once/day) and is exempt.

### Meaning Quiz
- Show the word
- 4 options: 1 correct + 3 random distractors from word list
- Option text = **single best definition** via `pickBestDef()`: picks the longest line from `english_definition`, strips the leading "(pos) " tag — prevents the full multi-definition dump from making the answer obvious
- If word list < 4 words, pad with hardcoded common words
- Each option carries the Chinese meaning of **its own** word (`buildOptions` adds `chinese` per option), shown as a hidden `.opt-chi` line under each option button.
- **Two paid hint buttons, each costs 1 coin:**
  - "➗ Remove 2 Answers" — fades out two wrong options.
  - "🇨🇳 Reveal Chinese Meanings" — reveals **every** option's own Chinese meaning (the corresponding Chinese of each definition, not the question word's); only rendered when at least one option has a Chinese meaning.
  - The two are independent (no ordering/gating between them). Each is single-use per question and disables once used, after the question is answered, or when the wallet can't afford it.

### Spelling Quiz

- Prompt shows **part of speech + English definition(s) + Chinese meaning** (all three)
- Input is **one box per letter** (so the word length is visible by default). Editable boxes accept a single letter each and auto-advance; non-letter characters (spaces, hyphens, apostrophes…) render as **pre-revealed** static cells
- **Hint (cost 1 🪙):** "💡 First & last letter" reveals and locks the first and last letter boxes
- Compare case-insensitive, trimmed (reconstructed from the boxes)

### Quiz hint coins

Hints are spent live via `buyGardenItem()` against hidden `SHOP` entries (`hint5050`, `hintMeaningChi`, `hintSpelling`, each `type: 'hint'`, `cost: 1`, `hidden: true`). Because `type: 'hint'` is **not** one-off, every purchase is re-counted in `getUserCoins()` — i.e. each hint really costs a coin. `shopList()` filters out `hidden` items so they never appear in the Garden Shop. The quiz result screen subtracts hint coins from the celebrated earnings.

**Hint button styling:** paid hint buttons use the `.coin-btn` class — a **golden background + border** matching the home coin chip (`.coin-chip`). They do **not** show a minus sign, parentheses, or a number; the cost is shown as a plain `🪙` (just the coin glyph) in a `.coin-cost` span. Used in both quizzes (meaning: "Remove 2 Answers" / "Reveal Chinese Meanings"; spelling: "First & last letter").

### Listening Quiz (Phase 2)
- Use browser `SpeechSynthesis` API — no external API needed
- Speak the word, user types spelling
