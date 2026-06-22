# Supabase Complete Setup SQL Script

Copy and paste this entire script into Supabase SQL Editor and click Run.

```sql
-- ============================================================================
-- MULTI-LEARNER DATABASE SCHEMA FOR WORD ADVENTURE
-- Run this script in Supabase SQL Editor
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES TABLE (Updated for multiple learners)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('learner', 'parent')),
  display_name  text NOT NULL,
  avatar_color  text DEFAULT '#007BFF',           -- Avatar color for competition
  is_public     boolean DEFAULT true,             -- Show in leaderboards
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "users_select_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Anyone can select public learner profiles (for leaderboards)
CREATE POLICY "anyone_select_public_learners"
  ON profiles FOR SELECT
  USING (is_public = true AND role = 'learner');

-- Users can update their own profile
CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================================================
-- 2. WORDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS words (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word                text NOT NULL,
  ipa                 text,
  part_of_speech      text,
  english_definition  text,
  chinese_definition  text,
  example_sentence    text,
  category            text DEFAULT 'general',
  is_favorite         boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_words_user_id_created ON words(user_id, created_at DESC);
CREATE INDEX idx_words_user_id_word ON words(user_id, word);

ALTER TABLE words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_words"
  ON words FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_words"
  ON words FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_words"
  ON words FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_words"
  ON words FOR DELETE
  USING (user_id = auth.uid());

-- Parents can view all learners' words
CREATE POLICY "parent_select_learner_words"
  ON words FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ============================================================================
-- 3. REVIEW_SCHEDULE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_schedule (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id          uuid NOT NULL UNIQUE REFERENCES words(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  next_review_date date NOT NULL DEFAULT CURRENT_DATE,
  review_level     int DEFAULT 0,
  ease_factor      float DEFAULT 2.5,
  interval_days    int DEFAULT 1,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_review_schedule_next_date ON review_schedule(next_review_date, user_id);
CREATE INDEX idx_review_schedule_word_id ON review_schedule(word_id);

ALTER TABLE review_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_review"
  ON review_schedule FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_review"
  ON review_schedule FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_review"
  ON review_schedule FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "parent_select_learner_reviews"
  ON review_schedule FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ============================================================================
-- 4. TEST_RESULTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id     uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_type   text NOT NULL CHECK (test_type IN ('meaning', 'spelling', 'listening')),
  correct     boolean NOT NULL,
  response    text,
  tested_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_test_results_user_id ON test_results(user_id, tested_at DESC);
CREATE INDEX idx_test_results_word_id ON test_results(word_id);
CREATE INDEX idx_test_results_correct ON test_results(user_id, correct);

ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_tests"
  ON test_results FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_tests"
  ON test_results FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "parent_select_learner_tests"
  ON test_results FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ============================================================================
-- 5. ACHIEVEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_code text NOT NULL,
  earned_at        timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_achievements_user_code ON achievements(user_id, achievement_code);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_achievements"
  ON achievements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_achievements"
  ON achievements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Anyone can view public learner achievements (for leaderboards)
CREATE POLICY "anyone_select_public_learner_achievements"
  ON achievements FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE is_public = true AND role = 'learner'
    )
  );

CREATE POLICY "parent_select_learner_achievements"
  ON achievements FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ============================================================================
-- 6. LEADERBOARD SNAPSHOTS (for competition stats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date       date NOT NULL DEFAULT CURRENT_DATE,
  total_xp            int DEFAULT 0,
  current_level       int DEFAULT 1,
  words_added_count   int DEFAULT 0,
  mastered_words_count int DEFAULT 0,
  current_streak      int DEFAULT 0,
  total_tests         int DEFAULT 0,
  tests_correct       int DEFAULT 0,
  accuracy_pct        float DEFAULT 0.0,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX idx_leaderboard_date ON leaderboard_snapshots(snapshot_date DESC, total_xp DESC);

ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can view public leaderboard snapshots
CREATE POLICY "anyone_select_public_leaderboard"
  ON leaderboard_snapshots FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE is_public = true AND role = 'learner'
    )
  );

-- Users can view their own snapshots
CREATE POLICY "users_select_own_leaderboard"
  ON leaderboard_snapshots FOR SELECT
  USING (user_id = auth.uid());

-- Parents can view all leaderboards
CREATE POLICY "parent_select_all_leaderboard"
  ON leaderboard_snapshots FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ============================================================================
-- 7. LEARNER COMPARISON TABLE (for head-to-head stats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS learner_stats_cache (
  user_id             uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_updated        timestamptz DEFAULT now(),
  total_xp            int DEFAULT 0,
  current_level       int DEFAULT 1,
  words_added_count   int DEFAULT 0,
  mastered_words_count int DEFAULT 0,
  current_streak      int DEFAULT 0,
  total_tests         int DEFAULT 0,
  tests_correct       int DEFAULT 0,
  accuracy_pct        float DEFAULT 0.0,
  achievements_count  int DEFAULT 0
);

ALTER TABLE learner_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_select_public_stats_cache"
  ON learner_stats_cache FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE is_public = true AND role = 'learner'
    )
  );

CREATE POLICY "users_select_own_stats_cache"
  ON learner_stats_cache FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

-- Tables created! Now insert initial users:
-- Go to Authentication → Users, create users, then run LEARNERS_INSERT.sql

```

---

## 📝 Save This Script

**Filename:** `SUPABASE_SETUP.sql`

Save in project root (or reference when running)

---

## 🚀 How to Run

1. **Copy entire script above** (from `CREATE EXTENSION` to end)
2. Go to **Supabase Dashboard** → **SQL Editor**
3. Click **New Query**
4. **Paste entire script**
5. Click **Run** (blue play button)
6. Wait for "Success" message
7. Check **Tables** in left sidebar to verify creation

---

## ✅ After Running

- [ ] All tables created (check Tables menu)
- [ ] RLS policies enabled (check Authentication → Policies)
- [ ] No errors in output

**Next Step:** Run `LEARNERS_INSERT.sql` after creating users in Auth

---

