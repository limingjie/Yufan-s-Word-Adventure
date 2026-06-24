// ============================================================================
// Sunlight & Gardener Ranks  (formerly XP & Levels — see js/lib/xp.js history)
// ============================================================================
// "Sunlight" ☀️ is the permanent progress currency: it drives the gardener
// rank ladder and the leaderboard, and is never spent. (Coins, in coins.js,
// are the *spendable* currency.) Thresholds are unchanged from the old XP
// ladder — they map to ESL fluency milestones:
//   Rank 6 ≈   300 words — A1 survival vocabulary
//   Rank 7 ≈   600 words — A2 everyday topics
//   Rank 8 ≈ 1,500 words — B1 general fluency
//   Rank 9 ≈ 3,000 words — B2 academic/professional
//   Rank 10 ≈ 8,000 words — C1/C2 near-native
//
// Rank names are botanical and describe the *gardener* (the learner), kept
// deliberately distinct from per-word plant stages in srs.js (seed→golden tree).
export const RANKS = [
    { level:  1, name: 'Sprout Scout',     emoji: '🌱', minSun:       0 },
    { level:  2, name: 'Seedling Sitter',  emoji: '🪴', minSun:      50 },
    { level:  3, name: 'Leaf Learner',     emoji: '🌿', minSun:     200 },
    { level:  4, name: 'Bud Tender',       emoji: '🌻', minSun:     500 },
    { level:  5, name: 'Garden Keeper',    emoji: '🐝', minSun:   1_200 },
    { level:  6, name: 'Grove Guardian',   emoji: '🌳', minSun:   3_000 },
    { level:  7, name: 'Green Thumb',      emoji: '🍀', minSun:   6_000 },
    { level:  8, name: 'Garden Master',    emoji: '🏡', minSun:  15_000 },
    { level:  9, name: 'Nature Sage',      emoji: '🦋', minSun:  30_000 },
    { level: 10, name: 'Master Botanist',  emoji: '👑', minSun:  80_000 },
];

// +1 per word added, +2 per test taken, +3 per correct answer
export function computeSunlight({ wordsAdded = 0, testsTaken = 0, testsCorrect = 0 } = {}) {
    return wordsAdded * 1 + testsTaken * 2 + testsCorrect * 3;
}

export function getRankInfo(sun) {
    let info = RANKS[0];
    for (const r of RANKS) {
        if (sun >= r.minSun) info = r;
    }
    const idx = RANKS.indexOf(info);
    return { ...info, sun, next: RANKS[idx + 1] || null };
}

export function getRankProgress(sun) {
    const { minSun, next } = getRankInfo(sun);
    if (!next) return 100;
    return Math.min(100, Math.round(((sun - minSun) / (next.minSun - minSun)) * 100));
}
