# Word Adventure — Technical Architecture

**Version:** 1.0
**Date:** 2026-06-21
**Status:** Design Phase

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Vanilla JS SPA)                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ app.js (Router)  →  Pages (child-home, add-word, quiz, etc.)    │   │
│  │ lib/ (SRS, XP, Achievements, Garden)                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              ↓                                            │
│                    Supabase JS Client (CDN)                             │
│                   (Auth + Database + Real-time)                         │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓  (HTTP REST)
┌─────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE CLOUD (Backend)                           │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Auth Module                                                   │    │
│  │  - Email/password login                                        │    │
│  │  - Session tokens (JWT)                                        │    │
│  └────────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL Database + RLS Policies                            │    │
│  │  - profiles, words, review_schedule, test_results, achievements  │  │
│  │  - Each table enforces RLS: user can only access own rows      │    │
│  └────────────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Edge Function: POST /lookup-word                              │    │
│  │  - Calls Free Dictionary API → English definition, POS         │    │
│  │  - Calls MyMemory API → Chinese translation                    │    │
│  │  - Returns combined result to browser                          │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ (HTTPS)
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL APIs (No Auth)                         │
│  • freedictionaryapi.com/api/v2/entries/en/{word}                       │
│  • api.mymemory.translated.net/get                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓ (HTTPS)
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT (Static CDN)                         │
│  Netlify or GitHub Pages                                                │
│  - Hosts index.html, style.css, js/ modules, assets/                    │
│  - All code runs in browser (no server-side rendering)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Module Organization

```
js/
├── app.js                    — Main entry point, router, app lifecycle
├── auth.js                   — Authentication handlers (login, logout, session check)
├── supabase.js               — Supabase client initialization
├── config.js                 — Environment config (gitignored)
│
├── lib/                      — Utility & logic libraries (no UI)
│   ├── srs.js                — Spaced repetition scheduling logic
│   ├── xp.js                 — XP and level calculation
│   ├── achievements.js       — Achievement rule evaluation
│   └── garden.js             — Garden SVG/Canvas rendering logic
│
└── pages/                    — Page modules (UI rendering + events)
    ├── child-home.js         — Child dashboard
    ├── add-word.js           — Word lookup + add + preview
    ├── word-list.js          — Browse, search, delete words
    ├── review.js             — Spaced repetition review session
    ├── quiz.js               — Quiz session (meaning, spelling, listening)
    ├── garden.js             — Word Garden page
    ├── achievements.js       — Medals and badges display
    └── parent-dashboard.js   — Statistics, charts, CSV export
```

### Routing Pattern

**URL hash-based routing** (no server-side routing needed):

```
#/login                    → auth.js (show login form)
#/child/home               → child-home.js
#/child/add-word           → add-word.js
#/child/words              → word-list.js
#/child/review             → review.js
#/child/quiz               → quiz.js
#/child/garden             → garden.js
#/child/achievements       → achievements.js
#/parent/dashboard         → parent-dashboard.js
```

**Router Implementation (app.js):**

```javascript
const routes = {
  '/login': import('./pages/login.js'),
  '/child/home': import('./pages/child-home.js'),
  '/child/add-word': import('./pages/add-word.js'),
  // ... etc
}

window.addEventListener('hashchange', () => {
  const route = window.location.hash.slice(1) || '/login'
  const page = routes[route]
  if (page) page.render(document.getElementById('app'))
})

// On app load, check session and redirect to appropriate dashboard
```

### Page Module Pattern

Each page module exports a single `render(container)` function:

```javascript
// pages/child-home.js
export async function render(container) {
  // 1. Fetch data
  const { data: user } = await supabase.auth.getUser()
  const { data: xpStats } = await supabase
    .from('words')
    .select('COUNT(*)', { count: 'exact' })
    .eq('user_id', user.id)

  // 2. Render HTML
  container.innerHTML = `
    <h1>Dashboard</h1>
    <div class="xp-display">${xpStats.count} words added</div>
    <button id="btn-add-word">Add Word</button>
  `

  // 3. Attach event listeners
  document.getElementById('btn-add-word').addEventListener('click', () => {
    window.location.hash = '#/child/add-word'
  })
}
```

