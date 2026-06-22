# Word Adventure — Database Schema

**Version:** 1.0
**Database:** Supabase PostgreSQL
**Last Updated:** 2026-06-21

---

## Schema Overview

```
TABLES
├── auth.users (Supabase managed)
│   └── profiles (custom)
│       ├── words
│       │   └── review_schedule
│       │   └── test_results
│       │       └── achievements
```

---

## Authentication Tables (Supabase Managed)

### auth.users

Managed by Supabase Auth. Do NOT modify directly.

```sql
id              uuid  PRIMARY KEY
email           text  UNIQUE NOT NULL
encrypted_password text
email_confirmed_at timestamptz
created_at      timestamptz
updated_at      timestamptz
-- ... other Supabase auth fields
```

---

## Custom Tables

### 1. profiles

**Purpose:** User metadata and role assignment

**SQL:**
```sql
CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('child', 'parent')),
  display_name  text DEFAULT 'User',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can select their own profile
CREATE POLICY "users_select_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- RLS Policy: Users can update their own profile
CREATE POLICY "users_update_own_profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- RLS Policy: Only insert during signup (via trigger or Supabase Auth hook)
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
```

**Fields:**
- `id` (uuid) — Foreign key to `auth.users`, primary key
- `role` (text) — 'child' or 'parent', controls UI access
- `display_name` (text) — Display name (e.g., "Learner 1")
- `created_at` (timestamptz) — Account creation timestamp
- `updated_at` (timestamptz) — Last profile update

**Notes:**
- Use a Supabase Auth hook or trigger to automatically create a profile row when a new user signs up
- Role determines which routes are accessible in the frontend

---

### 2. words

**Purpose:** Vocabulary words added by the child

**SQL:**
```sql
CREATE TABLE words (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word                text NOT NULL,
  part_of_speech      text,
  english_definition  text,
  chinese_definition  text,
  example_sentence    text,
  category            text DEFAULT 'general',
  is_favorite         boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Composite index for efficient user word queries
CREATE INDEX idx_words_user_id_created ON words(user_id, created_at DESC);
CREATE INDEX idx_words_user_id_word ON words(user_id, word);

-- Enable RLS
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can select only their own words
CREATE POLICY "users_select_own_words"
  ON words FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert words
CREATE POLICY "users_insert_own_words"
  ON words FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own words
CREATE POLICY "users_update_own_words"
  ON words FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can delete their own words
CREATE POLICY "users_delete_own_words"
  ON words FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policy: Parent can view learner's words (read-only)
CREATE POLICY "parent_select_learner_words"
  ON words FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
    AND user_id = (SELECT id FROM profiles WHERE role = 'learner')
  );
```

**Fields:**
- `id` (uuid) — Primary key
- `user_id` (uuid) — Foreign key to `profiles(id)`, learner user
- `word` (text) — The vocabulary word (e.g., "curious")
- `part_of_speech` (text) — Word type (e.g., "adjective", "noun")
- `english_definition` (text) — English definition
- `chinese_definition` (text) — Simplified Chinese translation
- `example_sentence` (text) — Example usage
- `category` (text) — Word category (e.g., "animals", "science", "school")
- `is_favorite` (boolean) — Star-marked words for quick review
- `created_at` (timestamptz) — When word was added
- `updated_at` (timestamptz) — When word was last modified

**Notes:**
- `part_of_speech` populated by Free Dictionary API or manual entry
- `english_definition` and `chinese_definition` can be edited by child before saving
- `category` allows filtering/grouping (nice-to-have for future)

---

### 3. review_schedule

**Purpose:** Spaced repetition state for each word

**SQL:**
```sql
CREATE TABLE review_schedule (
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

-- Composite index for "due today" queries
CREATE INDEX idx_review_schedule_next_date ON review_schedule(next_review_date, user_id);
CREATE INDEX idx_review_schedule_word_id ON review_schedule(word_id);

-- Enable RLS
ALTER TABLE review_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access only their own review schedules
CREATE POLICY "users_select_own_review_schedule"
  ON review_schedule FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert review schedules
CREATE POLICY "users_insert_review_schedule"
  ON review_schedule FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own schedules
CREATE POLICY "users_update_review_schedule"
  ON review_schedule FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Parent can view child's review schedule (read-only)
CREATE POLICY "parent_select_review_schedule"
  ON review_schedule FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
    AND user_id = (SELECT id FROM profiles WHERE role = 'child')
  );
```

