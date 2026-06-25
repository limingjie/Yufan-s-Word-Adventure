# Changes from Single-Child to Multi-Learner Competition

**Summary:** How the original design evolves to support competition

---

## Role Changes

### Original Design
```
users:
├── child (1 learner)
└── parent (1 monitor)
```

### New Design
```
users:
├── learner (multiple)
│   ├── Learner 1
│   └── Learner 2
└── parent (1 or more monitors)
```

**Impact:**
- Original `role IN ('child', 'parent')` becomes `role IN ('learner', 'parent')`
- Profiles table now supports N learners
- Auth policies updated to show public learner data

---

## Database Schema Changes

### Original Tables (6 tables)
1. `profiles` — User metadata
2. `words` — Learner's vocabulary
3. `review_schedule` — SRS scheduling
4. `test_results` — Quiz history
5. `achievements` — Badges and medals
6. `daily_stats` — Optional aggregation

### New Tables (Added 2)
7. `leaderboard_snapshots` — Historical leaderboard data
8. `learner_stats_cache` — Real-time stats for leaderboards

### Schema Changes to Existing Tables

**profiles table:**
```sql
-- ADDED columns:
avatar_color text DEFAULT '#007BFF'     -- For visual identification
is_public boolean DEFAULT true          -- Toggle leaderboard visibility
```

**RLS policies updated:**
```sql
-- NEW: Anyone can see public learner profiles
CREATE POLICY "anyone_select_public_learners"
  ON profiles FOR SELECT
  USING (is_public = true AND role = 'learner');

-- NEW: Anyone can see public learner achievements
CREATE POLICY "anyone_select_public_learner_achievements"
  ON achievements FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true));
```

---

## UI Changes

### Original Pages (8 learner pages)
```
Child Pages:
├── Login (shared)
├── Home
├── Add Word
├── Word List
├── Review
├── Quiz
├── Garden
└── Achievements

Parent Pages:
├── Dashboard
├── Words View
└── (Login shared)
```

### New Pages (Added 4 learner pages + 1 parent enhancement)

**Learner Pages (NEW):**
```
├── Leaderboard (XP rankings)
├── Leaderboard — Mastered Words
├── Leaderboard — Streaks
├── Head-to-Head Comparison
├── Settings (privacy controls)
```

**Parent Pages (ENHANCED):**
```
├── Dashboard (multi-learner comparison added)
└── (other pages remain similar)
```

---

## Feature Additions

### For Learners

| Feature                        | Original | New                     |
| ------------------------------ | -------- | ----------------------- |
| View own XP                    | ✅        | ✅                       |
| View own achievements          | ✅        | ✅                       |
| View others' XP                | ❌        | ✅ XP Leaderboard        |
| View others' achievements      | ❌        | ✅ Achievements Showcase |
| See mastered words leaderboard | ❌        | ✅ Leaderboard page      |
| See streaks leaderboard        | ❌        | ✅ Leaderboard page      |
| Head-to-head comparison        | ❌        | ✅ Compare page          |
| Privacy settings               | ❌        | ✅ Settings page         |

### For Parents

| Feature              | Original | New                          |
| -------------------- | -------- | ---------------------------- |
| View child stats     | ✅        | ✅                            |
| View child charts    | ✅        | ✅                            |
| Export child data    | ✅        | ✅                            |
| Compare all learners | ❌        | ✅ Comparison cards           |
| Multi-learner charts | ❌        | ✅ Separate lines per learner |
| Multi-learner export | ❌        | ✅ Export all learners        |

---

## API Queries (New)

### Leaderboard Queries

**1. XP Ranking (all public learners):**
```javascript
// Returns: [{id, name, level, xp, avatar_color}, ...]
// Sorted by XP descending
```

**2. Mastered Words Ranking:**
```javascript
// Returns: [{id, name, mastered_count, avatar_color}, ...]
// Sorted by mastered count descending
```

**3. Streak Ranking:**
```javascript
// Returns: [{id, name, streak_days, avatar_color}, ...]
// Sorted by streak descending
```

**4. Head-to-Head Comparison:**
```javascript
// Returns: Two learners' stats side-by-side
// [{learner1_stats}, {learner2_stats}]
```

**5. Learner Profile:**
```javascript
// Returns: Full profile with all stats
// {id, name, level, xp, achievements, mastered, streak, accuracy}
```

