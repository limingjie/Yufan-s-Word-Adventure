# Word Lookup — called directly from browser

> Detail doc for [CLAUDE.md](../CLAUDE.md). The add-word dictionary lookup flow.

Both APIs support CORS, so `word-list.js` (the add-word drawer) calls them directly — no Edge Function needed.

### Spelling check

Before showing the save form, the user must click "Look Up". If the API returns 404, the status shows "Not found — check spelling or fill in manually" and `lookupResult` is set to `'not_found'`. On save, the user sees a confirm dialog before proceeding. If the user edits the word input after a lookup, the details panel resets and a fresh lookup is required.

### Step 1: IPA + English definition + built-in Chinese (v1 API)

```
GET https://freedictionaryapi.com/api/v1/entries/en/{word}?translations=true
```

Response shape (Wiktionary-sourced):

- US IPA: `pronunciations.find(p => p.type === "ipa" && p.tags?.includes("General American"))?.text`
- UK IPA: `pronunciations.find(p => p.type === "ipa" && p.tags?.includes("Received Pronunciation"))?.text`
- Stored as `usIpa$ukIpa` in `ipa` field (US first)
- Audio URLs: probed with GET + body-cancel (CORS allows GET, not HEAD). Stored only if server returns 200.
  - `https://api.dictionaryapi.dev/media/pronunciations/en/{word}-us.mp3`
  - `https://api.dictionaryapi.dev/media/pronunciations/en/{word}-uk.mp3`
- Part of speech: `entries[0].partOfSpeech`
- Definitions: collected across all `entries[]`, up to 2 per POS entry, max 8 total — stored newline-separated in `english_definition`, each prefixed with "(noun) ", "(verb) ", etc.
- Example: first `senses[].examples[0]` found across all senses
- Word forms: extracted from `entries[0].forms[]`, filtered by tag rules → `word_forms` JSONB
- Synonyms: from `senses[].synonyms[]`, deduped, max 12, comma-separated
- Antonyms: from `senses[].antonyms[]`, deduped, max 8, comma-separated
- Quotes: from `senses[].quotes[]`, max 4, stored as `text — reference` per line
- Chinese: `entries[0].senses[0].translations.find(t => t.language.code.startsWith("zh"))?.word`
  - Format is `Traditional /Simplified` — extract the part after `/`
  - Only present for some words (Wiktionary coverage)

### Step 2: Chinese fallback — MyMemory (when v1 has no Chinese)
```
GET https://api.mymemory.translated.net/get?q={word}&langpair=en|zh-CN
```
Extract: `responseData.translatedText`

### Error handling

- Dictionary API 404 → show "not found" message, user fills in manually
- MyMemory failure → non-fatal, user fills in Chinese manually
- Always allow manual editing of all fields before saving
