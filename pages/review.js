import { getWordsForReviewToday, completeReview, recordTestResult } from '../js/db.js';
import { runAfterActivity } from '../js/lib/awards.js';
import { celebrateEvents, comboPopup } from '../js/lib/celebrate.js';

export async function render(container) {
    // Mission-scoped review: 'new' = today's new words, 'curve' = older backlog.
    const scope = sessionStorage.getItem('reviewScope') || 'all';
    sessionStorage.removeItem('reviewScope');

    const words = await getWordsForReviewToday(scope);

    if (words.length === 0) {
        const emptyMsg = scope === 'new'
            ? "No new words to review right now. Add some words, then come back!"
            : "No words due for review today. Come back tomorrow or add new words.";
        container.innerHTML = `
            <div class="empty-state" style="max-width:480px;margin:2rem auto">
                <span class="empty-icon">🎉</span>
                <h3>All caught up!</h3>
                <p>${emptyMsg}</p>
                <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
                    <a href="#/learner/add-word" class="btn btn-primary">Add a Word</a>
                    <a href="#/learner/quiz"     class="btn btn-secondary">Take a Quiz</a>
                </div>
            </div>`;
        return;
    }

    let idx      = 0;
    let correct  = 0;
    let shown    = false;
    let combo    = 0;
    let maxCombo = 0;

    function renderCard() {
        shown = false;
        const total  = words.length;
        const pct    = Math.round((idx / total) * 100);
        const item   = words[idx];
        const w      = item.words;

        container.innerHTML = `
            <div style="max-width:560px;margin:0 auto">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                    <span style="font-size:0.85rem;color:#666">${idx + 1} of ${total}</span>
                    <span style="font-size:0.85rem;color:#666">${correct} correct</span>
                </div>
                <div class="progress-bar-wrap" style="margin-bottom:1.5rem">
                    <div class="progress-bar-fill" style="width:${pct}%"></div>
                </div>

                <div class="review-card">
                    <div class="review-word">${esc(w.word)}</div>
                    ${w.part_of_speech ? `<div class="review-pos">${esc(w.part_of_speech)}</div>` : ''}
                    ${pronHtml(w)}

                    <div id="answerSection" style="display:none" class="review-answer">
                        ${w.english_definition ? `<p><strong>English:</strong> ${esc(w.english_definition)}</p>` : ''}
                        ${w.chinese_definition ? `<p><strong>中文:</strong> ${esc(w.chinese_definition)}</p>` : ''}
                        ${w.example_sentence   ? `<p style="color:#555;font-style:italic;margin-top:0.5rem">"${esc(w.example_sentence)}"</p>` : ''}
                    </div>

                    <div id="showBtnWrap" style="margin-top:1.5rem">
                        <button id="showBtn" class="btn btn-primary btn-block">Show Answer</button>
                    </div>

                    <div id="rateWrap" class="review-actions" style="display:none">
                        <button id="wrongBtn" class="btn btn-danger">✗ Didn't know</button>
                        <button id="rightBtn" class="btn btn-success">✓ I knew it</button>
                    </div>
                </div>
            </div>`;

        document.querySelector('.review-card')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.play-btn');
            if (btn) new Audio(btn.dataset.src).play().catch(() => {});
        });

        document.getElementById('showBtn').addEventListener('click', () => {
            if (shown) return;
            shown = true;
            document.getElementById('answerSection').style.display = 'block';
            document.getElementById('showBtnWrap').style.display = 'none';
            document.getElementById('rateWrap').style.display = 'grid';
        });

        document.getElementById('rightBtn').addEventListener('click', () => rate(item, true));
        document.getElementById('wrongBtn').addEventListener('click', () => rate(item, false));
    }

    async function rate(item, isCorrect) {
        if (isCorrect) {
            correct++;
            combo++;
            if (combo > maxCombo) maxCombo = combo;
            if (combo === 5 || combo === 10 || combo === 20) comboPopup(combo);
        } else {
            combo = 0;
        }

        await Promise.all([
            completeReview(item.word_id, isCorrect),
            recordTestResult(item.word_id, 'review', isCorrect),
        ]);

        idx++;
        if (idx < words.length) {
            renderCard();
        } else {
            showSummary();
        }
    }

    async function showSummary() {
        const total   = words.length;
        const pct     = Math.round((correct / total) * 100);
        const perfect = correct === total && total > 0;

        // The connector recomputes Sunlight/Coins/badges and returns events to celebrate.
        const result = await runAfterActivity({
            sessionType: 'review', answered: total, correct, maxCombo, perfectSession: perfect,
        });

        const trophy = pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪';
        container.innerHTML = `
            <div class="review-card" style="max-width:480px;margin:2rem auto;text-align:center">
                <div style="font-size:3rem;margin-bottom:1rem">${trophy}</div>
                <h2>Review Complete!</h2>
                <p style="font-size:1.15rem;color:#666;margin:0.75rem 0">
                    ${correct} / ${total} correct (${pct}%)
                </p>
                ${result.coinsDelta > 0 ? `<p class="session-coins">🪙 +${result.coinsDelta} coins earned!</p>` : ''}
                <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
                    <a href="#/learner/garden"   class="btn btn-primary">🌳 See your Garden</a>
                    <a href="#/learner/home"     class="btn btn-secondary">Home</a>
                </div>
            </div>`;

        celebrateEvents(result.events);
    }

    renderCard();
}

// Renders US/UK pronunciation chips. Audio chips are playable; IPA-only chips are static.
function pronHtml(w) {
    const parts = (w.ipa || '').split('$');
    const usIpa = parts[0] || null;
    const ukIpa = parts[1] || usIpa;
    const chips = [];

    if (w.audio_url_us) {
        const label = usIpa ? `🔊 US ${esc(usIpa)}` : '🔊 US';
        chips.push(`<button class="play-btn pron-chip pron-chip-us" data-src="${esc(w.audio_url_us)}">${label}</button>`);
    } else if (usIpa) {
        chips.push(`<span class="pron-chip pron-chip-us" style="opacity:0.82;cursor:default">US ${esc(usIpa)}</span>`);
    }

    if (w.audio_url_uk) {
        const label = ukIpa ? `🔊 UK ${esc(ukIpa)}` : '🔊 UK';
        chips.push(`<button class="play-btn pron-chip pron-chip-uk" data-src="${esc(w.audio_url_uk)}">${label}</button>`);
    } else if (ukIpa && ukIpa !== usIpa) {
        chips.push(`<span class="pron-chip pron-chip-uk" style="opacity:0.82;cursor:default">UK ${esc(ukIpa)}</span>`);
    }

    if (!chips.length) return '';
    return `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;margin:0.5rem 0">${chips.join('')}</div>`;
}

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
