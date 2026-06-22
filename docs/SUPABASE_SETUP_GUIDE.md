# Supabase Setup Guide — Quick Start

**Project ID:** hzqewqmowtvyrieqbxod
**Date:** 2026-06-21
**Learners:** 2 learners (customizable names)

---

## ⚙️ Step 1: Access Your Supabase Project

1. Go to: https://supabase.com/dashboard/project/hzqewqmowtvyrieqbxod
2. You should see your project dashboard
3. Note the **Project URL** (top-left, looks like `https://hzqewqmowtvyrieqbxod.supabase.co`)

---

## 🔑 Step 2: Get Your API Keys

1. Go to **Settings** → **API**
2. Copy these keys (store them securely, DO NOT commit to git):
   - **Project URL** (Supabase URL)
   - **anon public key** (for frontend)
   - **service_role key** (for Edge Functions and scripts)
3. Save them in a safe place (1Password, Notes, etc.)

---

## 📊 Step 3: Create Database Tables

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. **Copy and paste the COMPLETE SQL script** from `SUPABASE_SETUP.sql` (see below)
4. Click **Run** (the blue play button)
5. Wait for success message ("tables created successfully")

---

## 👥 Step 4: Create Initial Learners

1. Go to **Authentication** → **Users**
2. Click **Add user** (or use the script below)
3. Create two users:

**User 1: Learner 1**
- Email: `learner1@example.com`
- Password: (set something secure)
- Auto confirm (for testing)

**User 2: Learner 2**
- Email: `learner2@example.com`
- Password: (set something secure)
- Auto confirm (for testing)

💡 **Or use this script:** Copy-paste in SQL Editor to create profiles automatically (see `LEARNERS_INSERT.sql` below)

---

## 🔐 Step 5: Enable Row Level Security (RLS)

1. Go to **Authentication** → **Policies**
2. For each table (`profiles`, `words`, `review_schedule`, `test_results`, `achievements`):
   - Click the table name
   - Verify all RLS policies are enabled (green toggle)
   - If red (disabled), click toggle to enable

✅ RLS should already be enabled by the SQL script.

---

## ✅ Step 6: Test Connection

1. Create `js/config.js` in your project:

```javascript
// js/config.js — DO NOT COMMIT
export const SUPABASE_URL = 'https://hzqewqmowtvyrieqbxod.supabase.co'
export const SUPABASE_ANON_KEY = 'your-anon-key-here'
```

2. In browser console, test:
```javascript
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const { data } = await supabase.auth.getSession()
console.log(data)  // Should show session
```

---

## 🚀 All Scripts Below

Copy each script and run in Supabase SQL Editor.

---

## SQL SCRIPT 1: Create Tables (run first)

**File:** `SUPABASE_SETUP.sql`

See the script in the next section — very long, contains all table creation and RLS policies.

---

## SQL SCRIPT 2: Insert Initial Learners (run after script 1)

**File:** `LEARNERS_INSERT.sql`

This script needs the user UUIDs from Supabase Auth. Follow this process:

1. Create users manually in Auth UI (Step 4 above)
2. Copy their UUIDs
3. Replace in script below
4. Run in SQL Editor

```sql
-- LEARNERS_INSERT.sql
-- Insert profiles for learners
-- Replace the UUIDs with actual UUIDs from Supabase Auth

INSERT INTO profiles (id, role, display_name, is_public)
VALUES
  ('UUID-FOR-LEARNER1', 'learner', 'Learner 1', true),
  ('UUID-FOR-LEARNER2', 'learner', 'Learner 2', true)
ON CONFLICT DO NOTHING;

-- Verify insertion
SELECT * FROM profiles;
```

**How to get UUIDs:**
1. Go to **Authentication** → **Users**
2. Click each user
3. Copy the **User ID** (UUID format)
4. Replace in script above
5. Run

---

## 📋 Checklist

- [ ] Accessed Supabase project
- [ ] Copied Project URL and API keys (securely stored)
- [ ] Ran database creation SQL script (tables created)
- [ ] Created 2 users in Auth (Learner 1, Learner 2)
- [ ] Ran learners insert script (profiles created)
- [ ] Verified RLS policies enabled
- [ ] Created `js/config.js` with credentials
- [ ] Tested connection in browser console

---

## 🆘 Troubleshooting

**"Table already exists"**
→ Tables already created, skip to Step 4

**"Permission denied" error**
→ RLS policies blocking access, check policies are correct

**"User not found" error**
→ User UUID incorrect in learners script, verify in Auth UI

**"ANON_KEY error"**
→ Check `config.js` has correct key (copy from Settings → API)

---

## 📞 Next Steps

1. Once setup complete, notify me with:
   - ✅ Tables created
   - ✅ Users created (Learner 1, Learner 2)
   - ✅ Connection tested

2. I'll then:
   - Update app code with competition features
   - Create leaderboard pages
   - Generate profiles for both learners

---

