-- ============================================================================
-- MIGRATION: add avatar_emoji to profiles
-- ============================================================================
-- Learners can pick an emoji avatar from the home screen. When set, the emoji
-- is shown instead of the display-name initial. NULL = fall back to initial.
-- Self-update RLS on profiles already permits writing this column.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_emoji text DEFAULT NULL;
