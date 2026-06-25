# Word Adventure — Project Plan

**Status:** Planning Phase
**Last Updated:** 2026-06-21
**Project Type:** Educational Web App (Single Child + Parent)

---

## Executive Summary

Build a vocabulary learning website for a child (age ~10) with spaced repetition, gamification, and visual progress tracking. The parent has a separate monitoring dashboard.

**Key constraints:**
- Vanilla JS frontend (no framework, no build step)
- Supabase backend (Auth + Postgres + Edge Functions)
- Two users only (child + parent, no multi-tenancy)
- Simple, maintainable code optimized for clarity

---

## Project Scope

### In Scope ✅
- Child word collection and review system
- Spaced repetition scheduling
- Three quiz types (meaning, spelling, listening)
- Gamification: XP, levels, streaks, medals, badges
- Word Garden visualization (mastered words)
- Parent dashboard with statistics and CSV export
- Role-based access control (RLS on Supabase)
- English word definitions (Free Dictionary API)
- Chinese translations (MyMemory API)

### Out of Scope ❌
- Multi-user or classroom features
- Social sharing or networking
- Mobile app (web-first, responsive design)
- Audio recording (only SpeechSynthesis TTS)
- Machine learning or adaptive algorithms
- Offline support

---

## Success Criteria

1. ✅ Learner can add words and save them to personal list
2. ✅ Spaced repetition schedule shows "due today" words
3. ✅ Quiz sessions calculate and record test results
4. ✅ XP, levels, and streaks display correctly
5. ✅ Word Garden grows visually as mastered word count increases
6. ✅ Parent can view charts and export data as CSV
7. ✅ Role-based access prevents unauthorized view access
8. ✅ Free Dictionary API and MyMemory integration works for auto-lookup

---

## Tech Stack Summary

| Layer            | Technology                     | Notes                           |
| ---------------- | ------------------------------ | ------------------------------- |
| **Frontend**     | Vanilla JS + HTML + CSS        | No npm, no bundler, ES modules  |
| **Auth**         | Supabase Auth (email/password) | Browser session handled by SDK  |
| **Database**     | Supabase Postgres              | RLS policies for security       |
| **Server Logic** | Supabase Edge Functions (Deno) | Lookup-word API only            |
| **Styling**      | CSS Variables + Plain CSS      | Theme-able, no Tailwind         |
| **Charts**       | Chart.js (CDN)                 | Parent dashboard only           |
| **Deployment**   | Netlify or GitHub Pages        | Static files + Supabase backend |
| **Dictionary**   | Free Dictionary API            | 1000 req/hr, no key             |
| **Translation**  | MyMemory API                   | 5000 chars/day anonymous        |

---

## Database Overview

### Core Tables

| Table             | Purpose                 | Key Fields                                                                                                 |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `profiles`        | User metadata           | `id`, `role` (child/parent), `display_name`                                                                |
| `words`           | Child's word collection | `user_id`, `word`, `part_of_speech`, `english_definition`, `chinese_definition`, `category`, `is_favorite` |
| `review_schedule` | Spaced repetition state | `word_id`, `next_review_date`, `review_level`, `interval_days`                                             |
| `test_results`    | Quiz attempt history    | `user_id`, `word_id`, `test_type`, `correct`, `response`, `tested_at`                                      |
| `achievements`    | Badges and medals       | `user_id`, `achievement_code`, `earned_at`                                                                 |
| `daily_stats`     | Optional aggregation    | `date`, `user_id`, `words_added`, `tests_completed`                                                        |

### RLS Policy Model

- Child can only read/write their own `words`, `review_schedule`, `test_results`, `achievements`
- Parent can only read child's stats (view-only dashboard)
- Use `user_id` column on all data tables for RLS enforcement

---

## Feature Breakdown

### Phase 1: Core Learning (Weeks 1–3)

**Goal:** Functional spaced repetition loop

- [ ] Supabase project setup + tables + RLS
- [ ] Auth flow (login/logout, role-based redirect)
- [ ] Add word page (manual entry → auto-lookup via Edge Function)
- [ ] Word list page (display, search, delete)
- [ ] Review session (SRS scheduling, correct/incorrect tracking)
- [ ] Quiz session (meaning quiz first)

**Deliverable:** Child can add words, review on schedule, and take quizzes.

---

### Phase 2: Gamification (Weeks 4–5)

