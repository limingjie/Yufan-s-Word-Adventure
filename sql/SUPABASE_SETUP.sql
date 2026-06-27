-- ============================================================================
-- WORD ADVENTURE — FULL DATABASE SETUP (single source of truth)
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor to create the complete schema.
-- This file is the consolidated schema: every past migration is already folded
-- in. There are no separate migration files.
--
-- MIGRATION POLICY (locked):
--   Do NOT add a new committed MIGRATION_*.sql file. To change the schema:
--     1. Write a throwaway `sql/tmp_*.sql` (gitignored) and run it in the
--        Supabase SQL Editor against the live DB.
--     2. Merge the SAME DDL into this file so a fresh setup stays complete.
--        Use idempotent forms (IF NOT EXISTS / DROP POLICY IF EXISTS …).
--     3. Delete the tmp file. Only this file gets committed.
--
-- Does NOT include LEARNERS_INSERT.sql — create users in Auth first, then run
-- that file separately (it has a FK to auth.users).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('learner', 'parent')),
  display_name  text NOT NULL,
  avatar_color  text DEFAULT '#007BFF',
  avatar_emoji  text DEFAULT NULL,
  is_public     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "anyone_select_public_learners"
  ON profiles FOR SELECT
  USING (is_public = true AND role = 'learner');

CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================================================
-- 2. WORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS words (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word                text NOT NULL,
  ipa                 text,
  audio_url_us        text DEFAULT NULL,
  audio_url_uk        text DEFAULT NULL,
  part_of_speech      text,
  english_definition  text,
  chinese_definition  text,
  example_sentence    text,
  word_forms          jsonb DEFAULT NULL,
  synonyms            text DEFAULT NULL,
  antonyms            text DEFAULT NULL,
  quotes              text DEFAULT NULL,
  category            text DEFAULT 'general',
  is_favorite         boolean DEFAULT false,
  deleted_at          timestamptz DEFAULT NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_words_user_id_created ON words(user_id, created_at DESC);
CREATE INDEX idx_words_user_id_word ON words(user_id, word);
CREATE INDEX idx_words_deleted_at ON words(user_id, deleted_at) WHERE deleted_at IS NOT NULL;

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

CREATE POLICY "parent_select_learner_words"
  ON words FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

CREATE POLICY "parent_can_write_words"
  ON words FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent'));

CREATE POLICY "public_learner_words_readable"
  ON words FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

-- ============================================================================
-- 3. REVIEW_SCHEDULE
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

CREATE POLICY "parent_can_write_review_schedule"
  ON review_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent'));

CREATE POLICY "public_learner_review_schedule_readable"
  ON review_schedule FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

-- ============================================================================
-- 4. TEST_RESULTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id     uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_type   text NOT NULL CHECK (test_type IN ('meaning', 'spelling', 'listening', 'review')),
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

CREATE POLICY "public_learner_test_results_readable"
  ON test_results FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

-- ============================================================================
-- 5. ACHIEVEMENTS
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

CREATE POLICY "anyone_select_public_learner_achievements"
  ON achievements FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

CREATE POLICY "parent_select_learner_achievements"
  ON achievements FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ============================================================================
-- 6. LEADERBOARD_SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date        date NOT NULL DEFAULT CURRENT_DATE,
  total_xp             int DEFAULT 0,
  current_level        int DEFAULT 1,
  words_added_count    int DEFAULT 0,
  mastered_words_count int DEFAULT 0,
  current_streak       int DEFAULT 0,
  total_tests          int DEFAULT 0,
  tests_correct        int DEFAULT 0,
  accuracy_pct         float DEFAULT 0.0,
  created_at           timestamptz DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX idx_leaderboard_date ON leaderboard_snapshots(snapshot_date DESC, total_xp DESC);

ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_select_public_leaderboard"
  ON leaderboard_snapshots FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

CREATE POLICY "users_select_own_leaderboard"
  ON leaderboard_snapshots FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "parent_select_all_leaderboard"
  ON leaderboard_snapshots FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ============================================================================
-- 7. LEARNER_STATS_CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS learner_stats_cache (
  user_id              uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_updated         timestamptz DEFAULT now(),
  total_xp             int DEFAULT 0,
  current_level        int DEFAULT 1,
  words_added_count    int DEFAULT 0,
  mastered_words_count int DEFAULT 0,
  current_streak       int DEFAULT 0,
  total_tests          int DEFAULT 0,
  tests_correct        int DEFAULT 0,
  accuracy_pct         float DEFAULT 0.0,
  achievements_count   int DEFAULT 0
);

ALTER TABLE learner_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_select_public_stats_cache"
  ON learner_stats_cache FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

CREATE POLICY "users_select_own_stats_cache"
  ON learner_stats_cache FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- 8. GARDEN_ITEMS  (purchased decorations & cosmetic boosters)
-- ============================================================================
-- Coins are spendable currency; earned coins are derived from activity, only
-- purchases are stored. balance = earned − Σ(item costs), computed in
-- db.getUserCoins(). Boosters are cosmetic-only (never touch SRS/mastery).

-- Items STACK: one row per purchase (quantity = row count per item_code).
-- Placeable items (road/rail/crossing/fence/runway/station/controltower/car/bus/train/privatejet), structures and
-- ground-animal homes also remember WHERE they sit. col/grid_row are NULL while
-- a placeable is still in the tray, or before a structure/animal auto-home is saved.
CREATE TABLE IF NOT EXISTS garden_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_code  text NOT NULL,
  col        int,
  grid_row   int,
  rotation   int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE garden_items ADD COLUMN IF NOT EXISTS col      int;
ALTER TABLE garden_items ADD COLUMN IF NOT EXISTS grid_row int;
ALTER TABLE garden_items ADD COLUMN IF NOT EXISTS rotation int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_garden_items_user ON garden_items(user_id);

ALTER TABLE garden_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_garden_items"
  ON garden_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_garden_items"
  ON garden_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_garden_items"
  ON garden_items FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_garden_items"
  ON garden_items FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "public_learner_garden_items_readable"
  ON garden_items FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

CREATE POLICY "parent_select_learner_garden_items"
  ON garden_items FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');

-- ── Plant positions ─────────────────────────────────────────────────────────
-- The garden layout is no longer fully derived: every plant remembers its block.
-- A word with no row here = "needs a home" (auto-assigned on next garden open).
-- ON DELETE CASCADE makes orphan cleanup automatic when a word is hard-deleted.
CREATE TABLE IF NOT EXISTS garden_plants (
  user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word_id  uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  col      int NOT NULL,
  grid_row int NOT NULL,
  PRIMARY KEY (user_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_garden_plants_user ON garden_plants(user_id);

ALTER TABLE garden_plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_rw_own_garden_plants"
  ON garden_plants FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "public_learner_garden_plants_readable"
  ON garden_plants FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

CREATE POLICY "parent_select_learner_garden_plants"
  ON garden_plants FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');
