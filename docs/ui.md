# UI: Word Card, Rules & Responsiveness

> Detail doc for [CLAUDE.md](../CLAUDE.md). The word-list card UI plus the global
> UI rules and responsive requirements.

## Word Card UI (`word-list.js`)

### Sort & Filter controls

- **Word count:** the `#wordCount` element beside the "My Words" heading shows the total (`N words`), switching to `N of TOTAL words` while a search/date filter is active. Updated in `redraw()`, so it tracks adds/deletes/filters live.
- **Sort button:** single `[By Date ▾]` dropdown cycling through Date / A–Z / Level (replaced 3 separate buttons)
- **Date filter:** `📅 Date` button opens an inline calendar picker; selecting a date filters words by `created_at`; active filter shown as a chip with ✕ to clear
- Calendar picker computes word activity from already-loaded `allWords` — no extra DB call

### Word card layout

Each `.word-card` has a collapsible body (click to expand). Header is a single flex row:

```
[word title]  [· pos · 🔊 US /ipa/ · 🔊 UK /ipa/]  [SRS badge]  [✏️]  [✕]
```

The pronunciation span uses `pronHtmlFor(src, ipa, role)` which renders:

- **With audio:** `btn btn-secondary btn-sm` chip + monospace font (matches drawer lookup chips)
- **IPA only, no audio:** dimmed non-interactive span
- **Single IPA stored:** reused as label for both US and UK chips

### Word card body order

1. Word forms chips (past, past part., 3rd, -ing, pl., comp., superl.) — **top**
2. English definitions (numbered list if multi-line, plain text if single)
3. Chinese definition
4. Synonyms / Antonyms (comma-separated, small text)
5. Example sentence (italic) — sits directly **above** quotes
6. Quotes (up to 2, blockquote style)
7. Category (if not "general")

The add-word drawer matches this order (Example directly above Quotes in the "More details" section). It also puts **Part of speech above the definitions and always visible** (no longer inside "More details"), and **Part of speech, Definitions and Chinese are mandatory** on save. The Chinese field accepts **Chinese characters only**: the field is *not* filtered while typing (so an IME's in-progress pinyin isn't destroyed) — instead `zhOnly()` strips all ASCII (Latin letters/digits/punctuation) at **save/update** time. So an English word can't leak in to give away spelling-quiz answers; if a learner typed only ASCII it's stripped to empty and the mandatory-Chinese check blocks the save.

---

## UI Rules

- **Learner-facing views:** large text, large touch targets (min 44px), friendly empty states, no dense tables
- **Parent dashboard:** can be more information-dense; use Chart.js from CDN for charts
- **Empty states:** always show a prompt to act, never a blank screen (e.g. "No words yet — add your first word!")
- **Errors:** plain language, never technical (e.g. "That word wasn't found. You can type the definition yourself.")
- **Language:** all UI in English; Chinese appears only in word definition fields
- **No purple in links/buttons.** `--secondary-color` is slate blue-gray (`#64748b`, hover `#475569`) — drives every `.btn-secondary` and many text labels (IPA, stat labels, leaderboard rank, review POS). The XP/Sunlight chip is light green (`.xp-chip`) and its progress bar (`.xp-mini-fill`) is a green gradient; the `meaning` mission accent is rose. (The lone purple confetti sparkle in `celebrate.js` is decorative and intentionally kept.)
- **Round icon chips.** The `?` help button (`.help-btn`, home + garden) is a fixed 30px perfect circle — it opts out of the global button padding and the mobile `min-height:44px` rule so it stays round on phones. Avatar-picker cells (`.cell-box`) likewise opt out of the mobile min-height rule and use `align-items:start` so every emoji/color block is an equal square.

### Responsiveness

The app must be fully usable on a smartphone. Apply these rules everywhere:

- `index.html` must include `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Write CSS mobile-first: base styles target narrow screens, `@media (min-width: 640px)` for wider layouts
- Use `max-width` + `margin: auto` on a single `.container` wrapper — never fixed pixel widths on layout elements
- Flex and grid layouts only; no absolute positioning for flow elements
- Tap targets (buttons, links, inputs) must be at least 44×44px
- Font sizes: minimum 16px for body text (prevents iOS auto-zoom on input focus), 20px+ for primary actions
- Avoid hover-only interactions — all interactions must work with touch
- Quiz answer buttons and review cards must be full-width on mobile, multi-column on desktop
- IPA text may use a smaller font (14px) but must remain readable
