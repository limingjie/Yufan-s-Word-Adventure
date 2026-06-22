# Learner Competition Feature — Specification

**Version:** 1.0
**Date:** 2026-06-21
**Status:** New Feature (Phase 7.5)

---

## Overview

Allow multiple learners to view each other's achievements, progress, and compete on leaderboards. Parents can also view all learners' progress in comparison.

---

## Design Principles

- **Friendly Competition:** Encourage learning, not stress
- **Privacy Optional:** Learners can choose to be public or private
- **Fair Comparison:** All metrics shown side-by-side
- **Visual Recognition:** Celebrate achievements and streaks
- **Motivation:** See peers progressing to inspire continued learning

---

## Feature Scope

### Learners Can See:
- ✅ Other learners' XP and level
- ✅ Other learners' mastered word count
- ✅ Other learners' streaks
- ✅ Other learners' achievements/badges
- ✅ Leaderboard rankings (XP, words mastered, streaks)
- ✅ Comparison cards (head-to-head with one other learner)

### Parents Can See:
- ✅ All learners' stats in comparison
- ✅ Charts showing multiple learners' progress
- ✅ Export data for all learners

### NOT Included:
- ❌ Real-time challenges/duels
- ❌ Messaging between learners
- ❌ Social sharing outside app
- ❌ Competitive points deducted for wrong answers

---

## Database Changes

### New Tables

**leaderboard_snapshots**
- Stores daily snapshots of each learner's stats
- Used for historical leaderboard views
- Enables trend analysis

**learner_stats_cache**
- Real-time stats for each learner
- Fast queries for leaderboards
- Updated after each review/quiz

### Modified Tables

**profiles**
- Added `avatar_color` (color for visual identification)
- Added `is_public` (toggle leaderboard visibility)

---

## UI Components (New)

### 1. Leaderboard Page — XP Rankings

**Route:** `#/child/leaderboard` or `#/learner/leaderboard`

**Display:**
```
┌──────────────────────────────────────────┐
│ 🏆 XP Leaderboard                        │
│                                          │
│ Rank │ Learner  │ Level    │ XP        │
│ ─────┼──────────┼──────────┼──────────  │
│ 1    │ Learner 2 │ 5        │ 850 XP    │
│ 2    │ Learner 1 │ 3        │ 450 XP    │
│                                          │
│ [📊 Mastered] [🔥 Streaks] [🏅 Badges]│
│                                          │
└──────────────────────────────────────────┘
```

**Components:**
- Leaderboard table (rank, name, level, XP)
- Tab switcher (XP, Mastered Words, Streaks)
- Highlight current user's row
- Show medal badges next to name if applicable

### 2. Leaderboard Page — Mastered Words

**Similar to XP leaderboard, but by word count:**
```
Rank │ Learner  │ Mastered │ Recent
─────┼──────────┼──────────┼────────
1    │ Learner 1 │ 25 words │ 📚
2    │ Learner 2 │ 15 words │
```

### 3. Leaderboard Page — Streaks

**Competition by consecutive days:**
```
Rank │ Learner  │ Streak  │ Status
─────┼──────────┼─────────┼──────────
1    │ Learner 2 │ 12 days │ 🔥🔥🔥
2    │ Learner 1 │ 5 days  │ 🔥
```

### 4. Head-to-Head Comparison

**Route:** `#/child/compare/[user_id]`

**Display:**
```
┌────────────────────────────────────────────┐
│ Comparing: Learner 1 vs Learner 2         │
│                                            │
│ ┌──────────────────┬──────────────────┐   │
│ │ Learner 1        │ Learner 2        │   │
│ │ Level: 3         │ Level: 5         │   │
│ │ 450 XP           │ 850 XP           │   │
│ │ 23 words         │ 35 words         │   │
│ │ 25 mastered      │ 28 mastered      │   │
│ │ Streak: 5 days   │ Streak: 12 days  │   │
│ │ Badges: 3        │ Badges: 6        │   │
│ └──────────────────┴──────────────────┘   │
│                                            │
│ Learner 1 has more words added!           │
│ Learner 2 has a longer streak!            │
│                                            │
│ [← Back] [Compare with Others]            │
│                                            │
└────────────────────────────────────────────┘
```

