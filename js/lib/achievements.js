import { supabase } from '../supabase.js';
import { getCurrentUser } from '../auth.js';

// ============================================================================
// Badges — granular & garden-themed, designed to be earned quickly & often
// ============================================================================
// Each badge is a permanent one-time award (achievements table, UNIQUE code).
// Every earned badge is also worth +5 🪙 (see computeCoins in coins.js).
// `category` groups them on the Awards page; `tier` orders within a category.
export const ACHIEVEMENTS = {
    // --- Words planted ---
    FIRST_SEED:  { label: 'First Seed',     desc: 'Add your first word',    icon: '🌱', category: 'Words', tier: 1 },
    SPROUTS_10:  { label: 'Sprouting',      desc: '10 words added',         icon: '🌿', category: 'Words', tier: 2 },
    PATCH_25:    { label: 'Little Patch',   desc: '25 words added',         icon: '☘️', category: 'Words', tier: 3 },
    GARDEN_50:   { label: 'Garden Bed',     desc: '50 words added',         icon: '🪴', category: 'Words', tier: 4 },
    GROVE_100:   { label: 'Grove',          desc: '100 words added',        icon: '🌳', category: 'Words', tier: 5 },
    ORCHARD_250: { label: 'Orchard',        desc: '250 words added',        icon: '🍎', category: 'Words', tier: 6 },
    FOREST_500:  { label: 'Forest',         desc: '500 words added',        icon: '🌲', category: 'Words', tier: 7 },
    JUNGLE_1000: { label: 'Jungle',         desc: '1000 words added',       icon: '🌴', category: 'Words', tier: 8 },

    // --- Blooms (mastered words, review_level ≥ 4) ---
    FIRST_BLOOM: { label: 'First Bloom',    desc: 'Master your first word', icon: '🌷', category: 'Blooms', tier: 1 },
    BLOOMS_5:    { label: 'Bouquet',        desc: '5 words mastered',       icon: '💐', category: 'Blooms', tier: 2 },
    BLOOMS_10:   { label: 'Flower Patch',   desc: '10 words mastered',      icon: '🌸', category: 'Blooms', tier: 3 },
    BLOOMS_25:   { label: 'Flower Field',   desc: '25 words mastered',      icon: '🌺', category: 'Blooms', tier: 4 },
    BLOOMS_50:   { label: 'Botanic Garden', desc: '50 words mastered',      icon: '🏵️', category: 'Blooms', tier: 5 },
    BLOOMS_100:  { label: 'Golden Grove',   desc: '100 words mastered',     icon: '🏆', category: 'Blooms', tier: 6 },

    // --- Daily streaks ---
    STREAK_3:    { label: 'Watered 3 Days', desc: '3-day streak',           icon: '💧', category: 'Streaks', tier: 1 },
    STREAK_7:    { label: 'Week Warrior',   desc: '7-day streak',           icon: '🔥', category: 'Streaks', tier: 2 },
    STREAK_14:   { label: 'Fortnight',      desc: '14-day streak',          icon: '⚡', category: 'Streaks', tier: 3 },
    STREAK_30:   { label: 'Month Master',   desc: '30-day streak',          icon: '🌟', category: 'Streaks', tier: 4 },
    STREAK_60:   { label: 'Evergreen',      desc: '60-day streak',          icon: '🌲', category: 'Streaks', tier: 5 },
    STREAK_100:  { label: 'Century Bloom',  desc: '100-day streak',         icon: '💯', category: 'Streaks', tier: 6 },

    // --- Practice (correct answers, lifetime) ---
    SHARP_25:    { label: 'Sharp Sprout',   desc: '25 correct answers',     icon: '🎯', category: 'Practice', tier: 1 },
    SHARP_100:   { label: 'Sharp Shooter',  desc: '100 correct answers',    icon: '🏹', category: 'Practice', tier: 2 },
    SHARP_500:   { label: 'Sharp Master',   desc: '500 correct answers',    icon: '🥇', category: 'Practice', tier: 3 },
    FIRST_REVIEW:{ label: 'First Watering', desc: 'Finish a review session', icon: '🚿', category: 'Practice', tier: 4 },
    FIRST_QUIZ:  { label: 'Quiz Whiz',      desc: 'Finish a quiz',          icon: '📝', category: 'Practice', tier: 5 },

    // --- Skill & flair ---
    HOT_5:       { label: 'On a Roll',      desc: '5 correct in a row',     icon: '🔥', category: 'Skill', tier: 1 },
    HOT_10:      { label: 'Blazing',        desc: '10 correct in a row',    icon: '☄️', category: 'Skill', tier: 2 },
    HOT_20:      { label: 'Unstoppable',    desc: '20 correct in a row',    icon: '🌋', category: 'Skill', tier: 3 },
    PERFECT_REVIEW: { label: 'Flawless Care', desc: 'A perfect review session', icon: '✨', category: 'Skill', tier: 4 },
    PERFECT_QUIZ:{ label: 'Perfect Score',  desc: 'A perfect quiz',         icon: '💎', category: 'Skill', tier: 5 },
    GREEN_THUMB_DAY: { label: 'Green Thumb', desc: 'All daily missions in a day', icon: '🧤', category: 'Skill', tier: 6 },
};