**Fields:**
- `id` (uuid) — Primary key
- `word_id` (uuid) — Foreign key to `words(id)`, unique (one schedule per word)
- `user_id` (uuid) — Foreign key to `profiles(id)`, for RLS and queries
- `next_review_date` (date) — Next scheduled review date (e.g., 2026-06-25)
- `review_level` (int) — Current SRS level (0–5, see SRS ladder below)
- `ease_factor` (float) — SM-2 ease factor (reserved for future use, currently unused)
- `interval_days` (int) — Days until next review
- `created_at` (timestamptz) — When schedule was created (on word add)
- `updated_at` (timestamptz) — When schedule was last updated (on review)

**SRS Levels (Spaced Repetition):**
```
Level 0 (new):   1 day
Level 1:         3 days
Level 2:         7 days
Level 3:        14 days
Level 4:        30 days
Level 5+:     mastered (60+ days, show in garden)
```

**Notes:**
- Created automatically when a word is added
- Updated when child completes a review (correct/incorrect)
- Query `WHERE next_review_date <= CURRENT_DATE` to get "due today" words
- `ease_factor` reserved for possible SM-2 implementation later

---

### 4. test_results

**Purpose:** Record of each quiz attempt for analytics and accuracy tracking

**SQL:**
```sql
CREATE TABLE test_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id     uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_type   text NOT NULL CHECK (test_type IN ('meaning', 'spelling', 'listening')),
  correct     boolean NOT NULL,
  response    text,
  tested_at   timestamptz DEFAULT now()
);

-- Composite indexes for analytics queries
CREATE INDEX idx_test_results_user_id ON test_results(user_id, tested_at DESC);
CREATE INDEX idx_test_results_word_id ON test_results(word_id);
CREATE INDEX idx_test_results_correct ON test_results(user_id, correct);

-- Enable RLS
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can select only their own results
CREATE POLICY "users_select_own_test_results"
  ON test_results FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert test results
CREATE POLICY "users_insert_test_results"
  ON test_results FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Parent can view child's test results (read-only)
CREATE POLICY "parent_select_test_results"
  ON test_results FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
    AND user_id = (SELECT id FROM profiles WHERE role = 'child')
  );
```

**Fields:**
- `id` (uuid) — Primary key
- `word_id` (uuid) — Foreign key to `words(id)`
- `user_id` (uuid) — Foreign key to `profiles(id)`, for RLS
- `test_type` (text) — 'meaning', 'spelling', or 'listening'
- `correct` (boolean) — True if answer was correct
- `response` (text) — Child's response/answer
- `tested_at` (timestamptz) — When the test was completed

**Notes:**
- Immutable (INSERT only, no UPDATE/DELETE)
- Used to calculate test accuracy for parent dashboard
- Used to compute XP (3 XP per correct answer)
- Used to trigger achievement checks

---

### 5. achievements

**Purpose:** Track medals, badges, and milestones earned by the child

**SQL:**
```sql
CREATE TABLE achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_code text NOT NULL,
  earned_at        timestamptz DEFAULT now()
);

-- Composite index to prevent duplicates
CREATE UNIQUE INDEX idx_achievements_user_code ON achievements(user_id, achievement_code);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can select only their own achievements
CREATE POLICY "users_select_own_achievements"
  ON achievements FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policy: Users can insert achievements
CREATE POLICY "users_insert_achievements"
  ON achievements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policy: Parent can view child's achievements (read-only)
CREATE POLICY "parent_select_achievements"
  ON achievements FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
    AND user_id = (SELECT id FROM profiles WHERE role = 'child')
  );
```

**Fields:**
- `id` (uuid) — Primary key
- `user_id` (uuid) — Foreign key to `profiles(id)`
- `achievement_code` (text) — Code for the achievement (see below)
- `earned_at` (timestamptz) — When the achievement was earned