**Features:**
- Side-by-side stat comparison
- Highlight better stat in each category
- Show insights ("Learner 2 is X days ahead on streak")
- List learners to compare with

### 5. Achievements Showcase

**Route:** `#/child/achievements` (enhanced)

Show achievements grouped by learner:
```
┌──────────────────────────────────────────┐
│ 🏆 All Achievements                      │
│                                          │
│ ──── Learner 1's Badges ────             │
│ 🥉 Bronze Badge (100 words)             │
│ 🔥 7-Day Streak                         │
│                                          │
│ ──── Learner 2's Badges ────             │
│ 🥉 Bronze Badge (100 words)             │
│ 🥈 Silver Badge (500 words)             │
│ 🔥 30-Day Streak                        │
│ ⚡ Speed Reader                         │
│                                          │
└──────────────────────────────────────────┘
```

### 6. Profile Card (in Leaderboards)

Click learner name to see profile card:
```
┌──────────────────────────────────────────┐
│ 🟢 Learner 2's Profile                  │
│                                          │
│ Level: 5 - Vocabulary Wizard             │
│ XP: 850 / Next Level at 700+             │
│                                          │
│ Statistics:                              │
│ • Words Added: 35                        │
│ • Mastered: 28                           │
│ • Current Streak: 12 days 🔥🔥🔥       │
│ • Accuracy: 88%                          │
│ • Total Tests: 156                       │
│                                          │
│ Achievements: 6 badges                   │
│ 🥉 🥈 🏅 🔥 🔥 ⚡                        │
│                                          │
│ [← Close]                                │
│                                          │
└──────────────────────────────────────────┘
```

---

## Parent Dashboard Updates

### New Section: Learner Comparison

**Display all learners' stats in comparison:**

```
┌──────────────────────────────────────────┐
│ 📊 Learner Comparison (Last 30 Days)    │
│                                          │
│ ──── XP Earned ────                      │
│ Learner 1:  +180 XP  ✓                    │
│ Learner 2: +220 XP  ✓                    │
│                                          │
│ ──── Words Added ────                    │
│ Learner 1:  8 words                       │
│ Learner 2: 12 words                      │
│                                          │
│ ──── Reviews Completed ────              │
│ Learner 1:  45 reviews                    │
│ Learner 2: 62 reviews                    │
│                                          │
│ ──── Accuracy ────                       │
│ Learner 1:  82% (correct/total)           │
│ Learner 2: 88% (correct/total)           │
│                                          │
│ [📈 Chart] [Export All Data]            │
│                                          │
└──────────────────────────────────────────┘
```

### Charts with Multiple Learners

- XP progress over time (separate lines per learner)
- Words added per day (separate bars per learner)
- Accuracy trend (separate lines per learner)

---

## Leaderboard Query Strategy

### Query 1: XP Leaderboard (Current)

```sql
SELECT
  p.id,
  p.display_name,
  p.avatar_color,
  COUNT(DISTINCT w.id) * 1 as words_added_xp,
  COUNT(DISTINCT tr.id) * 2 as reviews_xp,
  SUM(CASE WHEN tr.correct THEN 3 ELSE 0 END) as correct_xp,
  COALESCE(COUNT(DISTINCT w.id), 0) * 1 +
  COALESCE(COUNT(DISTINCT tr.id), 0) * 2 +
  COALESCE(SUM(CASE WHEN tr.correct THEN 3 ELSE 0 END), 0) as total_xp
FROM profiles p
LEFT JOIN words w ON p.id = w.user_id
LEFT JOIN test_results tr ON p.id = tr.user_id
WHERE p.is_public = true AND p.role = 'learner'
GROUP BY p.id, p.display_name, p.avatar_color
ORDER BY total_xp DESC;
```

### Query 2: Mastered Words Leaderboard

```sql
SELECT
  p.id,
  p.display_name,
  p.avatar_color,
  COUNT(DISTINCT CASE WHEN rs.review_level >= 4 THEN rs.word_id END) as mastered_count
FROM profiles p
LEFT JOIN review_schedule rs ON p.id = (
  SELECT user_id FROM words WHERE id = rs.word_id
)
WHERE p.is_public = true AND p.role = 'learner'
GROUP BY p.id, p.display_name, p.avatar_color
ORDER BY mastered_count DESC;
```