// Each rule reads from the stats object built by awards.runAfterActivity():
//   wordsAdded, masteredCount, streak, correctTotal,
//   maxCombo, perfectSession, allMissions, sessionType
const RULES = [
    { code: 'FIRST_SEED',  check: s => s.wordsAdded >= 1 },
    { code: 'SPROUTS_10',  check: s => s.wordsAdded >= 10 },
    { code: 'PATCH_25',    check: s => s.wordsAdded >= 25 },
    { code: 'GARDEN_50',   check: s => s.wordsAdded >= 50 },
    { code: 'GROVE_100',   check: s => s.wordsAdded >= 100 },
    { code: 'ORCHARD_250', check: s => s.wordsAdded >= 250 },
    { code: 'FOREST_500',  check: s => s.wordsAdded >= 500 },
    { code: 'JUNGLE_1000', check: s => s.wordsAdded >= 1000 },

    { code: 'FIRST_BLOOM', check: s => s.masteredCount >= 1 },
    { code: 'BLOOMS_5',    check: s => s.masteredCount >= 5 },
    { code: 'BLOOMS_10',   check: s => s.masteredCount >= 10 },
    { code: 'BLOOMS_25',   check: s => s.masteredCount >= 25 },
    { code: 'BLOOMS_50',   check: s => s.masteredCount >= 50 },
    { code: 'BLOOMS_100',  check: s => s.masteredCount >= 100 },

    { code: 'STREAK_3',    check: s => s.streak >= 3 },
    { code: 'STREAK_7',    check: s => s.streak >= 7 },
    { code: 'STREAK_14',   check: s => s.streak >= 14 },
    { code: 'STREAK_30',   check: s => s.streak >= 30 },
    { code: 'STREAK_60',   check: s => s.streak >= 60 },
    { code: 'STREAK_100',  check: s => s.streak >= 100 },

    { code: 'SHARP_25',    check: s => s.correctTotal >= 25 },
    { code: 'SHARP_100',   check: s => s.correctTotal >= 100 },
    { code: 'SHARP_500',   check: s => s.correctTotal >= 500 },
    { code: 'FIRST_REVIEW', check: s => s.sessionType === 'review' },
    { code: 'FIRST_QUIZ',  check: s => (s.sessionType || '').startsWith('quiz') },

    { code: 'HOT_5',       check: s => s.maxCombo >= 5 },
    { code: 'HOT_10',      check: s => s.maxCombo >= 10 },
    { code: 'HOT_20',      check: s => s.maxCombo >= 20 },
    { code: 'PERFECT_REVIEW', check: s => s.perfectSession && s.sessionType === 'review' },
    { code: 'PERFECT_QUIZ', check: s => s.perfectSession && (s.sessionType || '').startsWith('quiz') },
    { code: 'GREEN_THUMB_DAY', check: s => !!s.allMissions },
];

export async function checkAndAward(stats) {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data: existing } = await supabase
        .from('achievements')
        .select('achievement_code')
        .eq('user_id', user.id);

    const earned = new Set((existing || []).map(a => a.achievement_code));
    const newCodes = [];

    for (const rule of RULES) {
        if (!earned.has(rule.code) && rule.check(stats)) {
            const { error } = await supabase
                .from('achievements')
                .insert({ user_id: user.id, achievement_code: rule.code });
            if (!error) newCodes.push(rule.code);
        }
    }

    return newCodes;
}
