// ============================================================================
// Daily missions — shared between learner home and parent dashboard
// ============================================================================
// Unlock model (NOT a strict sequential chain):
//   1. Add words        — always unlocked
//   2. Review new words  ┐
//   3. Meaning quiz      ├─ unlocked once mission 1 is complete; no order
//   4. Spelling quiz     ┘  dependency among themselves
//   5. Review older words — always unlocked
//
// Missions 2–4 practice TODAY's new words, so their target scales with the
// number of words actually added today (a learner who adds 22 words must
// review/quiz all 22), but they only unlock after mission 1's goal is met.

export const MISSION_NEW_WORDS    = 15;
export const MISSION_REVIEW_CURVE = 30;

/**
 * Build the 5 mission descriptors from a getDailyProgress() result.
 * Each descriptor carries its own `done` and `locked` state.
 */
export function buildMissions(daily) {
    const mission1Done   = daily.wordsAdded >= MISSION_NEW_WORDS;
    const practiceTarget = daily.wordsAdded;              // scales with today's words

    return [
        {
            key: 'add', icon: '📚', title: `Add ${MISSION_NEW_WORDS} new words`,
            current: daily.wordsAdded, target: MISSION_NEW_WORDS,
            done: mission1Done, locked: false, cta: 'Add words',
        },
        {
            key: 'reviewNew', icon: '💧', title: "Review today's new words",
            current: daily.reviewsNewDone, target: practiceTarget,
            done: mission1Done && daily.reviewsNewDone >= practiceTarget,
            locked: !mission1Done, cta: 'Start review',
        },
        {
            key: 'meaning', icon: '📖', title: 'Meaning quiz', subtitleSuffix: "(today's words)",
            current: daily.meaningQuizCount, target: practiceTarget,
            done: mission1Done && daily.meaningQuizCount >= practiceTarget,
            locked: !mission1Done, cta: 'Start quiz',
        },
        {
            key: 'spelling', icon: '✍️', title: 'Spelling quiz', subtitleSuffix: "(today's words)",
            current: daily.spellingQuizCount, target: practiceTarget,
            done: mission1Done && daily.spellingQuizCount >= practiceTarget,
            locked: !mission1Done, cta: 'Start quiz',
        },
        {
            key: 'reviewCurve', icon: '🔁', title: 'Review older words',
            current: daily.reviewsCurveDone,
            target: Math.min(MISSION_REVIEW_CURVE, daily.reviewsCurveDone + daily.curveDue),
            done: daily.curveDue === 0 || daily.reviewsCurveDone >= MISSION_REVIEW_CURVE,
            locked: false, cta: 'Start review', emptyLabel: 'Nothing due yet',
        },
    ];
}

export function allMissionsDone(missions) {
    return missions.every(m => m.done);
}

/**
 * Render the mission list as HTML.
 * @param {object[]} missions   from buildMissions()
 * @param {object}   opts
 * @param {boolean}  opts.readOnly  no buttons / CTA / active highlight (parent view)
 */
export function renderMissionList(missions, { readOnly = false } = {}) {
    // The first unlocked, incomplete mission gets the highlighted "active" look.
    const activeIndex = readOnly ? -1 : missions.findIndex(m => !m.done && !m.locked);
    const cards = missions.map((m, i) => missionCard(m, i, activeIndex, readOnly)).join('');
    return `<div class="mission-list${readOnly ? ' mission-list-readonly' : ''}">${cards}</div>`;
}

function missionCard(m, i, activeIndex, readOnly) {
    let state;
    if (m.done)               state = 'complete';
    else if (m.locked)        state = 'locked';
    else if (i === activeIndex) state = 'active';
    else                      state = 'available';

    const pct = m.target > 0
        ? Math.min(100, Math.round((m.current / m.target) * 100))
        : (m.done ? 100 : 0);
    const titleHtml = m.title + (m.subtitleSuffix ? ` <span class="mission-suffix">${m.subtitleSuffix}</span>` : '');

    let subtitle;
    if (m.locked)            subtitle = `Add ${MISSION_NEW_WORDS} words first`;
    else if (m.done)         subtitle = m.target > 0 ? `Done — ${m.current} / ${m.target} ✨` : 'All caught up ✨';
    else if (m.target === 0) subtitle = m.emptyLabel || '—';
    else                     subtitle = `${m.current} / ${m.target}`;

    const reward = m.done ? '✅' : m.locked ? '🔒' : (state === 'active' ? '▶' : '○');
    const ctaHtml = (!readOnly && state === 'active' && m.target > 0)
        ? `<div class="mission-cta">${m.cta} →</div>` : '';

    // Locked or read-only cards are non-interactive divs; only active/available
    // learner cards are real buttons.
    const interactive = !readOnly && !m.locked;
    const tag = interactive ? 'button' : 'div';
    const typeAttr = interactive ? ' type="button"' : '';

    return `
        <${tag} class="mission-card mission-${state}" data-key="${m.key}"${typeAttr}>
            <div class="mission-icon">${m.icon}</div>
            <div class="mission-info">
                <div class="mission-title">${titleHtml}</div>
                <div class="mission-sub">${subtitle}</div>
                <div class="mission-bar-wrap"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
                ${ctaHtml}
            </div>
            <div class="mission-reward">${reward}</div>
        </${tag}>`;
}
