import { supabase } from '../js/supabase.js';
import { getRankInfo } from '../js/lib/growth.js';
import { getDailyProgress, getMissionHistory } from '../js/db.js';
import { buildMissions, renderMissionList, allMissionsDone } from '../js/lib/missions.js';
import { loadLearnersSorted, isInactive } from '../js/lib/parent-stats.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading dashboard…</p></div>`;

    // Learners come back sorted by XP (then words) descending.
    const learners = await loadLearnersSorted();

    if (!learners.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">👶</span>
                <h3>No learners yet</h3>
                <p>Learner accounts appear here once they're created.</p>
            </div>`;
        return;
    }

    const dailies = await Promise.all(learners.map(l => getDailyProgress(l.id)));

    const cardsHTML = learners.map((l, i) => {
        const inner = learnerCardInner(l, dailies[i]);
        if (isInactive(l.stats)) {
            // 0 XP or 0 words → collapsed; expand on demand.
            return `
                <details class="card learner-collapsed">
                    <summary style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;list-style:none">
                        ${avatarHTML(l, 32)}
                        <div style="font-weight:600">${esc(l.display_name)}</div>
                        <span style="color:#999;font-size:0.82rem;margin-left:auto">No activity yet ▾</span>
                    </summary>
                    <div style="margin-top:1rem">${inner}</div>
                </details>`;
        }
        return `<div class="card">${inner}</div>`;
    }).join('');

    const compareBtn = learners.length >= 2
        ? `<a href="#/learner/compare/${learners[1].id}" class="btn btn-secondary btn-sm" style="margin-left:auto">⚔️ Compare learners</a>`
        : '';

    const activeLearners = learners.filter(l => !isInactive(l.stats));

    container.innerHTML = `
        <div style="max-width:800px;margin:0 auto">
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
                <h2 style="margin:0">Parent Dashboard</h2>
                ${compareBtn}
            </div>

            ${cardsHTML}

            ${activeLearners.length ? `
            <div class="card" style="margin-top:1rem">
                <h3 style="margin:0 0 1rem">Recent Activity (last 7 days)</h3>
                <div id="activityChart" style="position:relative;height:200px">
                    <canvas id="activityCanvas"></canvas>
                </div>
            </div>` : ''}
        </div>`;

    attachHistoryToggles(container);
    if (activeLearners.length) loadChart(activeLearners);
}

// ── Learner card ────────────────────────────────────────────────────────────

function learnerCardInner(l, daily) {
    const s        = l.stats;
    const rank     = getRankInfo(s.sun);
    const missions = buildMissions(daily);
    const allDone  = allMissionsDone(missions);

    return `
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
            ${avatarHTML(l, 44)}
            <div>
                <div style="font-weight:600;font-size:1.05rem">${esc(l.display_name)}</div>
                <span class="level-badge" style="font-size:0.75rem">${rank.emoji} ${rank.name}</span>
            </div>
        </div>
        <div class="stat-cards" style="margin-bottom:1rem">
            <div class="stat-card"><div class="stat-icon">☀️</div><div class="stat-value">${s.sun}</div><div class="stat-label">Sunlight</div></div>
            <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-value">${s.words}</div><div class="stat-label">Words</div></div>
            <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value">${s.mastered}</div><div class="stat-label">Mastered</div></div>
            <div class="stat-card"><div class="stat-icon">🎯</div><div class="stat-value">${s.accuracy}%</div><div class="stat-label">Accuracy</div></div>
        </div>
        <div class="section-label">Today's Missions ${allDone ? '🎉' : ''}</div>
        ${renderMissionList(missions, { readOnly: true })}
        <button class="history-toggle btn btn-secondary btn-sm" data-id="${l.id}" style="margin-top:0.75rem;font-size:0.8rem">📜 View mission history ▾</button>
        <div class="history-panel" id="history-${l.id}" style="display:none;margin-top:0.5rem"></div>`;
}

function avatarHTML(l, size) {
    const initial = (l.display_name || '?')[0].toUpperCase();
    const face    = l.avatar_emoji || initial;
    return `<div class="avatar${l.avatar_emoji ? ' avatar-emoji' : ''}" style="background:${l.avatar_color || '#007BFF'};width:${size}px;height:${size}px;font-size:${size > 36 ? '1.1rem' : '0.85rem'}">${face}</div>`;
}

// ── Mission history (lazy-loaded per learner) ───────────────────────────────

function attachHistoryToggles(container) {
    container.querySelectorAll('.history-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
            const panel = document.getElementById(`history-${btn.dataset.id}`);
            if (!panel) return;
            const open = panel.style.display !== 'none';
            if (open) {
                panel.style.display = 'none';
                btn.textContent = '📜 View mission history ▾';
                return;
            }
            btn.textContent = '📜 Hide mission history ▴';
            panel.style.display = 'block';
            if (!panel.dataset.loaded) {
                panel.innerHTML = `<p style="color:#999;font-size:0.82rem;margin:0.25rem 0">Loading…</p>`;
                const history = await getMissionHistory(btn.dataset.id, 14);
                panel.innerHTML = renderHistory(history);
                panel.dataset.loaded = '1';
            }
        });
    });
}

function renderHistory(history) {
    const rows = (history || []).filter(d => d.hasActivity);
    if (!rows.length) return `<p style="color:#999;font-size:0.82rem;margin:0.25rem 0">No activity in the last 14 days.</p>`;

    const body = rows.map(d => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid #f2f2f2;font-size:0.8rem">
            <span style="width:5.5rem;color:#555;font-weight:500;flex-shrink:0">${formatDate(d.date)}</span>
            <span style="color:#666;flex:1">📚 ${d.wordsAdded} · 💧 ${d.reviewsNew} · 📖 ${d.meaning} · ✍️ ${d.spelling} · 🔁 ${d.reviewsCurve}</span>
            <span style="flex-shrink:0">${d.coreDone ? '✅' : '·'}</span>
        </div>`).join('');

    return `
        <div style="font-size:0.72rem;color:#aaa;margin-bottom:0.25rem">📚 added · 💧 new reviews · 📖 meaning · ✍️ spelling · 🔁 older reviews · ✅ goals met</div>
        ${body}`;
}

// ── Activity chart ──────────────────────────────────────────────────────────

async function loadChart(learners) {
    if (typeof Chart === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js');
    }

    const days = 7;
    const now  = new Date();

    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        let label;
        if (i === 0)      label = 'Today';
        else if (i === 1) label = 'Yest.';
        else              label = d.toLocaleDateString('en', { weekday: 'short' });
        buckets.push({ ymd: localYMD(d), label });
    }
    const labels    = buckets.map(b => b.label);
    const bucketMap = new Map(buckets.map((b, i) => [b.ymd, i]));
    const cutoff    = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

    const datasets = await Promise.all(learners.map(async (l) => {
        const { data: tests } = await supabase
            .from('test_results')
            .select('tested_at')
            .eq('user_id', l.id)
            .gte('tested_at', cutoff.toISOString());

        const counts = new Array(days).fill(0);
        (tests || []).forEach(t => {
            const idx = bucketMap.get(localYMD(new Date(t.tested_at)));
            if (idx !== undefined) counts[idx]++;
        });

        const color = l.avatar_color || '#007BFF';
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

function localYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(dateStr) {
    const today    = new Date();
    const todayStr = localYMD(today);
    const yestStr  = localYMD(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yestStr)  return 'Yesterday';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(str) {
    return String(str ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
