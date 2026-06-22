import { getWordsWithSRS, getWordsForReviewToday } from '../js/db.js';
import { srsLabel }                               from '../js/lib/srs.js';
import { renderInteractiveGarden, gardenStats }   from '../js/lib/garden.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><p>Growing your garden…</p></div>`;

    const [words, dueRows] = await Promise.all([
        getWordsWithSRS(),
        getWordsForReviewToday(),
    ]);

    const dueIds    = new Set(dueRows.map(r => r.word_id));
    const dueCount  = dueIds.size;
    const stats     = gardenStats(words);
    const wordById  = new Map(words.map(w => [w.id, w]));

    // Legend entries (only show levels that have at least one word)
    const LEGEND = [
        { level: 0, label: 'Seed'        },
        { level: 1, label: 'Sprout'      },
        { level: 2, label: 'Flower'      },
        { level: 3, label: 'Tree'        },
        { level: 4, label: 'Golden Tree' },
    ];
    const legendHtml = LEGEND
        .filter(l => stats[l.level] > 0 || stats[5] > 0 && l.level === 4)
        .map(l => {
            const count = l.level === 4 ? (stats[4] + stats[5]) : stats[l.level];
            const icon  = srsLabel(l.level).split(' ')[0];
            return `<span>${icon} ${l.label}: <strong>${count}</strong></span>`;
        })
        .join('');

    const plantPlural = dueCount > 1 ? 's' : '';
    const dueNote = dueCount > 0
        ? `<div style="background:#fff3cd;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.85rem;color:#856404;margin-bottom:0.75rem;text-align:center">
               💧 <strong>${dueCount}</strong> plant${plantPlural} need watering!
               <a href="#/learner/review" style="color:#856404;font-weight:700;margin-left:0.5rem">Review now →</a>
           </div>`
        : '';

    container.innerHTML = `
        <div style="max-width:640px;margin:0 auto">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
                <h2 style="margin:0">🌱 Word Garden</h2>
                <a href="#/learner/review" class="btn btn-primary btn-sm">💧 Water Plants</a>
            </div>

            ${dueNote}

            <div style="margin-bottom:0.75rem" id="gardenContainer">
                ${renderInteractiveGarden(words, dueIds)}
            </div>

            <div class="garden-legend">${legendHtml || '<span style="color:#aaa">No words yet</span>'}</div>

            <!-- Plant detail popup -->
            <div id="plantPopup" style="display:none" class="garden-popup">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">
                    <span id="popupWord" style="font-size:1.4rem;font-weight:700"></span>
                    <span id="popupLevel" style="font-size:0.9rem"></span>
                </div>
                <p id="popupDef"  style="font-size:0.88rem;color:#555;margin:0 0 0.2rem"></p>
                <p id="popupChi"  style="font-size:0.9rem;margin:0 0 0.65rem"></p>
                <div id="popupActions"></div>
            </div>

            <div style="margin-top:1.5rem;display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
                <a href="#/learner/words" class="btn btn-secondary">+ Add Words</a>
                <a href="#/learner/quiz"  class="btn btn-secondary">📝 Quiz</a>
            </div>
        </div>`;

    // ── Plant click → popup ───────────────────────────────────────────────────
    let selectedEl = null;

    document.getElementById('gardenContainer').addEventListener('click', (e) => {
        const plant = e.target.closest('.garden-plant');
        if (!plant) {
            closePlantPopup();
            return;
        }

        // Deselect previous
        if (selectedEl && selectedEl !== plant) {
            selectedEl.classList.remove('selected');
        }
        if (selectedEl === plant) {
            // Second tap on same plant closes popup
            plant.classList.remove('selected');
            selectedEl = null;
            closePlantPopup();
            return;
        }

        plant.classList.add('selected');
        selectedEl = plant;

        const wordId = plant.dataset.wordId;
        const word   = wordById.get(wordId);
        if (!word) return;

        showPlantPopup(word, dueIds.has(wordId));
    });

    function closePlantPopup() {
        document.getElementById('plantPopup').style.display = 'none';
    }

    function showPlantPopup(word, isDue) {
        const level      = word.review_level ?? 0;
        const primaryDef = (word.english_definition || '').split('\n').find(Boolean) || '';
        const popup      = document.getElementById('plantPopup');

        document.getElementById('popupWord').textContent  = word.word;
        document.getElementById('popupLevel').textContent = srsLabel(level);
        document.getElementById('popupDef').textContent   = primaryDef;
        document.getElementById('popupChi').textContent   = word.chinese_definition
            ? '🇨🇳 ' + word.chinese_definition
            : '';

        const actionsEl = document.getElementById('popupActions');
        if (isDue) {
            actionsEl.innerHTML =
                '<a href="#/learner/review" class="btn btn-primary btn-sm" style="width:100%;text-align:center">'
                + '💧 Water it — Review now!</a>';
        } else {
            actionsEl.innerHTML =
                '<span style="color:#52c41a;font-size:0.85rem">✓ Feeling great — no water needed yet</span>';
        }

        popup.style.display = 'block';
        popup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