**Goal:** Motivate continued use

- [ ] XP system (compute from words, tests, reviews)
- [ ] Levels display (Level 1–5: Explorer → Vocabulary Wizard)
- [ ] Streaks (consecutive days with activity)
- [ ] Medals (word count milestones: Bronze, Silver, Gold, Platinum)
- [ ] Badges (special achievements: Perfect Week, Speed Reader, etc.)
- [ ] Home screen dashboard (XP, level, streak, due reviews at a glance)

**Deliverable:** Child sees progress through XP bar, level badge, and achievement notifications.

---

### Phase 3: Word Garden (Week 6)

**Goal:** Visual reward for mastery

- [ ] Query mastered word count (review_level >= 4)
- [ ] SVG/Canvas rendering of garden stages (seeds → sprouts → flowers → trees → forest)
- [ ] Animated growth as new words reach mastery
- [ ] Garden page with details

**Deliverable:** Child has a growing visual representation of vocabulary growth.

---

### Phase 4: Enhanced Quizzes (Week 7)

**Goal:** Variety and comprehensive testing

- [ ] Spelling quiz (show definition, type the word)
- [ ] Listening quiz (SpeechSynthesis TTS, type the word)
- [ ] Random quiz type selection in sessions
- [ ] Hint system (reveal one letter for spelling)

**Deliverable:** Multiple quiz modes reduce monotony.

---

### Phase 5: Parent Dashboard (Week 8)

**Goal:** Parental visibility and export

- [ ] Statistics dashboards (charts via Chart.js CDN)
  - Words added per day (30-day bar chart)
  - Review completion % per week (line chart)
  - Test accuracy % over time (line chart)
  - Mastered word count (number card)
  - Current streak (number card)
- [ ] CSV export of all word data
- [ ] Parent-only URL routes

**Deliverable:** Parent can track child's progress and export data.

---

### Phase 6: Polish & Testing (Week 9)

**Goal:** Stability and UX refinement

- [ ] Edge cases (empty states, error messages, network failures)
- [ ] Performance optimization (query indexing, client-side caching)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (color contrast, keyboard navigation)
- [ ] Browser testing (Chrome, Safari, Firefox)

**Deliverable:** Production-ready app.

---

## Implementation Order (Week-by-Week)

### Week 1: Foundation
1. Initialize Supabase project
2. Create database tables and RLS policies
3. Set up index.html, style.css, app.js router
4. Implement login/logout and role-based redirect
5. Create `config.js` template (gitignored)

### Week 2: Word Management
1. Implement `add-word.js` (manual entry first)
2. Wire up Edge Function `/lookup-word` (Free Dictionary + MyMemory APIs)
3. Create `word-list.js` (display, search, delete)
4. Implement SRS interval logic in `srs.js`

### Week 3: Review & Quiz
1. Implement `review.js` (pull due words, update schedule)
2. Implement `quiz.js` (meaning quiz, record test results)
3. Add test data (10–20 words) for testing
4. Test SRS scheduling with manual date adjustments

### Week 4: XP & Levels
1. Implement XP calculation in `xp.js`
2. Create `achievements.js` logic
3. Update `child-home.js` with XP bar, level badge, streak display
4. Add XP notifications when completing actions

### Week 5: Streaks & Medals
1. Implement streak calculation (consecutive days with activity)
2. Add medal check on login/session refresh
3. Display medal badges on home screen
4. Add achievement notifications

### Week 6: Word Garden
1. Implement SVG garden rendering in `garden.js`
2. Query mastered word count from `review_schedule`
3. Create `garden-page.js` (visualization + details)
4. Add animated transitions for garden growth

### Week 7: Enhanced Quizzes
1. Add spelling quiz to `quiz.js`
2. Add listening quiz with SpeechSynthesis
3. Implement hint system (reveal one letter)
4. Randomize quiz type selection

### Week 8: Parent Dashboard
1. Wire up Chart.js (CDN) for statistics
2. Create `parent-dashboard.js` with charts
3. Implement CSV export functionality
4. Add parent-only routes and auth guard

### Week 9: Polish & Launch
1. Test all features end-to-end
2. Fix edge cases and error messages
3. Optimize queries and add client-side caching
4. Responsive design review
5. Deploy to Netlify or GitHub Pages

---

## File Structure (Reference)

