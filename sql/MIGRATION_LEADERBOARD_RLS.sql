-- Migration: allow reading stats for public learners (required for leaderboard)
-- Run once in Supabase Dashboard → SQL Editor

-- Words: allow reading word count for public learner profiles
CREATE POLICY "Public learner words are readable"
ON words FOR SELECT
USING (
    user_id IN (
        SELECT id FROM profiles WHERE is_public = true AND role = 'learner'
    )
);

-- test_results: allow reading test data for public learner profiles
CREATE POLICY "Public learner test_results are readable"
ON test_results FOR SELECT
USING (
    user_id IN (
        SELECT id FROM profiles WHERE is_public = true AND role = 'learner'
    )
);

-- review_schedule: allow reading SRS data for public learner profiles
CREATE POLICY "Public learner review_schedule is readable"
ON review_schedule FOR SELECT
USING (
    user_id IN (
        SELECT id FROM profiles WHERE is_public = true AND role = 'learner'
    )
);
