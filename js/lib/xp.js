// XP milestones are tied to ESL fluency word counts.
// ~10 XP per word (adding + initial reviews), ~25 XP per mastered word.
// Level  6 ≈  300 words  — A1 survival vocabulary
// Level  7 ≈  600 words  — A2 everyday topics
// Level  8 ≈ 1,500 words — B1 general fluency
// Level  9 ≈ 3,000 words — B2 academic/professional
// Level 10 ≈ 8,000 words — C1/C2 near-native
const LEVELS = [
    { level:  1, name: 'Seedling',           minXP:       0 },
    { level:  2, name: 'Explorer',           minXP:      50 },
    { level:  3, name: 'Adventurer',         minXP:     200 },
    { level:  4, name: 'Word Collector',     minXP:     500 },
    { level:  5, name: 'Scholar',            minXP:   1_200 },
    { level:  6, name: 'Linguist',           minXP:   3_000 },
    { level:  7, name: 'Word Builder',       minXP:   6_000 },
    { level:  8, name: 'Word Master',        minXP:  15_000 },
    { level:  9, name: 'Vocabulary Wizard',  minXP:  30_000 },
    { level: 10, name: 'Word Champion',      minXP:  80_000 },
];

// +1 per word added, +2 per test taken, +3 per correct answer
export function computeXP({ wordsAdded = 0, testsTaken = 0, testsCorrect = 0 } = {}) {
    return wordsAdded * 1 + testsTaken * 2 + testsCorrect * 3;
}

export function getLevelInfo(xp) {
    let info = LEVELS[0];
    for (const l of LEVELS) {
        if (xp >= l.minXP) info = l;
    }
    const idx = LEVELS.indexOf(info);
    return { ...info, xp, next: LEVELS[idx + 1] || null };
}

export function getLevelProgress(xp) {
    const { minXP, next } = getLevelInfo(xp);
    if (!next) return 100;
    return Math.min(100, Math.round(((xp - minXP) / (next.minXP - minXP)) * 100));
}