```
/
├── index.html                  — Single entry point
├── style.css                   — Global styles, CSS variables
├── js/
│   ├── app.js                  — Router and main app logic
│   ├── auth.js                 — Auth flow
│   ├── config.js               — Environment variables (gitignored)
│   ├── supabase.js             — Supabase client init
│   │
│   ├── lib/
│   │   ├── srs.js              — Spaced repetition logic
│   │   ├── xp.js               — XP and level calculation
│   │   ├── achievements.js     — Achievement checking
│   │   └── garden.js           — Garden SVG rendering
│   │
│   └── pages/
│       ├── child-home.js       — Child dashboard
│       ├── add-word.js         — Word lookup and add
│       ├── word-list.js        — Word list with search
│       ├── review.js           — Spaced repetition review
│       ├── quiz.js             — Quiz session
│       ├── garden.js           — Garden visualization
│       ├── achievements.js     — Achievements page
│       └── parent-dashboard.js — Parent stats and export
│
├── assets/
│   └── icons/                  — SVG icons
│
├── .gitignore                  — Exclude config.js
├── README.md                   — Setup instructions
└── Design.md                   — Original design doc
```

---

## Key Decisions & Trade-offs

| Decision                                            | Rationale                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| Vanilla JS (no framework)                           | Simpler codebase, easier to modify later, no npm/build step needed          |
| Supabase Edge Functions instead of separate backend | Reduce operational complexity, no extra server to manage                    |
| Lookup flow goes through Edge Function, not browser | Keeps code architecture cleaner, easier to add authentication/logging later |
| Fixed-interval SRS (not SM-2)                       | Simpler logic, sufficient for young learner, easy to adjust                 |
| Role column in profiles instead of Supabase roles   | More explicit and easier to query in RLS policies                           |
| CSS variables for theming                           | No external dependency, allows easy dark mode later                         |
| Chart.js from CDN (not Recharts)                    | Lighter weight, no build step                                               |

---

## Risk Mitigation

| Risk                                     | Likelihood | Impact | Mitigation                                                 |
| ---------------------------------------- | ---------- | ------ | ---------------------------------------------------------- |
| Free Dictionary API rate limit (1000/hr) | Low        | Medium | Add caching, warn user if limit hit                        |
| MyMemory 5000 chars/day limit            | Low        | Low    | Register free account to raise to 50k chars/day            |
| Supabase outage                          | Very Low   | High   | Display offline message, no local sync needed yet          |
| RLS policy misconfiguration              | Medium     | High   | Test all access patterns, review policies twice            |
| Child loses data on device wipe          | Low        | Medium | Implement browser backup (localStorage), parent CSV export |

---

## Deployment Checklist

- [ ] Supabase project created, tables migrated, RLS policies enabled
- [ ] Edge Function `/lookup-word` deployed and tested
- [ ] `config.js` created with production credentials
- [ ] `index.html` has correct CDN imports (Supabase, Chart.js)
- [ ] Two user accounts created (one child, one parent)
- [ ] Static files built and ready for Netlify/GitHub Pages
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up (Supabase logs, CDN alerts)

---

## Maintenance & Future Work

**Post-Launch Monitoring:**
- Track API usage (Free Dictionary, MyMemory)
- Monitor Supabase database growth and RLS performance
- Collect child feedback on UX (verbally or simple survey)

**Possible Future Features (Phase 2):**
- Word categories and curated lists
- Pronunciation guide (IPA + audio)
- Notebook / word etymology
- Parent notification on low streaks
- Dark mode
- Offline support with sync

---

## Communication Plan

- **Weekly sync:** Review progress, blockers, any design changes
- **Phase gates:** Approval before moving to next phase
- **User testing:** Involve child in Phase 6 polish (feedback on UI, colors, difficulty)
- **Launch:** Internal testing first, then invite child and parent

---

## Document References

- [Design.md](Design.md) — Original design document
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) — Detailed tech breakdown
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Complete DB schema with SQL
- [COMPONENT_SPECS.md](COMPONENT_SPECS.md) — UI component specifications
- [DEVELOPMENT_CHECKLIST.md](DEVELOPMENT_CHECKLIST.md) — Implementation steps

---

## Sign-Off

**Project Lead:** (Your Name)
**Stakeholder:** Learner, Parent
**Approval Date:** _______________
**Target Launch:** Week 9 (9 weeks from start)
