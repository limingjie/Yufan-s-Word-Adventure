import { supabase } from '../js/supabase.js';
import { getCurrentUser } from '../js/auth.js';
import { computeSunlight } from '../js/lib/growth.js';

const TABS = [
    { key: 'sun',     label: 'Sunlight', icon: '☀️' },
    { key: 'words',   label: 'Words',    icon: '📚' },
    { key: 'mastered', label: 'Mastered', icon: '⭐' },
    { key: 'streak',  label: 'Streak',   icon: '🔥' },
];

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const [user, learnersResult] = await Promise.all([
        getCurrentUser(),
        supabase.from('profiles').select('id,display_name,avatar_color').eq('role', 'learner').eq('is_public', true),
    ]);

    const learners = learnersResult.data || [];

    if (learners.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🏆</span>
                <h3>No public learners yet</h3>
                <p>Enable your profile in <a href="#/learner/settings">Settings</a> to appear here.</p>
            </div>`;
        return;
    }

    // Fetch stats for all public learners in parallel
    const stats = await Promise.all(learners.map(l => fetchStats(l.id)));
    const rows  = learners.map((l, i) => ({ ...l, ...stats[i] }));

    let activeTab = 'sun';

    function renderTab() {
        const sorted = [...rows].sort((a, b) => {
            if (activeTab === 'sun')     return b.sun - a.sun;
            if (activeTab === 'words')   return b.words - a.words;
            if (activeTab === 'mastered') return b.mastered - a.mastered;
            return b.streak - a.streak;
        });

        const col = {
            sun:     r => `☀️ ${r.sun}`,
            words:   r => `${r.words} words`,
            mastered: r => `${r.mastered} mastered`,
            streak:  r => `${r.streak} days`,
        };

        const rowsHTML = sorted.map((r, i) => {
            const isMe    = r.id === user?.id;
            const initial = (r.display_name || '?')[0].toUpperCase();
            const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

            return `
                <div class="leaderboard-row${isMe ? ' me' : ''}">
                    <span class="leaderboard-rank${i < 3 ? ' gold' : ''}">${medal || (i + 1)}</span>
                    <div class="avatar" style="background:${r.avatar_color || '#007BFF'};width:34px;height:34px;font-size:0.85rem">${initial}</div>
                    <span style="font-weight:${isMe ? '600' : '400'}">${esc(r.display_name)}${isMe ? ' (you)' : ''}</span>
                    <span class="leaderboard-score">${col[activeTab](r)}</span>
                </div>`;
        }).join('');

        document.getElementById('leaderboardBody').innerHTML = rowsHTML || `
            <div class="empty-state"><span class="empty-icon">📊</span><h3>No data yet</h3><p>Complete some reviews to appear here.</p></div>`;

        document.querySelectorAll('.leaderboard-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === activeTab);
        });
    }

    const tabsHTML = TABS.map(t =>
        `<button class="leaderboard-tab${activeTab === t.key ? ' active' : ''}" data-tab="${t.key}">${t.icon} ${t.label}</button>`
    ).join('');

    container.innerHTML = `
        <div style="max-width:560px;margin:0 auto">
            <h2 style="margin-bottom:1.25rem">Leaderboard</h2>
            <div class="leaderboard-tabs">${tabsHTML}</div>
            <div id="leaderboardBody"></div>
        </div>`;

    document.querySelectorAll('.leaderboard-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab;
            renderTab();
        });
    });

    renderTab();
}

async function fetchStats(userId) {
    const [wordsRes, testsRes, masteredRes, streakRes] = await Promise.all([
        supabase.from('words').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null),
        supabase.from('test_results').select('correct').eq('user_id', userId),
        supabase.from('review_schedule').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('review_level', 4),
        fetchStreak(userId),
    ]);

    const wordsAdded  = wordsRes.count || 0;
    const tests       = testsRes.data || [];
    const testsTaken  = tests.length;
    const testsCorrect = tests.filter(t => t.correct).length;
    const sun         = computeSunlight({ wordsAdded, testsTaken, testsCorrect });
    const mastered    = masteredRes.count || 0;

    return { sun, words: wordsAdded, mastered, streak: streakRes };
}

async function fetchStreak(userId) {
    const [wordsRes, testsRes] = await Promise.all([
        supabase.from('words').select('created_at').eq('user_id', userId),
        supabase.from('test_results').select('tested_at').eq('user_id', userId),
    ]);

    const dates = new Set();
    for (const w of wordsRes.data || []) dates.add(w.created_at.split('T')[0]);
    for (const t of testsRes.data || []) dates.add(t.tested_at.split('T')[0]);

    if (dates.size === 0) return 0;

    const sorted    = [...dates].sort((a, b) => (a < b ? 1 : -1));
    const today     = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

    let streak = 0;
    let cursor = new Date(sorted[0] + 'T12:00:00Z');

    for (const date of sorted) {
        if (date === cursor.toISOString().split('T')[0]) {
            streak++;
            cursor = new Date(cursor.getTime() - 86400000);
        } else break;
    }

    return streak;
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
