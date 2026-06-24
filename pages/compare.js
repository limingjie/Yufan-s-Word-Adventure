import { supabase } from '../js/supabase.js';
import { getCurrentUser } from '../js/auth.js';
import { fetchLearnerStats, fetchStreak, compareByStats } from '../js/lib/parent-stats.js';

export async function render(container, otherId) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const me = await getCurrentUser();
    if (!me) return;

    const { data: myProfile } = await supabase
        .from('profiles').select('role').eq('id', me.id).single();
    const isParent = myProfile?.role === 'parent';

    // Comparison is always learner-vs-learner. A learner compares themselves
    // against `otherId`; a parent compares `otherId` against another learner.
    let leftId;
    if (isParent) {
        const { data: learners } = await supabase
            .from('profiles').select('id').eq('role', 'learner');
        leftId = (learners || []).map(l => l.id).find(id => id !== otherId);
        if (!leftId) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <h3>Need two learners to compare</h3>
                    <a href="#/parent/dashboard" class="btn btn-secondary" style="margin-top:1rem">Back to Dashboard</a>
                </div>`;
            return;
        }
    } else {
        leftId = me.id;
    }

    const [aStats, bStats, aStreak, bStreak, aProfRes, bProfRes] = await Promise.all([
        fetchLearnerStats(leftId),
        fetchLearnerStats(otherId),
        fetchStreak(leftId),
        fetchStreak(otherId),
        supabase.from('profiles').select('display_name,avatar_color,avatar_emoji').eq('id', leftId).single(),
        supabase.from('profiles').select('display_name,avatar_color,avatar_emoji').eq('id', otherId).single(),
    ]);

    if (!aProfRes.data || !bProfRes.data) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span><h3>Learner not found</h3></div>`;
        return;
    }

    // Higher XP (then words) goes on the left, consistent with other parent views.
    let left  = { id: leftId,  stats: { ...aStats, streak: aStreak }, profile: aProfRes.data };
    let right = { id: otherId, stats: { ...bStats, streak: bStreak }, profile: bProfRes.data };
    if (compareByStats(left.stats, right.stats) > 0) [left, right] = [right, left];

    const ROWS = [
        { label: 'Sunlight',       key: 'sun',        fmt: v => `☀️ ${v}` },
        { label: 'Words Added',    key: 'words',      fmt: v => v },
        { label: 'Mastered Words', key: 'mastered',   fmt: v => v },
        { label: 'Test Accuracy',  key: 'accuracy',   fmt: v => `${v}%` },
        { label: 'Current Streak', key: 'streak',     fmt: v => `${v} days` },
        { label: 'Tests Taken',    key: 'testsTaken', fmt: v => v },
    ];

    function row(r) {
        const v1 = left.stats[r.key];
        const v2 = right.stats[r.key];
        const win1 = v1 > v2;
        const win2 = v2 > v1;
        return `
            <tr>
                <td style="text-align:right;font-weight:${win1 ? '700' : '400'};color:${win1 ? '#0d6efd' : 'inherit'}">${r.fmt(v1)}</td>
                <td style="text-align:center;color:#666;font-size:0.85rem;padding:0 0.5rem">${r.label}</td>
                <td style="text-align:left;font-weight:${win2 ? '700' : '400'};color:${win2 ? '#dc3545' : 'inherit'}">${r.fmt(v2)}</td>
            </tr>`;
    }

    const back = isParent
        ? `<a href="#/parent/dashboard" class="btn btn-secondary">Back to Dashboard</a>`
        : `<a href="#/learner/leaderboard" class="btn btn-secondary">Back to Leaderboard</a>`;

    container.innerHTML = `
        <div style="max-width:560px;margin:0 auto">
            <h2 style="margin-bottom:1.5rem;text-align:center">Head-to-Head</h2>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem">
                <div style="text-align:center;flex:1">
                    ${avatarHTML(left.profile, '#0d6efd')}
                    <div style="font-weight:600">${esc(left.profile.display_name)}</div>
                </div>
                <div style="font-size:1.5rem;color:#666;padding:0 1rem">vs</div>
                <div style="text-align:center;flex:1">
                    ${avatarHTML(right.profile, '#dc3545')}
                    <div style="font-weight:600">${esc(right.profile.display_name)}</div>
                </div>
            </div>

            <div class="card">
                <table style="width:100%;border-collapse:collapse">
                    <tbody>${ROWS.map(row).join('')}</tbody>
                </table>
            </div>

            <div style="text-align:center;margin-top:1rem">${back}</div>
        </div>`;
}

function avatarHTML(profile, fallbackColor) {
    const initial = (profile.display_name || '?')[0].toUpperCase();
    const face    = profile.avatar_emoji || initial;
    return `<div class="avatar${profile.avatar_emoji ? ' avatar-emoji' : ''}" style="background:${profile.avatar_color || fallbackColor};width:56px;height:56px;font-size:1.4rem;margin:0 auto 0.5rem">${face}</div>`;
}

function esc(str) {
    return String(str ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
