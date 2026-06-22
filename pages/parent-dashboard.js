import { supabase } from '../js/supabase.js';
import { computeXP } from '../js/lib/xp.js';
import { getLevelInfo } from '../js/lib/xp.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading dashboard…</p></div>`;

    // Load all learner profiles
    const { data: learners } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_color')
        .eq('role', 'learner')
        .order('display_name');

    if (!learners || learners.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">👶</span>
                <h3>No learners yet</h3>
                <p>Learner accounts appear here once they're created.</p>
            </div>`;
        return;
    }

    const stats = await Promise.all(learners.map(l => fetchLearnerStats(l.id)));

    const cardsHTML = learners.map((l, i) => {
        const s       = stats[i];
        const level   = getLevelInfo(s.xp);
        const initial = (l.display_name || '?')[0].toUpperCase();

        return `
            <div class="card">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
                    <div class="avatar" style="background:${l.avatar_color || '#007BFF'};width:44px;height:44px;font-size:1.1rem">${initial}</div>
                    <div>
                        <div style="font-weight:600;font-size:1.05rem">${esc(l.display_name)}</div>
                        <span class="level-badge" style="font-size:0.75rem">Lv.${level.level} ${level.name}</span>
                    </div>
                    <a href="#/learner/compare/${l.id}" class="btn btn-secondary btn-sm" style="margin-left:auto">Compare</a>
                </div>
                <div class="stat-cards" style="margin-bottom:0">
                    <div class="stat-card">
                        <div class="stat-icon">⚡</div>
                        <div class="stat-value">${s.xp}</div>
                        <div class="stat-label">XP</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📚</div>
                        <div class="stat-value">${s.words}</div>
                        <div class="stat-label">Words</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">⭐</div>
                        <div class="stat-value">${s.mastered}</div>
                        <div class="stat-label">Mastered</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-value">${s.accuracy}%</div>
                        <div class="stat-label">Accuracy</div>
                    </div>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div style="max-width:800px;margin:0 auto">
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
                <h2 style="margin:0">Parent Dashboard</h2>
                <a href="#/parent/words" class="btn btn-secondary btn-sm" style="margin-left:auto">View Word Lists</a>
            </div>

            ${cardsHTML}

            <div class="card" style="margin-top:1rem">
                <h3 style="margin:0 0 1rem">Recent Activity (last 7 days)</h3>
                <div id="activityChart" style="position:relative;height:200px">
                    <canvas id="activityCanvas"></canvas>
                </div>
            </div>
        </div>`;

    loadChart(learners, stats);
}

async function loadChart(learners, stats) {
    if (typeof Chart === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js');
    }

    const days    = 7;
    const labels  = [];
    const today   = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
    }

    const datasets = await Promise.all(learners.map(async (l, li) => {
        const { data: tests } = await supabase
            .from('test_results')
            .select('tested_at')
            .eq('user_id', l.id)
            .gte('tested_at', new Date(Date.now() - days * 86400000).toISOString());

        const counts = Array(days).fill(0);
        (tests || []).forEach(t => {
            const d   = new Date(t.tested_at);
            const idx = days - 1 - Math.floor((today - d) / 86400000);
            if (idx >= 0 && idx < days) counts[idx]++;
        });

        const color = learners[li].avatar_color || '#007BFF';
        return { label: l.display_name, data: counts, borderColor: color, backgroundColor: color + '33', fill: true, tension: 0.3 };
    }));

    const ctx = document.getElementById('activityCanvas');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
    });
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

async function fetchLearnerStats(userId) {
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

    return { xp, words, testsTaken, correct, accuracy, mastered };
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
