import { getCurrentProfile, getCurrentUser } from '../js/auth.js';
import { getUserXP, getUserStreak, getMasteredCount, getWordsForReviewToday, getWordsCount } from '../js/db.js';
import { getLevelInfo, getLevelProgress } from '../js/lib/xp.js';
import { supabase } from '../js/supabase.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const [profile, user, xpData, streak, dueWords, totalWords, mastered] = await Promise.all([
        getCurrentProfile(),
        getCurrentUser(),
        getUserXP(),
        getUserStreak(),
        getWordsForReviewToday(),
        getWordsCount(),
        getMasteredCount(),
    ]);

    const { xp } = xpData;
    const levelInfo = getLevelInfo(xp);
    const progress  = getLevelProgress(xp);
    const dueCount  = dueWords.length;
    const initial   = (profile?.display_name || '?')[0].toUpperCase();
    const color     = profile?.avatar_color || '#007BFF';
    const xpLabel   = levelInfo.next ? `${xp} / ${levelInfo.next.minXP} XP` : `${xp} XP — Max level!`;

    container.innerHTML = `
        <div style="max-width:640px;margin:0 auto">

            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
                <div class="avatar" style="background:${color};width:52px;height:52px;font-size:1.3rem">${initial}</div>
                <div>
                    <h1 style="font-size:1.5rem;margin:0">Hello, ${profile?.display_name}!</h1>
                    <span class="level-badge" style="margin-top:4px;display:inline-flex">
                        Lv.${levelInfo.level} ${levelInfo.name}
                    </span>
                </div>
            </div>

            <div class="card" style="margin-bottom:1.25rem">
                <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#666;margin-bottom:6px">
                    <span>${xpLabel}</span><span>${progress}%</span>
                </div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" style="width:${progress}%"></div>
                </div>
            </div>

            <div class="stat-cards">
                <div class="stat-card">
                    <div class="stat-icon">🔥</div>
                    <div class="stat-value">${streak}</div>
                    <div class="stat-label">Day Streak</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📚</div>
                    <div class="stat-value">${totalWords}</div>
                    <div class="stat-label">Words Added</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-value">${mastered}</div>
                    <div class="stat-label">Mastered</div>
                </div>
                <div class="stat-card" style="${dueCount > 0 ? 'border:2px solid #dc3545' : ''}">
                    <div class="stat-icon">📝</div>
                    <div class="stat-value" style="${dueCount > 0 ? 'color:#dc3545' : ''}">${dueCount}</div>
                    <div class="stat-label">Due Today</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem">
                <a href="#/learner/review" class="btn btn-primary" style="text-align:center;padding:0.85rem">
                    ${dueCount > 0 ? `Review (${dueCount})` : 'Review'}
                </a>
                <button id="addWordBtn" class="btn btn-success" style="padding:0.85rem">+ Add Word</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1.5rem">
                <a href="#/learner/quiz"        class="btn btn-secondary" style="text-align:center;font-size:0.85rem">Quiz</a>
                <a href="#/learner/garden"      class="btn btn-secondary" style="text-align:center;font-size:0.85rem">Garden</a>
                <a href="#/learner/leaderboard" class="btn btn-secondary" style="text-align:center;font-size:0.85rem">Leaderboard</a>
            </div>

            ${dueCount === 0 && totalWords === 0 ? `
            <div class="empty-state" style="margin-top:1rem;margin-bottom:1.5rem">
                <span class="empty-icon">🌱</span>
                <h3>Start your adventure!</h3>
                <p>Add your first word to begin learning.</p>
            </div>` : ''}

            <!-- Calendar -->
            <div style="border-top:1px solid #eee;padding-top:1.25rem">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
                    <button id="calPrev" class="btn btn-secondary btn-sm">←</button>
                    <span id="calTitle" style="flex:1;text-align:center;font-weight:600;font-size:0.95rem"></span>
                    <button id="calNext" class="btn btn-secondary btn-sm">→</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;margin-bottom:2px">
                    ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d =>
                        `<div style="font-size:0.7rem;color:#aaa;padding:2px 0">${d}</div>`
                    ).join('')}
                </div>
                <div id="calGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
                <div style="display:flex;gap:1rem;margin-top:0.6rem;font-size:0.72rem;color:#888">
                    <span><span style="display:inline-block;width:8px;height:8px;background:#007bff;border-radius:2px;margin-right:3px;vertical-align:middle"></span>Added</span>
                    <span><span style="display:inline-block;width:8px;height:8px;background:#28a745;border-radius:2px;margin-right:3px;vertical-align:middle"></span>Tests</span>
                </div>
            </div>
        </div>`;

    // ── Add Word button (opens drawer on My Words page) ───────────────────────
    document.getElementById('addWordBtn').addEventListener('click', () => {
        sessionStorage.setItem('openAddDrawer', 'true');
        location.hash = '#/learner/words';
    });

    // ── Calendar ──────────────────────────────────────────────────────────────
    let calYear    = new Date().getFullYear();
    let calMonth   = new Date().getMonth();
    let calAdded   = {};
    let calReviewed = {};

    // Single delegated click handler (survives prev/next navigation)
    document.getElementById('calGrid').addEventListener('click', (e) => {
        const cell = e.target.closest('[data-date]');
        if (cell && (calAdded[cell.dataset.date] || calReviewed[cell.dataset.date])) {
            sessionStorage.setItem('wordDateFilter', cell.dataset.date);
            location.hash = '#/learner/words';
        }
    });

    async function renderCalendar() {
        const monthLabel = new Date(calYear, calMonth, 1)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        document.getElementById('calTitle').textContent = monthLabel;

        const start = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
        const end   = new Date(calYear, calMonth + 1, 1).toISOString().split('T')[0];

        const [wordsRes, testsRes] = await Promise.all([
            supabase.from('words').select('created_at').eq('user_id', user.id).gte('created_at', start).lt('created_at', end),
            supabase.from('test_results').select('tested_at').eq('user_id', user.id).gte('tested_at', start).lt('tested_at', end),
        ]);

        calAdded    = {};
        calReviewed = {};
        for (const w of wordsRes.data  || []) { const d = w.created_at.split('T')[0]; calAdded[d]    = (calAdded[d]    || 0) + 1; }
        for (const t of testsRes.data  || []) { const d = t.tested_at.split('T')[0];  calReviewed[d] = (calReviewed[d] || 0) + 1; }

        const today        = new Date().toISOString().split('T')[0];
        const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
        const firstWeekday = new Date(calYear, calMonth, 1).getDay();
        const mm           = String(calMonth + 1).padStart(2, '0');

        let html = '<div></div>'.repeat(firstWeekday);
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${calYear}-${mm}-${String(d).padStart(2, '0')}`;
            html += buildCalDay(ds, d, ds === today, calAdded[ds] || 0, calReviewed[ds] || 0);
        }

        document.getElementById('calGrid').innerHTML = html;
    }

    document.getElementById('calPrev').addEventListener('click', () => {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        renderCalendar();
    });
    document.getElementById('calNext').addEventListener('click', () => {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar();
    });

    renderCalendar();
}

function buildCalDay(ds, d, isToday, nAdded, nTests) {
    const hasData = nAdded > 0 || nTests > 0;
    const border  = isToday ? '#007bff' : '#e8e8e8';
    let bg = '#fff';
    if (isToday)    bg = '#f0f6ff';
    else if (hasData) bg = '#fafff9';
    const cursor  = hasData ? 'pointer' : 'default';
    const weight  = isToday ? '700' : '400';
    const color   = isToday ? '#007bff' : '#444';
    const addedHtml   = nAdded > 0 ? `<div style="font-size:0.65rem;color:#007bff;line-height:1.2">+${nAdded}</div>` : '';
    const reviewedHtml = nTests > 0 ? `<div style="font-size:0.65rem;color:#28a745;line-height:1.2">${nTests}</div>` : '';
    return `<div data-date="${ds}" style="min-height:52px;border:1px solid ${border};border-radius:5px;padding:3px 4px;background:${bg};cursor:${cursor}"><div style="font-size:0.72rem;font-weight:${weight};color:${color}">${d}</div>${addedHtml}${reviewedHtml}</div>`;
}
