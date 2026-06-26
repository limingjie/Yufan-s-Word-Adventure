import { getPrioritizedWords, recordTestResult, getUserCoins, buyGardenItem, completeReview, getTodayAttemptCounts } from '../js/db.js';
import { runAfterActivity } from '../js/lib/awards.js';
import { celebrateEvents, comboPopup } from '../js/lib/celebrate.js';

const FALLBACK_WORDS = ['curious', 'adventure', 'brilliant', 'mysterious', 'eloquent'];
const QUIZ_SIZE = 15;

// Daily practice cap: a word can be quizzed at most this many times per day in a
// given modality. Past the cap it drops out of the deck — this throttles the
// "re-quiz the same words to farm coins" grind without touching the coin math
// (coins are still earned per attempt; there are simply fewer attempts to make).
// Older words come through the SRS-due drill (curve-drill.js), which self-limits.
const DAILY_QUIZ_CAP = 5;

// Words still under the daily cap for `testType` (used only for the launch-from-
// mission / selector decks; the older-word drill passes its own opts.deck).
async function uncappedDeck(words, testType) {
    const counts = await getTodayAttemptCounts(testType);
    return words.filter(w => (counts.get(w.id) || 0) < DAILY_QUIZ_CAP);
}

function renderCapReached(container, label) {
    container.innerHTML = `
        <div class="empty-state" style="max-width:480px;margin:2rem auto">
            <span class="empty-icon">🎉</span>
            <h3>Great practising!</h3>
            <p>You've done today's ${label} quiz plenty of times. Practise older
               words for more coins, or come back tomorrow for fresh ones.</p>
            <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
                <a href="#/learner/curve-drill" class="btn btn-primary">Practise older words</a>
                <a href="#/learner/garden"      class="btn btn-secondary">Garden</a>
            </div>
        </div>`;
}

// Quiz deck size: normally 15, but if more than 15 new words were added today the
// deck grows to cover ALL of today's new words (so the practice missions, whose
// target scales with today's words, can actually be completed).
function deckSizeFor(words) {
    const today = localYMD(new Date());
    const newToday = words.filter(w => w.created_at && localYMD(new Date(w.created_at)) === today).length;
    return Math.max(QUIZ_SIZE, newToday);
}

function localYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function render(container) {
    // Deck is ordered today's-words-first, then by memory curve (getPrioritizedWords).
    const allWords = await getPrioritizedWords();

    if (allWords.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="max-width:480px;margin:2rem auto">
                <span class="empty-icon">📚</span>
                <h3>No words yet</h3>
                <p>Add at least one word to start a quiz.</p>
                <a href="#/learner/add-word" class="btn btn-primary" style="margin-top:1rem">Add a Word</a>
            </div>`;
        return;
    }

    // Launch directly into a mode when a mission set one; else show the selector.
    const presetMode = sessionStorage.getItem('quizMode');
    sessionStorage.removeItem('quizMode');
    if (presetMode === 'meaning')  { await startMeaning(container, allWords);  return; }
    if (presetMode === 'spelling') { await startSpelling(container, allWords); return; }

    // --- Mode selector ---
    container.innerHTML = `
        <div style="max-width:480px;margin:2rem auto;text-align:center">
            <h2 style="margin-bottom:0.5rem">Choose Quiz Mode</h2>
            <p style="color:#666;margin-bottom:2rem">Test your vocabulary knowledge</p>
            <div style="display:grid;gap:1rem">
                <button id="meaningBtn" class="btn btn-primary" style="padding:1.25rem;font-size:1.1rem">
                    📖 Meaning Quiz<br>
                    <small style="font-weight:normal;opacity:0.85">See the word, pick the definition</small>
                </button>
                <button id="spellingBtn" class="btn btn-secondary" style="padding:1.25rem;font-size:1.1rem">
                    ✍️ Spelling Quiz<br>
                    <small style="font-weight:normal;opacity:0.85">See the definition, type the word</small>
                </button>
            </div>
        </div>`;

    document.getElementById('meaningBtn').addEventListener('click',  () => startMeaning(container, allWords));
    document.getElementById('spellingBtn').addEventListener('click', () => startSpelling(container, allWords));
}

// ============================================================================
// Coin wallet helper — hints are spent live during a quiz. Each hint persists a
// garden_items row (a real coin cost) and we track the running balance locally
// so buttons disable the moment the learner can't afford the next hint.
// ============================================================================
export function makeWallet(startBalance) {
    let balance = startBalance;
    let spent   = 0;
    let spending = false;
    return {
        get balance() { return balance; },
        get spent()   { return spent; },
        get spending() { return spending; },
        canAfford()   { return !spending && balance >= 1; },
        // Optimistically deduct, then persist. A failed purchase restores the
        // local wallet so quiz hints cannot drift away from real coin rows.
        async spend(code) {
            if (spending || balance < 1) return false;
            spending = true;
            balance -= 1;
            spent   += 1;
            try {
                const r = await buyGardenItem(code);
                balance = r.balance;
                return true;
            } catch {
                balance += 1;
                spent   -= 1;
                return false;
            } finally {
                spending = false;
            }
        },
    };
}

// ============================================================================
// Meaning quiz
// ============================================================================

// opts (all optional) — used by the older-word mixed drill (curve-drill.js):
//   deck         pre-built word list to quiz (else today-first deck)
//   wallet       shared coin wallet across drill phases
//   advanceSrs   also move each word along the SRS ladder (older-word drill only)
//   onComplete   called with { score, total, maxCombo } instead of the result screen
export async function startMeaning(container, allWords, opts = {}) {
    // allWords is pre-ordered today-first then by memory curve — keep that order.
    // For mission/selector decks, drop words that already hit today's cap.
    let deck = opts.deck;
    if (!deck) {
        const pool = await uncappedDeck(allWords, 'meaning');
        if (pool.length === 0) { renderCapReached(container, 'meaning'); return; }
        deck = pool.slice(0, deckSizeFor(pool));
    }
    let idx = 0, score = 0, combo = 0, maxCombo = 0;
    const wallet = opts.wallet || makeWallet((await getUserCoins()).balance);

    function renderQ() {
        const word     = deck[idx];
        const options  = buildOptions(word, allWords);
        const total    = deck.length;
        const pct      = Math.round((idx / total) * 100);
        const hasChi   = options.some(o => o.chinese);   // any option has a Chinese meaning

        container.innerHTML = `
            <div style="max-width:560px;margin:0 auto">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#666;margin-bottom:0.5rem">
                    <span>${idx + 1} / ${total}</span><span>${score} correct${idx > 0 ? ` · ${Math.round((score / idx) * 100)}%` : ''} · 🪙 <span id="walletNum">${wallet.balance}</span></span>
                </div>
                <div class="progress-bar-wrap" style="margin-bottom:1.5rem">
                    <div class="progress-bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="review-card">
                    <div class="review-word">${esc(word.word)}</div>
                    ${word.ipa ? `<div class="review-ipa">${esc(word.ipa)}</div>` : ''}
                    ${word.part_of_speech ? `<div class="review-pos">${esc(word.part_of_speech)}</div>` : ''}
                    <p style="color:#666;margin-top:0.75rem">Which definition is correct?</p>
                    <div class="quiz-options" id="optionGrid"></div>
                    <div class="quiz-hints" style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem;flex-wrap:wrap">
                        <button id="hint5050" class="coin-btn" type="button">➗ Remove 2 Answers <span class="coin-cost">🪙</span></button>
                        ${hasChi ? `<button id="hintChi" class="coin-btn" type="button">🇨🇳 Reveal Chinese Meanings <span class="coin-cost">🪙</span></button>` : ''}
                    </div>
                </div>
            </div>`;

        const grid       = document.getElementById('optionGrid');
        const hint5050   = document.getElementById('hint5050');
        const hintChi    = document.getElementById('hintChi');
        const walletNum  = document.getElementById('walletNum');
        let answered     = false;
        let excludeUsed  = false;
        let chiUsed      = false;

        function refreshHintButtons() {
            walletNum.textContent = wallet.balance;
            hint5050.disabled = answered || excludeUsed || !wallet.canAfford();
            if (hintChi) hintChi.disabled = answered || chiUsed || !wallet.canAfford();
        }

        const optionBtns = [];
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.cssText = 'text-align:left;font-size:0.9rem;padding:0.75rem;min-height:56px;display:flex;flex-direction:column;gap:4px;align-items:flex-start';
            btn.innerHTML = `<span>${esc(opt.text)}</span>`
                + (opt.chinese ? `<span class="opt-chi" style="display:none;font-size:0.85rem;font-weight:600">🇨🇳 ${esc(opt.chinese)}</span>` : '');
            btn.dataset.correct = opt.id === word.id ? '1' : '0';
            btn.addEventListener('click', async () => {
                if (answered) return;
                answered = true;
                const isCorrect = opt.id === word.id;
                if (isCorrect) {
                    score++;
                    combo++;
                    if (combo > maxCombo) maxCombo = combo;
                    if (combo === 5 || combo === 10 || combo === 20) comboPopup(combo);
                } else {
                    combo = 0;
                }

                grid.querySelectorAll('button').forEach(b => b.disabled = true);
                btn.style.background = isCorrect ? 'var(--success-color)' : 'var(--danger-color)';
                btn.style.color = 'white';
                if (!isCorrect) {
                    grid.querySelectorAll('button').forEach(b => {
                        if (b.dataset.correct === '1') { b.style.background = 'var(--success-color)'; b.style.color = 'white'; }
                    });
                }
                refreshHintButtons();

                await Promise.all([
                    recordTestResult(word.id, 'meaning', isCorrect),
                    opts.advanceSrs ? completeReview(word.id, isCorrect) : Promise.resolve(),
                ]);
                setTimeout(() => {
                    idx++;
                    if (idx < deck.length) renderQ();
                    else if (opts.onComplete) opts.onComplete({ score, total: deck.length, maxCombo });
                    else showResult(container, score, deck.length, 'meaning', maxCombo, wallet.spent);
                }, 900);
            });
            grid.appendChild(btn);
            optionBtns.push(btn);
        });

        // 50/50 — fade out 2 wrong options for one coin.
        hint5050.addEventListener('click', async () => {
            if (answered || excludeUsed || !wallet.canAfford()) return;
            hint5050.disabled = true;
            const ok = await wallet.spend('hint5050');
            if (!ok) { refreshHintButtons(); return; }
            const wrong = shuffle(optionBtns.filter(b => b.dataset.correct === '0')).slice(0, 2);
            wrong.forEach(b => { b.disabled = true; b.style.opacity = '0.3'; b.style.textDecoration = 'line-through'; });
            excludeUsed = true;
            refreshHintButtons();
        });

        // Reveal each option's own Chinese meaning — costs one coin.
        hintChi?.addEventListener('click', async () => {
            if (answered || chiUsed || !wallet.canAfford()) return;
            hintChi.disabled = true;
            const ok = await wallet.spend('hintMeaningChi');
            if (!ok) { refreshHintButtons(); return; }
            grid.querySelectorAll('.opt-chi').forEach(el => { el.style.display = 'block'; });
            chiUsed = true;
            refreshHintButtons();
        });

        refreshHintButtons();
    }

    renderQ();
}

// Pick the single longest definition line and strip the leading (pos) tag.
// Longer lines are more specific — harder to guess from word alone.
function pickBestDef(text) {
    if (!text) return null;
    const lines = text.split('\n').filter(Boolean);
    const longest = lines.reduce((a, b) => b.length > a.length ? b : a, '');
    return longest.replace(/^\([^)]+\)\s*/, '') || null;
}

function buildOptions(word, allWords) {
    // Each option carries the Chinese meaning of ITS OWN word, so the "Reveal
    // Chinese Meanings" hint can annotate every option, not just the question.
    const correctText = pickBestDef(word.english_definition) || word.word;
    const correct = { id: word.id, text: correctText, chinese: word.chinese_definition || null };
    const distractors = shuffle(
        allWords
            .filter(w => w.id !== word.id && w.english_definition)
            .map(w => ({ id: w.id, text: pickBestDef(w.english_definition), chinese: w.chinese_definition || null }))
            .filter(w => w.text)
    ).slice(0, 3);

    while (distractors.length < 3) {
        distractors.push({ id: `fallback-${distractors.length}`, text: `Definition of ${FALLBACK_WORDS[distractors.length]}`, chinese: null });
    }

    return shuffle([correct, ...distractors]);
}

// ============================================================================
// Spelling quiz
// ============================================================================

// opts: same shape as startMeaning (deck / wallet / advanceSrs / onComplete).
export async function startSpelling(container, allWords, opts = {}) {
    // For mission/selector decks, drop words that already hit today's cap.
    const source   = opts.deck ? allWords : await uncappedDeck(allWords, 'spelling');
    const eligible = (opts.deck || source).filter(w => w.chinese_definition || w.english_definition);
    if (!opts.deck && eligible.length === 0) { renderCapReached(container, 'spelling'); return; }
    const deck     = opts.deck ? eligible : eligible.slice(0, deckSizeFor(eligible));
    let idx = 0, score = 0, combo = 0, maxCombo = 0;
    const wallet = opts.wallet || makeWallet((await getUserCoins()).balance);

    function renderQ() {
        const word  = deck[idx];
        const total = deck.length;
        const pct   = Math.round((idx / total) * 100);
        // First & last letter hint is meaningless on 1–3 letter words (it would
        // give away the whole answer), so those words get no hint button.
        const letterCount = [...word.word].filter(ch => /[a-zA-Z]/.test(ch)).length;
        const showHint = letterCount >= 4;

        container.innerHTML = `
            <div style="max-width:560px;margin:0 auto">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#666;margin-bottom:0.5rem">
                    <span>${idx + 1} / ${total}</span><span>${score} correct${idx > 0 ? ` · ${Math.round((score / idx) * 100)}%` : ''} · 🪙 <span id="walletNum">${wallet.balance}</span></span>
                </div>
                <div class="progress-bar-wrap" style="margin-bottom:1.5rem">
                    <div class="progress-bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="review-card">
                    <p style="color:#666;margin-bottom:0.5rem">Spell the word that matches:</p>
                    ${spellingClueHtml(word)}
                    <div id="letterBoxes" class="letter-boxes">${letterBoxesHtml(word.word)}</div>
                    <div id="feedback" style="min-height:1.5rem;margin-top:0.75rem;text-align:center;font-weight:600"></div>
                    ${showHint ? `<div style="display:flex;gap:0.5rem;justify-content:center;margin-top:0.5rem;flex-wrap:wrap">
                        <button id="hintSpelling" class="coin-btn" type="button">💡 First &amp; last letter <span class="coin-cost">🪙1</span></button>
                    </div>` : ''}
                    <button id="submitSpelling" class="btn btn-primary btn-block" style="margin-top:1rem">Check</button>
                </div>
            </div>`;

        const boxesWrap = document.getElementById('letterBoxes');
        const submit    = document.getElementById('submitSpelling');
        const hintBtn   = document.getElementById('hintSpelling');
        const walletNum = document.getElementById('walletNum');
        let answered    = false;

        // Editable letter inputs in left-to-right order (non-letter cells are static).
        const inputs = [...boxesWrap.querySelectorAll('input.letter-box')];

        function focusInput(i) { if (inputs[i]) inputs[i].focus(); }
        // Locked hint letters (readOnly) are skipped when moving between boxes.
        function nextEditable(i) { let j = i + 1; while (j < inputs.length && inputs[j].readOnly) { j++; } return j; }
        function prevEditable(i) { let j = i - 1; while (j >= 0 && inputs[j].readOnly) { j--; } return j; }

        inputs.forEach((inp, i) => {
            inp.addEventListener('input', () => {
                inp.value = inp.value.replace(/[^a-zA-Z]/g, '').slice(-1);
                if (inp.value) focusInput(nextEditable(i));
            });
            inp.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); check(); }
                else if (e.key === 'Backspace' && !inp.value) {
                    // Step back to the previous editable box, never clearing a hint letter.
                    e.preventDefault();
                    const p = prevEditable(i);
                    if (p >= 0) { inputs[p].value = ''; focusInput(p); }
                }
            });
        });
        focusInput(0);

        function refreshHint() {
            walletNum.textContent = wallet.balance;
            if (hintBtn) hintBtn.disabled = answered || !wallet.canAfford() || hintBtn.dataset.used === '1';
        }

        // First & last editable letters revealed and locked, for one coin.
        hintBtn?.addEventListener('click', async () => {
            if (answered || !wallet.canAfford() || hintBtn.dataset.used === '1') return;
            hintBtn.disabled = true;
            const ok = await wallet.spend('hintSpelling');
            if (!ok) { refreshHint(); return; }
            [inputs[0], inputs.at(-1)].forEach(inp => {
                inp.value = word.word[Number(inp.dataset.pos)];
                inp.readOnly = true;
                inp.classList.add('revealed');
            });
            hintBtn.dataset.used = '1';
            refreshHint();
            focusInput(inputs.findIndex(inp => !inp.readOnly));
        });

        function buildGuess() {
            // Reconstruct the word from boxes: static cells already hold their char.
            return [...boxesWrap.children].map(cell => {
                if (cell.tagName === 'INPUT') return cell.value;
                return cell.dataset.char ?? '';
            }).join('');
        }

        async function check() {
            if (answered) return;
            answered = true;
            const isCorrect = buildGuess().trim().toLowerCase() === word.word.toLowerCase();
            if (isCorrect) {
                score++;
                combo++;
                if (combo > maxCombo) maxCombo = combo;
                if (combo === 5 || combo === 10 || combo === 20) comboPopup(combo);
            } else {
                combo = 0;
            }

            const fb = document.getElementById('feedback');
            fb.textContent = isCorrect ? '✓ Correct!' : `✗ The answer was: ${word.word}`;
            fb.style.color = isCorrect ? 'var(--success-color)' : 'var(--danger-color)';

            submit.disabled = true;
            inputs.forEach(inp => inp.disabled = true);
            refreshHint();

            await Promise.all([
                recordTestResult(word.id, 'spelling', isCorrect),
                opts.advanceSrs ? completeReview(word.id, isCorrect) : Promise.resolve(),
            ]);
            setTimeout(() => {
                idx++;
                if (idx < deck.length) renderQ();
                else if (opts.onComplete) opts.onComplete({ score, total: deck.length, maxCombo });
                else showResult(container, score, deck.length, 'spelling', maxCombo, wallet.spent);
            }, 1100);
        }

        submit.addEventListener('click', check);
        refreshHint();
    }

    renderQ();
}

// Prompt for the spelling quiz: part of speech + English + Chinese meanings.
function spellingClueHtml(word) {
    const parts = [];
    if (word.part_of_speech) {
        parts.push(`<p style="color:#888;font-style:italic;margin:0 0 0.35rem">${esc(word.part_of_speech)}</p>`);
    }
    const engLines = (word.english_definition || '').split('\n').filter(Boolean);
    if (engLines.length) {
        const body = engLines.length === 1
            ? `<p style="font-size:1.05rem;font-weight:600;margin:0 0 0.35rem">${esc(engLines[0])}</p>`
            : `<ol style="margin:0 0 0.35rem 1.25rem;padding:0;font-size:0.95rem;font-weight:500">${engLines.map(l => `<li>${esc(l)}</li>`).join('')}</ol>`;
        parts.push(body);
    }
    if (word.chinese_definition) {
        parts.push(`<p style="font-size:1.1rem;font-weight:600;margin:0 0 0.5rem">🇨🇳 ${esc(word.chinese_definition)}</p>`);
    }
    return parts.join('') || '<p style="margin-bottom:0.5rem">Spell this word</p>';
}

// One box per character: letters are editable inputs; everything else (spaces,
// hyphens, apostrophes…) is revealed up-front as a static cell.
function letterBoxesHtml(word) {
    return [...word].map((ch, i) => {
        if (/[a-zA-Z]/.test(ch)) {
            return `<input class="letter-box" data-pos="${i}" type="text" inputmode="latin"
                       maxlength="1" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
        }
        const display = ch === ' ' ? '&nbsp;' : esc(ch);
        return `<span class="letter-box letter-static" data-char="${esc(ch)}">${display}</span>`;
    }).join('');
}

