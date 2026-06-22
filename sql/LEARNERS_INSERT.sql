# Insert Initial Learners — Script & Guide

**After you create users in Supabase Auth, use this script.**

---

## Step 1: Create Users in Supabase Auth

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Create three users (enable **Auto confirm email** on each):

| Email | Role | Notes |
|-------|------|-------|
| `learner1@example.com` | learner | e.g. Yufan |
| `learner2@example.com` | learner | e.g. your wife |
| `parent@example.com` | parent | the parent account |

4. After creating each user, **copy the User ID** (UUID shown in the Users list)

---

## Step 2: Run This SQL Script

1. Go to **SQL Editor** → **New Query**
2. **Replace the UUIDs** in the script below with actual UUIDs from Step 1
3. Paste and run

### SQL Script: Insert Learner Profiles

```sql
-- LEARNERS_INSERT.sql
-- IMPORTANT: Replace all UUID-FOR-* placeholders with actual UUIDs from Auth → Users

INSERT INTO profiles (id, role, display_name, avatar_color, is_public)
VALUES
  ('UUID-FOR-LEARNER1', 'learner', 'Yufan',  '#3498DB', true),
  ('UUID-FOR-LEARNER2', 'learner', 'Meiying', '#E74C3C', true),
  ('UUID-FOR-PARENT',   'parent',  'Parent',  '#2ECC71', false)
ON CONFLICT (id) DO NOTHING;

-- Verify insertion
SELECT id, role, display_name, is_public, created_at FROM profiles;
```

Replace `Yufan`, `Meiying`, `Parent` with whatever display names you want. The parent's `is_public` is `false` so they never appear in leaderboards.

---

## Step 3: Verify

After running script:
- Go to **Table Editor** → **profiles**
- Should see 2 rows: Learner 1 and Learner 2
- Both with `is_public = true` and `role = learner`

---

## 🎨 Avatar Colors (Optional Customization)

Each learner gets a unique color for their avatar in competition views:

| Learner | Suggested Color | Hex Code |
|---------|-----------------|----------|
| Learner 1 | Color A | `#3498DB` or customize |
| Learner 2 | Color B | `#E74C3C` or customize |

Change the `avatar_color` values if you prefer different colors.

---

## 📋 Checklist

- [ ] Created user: `learner1@example.com` in Auth
- [ ] Copied Learner 1's User ID
- [ ] Created user: `learner2@example.com` in Auth
- [ ] Copied Learner 2's User ID
- [ ] Updated script with both UUIDs
- [ ] Ran script in SQL Editor
- [ ] Verified 2 profiles in Table Editor

---

## ✅ Done!

Your Supabase database is now ready with:
- ✅ All tables created
- ✅ RLS policies enabled
- ✅ 2 learner profiles: Learner 1 & Learner 2
- ✅ Competition features ready

---

**Next:** I'll update the app code with leaderboard pages and competition features.

