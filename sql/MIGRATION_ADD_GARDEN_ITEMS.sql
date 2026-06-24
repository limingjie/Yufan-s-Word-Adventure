-- ============================================================================
-- MIGRATION: garden_items — purchased garden decorations & boosters
-- ============================================================================
-- Coins are spendable currency. Earned coins are DERIVED from activity (never
-- stored); only purchases live here. db.getUserCoins() computes
-- balance = earned − Σ(item costs). Items STACK: one row per purchase, so a
-- learner can own several butterflies (quantity = row count per item_code).
-- Boosters are cosmetic-only and never touch SRS/mastery data.

CREATE TABLE IF NOT EXISTS garden_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_code  text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- If an earlier version created the table with a UNIQUE(user_id, item_code)
-- constraint, drop it so items can stack.
ALTER TABLE garden_items DROP CONSTRAINT IF EXISTS garden_items_user_id_item_code_key;

CREATE INDEX IF NOT EXISTS idx_garden_items_user ON garden_items(user_id);

ALTER TABLE garden_items ENABLE ROW LEVEL SECURITY;

-- Drop-then-create so this migration is safe to re-run.
DROP POLICY IF EXISTS "users_select_own_garden_items" ON garden_items;
CREATE POLICY "users_select_own_garden_items"
  ON garden_items FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_insert_own_garden_items" ON garden_items;
CREATE POLICY "users_insert_own_garden_items"
  ON garden_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_garden_items" ON garden_items;
CREATE POLICY "users_delete_own_garden_items"
  ON garden_items FOR DELETE
  USING (user_id = auth.uid());

-- Public read so a learner's garden could be shown on shared/leaderboard views.
DROP POLICY IF EXISTS "public_learner_garden_items_readable" ON garden_items;
CREATE POLICY "public_learner_garden_items_readable"
  ON garden_items FOR SELECT
  USING (user_id IN (SELECT id FROM profiles WHERE is_public = true AND role = 'learner'));

DROP POLICY IF EXISTS "parent_select_learner_garden_items" ON garden_items;
CREATE POLICY "parent_select_learner_garden_items"
  ON garden_items FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'parent');
