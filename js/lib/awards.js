// ============================================================================
// Award connector — the single backbone every activity page calls
// ============================================================================
// After any activity (add word, finish a review, finish a quiz), pages call
// runAfterActivity(hints). It recomputes Sunlight, Coins and badges in one
// place and returns a list of `events` for celebrate.js to render, plus the
// fresh totals so callers can refresh wallets/bars.
//
// hints (all optional):
//   sessionType    'review' | 'quiz-meaning' | 'quiz-spelling' | 'add'
//   answered       tests taken THIS session  (for sunlight/coin delta)
//   correct        correct answers THIS session
//   wordsAdded     words added THIS session
//   maxCombo       longest correct streak this session
//   perfectSession every answer correct
//   allMissions    all daily missions completed today

import { getCurrentUser } from '../auth.js';
import { getUserSunlight, getUserStreak, getMasteredCount, getUserCoins } from '../db.js';
import { computeSunlight, getRankInfo } from './growth.js';
import { checkAndAward, ACHIEVEMENTS } from './achievements.js';

export async function runAfterActivity(hints = {}) {
    const user = await getCurrentUser();
    if (!user) return { events: [], coinsDelta: 0, sun: 0, rank: getRankInfo(0), coins: { balance: 0 } };

    const answered = hints.answered   || 0;
    const correct  = hints.correct    || 0;
    const added    = hints.wordsAdded  || 0;

    const [sunData, streak, mastered] = await Promise.all([
        getUserSunlight(),
        getUserStreak(),
        getMasteredCount(),
    ]);
    const sun  = sunData.sun;
    const rank = getRankInfo(sun);

    // Detect a rank-up by reconstructing the pre-session Sunlight total.
    const sessionSun = computeSunlight({ wordsAdded: added, testsTaken: answered, testsCorrect: correct });
    const preRank    = getRankInfo(sun - sessionSun);

    // Check & persist any newly-earned permanent badges.
    const newCodes = await checkAndAward({
        wordsAdded:     sunData.wordsAdded,
        correctTotal:   sunData.testsCorrect,
        streak,
        masteredCount:  mastered,
        maxCombo:       hints.maxCombo || 0,
        perfectSession: !!hints.perfectSession,
        allMissions:    !!hints.allMissions,
        sessionType:    hints.sessionType,
    });

    // Fresh coin balance (fetched AFTER badge inserts, since each badge = +5 🪙).
    const coins = await getUserCoins();

    // Coins earned this session = session activity + new badge bonuses
    // (mirrors computeCoins so the celebrated number matches the wallet rise).
    const coinsDelta = added + answered + correct + newCodes.length * 5;

    const events = [];
    if (rank.level > preRank.level) events.push({ type: 'rankUp', payload: rank });
    for (const code of newCodes) {
        const info = ACHIEVEMENTS[code];
        if (info) events.push({ type: 'badge', payload: { code, ...info } });
    }
    if (coinsDelta > 0) events.push({ type: 'coins', payload: { amount: coinsDelta, balance: coins.balance } });

    return { events, coinsDelta, sun, rank, coins, newCodes };
}
