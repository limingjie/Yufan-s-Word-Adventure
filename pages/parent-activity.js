import { supabase } from '../js/supabase.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const { data: learners } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_color')
        .eq('role', 'learner')
        .order('display_name');

    if (!learners?.length) {
        container.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><h3>No learners found</h3></div>`;
        return;
    }

    let activeLearner = learners[0].id;

    const tabsHTML = learners.map(l =>
        `<button class="leaderboard-tab${l.id === activeLearner ? ' active' : ''}" data-id="${l.id}">${esc(l.display_name)}</button>`
    ).join('');

    container.innerHTML = `
        <div style="max-width:720px;margin:0 auto">
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap">
                <h2 style="margin:0">Activity Log</h2>
                <a href="#/parent/dashboard" class="btn btn-secondary btn-sm">Dashboard</a>
                <a href="#/parent/words" class="btn btn-secondary btn-sm">Word Lists</a>
            </div>
            <div class="leaderboard-tabs" style="margin-bottom:1rem">${tabsHTML}</div>
            <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center">
                <select id="typeFilter" style="font-size:0.85rem;padding:6px 10px;border:1px solid #dee2e6;border-radius:6px;height:36px">
                    <option value="">All types</option>
                    <option value="meaning">📖 Meaning</option>
                    <option value="spelling">✍️ Spelling</option>
                    <option value="listening">🔊 Listening</option>
                </select>
                <select id="rangeFilter" style="font-size:0.85rem;padding:6px 10px;border:1px solid #dee2e6;border-radius:6px;height:36px">
                    <option value="30">Last 30 days</option>
                    <option value="7">Last 7 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="0">All time</option>
                </select>
            </div>
            <div id="activitySummary" style="margin-bottom:1rem"></div>
            <div id="activityLog"></div>
        </div>`;

    async function loadActivity(learnerId) {
        document.getElementById('activityLog').innerHTML     = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;
        document.getElementById('activitySummary').innerHTML = '';

        const days       = parseInt(document.getElementById('rangeFilter').value);
        const typeFilter = document.getElementById('typeFilter').value;

        let query = supabase
            .from('test_results')
            .select('id,word_id,test_type,correct,tested_at,words(word)')
            .eq('user_id', learnerId)
            .order('tested_at', { ascending: false });

        if (days > 0) query = query.gte('tested_at', new Date(Date.now() - days * 86400000).toISOString());
        if (typeFilter) query = query.eq('test_type', typeFilter);

        const { data } = await query.limit(1000);
        const tests = data || [];

        renderSummary(document.getElementById('activitySummary'), tests);
        renderLog(document.getElementById('activityLog'), tests);
    }

    function renderSummary(container, tests) {
        const total   = tests.length;
        const correct = tests.filter(t => t.correct).length;
        const pct     = total > 0 ? Math.round(correct / total * 100) : 0;
        const today   = new Date().toISOString().split('T')[0];
        const todayTests   = tests.filter(t => t.tested_at.startsWith(today));
        const todayCorrect = todayTests.filter(t => t.correct).length;
        const todayPct     = todayTests.length > 0 ? Math.round(todayCorrect / todayTests.length * 100) : null;

        const byType = {};
        for (const t of tests) {
            if (!byType[t.test_type]) byType[t.test_type] = { total: 0, correct: 0 };
            byType[t.test_type].total++;
            if (t.correct) byType[t.test_type].correct++;
        }

        const typeIcons  = { meaning: '📖', spelling: '✍️', listening: '🔊' };
        const typeCards  = Object.entries(byType).map(([type, s]) => {
            const p = Math.round(s.correct / s.total * 100);
            return `<div class="stat-card">
                <div class="stat-icon">${typeIcons[type] ?? '❓'}</div>
                <div class="stat-value">${p}%</div>
                <div class="stat-label">${type} (${s.total})</div>
            </div>`;
        }).join('');

        if (total === 0) {
            container.innerHTML = `<div class="card" style="padding:1rem;color:#888;font-size:0.9rem">No activity recorded in this period.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="card" style="padding:1rem">
                <div class="stat-cards" style="margin-bottom:${typeCards ? '0.75rem' : '0'}">
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-value">${total}</div>
                        <div class="stat-label">Total tests</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-value">${pct}%</div>
                        <div class="stat-label">Pass rate</div>
                    </div>
                    ${todayPct !== null ? `<div class="stat-card">
                        <div class="stat-icon">📅</div>
                        <div class="stat-value">${todayPct}%</div>
                        <div class="stat-label">Today (${todayTests.length})</div>
                    </div>` : ''}
                </div>
                ${typeCards ? `<div class="stat-cards">${typeCards}</div>` : ''}
            </div>`;
    }

    function renderLog(container, tests) {
        if (tests.length === 0) {
            container.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><h3>No activity</h3><p>No tests recorded in this period.</p></div>`;
            return;
        }

        // Group by date
        const groups = new Map();
        for (const t of tests) {
            const date = t.tested_at.split('T')[0];
            if (!groups.has(date)) groups.set(date, []);
            groups.get(date).push(t);
        }

        let html = '';
        for (const [date, dayTests] of groups) {
            const c   = dayTests.filter(t => t.correct).length;
            const pct = Math.round(c / dayTests.length * 100);
            const passColor = pct >= 70 ? '#28a745' : '#dc3545';
            const gid = `day-${date}`;

            html += `
                <div class="day-group-header" data-gid="${gid}"
                     style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;border:1px solid #eee;border-radius:6px;margin-bottom:2px;cursor:pointer;user-select:none;background:#fafafa">
                    <span style="font-size:0.85rem;font-weight:600;color:#444">${formatDate(date)}</span>
                    <span style="font-size:0.82rem;color:#888">${dayTests.length} tests &nbsp;·&nbsp; <span style="color:${passColor};font-weight:600">${pct}% pass</span></span>
                    <span class="day-chevron" style="font-size:0.7rem;color:#aaa;margin-left:0.5rem">▸</span>
                </div>
                <div id="${gid}" style="display:none;margin-bottom:0.5rem;overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:320px">
                        <thead>
                            <tr style="color:#aaa;font-size:0.78rem;text-align:left;border-bottom:2px solid #eee">
                                <th style="padding:5px 8px;font-weight:500">Word</th>
                                <th style="padding:5px 8px;font-weight:500">Type</th>
                                <th style="padding:5px 8px;font-weight:500">Result</th>
                                <th style="padding:5px 8px;font-weight:500">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dayTests.map(testRow).join('')}
                        </tbody>
                    </table>
                </div>`;
        }

        container.innerHTML = html;

        container.querySelectorAll('.day-group-header').forEach(header => {
            header.addEventListener('click', () => {
                const body    = document.getElementById(header.dataset.gid);
                const chevron = header.querySelector('.day-chevron');
                const open    = body.style.display !== 'none';
                body.style.display  = open ? 'none' : 'block';
                chevron.textContent = open ? '▸' : '▾';
            });
        });
    }

    function testRow(t) {
        const typeLabel = { meaning: '📖 Meaning', spelling: '✍️ Spelling', listening: '🔊 Listening' }[t.test_type] ?? t.test_type;
        const result    = t.correct
            ? '<span style="color:#28a745;font-weight:500">✅ Correct</span>'
            : '<span style="color:#dc3545;font-weight:500">❌ Wrong</span>';
        const time = new Date(t.tested_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `
            <tr style="border-bottom:1px solid #f5f5f5">
                <td style="padding:5px 8px;font-weight:500">${esc(t.words?.word ?? '—')}</td>
                <td style="padding:5px 8px;color:#555">${typeLabel}</td>
                <td style="padding:5px 8px">${result}</td>
                <td style="padding:5px 8px;color:#aaa;white-space:nowrap">${time}</td>
            </tr>`;
    }

    document.querySelectorAll('.leaderboard-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.dataset.id === activeLearner) return;
            activeLearner = btn.dataset.id;
            document.querySelectorAll('.leaderboard-tab').forEach(b => b.classList.toggle('active', b.dataset.id === activeLearner));
            await loadActivity(activeLearner);
        });
    });

    document.getElementById('typeFilter').addEventListener('change',  () => loadActivity(activeLearner));
    document.getElementById('rangeFilter').addEventListener('change', () => loadActivity(activeLearner));

    await loadActivity(activeLearner);
}

function formatDate(dateStr) {
    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yestStr  = new Date(today - 86400000).toISOString().split('T')[0];
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yestStr)  return 'Yesterday';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(y === today.getFullYear() ? {} : { year: 'numeric' }) });
}

function esc(str) {
    return String(str ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