---

## Authentication & Authorization

### Original RLS Model
```
Child can access:
├── Own words
├── Own reviews
├── Own tests
└── Own achievements

Parent can access:
├── View child words (read-only)
├── View child reviews (read-only)
├── View child tests (read-only)
└── View child achievements (read-only)
```

### New RLS Model
```
Learner can access:
├── Own data (all)
├── Public learners' stats (leaderboards)
└── Public learners' achievements (showcase)

Parent can access:
├── Own data (all)
├── All learners' data (read-only)
└── Leaderboards (comparison view)
```

---

## Migration Path (Non-Breaking)

### No Breaking Changes
- Original single-learner setup still works
- Just treat one learner as the app's "main" learner
- Add more learners to enable competition features
- Existing data remains untouched

### Database Migration Steps
1. Add `avatar_color` and `is_public` to profiles
2. Create `leaderboard_snapshots` table
3. Create `learner_stats_cache` table
4. Update RLS policies
5. Add new pages to frontend
6. No data loss or migration needed

---

## Backward Compatibility

✅ **Fully backward compatible** with original design:

- If you only have 1 learner, app works exactly as before
- Leaderboard pages just show 1 entry
- Parent dashboard works with 1 or N learners
- All original features unchanged

---

## Implementation Order

### Phase 1: Database (Week 1)
- [ ] Add columns to `profiles`
- [ ] Create new tables
- [ ] Update RLS policies
- [ ] Insert test learners

### Phase 2: Backend Queries (Week 1-2)
- [ ] Implement leaderboard queries
- [ ] Create profile query
- [ ] Create comparison query
- [ ] Cache update functions

### Phase 3: Frontend Pages (Week 2-3)
- [ ] Leaderboard pages (XP, words, streaks)
- [ ] Head-to-head comparison
- [ ] Learner profile cards
- [ ] Settings page

### Phase 4: Parent Dashboard (Week 3)
- [ ] Multi-learner comparison cards
- [ ] Multi-learner charts
- [ ] Export all learners

### Phase 5: Testing & Polish (Week 4)
- [ ] Full end-to-end testing
- [ ] Performance optimization
- [ ] UX refinement

---

## Performance Impact

### Storage
- **New tables:** ~1 MB per 1000 learners per year (snapshots)
- **Cache:** ~1 KB per learner
- **Total:** ~100 KB for 2 learners (negligible)

### Query Speed
- **Leaderboard queries:** <100ms (with cache)
- **Profile queries:** <50ms
- **Comparison queries:** <50ms
- **Parent dashboard:** <200ms (multiple queries)

### Recommendations
- Keep `learner_stats_cache` updated after each action
- Take `leaderboard_snapshots` daily for history
- Index on public profiles for fast leaderboard queries

---

## Configuration Options (Future)

### Privacy Settings
- `is_public` (boolean) — Show in leaderboards
- `show_achievements` (boolean) — Show badges to others
- `show_streak` (boolean) — Show streak in leaderboards

### Competition Rules (Future)
- Seasonal leaderboards (monthly reset)
- Category-based competition
- Time-based challenges
- Points multipliers for achievements

---

## Rollback Plan

If competition feature doesn't work out:

1. Keep `is_public = false` for all learners (they won't show in leaderboards)
2. Disable leaderboard pages in router
3. Remove leaderboard links from UI
4. Keep all data intact for potential re-enablement

No data loss, purely UI/router changes.

---

## Summary of Changes

| Aspect                 | Change                    | Impact              |
| ---------------------- | ------------------------- | ------------------- |
| **Database**           | +2 tables, +2 columns     | ~100 KB storage     |
| **Roles**              | child → learner (renamed) | Auth/RLS updated    |
| **Pages**              | +5 new pages              | ~10 KB code         |
| **Queries**            | +5 new query functions    | <100ms each         |
| **RLS Policies**       | +4 new policies           | Public data visible |
| **Breaking Changes**   | None                      | Fully compatible    |
| **Migration Required** | No                        | Works as-is         |

---

## Next Steps

1. ✅ Review this document
2. ✅ Run `SUPABASE_SETUP.sql` to create tables
3. ✅ Create learner profiles
4. ⏳ Implement leaderboard queries
5. ⏳ Build leaderboard pages
6. ⏳ Test competition features

---

