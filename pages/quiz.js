import { getPrioritizedWords, recordTestResult } from '../js/db.js';
import { runAfterActivity } from '../js/lib/awards.js';
import { celebrateEvents, comboPopup } from '../js/lib/celebrate.js';

const FALLBACK_WORDS = ['curious', 'adventure', 'brilliant', 'mysterious', 'eloquent'];
const QUIZ_SIZE = 15;

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
    if (presetMode === 'meaning')  { startMeaning(container, allWords);  return; }
    if (presetMode === 'spelling') { startSpelling(container, allWords); return; }

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
// Meaning quiz
// ============================================================================

function startMeaning(container, allWords) {
    // allWords is pre-ordered today-first then by memory curve — keep that order.
    const deck = allWords.slice(0, QUIZ_SIZE);
    let idx = 0, score = 0, combo = 0, maxCombo = 0;

    function renderQ() {
        const word     = deck[idx];
        const options  = buildOptions(word, allWords);
        const total    = deck.length;
        const pct      = Math.round((idx / total) * 100);

        container.innerHTML = `
            <div style="max-width:560px;margin:0 auto">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#666;margin-bottom:0.5rem">
                    <span>${idx + 1} / ${total}</span><span>${score} correct</span>
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
                </div>
            </div>`;

        const grid = document.getElementById('optionGrid');
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.cssText = 'text-align:left;font-size:0.9rem;padding:0.75rem;min-height:56px';
            btn.textContent = opt.text;
            btn.addEventListener('click', () => {
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
                btn.style.background = isCorrect ? '#28a745' : '#dc3545';
                btn.style.color = 'white';
                if (!isCorrect) {
                    grid.querySelectorAll('button').forEach(b => {
                        if (b.textContent === options.find(o => o.id === word.id)?.text) {
                            b.style.background = '#28a745';
                            b.style.color = 'white';
                        }
                    });
                }

                recordTestResult(word.id, 'meaning', isCorrect);
                setTimeout(() => { idx++; idx < deck.length ? renderQ() : showResult(container, score, deck.length, 'meaning', maxCombo); }, 900);
            });
            grid.appendChild(btn);
        });
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
    const correctText = pickBestDef(word.english_definition) || word.word;
    const correct = { id: word.id, text: correctText };
    const distractors = shuffle(
        allWords
            .filter(w => w.id !== word.id && w.english_definition)
            .map(w => ({ id: w.id, text: pickBestDef(w.english_definition) }))
            .filter(w => w.text)
    ).slice(0, 3);

    while (distractors.length < 3) {
        distractors.push({ id: `fallback-${distractors.length}`, text: `Definition of ${FALLBACK_WORDS[distractors.length]}` });
    }

    return shuffle([correct, ...distractors]);
}

// ============================================================================
// Spelling quiz
// ============================================================================

function startSpelling(container, allWords) {
    const eligible = allWords.filter(w => w.chinese_definition || w.english_definition);
    const deck     = eligible.slice(0, QUIZ_SIZE);
    let idx = 0, score = 0, combo = 0, maxCombo = 0;

    function renderQ() {
        const word  = deck[idx];
        const total = deck.length;
        const pct   = Math.round((idx / total) * 100);
        const clue  = word.chinese_definition || word.english_definition;

        container.innerHTML = `
            <div style="max-width:560px;margin:0 auto">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#666;margin-bottom:0.5rem">
                    <span>${idx + 1} / ${total}</span><span>${score} correct</span>
                </div>
                <div class="progress-bar-wrap" style="margin-bottom:1.5rem">
                    <div class="progress-bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="review-card">
                    <p style="color:#666;margin-bottom:0.5rem">Type the word that matches this definition:</p>
                    <p style="font-size:1.2rem;font-weight:600;margin-bottom:1.5rem">${esc(clue)}</p>
                    <input type="text" id="spellingInput" placeholder="Type the word…"
                           autocomplete="off" autocorrect="off" spellcheck="false"
                           style="font-size:1.2rem;text-align:center">
                    <div id="feedback" style="min-height:1.5rem;margin-top:0.75rem;text-align:center;font-weight:600"></div>
                    <button id="submitSpelling" class="btn btn-primary btn-block" style="margin-top:1rem">Check</button>
                </div>
            </div>`;

        const input  = document.getElementById('spellingInput');
        const submit = document.getElementById('submitSpelling');

        input.focus();

        function check() {
            const answer    = input.value.trim().toLowerCase();
            const isCorrect = answer === word.word.toLowerCase();
            if (isCorrect) {
                score++;
                combo++;
                if (combo > maxCombo) maxCombo = combo;
                if (combo === 5 || combo === 10 || combo === 20) comboPopup(combo);
            } else {
                combo = 0;
            }

            document.getElementById('feedback').textContent = isCorrect
                ? '✓ Correct!'
                : `✗ The answer was: ${word.word}`;
            document.getElementById('feedback').style.color = isCorrect ? '#28a745' : '#dc3545';

            submit.disabled = true;
            input.disabled  = true;

            recordTestResult(word.id, 'spelling', isCorrect);
            setTimeout(() => { idx++; idx < deck.length ? renderQ() : showResult(container, score, deck.length, 'spelling', maxCombo); }, 1000);
        }

        submit.addEventListener('click', check);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    }

    renderQ();
}

// ============================================================================
// Result screen
// ============================================================================

async function showResult(container, score, total, mode, maxCombo = 0) {
    const pct     = Math.round((score / total) * 100);
    const perfect = score === total && total > 0;
    const trophy  = pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪';

    const result = await runAfterActivity({
        sessionType: mode === 'spelling' ? 'quiz-spelling' : 'quiz-meaning',
        answered: total, correct: score, maxCombo, perfectSession: perfect,
    });

    container.innerHTML = `
        <div class="review-card" style="max-width:480px;margin:2rem auto;text-align:center">
            <div style="font-size:3rem;margin-bottom:1rem">${trophy}</div>
            <h2>Quiz Complete!</h2>
            <p style="font-size:1.15rem;color:#666;margin:0.75rem 0">${score} / ${total} correct (${pct}%)</p>
            ${result.coinsDelta > 0 ? `<p class="session-coins">🪙 +${result.coinsDelta} coins earned!</p>` : ''}
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
