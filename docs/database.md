# Database Schema

> Detail doc for [CLAUDE.md](../CLAUDE.md). Supabase/Postgres schema for every
> table. The user-authored (and possibly stale) longer version is archived at
> [archive/DATABASE_SCHEMA.md](archive/DATABASE_SCHEMA.md).
>
> **Schema-change workflow (locked).** `sql/SUPABASE_SETUP.sql` is the single,
> consolidated source of truth — there are no committed migration files. To
> change the schema: write a throwaway `sql/tmp_*.sql` (gitignored), run it in
> the Supabase SQL Editor against the live DB, then merge the same DDL into
> `SUPABASE_SETUP.sql` (use idempotent forms — `ADD COLUMN IF NOT EXISTS`,
> `DROP POLICY IF EXISTS … ; CREATE POLICY …`) and delete the tmp file.

### `profiles`
```sql
id            uuid  PRIMARY KEY REFERENCES auth.users
role          text  CHECK (role IN ('learner', 'parent'))
display_name  text  DEFAULT 'User'
avatar_color  text  DEFAULT '#007BFF'   -- used in leaderboards
avatar_emoji  text  DEFAULT NULL        -- optional emoji avatar; falls back to display-name initial. Shown everywhere an avatar renders (home, navbar, garden, parent, compare, leaderboard). Edited via the Home "Choose your avatar" picker; saving dispatches a `profile-updated` event so the navbar avatar refreshes immediately.
is_public     boolean DEFAULT true      -- controls leaderboard visibility
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### `words`
```sql
id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid  REFERENCES profiles(id) ON DELETE CASCADE
word                text  NOT NULL
ipa                 text     -- stored as usIpa$ukIpa (US first); single IPA if only one found
audio_url_us        text     -- https://api.dictionaryapi.dev/media/pronunciations/en/{word}-us.mp3
audio_url_uk        text     -- https://api.dictionaryapi.dev/media/pronunciations/en/{word}-uk.mp3
part_of_speech      text
english_definition  text     -- multi-line: one definition per line, POS-prefixed e.g. "(noun) a body of water"
chinese_definition  text
example_sentence    text
word_forms          jsonb    -- { past, pastParticiple, thirdPerson, gerund, plural, comparative, superlative }
synonyms            text     -- comma-separated, up to 12
antonyms            text     -- comma-separated, up to 8
quotes              text     -- newline-separated; each line: "quote text — reference", up to 4
category            text  DEFAULT 'general'
is_favorite         boolean DEFAULT false
deleted_at          timestamptz DEFAULT NULL  -- NULL = active; non-NULL = soft-deleted (trash)
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

Soft delete: `db.deleteWord()` sets `deleted_at = now()`. `db.restoreWord()` clears it. `db.permanentlyDeleteWord()` hard-deletes. All list queries filter `WHERE deleted_at IS NULL`.

**IPA format:** `ipa` stores `usIpa$ukIpa` when both exist (even if identical — signals both were found). Stores bare IPA when only one was found. Display logic in `wordCardPronRow` handles all combinations of IPA count vs audio URL count.

### `review_schedule`
```sql
id                uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id           uuid  UNIQUE REFERENCES words(id) ON DELETE CASCADE
user_id           uuid  REFERENCES profiles(id) ON DELETE CASCADE
next_review_date  date  NOT NULL DEFAULT CURRENT_DATE
review_level      int   DEFAULT 0
ease_factor       float DEFAULT 2.5   -- reserved for future SM-2
interval_days     int   DEFAULT 1
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```

### `test_results`
```sql
id         uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id    uuid  REFERENCES words(id) ON DELETE CASCADE
user_id    uuid  REFERENCES profiles(id) ON DELETE CASCADE
test_type  text  CHECK (test_type IN ('meaning', 'spelling', 'listening', 'review'))
correct    boolean NOT NULL
response   text
tested_at  timestamptz DEFAULT now()
```

**`'review'` test_type:** `review.js` records each completed SRS review as a `test_results` row with `test_type = 'review'`, so daily missions/history can count reviews separately from meaning-quiz answers. The `test_type` CHECK in `sql/SUPABASE_SETUP.sql` already allows `'review'`. No backfill: reviews logged before this change remain `test_type = 'meaning'`, so they show under the meaning count in older history rather than under reviews. Accuracy, Sunlight, Coins, calendars and parent charts count all `test_results` regardless of type, so they are unaffected.

### `achievements`
```sql
id                uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id           uuid  REFERENCES profiles(id) ON DELETE CASCADE
achievement_code  text  NOT NULL
earned_at         timestamptz DEFAULT now()

UNIQUE (user_id, achievement_code)   -- prevent duplicate awards
```

### `garden_items` (shop purchases — coin sink)
```sql
id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE
item_code  text NOT NULL            -- maps to coins.js SHOP
col        int                      -- chosen block for placeables/structures/animals…
grid_row   int                      -- …NULL = tray/unplaced, or needs auto-home
rotation   int  DEFAULT 0           -- retained for compatibility; UI auto-faces most items
created_at timestamptz DEFAULT now()
```
Items **stack** (one row per purchase). Coin balance is derived as
`earned − Σ(item costs)` (`getUserCoins`), so deleting a row refunds it; never add
a stored balance. Placeable playset items (road/rail/crossing/fence/runway/station/controltower/car/bus/train/privatejet),
structures and ground-animal homes carry their position here.

### `garden_plants` (stored plant positions)
```sql
user_id  uuid REFERENCES profiles(id) ON DELETE CASCADE
word_id  uuid REFERENCES words(id)    ON DELETE CASCADE
col      int NOT NULL
grid_row int NOT NULL
PRIMARY KEY (user_id, word_id)
```
The garden layout is **stored, not derived**: each plant remembers its block. A
word with no row here has no home yet → the garden auto-assigns the nearest free
cell on open and persists it. `ON DELETE CASCADE` cleans up when a word is
hard-deleted. See [garden.md](garden.md).

### `daily_stats` (optional — can be computed dynamically)
```sql
date                date NOT NULL
user_id             uuid REFERENCES profiles(id) ON DELETE CASCADE
words_added         int  DEFAULT 0
reviews_completed   int  DEFAULT 0
tests_completed     int  DEFAULT 0
tests_correct       int  DEFAULT 0
PRIMARY KEY (date, user_id)
```

### `leaderboard_snapshots` (competition feature)
```sql
id          uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid  REFERENCES profiles(id) ON DELETE CASCADE
snapshot_date  date NOT NULL
total_xp    int   DEFAULT 0
mastered_count int DEFAULT 0
streak_days int   DEFAULT 0
created_at  timestamptz DEFAULT now()
```

### `learner_stats_cache` (competition feature — updated after each review/quiz)
```sql
user_id          uuid  PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE
total_xp         int   DEFAULT 0
current_level    int   DEFAULT 1
mastered_words_count int DEFAULT 0
current_streak   int   DEFAULT 0
updated_at       timestamptz DEFAULT now()
```

**RLS:** Enable RLS on all tables. Core policy: users can only read/write rows where `user_id = auth.uid()`. Parent role gets additional read-only access to learner data. Public leaderboard policies allow reading `profiles` and `achievements` where `is_public = true`.
