// ============================================================================
// Older-word mixed drill — daily mission 5 ("Practice older words")
// ============================================================================
// The SRS-due backlog of OLDER words (created before today) is practiced across
// three modalities in one session: flashcard review, then meaning quiz, then
// spelling quiz. Up to 30 distinct due words, balanced ~10/10/10 by round-robin.
//
// Unlike the today's-word quizzes (missions 3–4, pure practice), EVERY answer
// here advances the word along the SRS ladder (`advanceSrs`) — a correct recall
// in any modality counts, so the drill is what drains the older-word due queue.
// One reward celebration covers all three phases (see runAfterActivity below).

import { getWordsForReviewToday, getPrioritizedWords, getUserCoins } from '../js/db.js';
import { runReviewSession } from './review.js';
import { startMeaning, startSpelling, makeWallet } from './quiz.js';
import { runAfterActivity } from '../js/lib/awards.js';
import { celebrateEvents } from '../js/lib/celebrate.js';

const DRILL_CAP = 30;   // matches MISSION_REVIEW_CURVE — ~10 words per modality

export async function render(container) {
    // Older due words only (review_schedule rows), by memory curve, capped at 30.
    const curveRows = await getWordsForReviewToday('curve');

    if (curveRows.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="max-width:480px;margin:2rem auto">
                <span class="empty-icon">🎉</span>
                <h3>All caught up!</h3>
                <p>No older words are due for review right now. Come back tomorrow,
                   or keep adding and practising today's new words.</p>
                <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
                    <a href="#/learner/home"   class="btn btn-primary">Home</a>
                    <a href="#/learner/garden" class="btn btn-secondary">🌳 Garden</a>
                </div>
            </div>`;
        return;
    }

    // allWords feeds the meaning-quiz distractors (needs the whole word list).
    const allWords = await getPrioritizedWords();

    // Round-robin the due words across the three phases so each modality gets a
    // balanced share even when fewer than 30 are due (12 due → 4/4/4, not 10/2/0).
    const groups = [[], [], []];   // [review, meaning, spelling]
    curveRows.slice(0, DRILL_CAP).forEach((row, i) => groups[i % 3].push(row));
    const [reviewRows, meaningRows, spellingRows] = groups;
    const meaningDeck  = meaningRows.map(r => r.words);
    const spellingDeck = spellingRows.map(r => r.words);

    // One coin wallet shared across all phases so hint spending carries through.
    const wallet = makeWallet((await getUserCoins()).balance);
    const totals = { score: 0, total: 0, maxCombo: 0 };
    const accumulate = (p) => {
        totals.score   += p.score;
        totals.total   += p.total;
        totals.maxCombo = Math.max(totals.maxCombo, p.maxCombo);
    };

    // Chain the phases, skipping any that ended up empty.
    function runReview() {
        if (!reviewRows.length) return runMeaning();
        runReviewSession(container, reviewRows, {
            onComplete: (p) => { accumulate(p); runMeaning(); },
        });
    }
    function runMeaning() {
        if (!meaningDeck.length) return runSpelling();
        startMeaning(container, allWords, {
            deck: meaningDeck, wallet, advanceSrs: true,
            onComplete: (p) => { accumulate(p); runSpelling(); },
        });
    }
    function runSpelling() {
        if (!spellingDeck.length) return finish();
        startSpelling(container, allWords, {
            deck: spellingDeck, wallet, advanceSrs: true,
            onComplete: (p) => { accumulate(p); finish(); },
        });
    }

    async function finish() {
        const { score, total, maxCombo } = totals;
        const pct     = total > 0 ? Math.round((score / total) * 100) : 0;
        const perfect = total > 0 && score === total;

        // One reward pass for the whole drill (the connector recomputes from
        // history, so a single call is correct and avoids three celebrations).
        const result = await runAfterActivity({
            sessionType: 'review', answered: total, correct: score, maxCombo, perfectSession: perfect,
        });

        // Quiz phases may have spent coins on hints — net them out of the
        // celebrated coins so the number matches the wallet the learner sees.
        const netCoins   = Math.max(0, result.coinsDelta - wallet.spent);
        const coinsEvent = result.events.find(e => e.type === 'coins');
        if (coinsEvent) {
            coinsEvent.payload.amount = netCoins;
            if (netCoins === 0) result.events = result.events.filter(e => e !== coinsEvent);
        }

        let trophy;
        if (pct >= 80)      trophy = '🌟';
        else if (pct >= 50) trophy = '👍';
        else                trophy = '💪';

        container.innerHTML = `
            <div class="review-card" style="max-width:480px;margin:2rem auto;text-align:center">
                <div style="font-size:3rem;margin-bottom:1rem">${trophy}</div>
                <h2>Older Words Practised!</h2>
                <p style="font-size:1.15rem;color:#666;margin:0.75rem 0">${score} / ${total} correct (${pct}%)</p>
                ${netCoins > 0 ? `<p class="session-coins">🪙 +${netCoins} coins earned!</p>` : ''}
                ${wallet.spent > 0 ? `<p style="font-size:0.85rem;color:#999;margin:0">💡 ${wallet.spent} coin${wallet.spent === 1 ? '' : 's'} spent on hints</p>` : ''}
                <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
                    <a href="#/learner/garden" class="btn btn-primary">🌳 See your Garden</a>
                    <a href="#/learner/home"   class="btn btn-secondary">Home</a>
                </div>
            </div>`;

        celebrateEvents(result.events);
    }

    runReview();
}