**Achievement Codes:**
```javascript
// In code (js/lib/achievements.js)
export const ACHIEVEMENT_CODES = {
  // Word count milestones
  BRONZE_100:   { name: 'Bronze Badge',        threshold: 100 },
  SILVER_500:   { name: 'Silver Badge',        threshold: 500 },
  GOLD_1000:    { name: 'Gold Badge',          threshold: 1000 },
  PLATINUM_2000:{ name: 'Platinum Badge',      threshold: 2000 },

  // Special badges
  PERFECT_WEEK: { name: 'Perfect Week',        description: '7 days with no missed reviews' },
  SPEED_READER: { name: 'Speed Reader',        description: '100 reviews in one day' },
  WORD_COLLECTOR:{ name: 'Word Collector',     description: '1000 unique words' },

  // Streak badges
  STREAK_7:     { name: '7-Day Streak',        days: 7 },
  STREAK_30:    { name: '30-Day Streak',       days: 30 },
  STREAK_100:   { name: '100-Day Streak',      days: 100 }
}
```

**Notes:**
- Achievements are earned based on specific milestones
- Once earned, never lost
- Check for new achievements after each action (add word, complete review)
- Parent dashboard displays all earned achievements

---

### 6. daily_stats (Optional)

**Purpose:** Denormalized daily statistics for faster parent dashboard queries

**SQL:**
```sql
CREATE TABLE daily_stats (
  date                date NOT NULL,
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  words_added         int DEFAULT 0,
  reviews_completed   int DEFAULT 0,
  tests_completed     int DEFAULT 0,
  tests_correct       int DEFAULT 0,
  PRIMARY KEY (date, user_id)
);

CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date DESC);

-- Enable RLS
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Parent can view child's daily stats (read-only)
CREATE POLICY "parent_select_daily_stats"
  ON daily_stats FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
    AND user_id = (SELECT id FROM profiles WHERE role = 'child')
  );
```

**Fields:**
- `date` (date) — Date for the statistics
- `user_id` (uuid) — User these stats belong to
- `words_added` (int) — Words added that day
- `reviews_completed` (int) — Reviews completed that day
- `tests_completed` (int) — Total tests taken that day
- `tests_correct` (int) — Tests answered correctly that day

**Notes:**
- Optional table (can compute dynamically from `test_results` and `words`)
- If used, update nightly via trigger or batch job
- Speeds up parent dashboard queries for 30-day trends

---

## Useful SQL Queries

### Dashboard Queries

**Get all words added in last 30 days:**
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as words_added
FROM words
WHERE user_id = $1
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Get words due for review today:**
```sql
SELECT w.*
FROM words w
INNER JOIN review_schedule rs ON w.id = rs.word_id
WHERE w.user_id = $1
  AND rs.next_review_date <= CURRENT_DATE
ORDER BY rs.next_review_date ASC;
```

**Get test accuracy for last 30 days:**
```sql
SELECT
  test_type,
  COUNT(CASE WHEN correct THEN 1 END) as correct_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(CASE WHEN correct THEN 1 END) / COUNT(*), 2) as accuracy_pct
FROM test_results
WHERE user_id = $1
  AND tested_at >= NOW() - INTERVAL '30 days'
GROUP BY test_type;
```

**Get count of mastered words:**
```sql
SELECT COUNT(*)
FROM review_schedule
WHERE user_id = $1
  AND review_level >= 4;
```

**Calculate total XP:**
```sql
SELECT
  (SELECT COUNT(*) FROM words WHERE user_id = $1) * 1 as word_xp,
  (SELECT COUNT(*) FROM test_results WHERE user_id = $1) * 2 as review_xp,
  (SELECT COUNT(*) FROM test_results WHERE user_id = $1 AND correct) * 3 as correct_xp;
```

---

## Data Initialization

### Create Test Users

```sql
-- These would typically be created via Supabase Auth UI or API
-- But here's what the auth.users + profiles would look like:

-- Learner user
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  'learner-uuid-here',
  'learner1@example.com',
  'encrypted-password-hash'
);

INSERT INTO profiles (id, role, display_name)
VALUES ('learner-uuid-here', 'learner', 'Learner 1');

-- Parent user
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  'parent-uuid-here',
  'parent@example.com',
  'encrypted-password-hash'
);

INSERT INTO profiles (id, role, display_name)
VALUES ('parent-uuid-here', 'parent', 'Parent');
```

---

## Indexes Summary

**Performance-critical indexes:**

| Table             | Columns                            | Purpose                        |
| ----------------- | ---------------------------------- | ------------------------------ |
| `words`           | (user_id, created_at DESC)         | List words by user             |
| `words`           | (user_id, word)                    | Search words by user           |
| `review_schedule` | (next_review_date, user_id)        | Find "due today" words         |
| `test_results`    | (user_id, tested_at DESC)          | Get recent test results        |
| `test_results`    | (user_id, correct)                 | Calculate accuracy             |
| `achievements`    | (user_id, achievement_code) UNIQUE | Prevent duplicate achievements |

