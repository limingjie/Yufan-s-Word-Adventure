# Verification & Testing Guide

After you complete the Supabase setup, use these scripts to verify everything is working correctly.

---

## Part 1: Database Verification

Run these SQL queries in Supabase SQL Editor to verify tables and data.

### Query 1: Verify All Tables Created

```sql
-- Check all tables exist (should show 8 tables)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected output:
-- achievements
-- learner_stats_cache
-- leaderboard_snapshots
-- profiles
-- review_schedule
-- test_results
-- words
```

### Query 2: Verify RLS Enabled

```sql
-- Check RLS is enabled on all tables (should show 8)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected: all have rowsecurity = true
```

### Query 3: Verify Profiles Created

```sql
-- Check learner profiles exist (should show 2)
SELECT
  id,
  role,
  display_name,
  avatar_color,
  is_public,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- Expected output:
-- Learner 1 | learner | Learner 1 | #3498DB | true | 2026-06-21 12:00:00
-- Learner 2 | learner | Learner 2 | #E74C3C | true | 2026-06-21 12:00:00
```

### Query 4: Check Auth Users

```sql
-- Check auth users (should show 2)
SELECT
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Expected output:
-- a1b2c3d4-... | learner1@example.com | 2026-06-21 12:00:00
-- z9y8x7w6-... | learner2@example.com | 2026-06-21 12:00:00
```

### Query 5: Verify Leaderboard Policy

```sql
-- Test public access (simulate leaderboard query)
-- This shows what public users see in leaderboards
SELECT
  p.id,
  p.display_name,
  p.avatar_color,
  p.role,
  p.is_public
FROM profiles p
WHERE p.is_public = true
  AND p.role = 'learner'
ORDER BY p.display_name;

-- Expected: Both learners visible
```

### Query 6: Count Indexes

```sql
-- Check indexes created (should show 10+)
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## Part 2: Frontend Connection Test

Test in browser console after loading your app.

### Test 1: Supabase Client Connected

```javascript
// In browser console, after app loads:
console.log(supabase)

// Should show: { auth: {...}, from: (...) }
// If undefined, check config.js has correct URL and key
```

### Test 2: Get Current Session

```javascript
// Check if logged in
const { data } = await supabase.auth.getSession()
console.log(data)

// If logged in: { session: { user: {...}, access_token: "..." } }
// If not logged in: { session: null }
```

### Test 3: Fetch User Profile

```javascript
// Get current user's profile
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()
console.log(profile)

// Should show: { id: "...", role: "learner", display_name: "Learner 1", ... }
```

### Test 4: Test Leaderboard Query

```javascript
// Query public leaderboards (what learners see)
const { data: leaderboard } = await supabase
  .from('profiles')
  .select('id, display_name, avatar_color, role, is_public')
  .eq('is_public', true)
  .eq('role', 'learner')
  .order('display_name')

console.log(leaderboard)

// Should show: [ { id: "...", display_name: "Learner 1", ... }, { id: "...", display_name: "Learner 2", ... } ]
```

### Test 5: Insert Sample Data (Test Only)

```javascript
// Add a test word as logged-in user
const { data: word, error } = await supabase
  .from('words')
  .insert({
    user_id: 'current-user-uuid-here',
    word: 'test',
    english_definition: 'a test word'
  })
  .select()

console.log(word, error)

// Should show: { id: "...", word: "test", ... }
```

---

## Part 3: Functional Testing

### Test 3.1: User Authentication Flow

```
✅ Login as Learner 1
  1. Go to app URL
  2. Click login
  3. Enter: learner1@example.com / password
  4. Should redirect to home page
  5. Header should show: XP 0 | Level 1

✅ View Profile
  1. Click user menu (top-right)
  2. Should show: Learner 1 | Logout
  3. Click profile (if exists)
  4. Should show profile info

✅ Logout
  1. Click Logout
  2. Should redirect to login page

✅ Login as Learner 2
  1. Same steps as Learner 1
  2. Should show: learner2@example.com login success
```

### Test 3.2: Add Word

```
✅ Add Word Manually
  1. Home page → "Add Word" button
  2. Enter: "curious"
  3. Click "Manual Entry"
  4. Fill in definition, category
  5. Click "Save"
  6. Should show: "+1 XP"
  7. Verify word appears in Word List
  8. Verify in database: SELECT * FROM words

✅ Auto-Lookup (requires Edge Function)
  1. Enter word
  2. Wait 300ms
  3. Should fetch from Free Dictionary API
  4. Show preview with definition
  5. Save
```

### Test 3.3: Review Session

```
✅ Start Review
  1. Home page → "Review Today" or "Start Review"
  2. Should show: "No words due today" (if empty)
  3. Add 3+ words first
  4. Wait until next day (or manually adjust review date in DB)
  5. Start review
  6. Should show first word

✅ Complete Review
  1. Click "Got it" or "Didn't get it"
  2. Move to next word
  3. After last word, show summary
  4. Should show: XP earned, level, streak

✅ Verify DB Update
  1. Check test_results: INSERT logged
  2. Check review_schedule: next_review_date updated
  3. Check XP calculated correctly
```

### Test 3.4: Leaderboard (New Feature)

```
✅ View XP Leaderboard
  1. Home page → "Leaderboard" or "Rankings"
  2. Should show table: Rank | Learner | Level | XP
  3. Both learners visible
  4. Click learner name → profile card

