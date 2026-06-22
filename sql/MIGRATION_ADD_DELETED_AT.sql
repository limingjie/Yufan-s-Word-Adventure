-- Migration: add soft-delete column to words
-- Run once in Supabase Dashboard → SQL Editor

ALTER TABLE words
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Index makes trash queries fast
CREATE INDEX IF NOT EXISTS words_deleted_at_idx ON words (user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
