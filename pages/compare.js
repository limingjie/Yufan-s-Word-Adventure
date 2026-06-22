import { supabase } from '../js/supabase.js';
import { getCurrentUser } from '../js/auth.js';
import { computeXP } from '../js/lib/xp.js';

export async function render(container, otherId) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const me = await getCurrentUser();
    if (!me) return;

    const [myStats, otherStats, otherProfile] = await Promise.all([
        fetchFullStats(me.id),
        fetchFullStats(otherId),
        supabase.from('profiles').select('display_name,avatar_color').eq('id', otherId).single(),
    ]);

    const myProfile = await supabase.from('profiles').select('display_name,avatar_color').eq('id', me.id).single();

    const p1 = myProfile.data;
    const p2 = otherProfile.data;

    if (!p2) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span><h3>Learner not found</h3></div>`;
        return;
    }

    const ROWS = [
        { label: 'Total XP',       v1: myStats.xp,       v2: otherStats.xp,       fmt: v => `${v} XP` },
        { label: 'Words Added',    v1: myStats.words,     v2: otherStats.words,     fmt: v => v },
        { label: 'Mastered Words', v1: myStats.mastered,  v2: otherStats.mastered,  fmt: v => v },
        { label: 'Test Accuracy',  v1: myStats.accuracy,  v2: otherStats.accuracy,  fmt: v => `${v}%` },
        { label: 'Current Streak', v1: myStats.streak,    v2: otherStats.streak,    fmt: v => `${v} days` },
        { label: 'Tests Taken',    v1: myStats.testsTaken,v2: otherStats.testsTaken,fmt: v => v },
    ];

    function row(r) {
        const win1 = r.v1 > r.v2;
        const win2 = r.v2 > r.v1;
        return `
            <tr>
                <td style="text-align:right;font-weight:${win1 ? '700' : '400'};color:${win1 ? '#0d6efd' : 'inherit'}">${r.fmt(r.v1)}</td>
                <td style="text-align:center;color:#666;font-size:0.85rem;padding:0 0.5rem">${r.label}</td>
                <td style="text-align:left;font-weight:${win2 ? '700' : '400'};color:${win2 ? '#dc3545' : 'inherit'}">${r.fmt(r.v2)}</td>
            </tr>`;
    }

    const i1 = (p1?.display_name || '?')[0].toUpperCase();
    const i2 = (p2?.display_name || '?')[0].toUpperCase();

    container.innerHTML = `
        <div style="max-width:560px;margin:0 auto">
            <h2 style="margin-bottom:1.5rem;text-align:center">Head-to-Head</h2>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
                <div style="text-align:center;flex:1">
                    <div class="avatar" style="background:${p1?.avatar_color || '#007BFF'};width:56px;height:56px;font-size:1.4rem;margin:0 auto 0.5rem">${i1}</div>
                    <div style="font-weight:600">${esc(p1?.display_name || 'You')}</div>
                </div>
                <div style="font-size:1.5rem;color:#666;padding:0 1rem">vs</div>
                <div style="text-align:center;flex:1">
                    <div class="avatar" style="background:${p2?.avatar_color || '#dc3545'};width:56px;height:56px;font-size:1.4rem;margin:0 auto 0.5rem">${i2}</div>
                    <div style="font-weight:600">${esc(p2?.display_name)}</div>
                </div>
            </div>

            <div class="card">
                <table style="width:100%;border-collapse:collapse">
                    <tbody>${ROWS.map(row).join('')}</tbody>
                </table>
            </div>

            <div style="text-align:center;margin-top:1rem">
                <a href="#/learner/leaderboard" class="btn btn-secondary">Back to Leaderboard</a>
            </div>
        </div>`;
}

async function fetchFullStats(userId) {
    const [wordsRes, testsRes, masteredRes] = await Promise.all([
        supabase.from('words').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('test_results').select('correct').eq('user_id', userId),
        supabase.from('review_schedule').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('review_level', 4),
    ]);

    const words      = wordsRes.count || 0;
    const tests      = testsRes.data || [];
    const testsTaken = tests.length;
    const correct    = tests.filter(t => t.correct).length;
    const accuracy   = testsTaken > 0 ? Math.round((correct / testsTaken) * 100) : 0;
    const xp         = computeXP({ wordsAdded: words, testsTaken, testsCorrect: correct });
    const mastered   = masteredRes.count || 0;

    return { xp, words, testsTaken, accuracy, mastered, streak: 0 };
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