// ============================================================================
// Result screen
// ============================================================================

async function showResult(container, score, total, mode, maxCombo = 0, hintsSpent = 0) {
    const pct     = Math.round((score / total) * 100);
    const perfect = score === total && total > 0;
    const trophy  = pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪';

    const result = await runAfterActivity({
        sessionType: mode === 'spelling' ? 'quiz-spelling' : 'quiz-meaning',
        answered: total, correct: score, maxCombo, perfectSession: perfect,
    });

    // Hints already cost real coins (persisted), so subtract them from the
    // celebrated earnings to match the wallet the learner now sees.
    const netCoins = Math.max(0, result.coinsDelta - hintsSpent);
    const coinsEvent = result.events.find(e => e.type === 'coins');
    if (coinsEvent) {
        coinsEvent.payload.amount = netCoins;
        if (netCoins === 0) result.events = result.events.filter(e => e !== coinsEvent);
    }

    container.innerHTML = `
        <div class="review-card" style="max-width:480px;margin:2rem auto;text-align:center">
            <div style="font-size:3rem;margin-bottom:1rem">${trophy}</div>
            <h2>Quiz Complete!</h2>
            <p style="font-size:1.15rem;color:#666;margin:0.75rem 0">${score} / ${total} correct (${pct}%)</p>
            ${netCoins > 0 ? `<p class="session-coins">🪙 +${netCoins} coins earned!</p>` : ''}
            ${hintsSpent > 0 ? `<p style="font-size:0.85rem;color:#999;margin:0">💡 ${hintsSpent} coin${hintsSpent === 1 ? '' : 's'} spent on hints</p>` : ''}
            <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
                <button id="playAgainBtn" class="btn btn-primary">Play Again</button>
                <a href="#/learner/garden" class="btn btn-secondary">🌳 Garden</a>
                <a href="#/learner/home" class="btn btn-secondary">Home</a>
            </div>
        </div>`;
    document.getElementById('playAgainBtn').addEventListener('click', () => render(container));

    celebrateEvents(result.events);
}

// ============================================================================
// Helpers
// ============================================================================

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
