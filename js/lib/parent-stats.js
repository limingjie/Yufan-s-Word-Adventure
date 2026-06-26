// ============================================================================
// Parent-side learner stats — shared across parent pages
// ============================================================================
// Parent views always order learners by XP (then words) descending, and treat
// a learner with 0 XP or 0 words as "inactive" (collapsed in listings).

import { supabase } from '../supabase.js';
import { computeSunlight } from './growth.js';

function localYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function fetchTestCounts(userId) {
    const [takenRes, correctRes] = await Promise.all([
        supabase.from('test_results').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('test_results').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('correct', true),
    ]);
    return {
        testsTaken: takenRes.count || 0,
        correct: correctRes.count || 0,
    };
}

/** Aggregate stats for one learner: xp, words, mastered, accuracy. */
export async function fetchLearnerStats(userId) {
    const [wordsRes, testCounts, masteredRes] = await Promise.all([
        supabase.from('words').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        fetchTestCounts(userId),
        supabase.from('review_schedule').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('review_level', 4),
    ]);

    const words      = wordsRes.count || 0;
    const { testsTaken, correct } = testCounts;
    const accuracy   = testsTaken > 0 ? Math.round((correct / testsTaken) * 100) : 0;
    const sun        = computeSunlight({ wordsAdded: words, testsTaken, testsCorrect: correct });
    const mastered   = masteredRes.count || 0;

    return { sun, words, testsTaken, correct, accuracy, mastered };
}

/** Sort comparator: highest Sunlight first, then most words. */
export function compareByStats(a, b) {
    if (b.sun !== a.sun) return b.sun - a.sun;
    return b.words - a.words;
}

/** A learner is "inactive" (and collapsed in listings) with no Sunlight or no words. */
export function isInactive(stats) {
    return !stats || stats.sun === 0 || stats.words === 0;
}

/**
 * Fetch all learner profiles with their stats attached, sorted by XP then words.
 * Each returned learner has a `.stats` field.
 */
export async function loadLearnersSorted() {
    const { data: learners } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_color,avatar_emoji')
        .eq('role', 'learner');

    if (!learners?.length) return [];

    const stats = await Promise.all(learners.map(l => fetchLearnerStats(l.id)));
    return learners
        .map((l, i) => ({ ...l, stats: stats[i] }))
        .sort((a, b) => compareByStats(a.stats, b.stats));
}

/** Current consecutive-day activity streak (words added or tests taken). */
export async function fetchStreak(userId) {
    const [wordsRes, testsRes] = await Promise.all([
        supabase.from('words').select('created_at').eq('user_id', userId),
        supabase.from('test_results').select('tested_at').eq('user_id', userId),
    ]);

    const dates = new Set();
    for (const w of wordsRes.data || []) dates.add(localYMD(new Date(w.created_at)));
    for (const t of testsRes.data || []) dates.add(localYMD(new Date(t.tested_at)));
    if (dates.size === 0) return 0;

    const sorted    = [...dates].sort((a, b) => (a < b ? 1 : -1));
    const now       = new Date();
    const today     = localYMD(now);
    const yesterday = localYMD(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

    let streak    = 0;
    let cursorYMD = sorted[0];
    for (const date of sorted) {
        if (date !== cursorYMD) break;
        streak++;
        const [y, m, d] = cursorYMD.split('-').map(Number);
        cursorYMD = localYMD(new Date(y, m - 1, d - 1));
    }
    return streak;
}
