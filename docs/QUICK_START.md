# Quick Reference — Supabase Setup & Competition Feature

**Your Project:** hzqewqmowtvyrieqbxod
**Date:** 2026-06-21
**Learners:** 2 learners (customizable names)
**Features:** Multi-learner competition with leaderboards

---

## 📋 To-Do Checklist

### Phase 1: Supabase Setup (Complete These First)

- [ ] **Access Supabase project**
  - [ ] Go to https://supabase.com/dashboard/project/hzqewqmowtvyrieqbxod
  - [ ] Verify you can access it

- [ ] **Get API keys** (save securely)
  - [ ] Go to Settings → API
  - [ ] Copy Project URL (https://hzqewqmowtvyrieqbxod.supabase.co)
  - [ ] Copy anon public key
  - [ ] Copy service_role key
  - [ ] Save in password manager (1Password, Notes, etc.)

- [ ] **Create database tables**
  - [ ] Open SQL Editor → New Query
  - [ ] Copy `SUPABASE_SETUP.sql` from project
  - [ ] Paste entire script in SQL Editor
  - [ ] Click Run (blue play button)
  - [ ] Wait for success message
  - [ ] Verify tables created in Table Editor

- [ ] **Create auth users**
  - [ ] Go to Authentication → Users
  - [ ] Add user: `learner1@example.com` (password: ______)
  - [ ] Copy Learner 1's User ID (UUID)
  - [ ] Add user: `learner2@example.com` (password: ______)
  - [ ] Copy Learner 2's User ID (UUID)

- [ ] **Insert learner profiles**
  - [ ] Open SQL Editor → New Query
  - [ ] Use `LEARNERS_INSERT.sql` from project
  - [ ] Replace UUIDs with actual user IDs
  - [ ] Run script
  - [ ] Verify 2 profiles in Table Editor

- [ ] **Create config.js**
  - [ ] In project root, create `js/config.js`
  - [ ] Add:
    ```javascript
    export const SUPABASE_URL = 'https://hzqewqmowtvyrieqbxod.supabase.co'
    export const SUPABASE_ANON_KEY = 'your-anon-key-here'
    ```
  - [ ] Do NOT commit to git (in .gitignore)

- [ ] **Test connection**
  - [ ] Run app in browser
  - [ ] Test login with learner1@example.com
  - [ ] Verify redirects to home page
  - [ ] Test logout

---

### Phase 2: Competition Feature Implementation

**Estimated:** 2 weeks after Phase 1

- [ ] Update authentication system (support multiple learners)
- [ ] Implement leaderboard queries
- [ ] Create leaderboard UI pages
  - [ ] XP leaderboard
  - [ ] Mastered words leaderboard
  - [ ] Streaks leaderboard
- [ ] Create head-to-head comparison page
- [ ] Create learner profile cards
- [ ] Update parent dashboard with multi-learner comparison
- [ ] Add learner settings page (privacy controls)
- [ ] Implement cache update functions
- [ ] Testing & QA

---

## 📚 Key Documents

| Document                  | Purpose                           | Read First?   |
| ------------------------- | --------------------------------- | ------------- |
| SUPABASE_SETUP_GUIDE.md   | Step-by-step setup (YOU ARE HERE) | ✅ Yes         |
| SUPABASE_SETUP.sql        | Database creation script          | ✅ Yes         |
| LEARNERS_INSERT.sql       | Create learner profiles           | ✅ Yes         |
| COMPETITION_FEATURE.md    | Competition feature spec          | ⚠️ After setup |
| TECHNICAL_ARCHITECTURE.md | System design                     | 📖 Reference   |
| DATABASE_SCHEMA.md        | Table structure                   | 📖 Reference   |
| COMPONENT_SPECS.md        | UI specifications                 | 📖 Reference   |

---

## 🔑 Your Credentials (DO NOT SHARE)

**Store these securely (1Password, Keepass, etc.):**

| Item               | Value                                    | Where?         |
| ------------------ | ---------------------------------------- | -------------- |
| Project URL        | https://hzqewqmowtvyrieqbxod.supabase.co | Settings → API |
| Anon Key           | _________________________                | Settings → API |
| Service Role Key   | _________________________                | Settings → API |
| Learner 1 Email    | learner1@example.com                     | Auth → Users   |
| Learner 1 Password | _________________________                | You set this   |
| Learner 2 Email    | learner2@example.com                     | Auth → Users   |
| Learner 2 Password | _________________________                | You set this   |

⚠️ **Never:**
- [ ] Commit credentials to git
- [ ] Share public/anon key in code (it's safe in browser, but be cautious)
- [ ] Push service role key anywhere

---

## 🚀 Command Reference

### Setup Commands

**Copy & run in Supabase SQL Editor:**

1. **Create all tables:**
   - Paste contents of `SUPABASE_SETUP.sql`
   - Click Run

2. **Insert learners (after creating users in Auth):**
   - Paste contents of `LEARNERS_INSERT.sql`
   - Replace UUIDs
   - Click Run

3. **Verify setup:**
   ```sql
   -- Check tables exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public';

   -- Check profiles
   SELECT * FROM profiles;

   -- Check RLS enabled
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public' AND rowsecurity = true;
   ```

### Troubleshooting Commands

**Check for errors:**
```sql
-- List all RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies WHERE schemaname = 'public';

-- Check if user exists
SELECT id, email FROM auth.users;

-- Count tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
```

---

## 💡 Pro Tips

### Tip 1: Test Data
After setup, add test data:
- Log in as Learner 1
- Add 10–20 words
- Take 5 reviews
- Do some quizzes
- Same for Learner 2

Then you can test leaderboards!

### Tip 2: Reset Database
If something goes wrong, reset:
1. Go to Settings → Danger zone → Delete project
2. Create new project
3. Run setup script again

Or just delete individual tables in Table Editor.

### Tip 3: Monitor Usage
Track in Supabase:
- Database size (Settings → Database)
- API usage (Settings → Usage)
- Real-time connections (Status)

### Tip 4: Backup Data
Before deploying:
1. Go to Backups (Settings → Backups)
2. Manual backup
3. Test restore

---

## 📞 Troubleshooting

### Problem: "Table already exists"
**Solution:** Tables already created from previous run. Skip to Step 4.

### Problem: "Permission denied"
**Solution:**
- Check RLS policies in Authentication → Policies
- Ensure user is owner of data being accessed
- Check `is_public = true` for leaderboards

### Problem: "User not found"
**Solution:**
- Create user in Auth → Users first
- Copy correct UUID
- Update LEARNERS_INSERT.sql with actual UUID

### Problem: "ANON_KEY error"
**Solution:**
- Go to Settings → API
- Copy anon public key (not service role)
- Paste in js/config.js
- Clear browser cache and reload

### Problem: "Not able to log in"
**Solution:**
- Verify user created in Auth
- Check email/password match
- Verify auth.users table has user record
- Check email is not already invited (invite pending)

### Problem: Leaderboards show no users
**Solution:**
- Verify profiles created with `is_public = true`
- Check profiles have role = 'learner'
- Run: `SELECT * FROM profiles WHERE is_public = true;`

---

## 📊 Validation Checklist

After setup, verify everything works:

```sql
-- 1. Check all tables exist
SELECT COUNT(*) as table_count FROM information_schema.tables
WHERE table_schema = 'public';
-- Should return: 7 (or more if you add more)

-- 2. Check profiles
SELECT * FROM profiles;
-- Should show: both learners (2 rows)

-- 3. Check RLS enabled
SELECT COUNT(*) as rls_enabled FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
-- Should return: 7 (all tables have RLS)

-- 4. Check auth users
SELECT COUNT(*) as auth_count FROM auth.users;
-- Should return: 2 (both learners)

-- 5. Test public access (simulate leaderboard query)
SELECT p.id, p.display_name, p.is_public FROM profiles p
WHERE p.is_public = true AND p.role = 'learner';
-- Should return: 2 (both learners visible in leaderboard)
```

---

## 🎯 Next Steps

### Today (Setup):
1. ✅ Access Supabase project
2. ✅ Copy API keys securely
3. ✅ Run `SUPABASE_SETUP.sql`
4. ✅ Create users in Auth
5. ✅ Run `LEARNERS_INSERT.sql`
6. ✅ Create `js/config.js`
7. ✅ Test connection

### Tomorrow (Verification):
1. Test login as Learner 1
2. Test login as Learner 2
3. Add sample data (words, reviews)
4. Verify data saved to database
5. Check leaderboard queries work (in SQL Editor)

### This Week (Implementation):
1. Update app code with multi-learner auth
2. Implement leaderboard pages
3. Test competition features
4. Update parent dashboard

---

## 📈 Project Status

**Phase 1: Foundation** ✅ Done (original plan)
**Phase 2: Word Management** ✅ Ready
**Phase 3: Review & Quiz** ✅ Ready
**Phase 4: Gamification** ✅ Ready
**Phase 5: Streaks & Medals** ✅ Ready
**Phase 6: Word Garden** ✅ Ready
**Phase 7: Enhanced Quizzes** ✅ Ready
**Phase 7.5: Competition** 🆕 NEW - Ready for implementation
**Phase 8: Parent Dashboard** ⏳ Updated for multi-learner
**Phase 9: Launch & Polish** ⏳ Updated for multi-learner

---

## 📞 Contact & Support

**Questions about:**
- **Supabase setup** → Read SUPABASE_SETUP_GUIDE.md
- **Competition features** → Read COMPETITION_FEATURE.md
- **General architecture** → Read TECHNICAL_ARCHITECTURE.md
- **Database schema** → Read DATABASE_SCHEMA.md
- **UI design** → Read COMPONENT_SPECS.md

---

## ✅ Final Checklist

Before marking "setup complete":

- [ ] Project accessible
- [ ] API keys stored securely
- [ ] All 7 tables created
- [ ] 2 auth users created
- [ ] 2 learner profiles created
- [ ] RLS policies enabled
- [ ] config.js created with credentials
- [ ] Login test successful
- [ ] All validation SQL queries pass

---

**Status:** Ready for your action!
**Next:** Complete Phase 1 checklist above, then let me know and I'll help with Phase 2 implementation.