---

## Backend Architecture

### Supabase Configuration

#### 1. Auth Setup

**Provider:** Email/password only

- No OAuth, no third-party login
- Two hardcoded users: `child@example.com` and `parent@example.com`
- Session tokens (JWT) valid for 30 days

**Session Handling:**

```javascript
// Client-side
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
})

// Token stored in browser localStorage by Supabase JS SDK
// Automatically attached to all API requests
```

#### 2. Database Tables

All tables are in public schema. RLS policies enforce access control.

**profiles**
```sql
id          uuid  PRIMARY KEY REFERENCES auth.users(id)
role        text  NOT NULL CHECK (role IN ('child', 'parent'))
display_name text  DEFAULT 'User'
created_at  timestamptz DEFAULT now()

RLS: SELECT on own row only
```

**words**
```sql
id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
word                text  NOT NULL
part_of_speech      text
english_definition  text
chinese_definition  text
example_sentence    text
category            text  DEFAULT 'general'
is_favorite         boolean DEFAULT false
created_at          timestamptz DEFAULT now()

RLS: User can SELECT/INSERT/UPDATE/DELETE only own words
INDEX: (user_id, created_at DESC) for efficient queries
```

**review_schedule**
```sql
id               uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id          uuid  NOT NULL UNIQUE REFERENCES words(id) ON DELETE CASCADE
next_review_date date  NOT NULL DEFAULT CURRENT_DATE
review_level     int   DEFAULT 0
ease_factor      float DEFAULT 2.5
interval_days    int   DEFAULT 1
created_at       timestamptz DEFAULT now()

RLS: User can access only schedules for their own words
INDEX: (next_review_date, user_id) for "due today" queries
```

**test_results**
```sql
id          uuid  PRIMARY KEY DEFAULT gen_random_uuid()
word_id     uuid  NOT NULL REFERENCES words(id) ON DELETE CASCADE
user_id     uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
test_type   text  NOT NULL CHECK (test_type IN ('meaning', 'spelling', 'listening'))
correct     boolean NOT NULL
response    text
tested_at   timestamptz DEFAULT now()

RLS: User can SELECT/INSERT only own results
INDEX: (user_id, tested_at DESC) for accuracy reporting
```

**achievements**
```sql
id               uuid  PRIMARY KEY DEFAULT gen_random_uuid()
user_id          uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
achievement_code text  NOT NULL
earned_at        timestamptz DEFAULT now()

RLS: User can SELECT only own achievements
INDEX: (user_id, achievement_code) for deduplication
```

#### 3. RLS Policies

Example for `words` table:

```sql
-- Allow users to select only their own words
CREATE POLICY "users_select_own_words"
  ON words FOR SELECT
  USING (user_id = (SELECT id FROM auth.users WHERE auth.uid() = id))

-- Allow users to insert words
CREATE POLICY "users_insert_own_words"
  ON words FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM auth.users WHERE auth.uid() = id))

-- Allow users to update their own words
CREATE POLICY "users_update_own_words"
  ON words FOR UPDATE
  USING (user_id = (SELECT id FROM auth.users WHERE auth.uid() = id))

-- Allow users to delete their own words
CREATE POLICY "users_delete_own_words"
  ON words FOR DELETE
  USING (user_id = (SELECT id FROM auth.users WHERE auth.uid() = id))
```

**Parent dashboard access:** Create a separate RLS policy allowing parent to SELECT child's data (view-only):

```sql
CREATE POLICY "parent_can_view_child_data"
  ON words FOR SELECT
  USING (
    user_id = (SELECT id FROM auth.users WHERE email = 'child@example.com')
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'parent'
  )
```

---

### Edge Function: /lookup-word

**Purpose:** Fetch English definition and Chinese translation without exposing APIs to frontend.

**Deployment:** Supabase Edge Functions (Deno runtime)

**Endpoint:** `POST /lookup-word`

**Request Body:**
```json
{
  "word": "curious"
}
```

**Response (Success):**
```json
{
  "word": "curious",
  "part_of_speech": "adjective",
  "english_definition": "eager to know or learn something",
  "chinese_definition": "渴望了解或学习某事",
  "example_sentence": "The curious boy opened the box."
}
```

