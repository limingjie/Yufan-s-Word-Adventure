import { supabase } from '../supabase.js';
import { getCurrentUser } from '../auth.js';

export const ACHIEVEMENTS = {
    BRONZE_100:    { label: 'Bronze Collector',  desc: '100 words added',              icon: '🥉' },
    SILVER_500:    { label: 'Silver Scholar',     desc: '500 words added',              icon: '🥈' },
    GOLD_1000:     { label: 'Gold Master',        desc: '1000 words added',             icon: '🥇' },
    PLATINUM_2000: { label: 'Platinum Legend',    desc: '2000 words added',             icon: '💎' },
    STREAK_7:      { label: 'Week Warrior',       desc: '7-day streak',                 icon: '🔥' },
    STREAK_30:     { label: 'Month Master',       desc: '30-day streak',                icon: '⚡' },
    STREAK_100:    { label: 'Century Champion',   desc: '100-day streak',               icon: '🌟' },
    PERFECT_WEEK:  { label: 'Perfect Week',       desc: 'No missed reviews for 7 days', icon: '✨' },
    SPEED_READER:  { label: 'Speed Reader',       desc: '100 reviews in one day',       icon: '🚀' },
    WORD_COLLECTOR:{ label: 'Word Collector',     desc: '1000 unique words',            icon: '📚' },
};

const RULES = [
    { code: 'BRONZE_100',    check: s => s.wordsAdded >= 100 },
    { code: 'SILVER_500',    check: s => s.wordsAdded >= 500 },
    { code: 'GOLD_1000',     check: s => s.wordsAdded >= 1000 },
    { code: 'PLATINUM_2000', check: s => s.wordsAdded >= 2000 },
    { code: 'STREAK_7',      check: s => s.streak >= 7 },
    { code: 'STREAK_30',     check: s => s.streak >= 30 },
    { code: 'STREAK_100',    check: s => s.streak >= 100 },
    { code: 'WORD_COLLECTOR', check: s => s.wordsAdded >= 1000 },
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