### Query 3: Streak Leaderboard

Calculated in JS library (complex logic with date ranges).

---

## Privacy Controls

### Learner Settings

**Route:** `#/child/settings`

```
┌──────────────────────────────────────────┐
│ ⚙️ Your Settings                         │
│                                          │
│ Display Name: [Learner 1] (edit)        │
│ Avatar Color: [Choose color]            │
│                                          │
│ Privacy:                                 │
│ [✓] Show me in leaderboards             │
│ [ ] Hide my progress from others        │
│ [ ] Only show achievements              │
│                                          │
│ [Save Changes]                          │
│                                          │
└──────────────────────────────────────────┘
```

**Options:**
- `is_public = true`: Show all stats in leaderboards
- `is_public = false`: Only visible to parent

---

## Implementation Order

### Phase 7.5: Learner Competition

1. **Update database** (DONE in SUPABASE_SETUP.sql)
2. **Leaderboard queries** — write query functions in backend
3. **Leaderboard pages** — create UI components
4. **Head-to-head comparison** — build comparison card
5. **Profile cards** — clickable learner profiles
6. **Parent comparison dashboard** — multi-learner stats
7. **Privacy settings** — allow learners to control visibility
8. **Streak calculation** — enhanced for leaderboards
9. **Testing** — verify leaderboard accuracy and performance

**Estimated:** 2 weeks (Days 56–70 if in original timeline)

---

## Visual Design

### Color Scheme

Each learner gets a unique avatar color (from profiles table):
- Learner 1: `#3498DB` (Blue)
- Learner 2: `#E74C3C` (Red)

These colors used in:
- Leaderboard name display
- Comparison cards
- Charts (separate colors per learner)
- Profile badges

### Icons

- 🏆 Leaderboard / Rankings
- 📊 Stats / Comparison
- 🟢 Online status / Activity (if real-time added later)
- 🔥 Streak count
- 🥇 🥈 🥉 🏅 Medals/badges

---

## Performance Considerations

### Caching Strategy

**learner_stats_cache table:**
- Updated after each review/quiz
- Stores pre-calculated stats
- Fast queries for leaderboards

**Cache invalidation:**
- After test_results INSERT
- After review_schedule UPDATE
- After achievements INSERT

### Query Optimization

```sql
-- Use cache instead of live calculation
SELECT
  p.id,
  p.display_name,
  p.avatar_color,
  lsc.total_xp,
  lsc.current_level,
  lsc.mastered_words_count,
  lsc.current_streak
FROM profiles p
JOIN learner_stats_cache lsc ON p.id = lsc.user_id
WHERE p.is_public = true
ORDER BY lsc.total_xp DESC;
```

---

## Security & RLS

### Policies

- **Public learners:** Everyone can see public stats
- **Private learners:** Only parents can see
- **Own stats:** Always accessible
- **Parent view:** Can see all learners

### RLS Enforcement

All queries filtered by `is_public` and user role.

---

## Future Enhancements

(Post-MVP):
- Real-time challenges/duels
- Seasonal leaderboards (monthly reset)
- Team competition (if more learners added)
- Achievements notifications when others level up
- Learner messaging/encouragement

---

## Migration Path

### From Single-Learner to Multi-Learner

Original design assumed 1 child + 1 parent.

**Changes:**
1. ✅ Create `profiles` role system (learner vs parent)
2. ✅ Update RLS to support multiple learners
3. ✅ Add `leaderboard_snapshots` and `learner_stats_cache` tables
4. ✅ Update UI for competition features
5. ✅ Update parent dashboard for multi-learner comparison

**Backward Compatibility:**
- Original single-learner setup still works
- Just add more learners to get competition
- No data migration needed

---

## References

- COMPONENT_SPECS.md — UI component specifications
- TECHNICAL_ARCHITECTURE.md — Leaderboard queries
- DATABASE_SCHEMA.md — Table structure
- SUPABASE_SETUP.sql — Database migration

---

