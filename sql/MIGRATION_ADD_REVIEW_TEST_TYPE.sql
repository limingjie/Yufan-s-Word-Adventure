-- ============================================================================
-- MIGRATION: allow 'review' as a test_results.test_type
-- ============================================================================
-- The review flow now records its own test type ('review') so daily missions
-- can count SRS reviews separately from meaning-quiz answers. Non-breaking:
-- accuracy, XP, calendar and parent charts all count test_results regardless
-- of type. No backfill needed — historical review rows stay as 'meaning'.

ALTER TABLE test_results DROP CONSTRAINT IF EXISTS test_results_test_type_check;

ALTER TABLE test_results
  ADD CONSTRAINT test_results_test_type_check
  CHECK (test_type IN ('meaning', 'spelling', 'listening', 'review'));
