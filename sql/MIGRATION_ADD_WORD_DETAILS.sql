-- Migration: add rich word detail columns
-- Run once in Supabase Dashboard → SQL Editor

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS word_forms  jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS synonyms    text  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS antonyms    text  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quotes      text  DEFAULT NULL;

-- word_forms stores inflections as JSON:
--   { "past": "ran", "pastParticiple": "run", "thirdPerson": "runs",
--     "gerund": "running", "plural": "tests",
--     "comparative": "happier", "superlative": "happiest" }
--
-- synonyms / antonyms: comma-separated text, e.g. "cheerful, glad, content"
-- quotes:              newline-separated; each line is "quote text — reference"
-- english_definition:  repurposed to store all definitions (one per line, POS-prefixed)
--                      existing single-definition rows still work fine
