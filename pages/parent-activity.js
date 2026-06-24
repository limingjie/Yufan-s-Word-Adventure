import { supabase } from '../js/supabase.js';
import { loadLearnersSorted } from '../js/lib/parent-stats.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    // Sorted by XP (then words) descending, consistent with the rest of the parent pages.
    const learners = await loadLearnersSorted();

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
            </div>
            <div class="leaderboard-tabs" style="margin-bottom:1rem">${tabsHTML}</div>
            <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center">
                <select id="typeFilter" style="font-size:0.85rem;padding:6px 10px;border:1px solid #dee2e6;border-radius:6px;height:36px">
                    <option value="">All types</option>
                    <option value="meaning">📖 Meaning</option>
                    <option value="spelling">✍️ Spelling</option>
                    <option value="listening">🔊 Listening</option>
                    <option value="review">🔁 Review</option>
                </select>
                <select id="rangeFilter" style="font-size:0.85rem;padding:6px 10px;border:1px solid #dee2e6;border-radius:6px;height:36px">
                    <option value="30">Last 30 days</option>
                    <option value="7">Last 7 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="0">All time</option>
                </select>
            </div>
            <div class="card" style="padding:0.85rem;margin-bottom:1rem">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
                    <button id="calPrev" class="btn btn-secondary btn-sm" style="min-width:36px">‹</button>
                    <span id="calTitle" style="font-weight:600;font-size:0.9rem"></span>
                    <button id="calNext" class="btn btn-secondary btn-sm" style="min-width:36px">›</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;font-size:0.7rem;text-align:center;margin-bottom:4px;color:#888">
                    <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
                </div>
                <div id="calGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px"></div>
                <div style="display:flex;gap:1.25rem;margin-top:0.5rem;font-size:0.72rem;color:#666">
                    <span><span style="color:#007bff;font-weight:600">+</span> Words added</span>
                    <span><span style="color:#28a745;font-weight:600">✓</span> Tests done</span>
                </div>
            </div>
            <div id="activitySummary" style="margin-bottom:1rem"></div>
            <div id="activityLog"></div>
        </div>`;

    let calYear  = new Date().getFullYear();
    let calMonth = new Date().getMonth();
    let calAdded = {};
    let calTests = {};

    async function renderCalendar(learnerId) {
        document.getElementById('calTitle').textContent = new Date(calYear, calMonth, 1)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const start = new Date(calYear, calMonth, 1).toISOString();
        const end   = new Date(calYear, calMonth + 1, 1).toISOString();

        const [wordsRes, testsRes] = await Promise.all([
            supabase.from('words').select('created_at').eq('user_id', learnerId).is('deleted_at', null).gte('created_at', start).lt('created_at', end),
            supabase.from('test_results').select('tested_at').eq('user_id', learnerId).gte('tested_at', start).lt('tested_at', end),
        ]);

        calAdded = {};
        calTests = {};
        for (const w of wordsRes.data || []) { const d = localYMD(new Date(w.created_at)); calAdded[d] = (calAdded[d] || 0) + 1; }
        for (const t of testsRes.data || []) { const d = localYMD(new Date(t.tested_at));  calTests[d] = (calTests[d] || 0) + 1; }

        const today        = localYMD(new Date());
        const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
        const firstWeekday = new Date(calYear, calMonth, 1).getDay();
        const mm           = String(calMonth + 1).padStart(2, '0');

        let html = '<div></div>'.repeat(firstWeekday);
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${calYear}-${mm}-${String(d).padStart(2, '0')}`;
            html += buildCalDay(ds, d, ds === today, calAdded[ds] || 0, calTests[ds] || 0);
        }
        document.getElementById('calGrid').innerHTML = html;
    }

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

        const [{ data }] = await Promise.all([
            query.limit(1000),
            renderCalendar(learnerId),
        ]);
        const tests = data || [];

        renderSummary(document.getElementById('activitySummary'), tests);
        renderLog(document.getElementById('activityLog'), tests);
    }

    function renderSummary(container, tests) {
        const total   = tests.length;
        const correct = tests.filter(t => t.correct).length;
        const pct     = total > 0 ? Math.round(correct / total * 100) : 0;
        const today   = localYMD(new Date());
        const todayTests   = tests.filter(t => localYMD(new Date(t.tested_at)) === today);
        const todayCorrect = todayTests.filter(t => t.correct).length;
        const todayPct     = todayTests.length > 0 ? Math.round(todayCorrect / todayTests.length * 100) : null;

        const byType = {};
        for (const t of tests) {
            if (!byType[t.test_type]) byType[t.test_type] = { total: 0, correct: 0 };
            byType[t.test_type].total++;
            if (t.correct) byType[t.test_type].correct++;
        }

        const typeIcons  = { meaning: '📖', spelling: '✍️', listening: '🔊', review: '🔁' };
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
            const date = localYMD(new Date(t.tested_at));
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
        const typeLabel = { meaning: '📖 Meaning', spelling: '✍️ Spelling', listening: '🔊 Listening', review: '🔁 Review' }[t.test_type] ?? t.test_type;
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

    document.getElementById('calPrev').addEventListener('click', () => {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        renderCalendar(activeLearner);
    });
    document.getElementById('calNext').addEventListener('click', () => {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar(activeLearner);
    });

    document.getElementById('calGrid').addEventListener('click', (e) => {
        const cell = e.target.closest('[data-date]');
        if (!cell) return;
        const date = cell.dataset.date;
        if (!calAdded[date] && !calTests[date]) return;
        const body = document.getElementById(`day-${date}`);
        if (!body) return;
        if (body.style.display === 'none') {
            body.style.display = 'block';
            const header = document.querySelector(`[data-gid="day-${date}"]`);
            if (header) {
                const chevron = header.querySelector('.day-chevron');
                if (chevron) chevron.textContent = '▾';
            }
        }
        body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.querySelectorAll('.leaderboard-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.dataset.id === activeLearner) return;
            activeLearner = btn.dataset.id;
            calYear  = new Date().getFullYear();
            calMonth = new Date().getMonth();
            document.querySelectorAll('.leaderboard-tab').forEach(b => b.classList.toggle('active', b.dataset.id === activeLearner));
            await loadActivity(activeLearner);
        });
    });

    document.getElementById('typeFilter').addEventListener('change',  () => loadActivity(activeLearner));
    document.getElementById('rangeFilter').addEventListener('change', () => loadActivity(activeLearner));

    await loadActivity(activeLearner);
}

function buildCalDay(ds, d, isToday, nAdded, nTests) {
    const hasData = nAdded > 0 || nTests > 0;
    const border  = isToday ? '#007bff' : '#e8e8e8';
    const bg      = isToday ? '#f0f6ff' : hasData ? '#fafff9' : '#fff';
    const cursor  = hasData ? 'pointer' : 'default';
    const weight  = isToday ? '700' : '400';
    const color   = isToday ? '#007bff' : '#444';
    const addedHtml    = nAdded > 0 ? `<div style="font-size:0.6rem;color:#007bff;line-height:1.2">+${nAdded}</div>` : '';
    const reviewedHtml = nTests > 0 ? `<div style="font-size:0.6rem;color:#28a745;line-height:1.2">${nTests}</div>` : '';
    return `<div data-date="${ds}" style="min-height:44px;border:1px solid ${border};border-radius:5px;padding:3px 4px;background:${bg};cursor:${cursor}"><div style="font-size:0.7rem;font-weight:${weight};color:${color}">${d}</div>${addedHtml}${reviewedHtml}</div>`;
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
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(y === today.getFullYear() ? {} : { year: 'numeric' }) });
}

function esc(str) {
    return String(str ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