**Response (Word Not Found):**
```json
{
  "error": "not_found",
  "message": "Word not found in dictionary. Please enter the definition manually."
}
```

**Implementation (Deno):**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { word } = await req.json()

  if (!word) {
    return new Response(
      JSON.stringify({ error: 'missing_word' }),
      { status: 400 }
    )
  }

  // Step 1: Fetch English definition
  const dictUrl = `https://api.freedictionaryapi.com/api/v2/entries/en/${word.toLowerCase()}`
  const dictRes = await fetch(dictUrl)

  if (!dictRes.ok) {
    return new Response(
      JSON.stringify({ error: 'not_found' }),
      { status: 404 }
    )
  }

  const dictData = await dictRes.json()
  const entry = dictData[0]
  const meaning = entry.meanings[0]
  const definition = meaning.definitions[0]

  const englishDefinition = definition.definition
  const partOfSpeech = meaning.partOfSpeech
  const exampleSentence = definition.example || ''

  // Step 2: Translate definition to Chinese
  const translateUrl = new URL('https://api.mymemory.translated.net/get')
  translateUrl.searchParams.set('q', englishDefinition)
  translateUrl.searchParams.set('langpair', 'en|zh-CN')

  const translateRes = await fetch(translateUrl.toString())
  const translateData = await translateRes.json()

  const chineseDefinition =
    translateData.responseStatus === 200
      ? translateData.responseData.translatedText
      : ''

  // Step 3: Return combined result
  return new Response(
    JSON.stringify({
      word,
      part_of_speech: partOfSpeech,
      english_definition: englishDefinition,
      chinese_definition: chineseDefinition,
      example_sentence: exampleSentence
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## Data Flow Diagrams

### Add Word Flow

```
1. Child enters word (e.g., "curious")
     ↓
2. Browser calls Edge Function POST /lookup-word
     ↓
3. Edge Function calls:
   - freedictionaryapi.com → {definition, part_of_speech, example}
   - mymemory.translated.net → {chinese_translation}
     ↓
4. Edge Function returns combined response
     ↓
5. Browser shows preview card (all fields editable)
     ↓
6. Child confirms → INSERT into `words` table + `review_schedule` table
     ↓
7. Home screen updates, XP +1
```

### Review Session Flow

```
1. Child clicks "Review Today's Words"
     ↓
2. Query: SELECT * FROM review_schedule WHERE next_review_date <= TODAY
     ↓
3. For each due word, load from `words` table
     ↓
4. Randomly select quiz type (meaning, spelling, or listening)
     ↓
5. Show quiz question
     ↓
6. Child answers → INSERT into `test_results` table
     ↓
7. If correct:   UPDATE review_schedule SET level = level+1, next_review_date = today + interval
   If incorrect: UPDATE review_schedule SET level = 0, next_review_date = today + 1
     ↓
8. Next word (or end session)
     ↓
9. Update home screen: XP +2 (per review), +3 (per correct)
```

### Parent Dashboard Flow

```
1. Parent logs in (role = 'parent')
     ↓
2. Redirect to /parent/dashboard
     ↓
3. Query child's data (RLS allows read-only access):
   - COUNT(words) WHERE created_at >= 30 days ago (group by date)
   - AVG(correct) FROM test_results WHERE tested_at >= 30 days ago
   - COUNT(*) FROM review_schedule WHERE review_level >= 4 (mastered)
     ↓
4. Render charts with Chart.js CDN
     ↓
5. Export button → query all words + test_results, convert to CSV, download
```

---

## API Integration Points

### Free Dictionary API

**Endpoint:** `https://api.freedictionaryapi.com/api/v2/entries/en/{word}`

**Rate Limit:** 1000 requests/hour, no key needed

**Response Parse:**

```javascript
const entry = response[0]
const meaning = entry.meanings[0]
const definition = meaning.definitions[0]

const partOfSpeech = meaning.partOfSpeech // "noun", "verb", etc.
const englishDefinition = definition.definition
const example = definition.example || null
```

**Error Handling:**
- 404 → Word not found, allow manual entry
- Other errors → Show user-friendly message, allow manual entry

### MyMemory Translation API

**Endpoint:** `https://api.mymemory.translated.net/get?q={text}&langpair=en|zh-CN`

**Rate Limit:** 5000 characters/day (anonymous), 50,000 with free email signup

**Response Parse:**

```javascript
if (response.responseStatus === 200) {
  const chineseText = response.responseData.translatedText
} else {
  // Translation failed, leave empty
  const chineseText = ''
}
```

**Edge Case:** Translate the full English definition, not just the word, for better context.

---

## Client-Side Logic Libraries

### srs.js — Spaced Repetition Scheduling

```javascript
export const SRS_LADDER = {
  0: 1,    // New: review after 1 day
  1: 3,    // Level 1: 3 days
  2: 7,    // Level 2: 7 days
  3: 14,   // Level 3: 14 days
  4: 30,   // Level 4: 30 days
  5: 60    // Level 5+: mastered (60+ days)
}

export function calculateNextReview(correct, currentLevel) {
  let nextLevel = correct ? currentLevel + 1 : 0
  nextLevel = Math.min(nextLevel, 5)
  const intervalDays = SRS_LADDER[nextLevel]
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + intervalDays)
  return { nextLevel, intervalDays, nextDate }
}

export function isMastered(reviewLevel) {
  return reviewLevel >= 4
}
```

### xp.js — XP and Level Calculation

```javascript
export const XP_MILESTONES = {
  1: 0,     // Explorer
  2: 50,    // Adventurer
  3: 150,   // Scholar
  4: 350,   // Word Master
  5: 700    // Vocabulary Wizard
}

export async function calculateTotalXP(userId) {
  // XP = (words_added * 1) + (reviews_completed * 2) + (correct_answers * 3)
  const { data: words } = await supabase
    .from('words')
    .select('COUNT(*)', { count: 'exact' })
    .eq('user_id', userId)

  const { data: reviews } = await supabase
    .from('test_results')
    .select('COUNT(*)', { count: 'exact' })
    .eq('user_id', userId)

  const { data: correct } = await supabase
    .from('test_results')
    .select('COUNT(*)', { count: 'exact' })
    .eq('user_id', userId)
    .eq('correct', true)

  return (words.count * 1) + (reviews.count * 2) + (correct.count * 3)
}

export function getLevel(totalXP) {
  for (let level = 5; level >= 1; level--) {
    if (totalXP >= XP_MILESTONES[level]) return level
  }
  return 1
}
```

### achievements.js — Achievement Checking

```javascript
export const ACHIEVEMENT_CODES = {
  BRONZE_100: { name: 'Bronze Badge', threshold: 100 },
  SILVER_500: { name: 'Silver Badge', threshold: 500 },
  GOLD_1000: { name: 'Gold Badge', threshold: 1000 },
  PLATINUM_2000: { name: 'Platinum Badge', threshold: 2000 },
  PERFECT_WEEK: { name: 'Perfect Week', check: 'perfectWeek' },
  SPEED_READER: { name: 'Speed Reader', check: 'speedReader' },
  STREAK_7: { name: '7-Day Streak', check: 'streak7' },
  STREAK_30: { name: '30-Day Streak', check: 'streak30' },
  STREAK_100: { name: '100-Day Streak', check: 'streak100' }
}

export async function checkNewAchievements(userId) {
  const newAchievements = []

  // Check word count milestones
  const wordCount = await getWordCount(userId)
  const milestones = ['BRONZE_100', 'SILVER_500', 'GOLD_1000', 'PLATINUM_2000']
  for (const code of milestones) {
    if (wordCount >= ACHIEVEMENT_CODES[code].threshold) {
      newAchievements.push(code)
    }
  }

  // Check other achievements...

  return newAchievements
}
```

### garden.js — SVG Garden Rendering

```javascript
export function renderGarden(container, masteredCount) {
  // Render SVG based on mastered word count
  let stage = getGardenStage(masteredCount)
  const svg = generateGardenSVG(stage)
  container.innerHTML = svg
}

function getGardenStage(count) {
  if (count < 1) return 'empty'
  if (count < 10) return 'seeds'
  if (count < 50) return 'sprouts'
  if (count < 100) return 'flowers'
  if (count < 500) return 'trees'
  return 'forest'
}

function generateGardenSVG(stage) {
  // Return SVG markup for garden visualization
}
```

---

## Performance Considerations

### Query Optimization

**Indexes to create:**
```sql
-- word lookups by user
CREATE INDEX idx_words_user_id ON words(user_id);

-- review schedule queries
CREATE INDEX idx_review_schedule_next_date ON review_schedule(next_review_date, user_id);

-- test results queries
CREATE INDEX idx_test_results_user_id ON test_results(user_id, tested_at DESC);

-- achievement lookups
CREATE INDEX idx_achievements_user_code ON achievements(user_id, achievement_code);
```

### Client-Side Caching

Cache frequently accessed data in memory:
- `currentUser` (profiles row)
- `userWords` (words list)
- `userStats` (XP, level, streak)

Invalidate cache on data mutations (add/update/delete word).

### Image & Asset Optimization

- Use inline SVG for icons (no HTTP requests)
- Use CSS variables for colors (easy theming)
- Minify CSS before deployment

---

## Security

### Authentication & Authorization

1. **Supabase Auth handles JWT tokens** — no custom auth needed
2. **RLS policies enforce data access** — database level security
3. **Role-based access:** `role` column in `profiles` determines UI shown
4. **Parent dashboard:** Separate RLS policy for view-only access to child data

### API Key Management

- **Free Dictionary API:** No key needed
- **MyMemory API:** No key needed (called server-side from Edge Function)
- **Supabase Auth:** Uses public `anon_key` (by design, RLS handles security)

### CORS & External APIs

- **Edge Function acts as proxy** — browser never calls external APIs directly
- **CORS not an issue** — all external API calls made from Supabase (server-side)

---

## Deployment Architecture

### Frontend (Static Hosting)

**Option 1: Netlify**
- Connect GitHub repo
- Set build command to `echo "No build needed"`
- Deploy to `main` branch automatically
- Custom domain: `word-adventure.netlify.app`

**Option 2: GitHub Pages**
- Push to `gh-pages` branch
- Custom domain: `word-adventure.github.io`

### Backend (Supabase Managed)

- Supabase hosts PostgreSQL, Auth, Edge Functions
- No separate server to manage
- Automatic backups and scaling

### Environment Configuration

**Netlify Environment Variables:**
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Browser Config (js/config.js):**
```javascript
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
```

---

## Monitoring & Logging

### What to Monitor

- **Supabase API usage** (real-time in Supabase dashboard)
- **Free Dictionary API rate limit** (log requests in Edge Function)
- **MyMemory API failures** (log in Edge Function)
- **User session activity** (view in Supabase Auth dashboard)
- **Page load time** (browser DevTools Performance tab)

### Error Tracking

Use Supabase logs and browser console for debugging:
- Edge Function logs: Supabase dashboard → Functions
- Client errors: Browser console (DevTools)
- Database errors: Supabase dashboard → Query Performance

---

## Scaling Considerations (Future)

For a single child, current setup is sufficient. If scaling needed:

1. **Multi-child:** Add `organization_id` column to profiles, change RLS policies
2. **Performance:** Add Redis caching for frequently accessed data
3. **Rate limiting:** Implement per-user API call limits
4. **CDN:** Use Cloudflare to cache static assets globally

---

## Technology Rationale

| Choice         | Why                                                       |
| -------------- | --------------------------------------------------------- |
| Vanilla JS     | No framework overhead, simple to modify, fast load time   |
| Supabase       | Managed auth + database + functions, no server ops needed |
| Edge Functions | Server-side API proxy, better than frontend calls         |
| Postgres RLS   | Fine-grained, database-level access control               |
| CSS Variables  | Theming without dependencies                              |
| Hash Routing   | No server-side rendering needed                           |

---

## References

- Supabase Documentation: https://supabase.com/docs
- Edge Functions: https://supabase.com/docs/guides/functions
- RLS Policies: https://supabase.com/docs/guides/auth/row-level-security
- Free Dictionary API: https://freedictionaryapi.com/
- MyMemory API: https://mymemory.translated.net/
- ES Modules: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- Chart.js: https://www.chartjs.org/
