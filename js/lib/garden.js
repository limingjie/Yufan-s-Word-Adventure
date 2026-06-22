import { masteryEmoji } from './srs.js';

// Returns an HTML string for the interactive garden grid.
// words: array of { id, word, review_level, english_definition, chinese_definition }
// dueIds: Set of word_ids that are due for review today
export function renderInteractiveGarden(words, dueIds) {
    if (!words.length) {
        return `<div class="garden-scene">
            <div class="garden-sky">
                <span class="garden-sun">☀️</span>
                <span class="garden-cloud" style="left:18%">☁️</span>
                <span class="garden-cloud" style="left:58%">☁️</span>
            </div>
            <div class="garden-ground" style="display:flex;align-items:center;justify-content:center;min-height:180px">
                <div style="text-align:center;color:rgba(255,255,255,0.85)">
                    <div style="font-size:2.5rem">🌱</div>
                    <div style="font-size:0.9rem;margin-top:0.4rem">Add words and review them<br>to grow your garden!</div>
                </div>
            </div>
        </div>`;
    }

    // Show at most 80 plants to keep layout manageable
    const visible = words.slice(0, 80);
    const overflow = words.length - visible.length;

    const plants = visible.map(w => {
        const level   = w.review_level ?? 0;
        const emoji   = masteryEmoji(level);
        const isDue   = dueIds.has(w.id);
        const wilting = isDue ? ' wilting' : '';
        const badge   = isDue ? '<span class="water-badge">💧</span>' : '';
        const label   = esc(w.word);
        return '<div class="garden-plant' + wilting + '" data-word-id="' + esc(w.id) + '" tabindex="0">'
             + badge
             + '<span class="plant-emoji">' + emoji + '</span>'
             + '<span class="plant-word">' + label + '</span>'
             + '</div>';
    }).join('');

    const overflowBadge = overflow > 0
        ? '<div style="color:rgba(255,255,255,0.7);font-size:0.78rem;width:100%;text-align:center;margin-top:4px">+' + overflow + ' more in your garden</div>'
        : '';

    return `<div class="garden-scene">
        <div class="garden-sky">
            <span class="garden-sun">☀️</span>
            <span class="garden-cloud" style="left:14%">☁️</span>
            <span class="garden-cloud" style="left:55%">☁️</span>
        </div>
        <div class="garden-ground">
            <div class="garden-grid">${plants}</div>
            ${overflowBadge}
        </div>
    </div>`;
}

// Summary counts per mastery level
export function gardenStats(words) {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const w of words) counts[Math.min(w.review_level ?? 0, 5)]++;
    return counts;
}

function esc(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
