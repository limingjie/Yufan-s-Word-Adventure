-- Allow parent role to insert/update/delete words and review_schedule for any learner.
-- Required so parent can add and edit vocabulary on behalf of learners.
-- Safe for this single-family app (no multi-tenancy).

CREATE POLICY "parent_can_write_words" ON words
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );

CREATE POLICY "parent_can_write_review_schedule" ON review_schedule
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'parent')
  );