✅ View Mastered Words Leaderboard
  1. Click "Mastered Words" tab
  2. Should show: Rank | Learner | Words Mastered
  3. Initially empty (no words mastered yet)
  4. Complete enough reviews to reach level 4+
  5. Mastered count increases

✅ View Streaks Leaderboard
  1. Click "Streaks" tab
  2. Should show: Rank | Learner | Streak | Status
  3. Complete reviews on consecutive days
  4. Streak updates

✅ Head-to-Head Comparison
  1. Click learner name in leaderboard
  2. Click "Compare" button
  3. Should show side-by-side stats
  4. Highlight better stat in each category
```

### Test 3.5: Parent Dashboard

```
✅ Login as Parent
  1. Create parent user in Auth (if not exists)
  2. Login with parent credentials
  3. Should redirect to /parent/dashboard

✅ View Stats
  1. Dashboard should show cards:
     - Words Added (total)
     - Mastered Words
     - Current Streak
     - Total XP

✅ View Charts
  1. Should show 3+ charts:
     - Words added per day (30 days)
     - Test accuracy over time
     - Review completion per week

✅ View Learner Comparison
  1. Should show: Learner 1 vs Learner 2 comparison
  2. Cards with stats side-by-side
  3. Insights ("Learner 2 has more streaks")

✅ Export Data
  1. Click "Export CSV"
  2. CSV file downloads
  3. Open in Excel/Sheets
  4. Verify data correct
```

---

## Part 4: RLS Policy Testing

### Test RLS: Child Can Only See Own Data

```javascript
// Log in as Learner 1 (not Learner 2)
const { data: learner1_data } = await supabase
  .from('words')
  .select('*')

// Should ONLY show Learner 1's words, not Learner 2's
console.log(learner1_data)
```

### Test RLS: Parent Can See All Data

```javascript
// Log in as parent
const { data: all_words } = await supabase
  .from('words')
  .select('*')

// Should show ALL words (from all learners)
console.log(all_words)
```

### Test RLS: Public Leaderboard Access

```javascript
// Test as any user (or anonymous)
const { data: leaderboard } = await supabase
  .from('profiles')
  .select('*')
  .eq('is_public', true)

// Should show public learners ONLY
console.log(leaderboard)
```

---

## Troubleshooting Checklist

### If leaderboard shows no users:

```sql
-- Verify profiles have is_public = true
SELECT * FROM profiles WHERE is_public = false;

-- If found, update:
UPDATE profiles SET is_public = true WHERE role = 'learner';

-- Verify role is 'learner' (not 'child')
SELECT * FROM profiles WHERE role != 'learner';
```

### If login fails:

```sql
-- Verify user exists in auth.users
SELECT id, email FROM auth.users;

-- Verify profile exists for user
SELECT * FROM profiles WHERE role = 'learner';

-- Check RLS policy allows login
SELECT * FROM profiles WHERE id = 'user-id-here';
-- Should return user's profile
```

### If can't see other learners' data:

```javascript
// Check RLS policy for public leaderboard
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('role', 'learner')
  .eq('is_public', true)

console.log(error) // Should be null
console.log(data)  // Should show all public learners
```

### If XP doesn't calculate:

```sql
-- Check test_results recorded
SELECT COUNT(*) FROM test_results WHERE user_id = 'learner-uuid';

-- Check review_schedule updated
SELECT COUNT(*) FROM review_schedule WHERE user_id = 'learner-uuid';

-- Manually calculate XP
SELECT
  (SELECT COUNT(*) FROM words WHERE user_id = 'learner-uuid') * 1 as word_xp,
  (SELECT COUNT(*) FROM test_results WHERE user_id = 'learner-uuid') * 2 as review_xp,
  (SELECT COUNT(*) FROM test_results WHERE user_id = 'learner-uuid' AND correct) * 3 as correct_xp;
```

---

## Performance Testing

### Query Response Times

```sql
-- Should complete in < 100ms
EXPLAIN ANALYZE
SELECT p.id, p.display_name, COUNT(DISTINCT w.id) as words_added
FROM profiles p
LEFT JOIN words w ON p.id = w.user_id
WHERE p.is_public = true AND p.role = 'learner'
GROUP BY p.id, p.display_name
ORDER BY words_added DESC;
```

### Index Verification

```sql
-- Verify indexes exist and are used
SELECT * FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- High idx_scan = index is being used efficiently
```

---

## Cleanup (Test Data Removal)

After testing, clean up:

```sql
-- Delete test words
DELETE FROM words WHERE user_id IN (
  SELECT id FROM profiles WHERE role = 'learner'
);

-- Delete test results
DELETE FROM test_results WHERE user_id IN (
  SELECT id FROM profiles WHERE role = 'learner'
);

-- Reset review schedule
DELETE FROM review_schedule;

-- Note: Keep profiles and auth users
```

---

## Success Criteria

✅ All 8 tables created
✅ RLS enabled on all tables
✅ 2 auth users created
✅ 2 learner profiles created
✅ Login works for both learners
✅ Leaderboard query returns both learners
✅ Parent dashboard loads
✅ Multi-learner comparison displays

---

## Next Actions

Once all tests pass:

1. ✅ Database setup complete
2. ⏳ Frontend implementation starts
3. ⏳ Leaderboard pages built
4. ⏳ Competition features tested end-to-end
5. ⏳ Ready for launch

---

