// ============================================================================
// Daily missions — shared between learner home and parent dashboard
// ============================================================================
// Unlock model (NOT a strict sequential chain):
//   1. Add words        — always unlocked
//   2. Review new words  ┐
//   3. Meaning quiz      ├─ unlocked once mission 1 is complete; no order
//   4. Spelling quiz     ┘  dependency among themselves
//   5. Practice older words — always unlocked
//
// Missions 2–4 practice TODAY's new words, so their target scales with the
// number of words actually added today (a learner who adds 22 words must
// review/quiz all 22), but they only unlock after mission 1's goal is met.
//
// Mission 5 is the older-word mixed drill (pages/curve-drill.js): the SRS-due
// backlog of earlier words, practiced ~10/10/10 across review/meaning/spelling.
// Its progress = distinct older words answered correctly today in ANY of those
// three modalities (getDailyProgress.reviewsCurveDone), capped at 30.

export const MISSION_NEW_WORDS    = 15;
export const MISSION_REVIEW_CURVE = 30;

// A mission counts as complete once 85% of its daily target is reached — a
// little slack so a missed word or two doesn't block the day. Same rule applies
// everywhere (learner home, parent dashboard, mission history).
export const MISSION_TARGET_PCT = 0.85;

/** Words needed to complete a mission whose full target is `target`. */
export function missionThreshold(target) {
    return target > 0 ? Math.ceil(target * MISSION_TARGET_PCT) : 0;
}

/**
 * Build the 5 mission descriptors from a getDailyProgress() result.
 * Each descriptor carries its own `done` and `locked` state.
 */
export function buildMissions(daily) {
    const mission1Done   = daily.wordsAdded >= missionThreshold(MISSION_NEW_WORDS);
    const practiceTarget = daily.wordsAdded;              // scales with today's words
    const curveTarget    = Math.min(MISSION_REVIEW_CURVE, daily.reviewsCurveDone + daily.curveDue);

    return [
        {
            key: 'add', icon: '📚', title: `Add ${MISSION_NEW_WORDS} new words`,
            current: daily.wordsAdded, target: MISSION_NEW_WORDS,
            done: mission1Done, locked: false, cta: 'Add words',
        },
        {
            key: 'reviewNew', icon: '💧', title: "Review today's new words",
            current: daily.reviewsNewDone, target: practiceTarget, accuracy: daily.reviewsNewAcc,
            done: mission1Done && daily.reviewsNewDone >= missionThreshold(practiceTarget),
            locked: !mission1Done, cta: 'Start review',
        },
        {
            key: 'meaning', icon: '📖', title: 'Meaning quiz', subtitleSuffix: "(today's words)",
            current: daily.meaningQuizCount, target: practiceTarget, accuracy: daily.meaningAcc,
            done: mission1Done && daily.meaningQuizCount >= missionThreshold(practiceTarget),
            locked: !mission1Done, cta: 'Start quiz',
        },
        {
            key: 'spelling', icon: '✍️', title: 'Spelling quiz', subtitleSuffix: "(today's words)",
            current: daily.spellingQuizCount, target: practiceTarget, accuracy: daily.spellingAcc,
            done: mission1Done && daily.spellingQuizCount >= missionThreshold(practiceTarget),
            locked: !mission1Done, cta: 'Start quiz',
        },
        {
            key: 'reviewCurve', icon: '🔁', title: 'Practice older words', subtitleSuffix: '(review + quiz)',
            current: daily.reviewsCurveDone,
            target: curveTarget, accuracy: daily.reviewsCurveAcc,
            done: daily.curveDue === 0 || daily.reviewsCurveDone >= missionThreshold(curveTarget),
            locked: false, cta: 'Start drill', emptyLabel: 'Nothing due yet',
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

    // Show the exact portion (a completed mission at 14/16 reads ~88%, not 100%).
    let pct;
    if (m.target > 0)  pct = Math.min(100, Math.round((m.current / m.target) * 100));
    else               pct = m.done ? 100 : 0;
    const titleHtml = m.title + (m.subtitleSuffix ? ` <span class="mission-suffix">${m.subtitleSuffix}</span>` : '');

    let subtitle;
    if (m.locked)            subtitle = `Add ${MISSION_NEW_WORDS} words first`;
    else if (m.done)         subtitle = m.target > 0 ? `Done — ${m.current} / ${m.target} ✨` : 'All caught up ✨';
    else if (m.target === 0) subtitle = m.emptyLabel || '—';
    else                     subtitle = `${m.current} / ${m.target}`;

    // Today's accuracy for tested missions (null when nothing attempted yet).
    if (!m.locked && m.accuracy != null) {
        subtitle += ` <span class="mission-acc">🎯 ${m.accuracy}%</span>`;
    }

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