---

## Backup & Recovery

### Supabase Managed Backups

Supabase automatically backs up PostgreSQL databases:
- Daily automated backups for 7 days
- Manual point-in-time recovery available
- Access via Supabase dashboard → Backups

### Export Data

Parent can export all data as CSV:
```sql
SELECT w.*,
       rs.next_review_date,
       rs.review_level,
       (SELECT COUNT(*) FROM test_results WHERE word_id = w.id AND correct) as correct_count,
       (SELECT COUNT(*) FROM test_results WHERE word_id = w.id) as total_tests
FROM words w
LEFT JOIN review_schedule rs ON w.id = rs.word_id
WHERE w.user_id = $1
ORDER BY w.created_at DESC;
```

---

## Schema Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│ auth.users (Supabase Managed)                                       │
│ id (uuid) | email (text) | encrypted_password | created_at | ...    │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ REFERENCES
                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│ profiles                                                             │
│ id (uuid) | role (text) | display_name | created_at | updated_at  │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ user_id
          ┌───────────┼───────────┬───────────┐
          ↓           ↓           ↓           ↓
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐
    │ words    │ │ review_  │ │ test_    │ │achievements
    │          │ │ schedule │ │ results  │ │
    │ id       │ │ id       │ │ id       │ │ id
    │ user_id  │ │ word_id  │ │ word_id  │ │ user_id
    │ word     │ │ user_id  │ │ user_id  │ │ achievement_code
    │ ...      │ │ next_    │ │ test_    │ │ earned_at
    │          │ │ review   │ │ type     │ │
    └──────────┘ │ date     │ │ correct  │ └───────────┘
                 │ review   │ │ response │
                 │ level    │ │ tested_at│
                 └──────────┘ └──────────┘
```

---

## Migration & Deployment

### Deploy to Supabase

1. Create new Supabase project
2. Run SQL migrations in Supabase SQL Editor:
   - profiles table + RLS
   - words table + RLS
   - review_schedule table + RLS
   - test_results table + RLS
   - achievements table + RLS
   - indexes
3. Test RLS policies with both child and parent users
4. Deploy Edge Function (lookup-word)

### Local Development (Optional)

Use Supabase local development with Docker:
```bash
supabase start
supabase db push
```

---

## Compliance & Security

### Data Retention

- All user data retained indefinitely
- Soft deletes possible (add `deleted_at` column if needed)
- Parent can export and delete data at any time

### Privacy

- RLS ensures child cannot access parent data and vice versa
- No third-party integrations access user data
- Supabase handles GDPR compliance

### Encryption

- Passwords encrypted by Supabase Auth
- Data in transit: HTTPS only
- Data at rest: Supabase managed encryption

---

## Appendix: SQL Setup Script

**Complete migration script (for SQL Editor):**

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create profiles table
CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('child', 'parent')),
  display_name  text DEFAULT 'User',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- 2. Create words table
CREATE TABLE words (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word                text NOT NULL,
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

CREATE POLICY "users_select_own_words" ON words FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_words" ON words FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_own_words" ON words FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_delete_own_words" ON words FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "parent_select_child_words" ON words FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
  AND user_id = (SELECT id FROM profiles WHERE role = 'child')
);

-- 3. Create review_schedule table
CREATE TABLE review_schedule (
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

CREATE POLICY "users_select_own_review" ON review_schedule FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_insert_review" ON review_schedule FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_review" ON review_schedule FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "parent_select_review" ON review_schedule FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
  AND user_id = (SELECT id FROM profiles WHERE role = 'child')
);

-- 4. Create test_results table
CREATE TABLE test_results (
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

CREATE POLICY "users_select_own_tests" ON test_results FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_insert_tests" ON test_results FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "parent_select_tests" ON test_results FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
  AND user_id = (SELECT id FROM profiles WHERE role = 'child')
);

-- 5. Create achievements table
CREATE TABLE achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_code text NOT NULL,
  earned_at        timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_achievements_user_code ON achievements(user_id, achievement_code);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_achievements" ON achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_insert_achievements" ON achievements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "parent_select_achievements" ON achievements FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
  AND user_id = (SELECT id FROM profiles WHERE role = 'child')
);
```

