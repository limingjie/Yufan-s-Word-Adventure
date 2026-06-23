import { getCurrentProfile, getCurrentUser } from '../js/auth.js';
import { getUserXP, getUserStreak, getWordsForReviewToday, getWordsCount, getDailyProgress } from '../js/db.js';
import { getLevelInfo, getLevelProgress } from '../js/lib/xp.js';
import { supabase } from '../js/supabase.js';

// Daily mission targets
const MISSION_WORDS    = 15;
const MISSION_REVIEWS  = 15;
const MISSION_ACCURACY = 90;   // percent, minimum 5 tests

// Word count milestones → medals
const GOALS = [
    { target: 15,  medal: '🥉', label: 'Bronze' },
    { target: 50,  medal: '🥈', label: 'Silver' },
    { target: 100, medal: '🥇', label: 'Gold'   },
];

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const [profile, user, xpData, streak, dueWords, totalWords, daily] = await Promise.all([
        getCurrentProfile(),
        getCurrentUser(),
        getUserXP(),
        getUserStreak(),
        getWordsForReviewToday(),
        getWordsCount(),
        getDailyProgress(),
    ]);

    const { xp }    = xpData;
    const levelInfo = getLevelInfo(xp);
    const progress  = getLevelProgress(xp);
    const dueCount  = dueWords.length;
    const initial   = (profile?.display_name || '?')[0].toUpperCase();
    const color     = profile?.avatar_color || '#007BFF';

    // Daily mission progress
    const mWordsAcc  = Math.min(daily.wordsAdded, MISSION_WORDS);
    const mReviewAcc = Math.min(daily.reviewed,   MISSION_REVIEWS);

    // Quiz coverage: % of today's added words that have been correctly quizzed.
    // Adding new words without quizzing them lowers this score until you catch up.
    const quizCoverage = daily.quizCoverage ?? 100;
    const quizSubtitle = daily.wordsAdded === 0
        ? 'Add words today to unlock this mission'
        : quizCoverage + '% of today\'s words quizzed correctly (need ' + MISSION_ACCURACY + '%)';

    const mWordsDone  = daily.wordsAdded >= MISSION_WORDS;
    const mReviewDone = daily.reviewed   >= MISSION_REVIEWS;
    const mQuizDone   = daily.wordsAdded === 0 || quizCoverage >= MISSION_ACCURACY;
    const allMissions = mWordsDone && mReviewDone && mQuizDone;

    // Focus CTA
    let focusHtml;
    if (dueCount > 0) {
        focusHtml = `
            <div style="background:linear-gradient(135deg,#007bff,#6610f2);border-radius:16px;padding:1.25rem 1.5rem;color:#fff;margin-bottom:1.25rem;text-align:center">
                <div style="font-size:2rem;margin-bottom:0.25rem">💧</div>
                <div style="font-size:1.1rem;font-weight:700;margin-bottom:0.9rem">
                    ${dueCount} ${dueCount === 1 ? 'word is' : 'words are'} ready to review!
                </div>
                <a href="#/learner/review" class="btn btn-primary"
                   style="background:#fff;color:#007bff;font-size:1.05rem;padding:0.7rem 2rem;width:100%;display:block;max-width:280px;margin:0 auto;font-weight:700">
                    Start Review 🚀
                </a>
            </div>`;
    } else if (totalWords === 0) {
        focusHtml = `
            <div style="background:linear-gradient(135deg,#52c41a,#87d068);border-radius:16px;padding:1.25rem 1.5rem;color:#fff;margin-bottom:1.25rem;text-align:center">
                <div style="font-size:2rem;margin-bottom:0.25rem">🌱</div>
                <div style="font-size:1.05rem;font-weight:700;margin-bottom:0.9rem">
                    Start your Word Adventure!
                </div>
                <button id="focusAddWordBtn" class="btn"
                        style="background:#fff;color:#52c41a;font-size:1.05rem;padding:0.7rem 2rem;width:100%;max-width:280px;font-weight:700">
                    Add Your First Word ✨
                </button>
            </div>`;
    } else {
        focusHtml = `
            <div style="background:linear-gradient(135deg,#52c41a,#87d068);border-radius:16px;padding:1.25rem 1.5rem;color:#fff;margin-bottom:1.25rem;text-align:center">
                <div style="font-size:2rem;margin-bottom:0.25rem">🌟</div>
                <div style="font-size:1.05rem;font-weight:700;margin-bottom:0.9rem">
                    All caught up! Keep adding words.
                </div>
                <button id="focusAddWordBtn" class="btn"
                        style="background:#fff;color:#52c41a;font-size:1.05rem;padding:0.7rem 2rem;width:100%;max-width:280px;font-weight:700">
                    + Add New Word
                </button>
            </div>`;
    }

    // Daily missions HTML
    function missionHtml(icon, title, current, target, done, subtitleOverride) {
        const pct      = Math.min(100, Math.round((current / target) * 100));
        const subtitle = subtitleOverride || `${current} / ${target}`;
        return `
            <div class="mission-card ${done ? 'complete' : ''}">
                <div class="mission-icon">${icon}</div>
                <div class="mission-info">
                    <div class="mission-title">${title}</div>
                    <div style="font-size:0.78rem;color:#888;margin-bottom:3px">${subtitle}</div>
                    <div class="mission-bar-wrap">
                        <div class="mission-bar-fill" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="mission-reward">${done ? '✅' : '🥇'}</div>
            </div>`;
    }

    // Word count goals
    const goalsHtml = GOALS.map(g => {
        const achieved = totalWords >= g.target;
        return `
            <div class="word-goal ${achieved ? 'achieved' : ''}">
                <div class="goal-medal">${g.medal}</div>
                <div class="goal-label">${g.label}</div>
                <div class="goal-target">${g.target} words</div>
            </div>`;
    }).join('');

    const xpLabel = levelInfo.next ? `${xp} / ${levelInfo.next.minXP} XP` : `${xp} XP — Max!`;

    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto">

            <!-- Greeting -->
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.1rem">
                <div class="avatar" style="background:${color};width:46px;height:46px;font-size:1.2rem;flex-shrink:0">${initial}</div>
                <div>
                    <div style="font-size:1.25rem;font-weight:700">Hello, ${esc(profile?.display_name)}! 👋</div>
                    <span class="level-badge" style="font-size:0.8rem">Lv.${levelInfo.level} ${levelInfo.name}</span>
                </div>
                ${streak >= 2 ? `<div style="margin-left:auto;font-size:0.85rem;color:#ff7d00;font-weight:700">🔥 ${streak} days</div>` : ''}
            </div>

            <!-- Focus CTA -->
            ${focusHtml}

            <!-- Daily Missions -->
            <div style="margin-bottom:1.1rem">
                <div style="font-size:0.78rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.5rem">
                    Today's Missions ${allMissions ? '🎉' : ''}
                </div>
                ${missionHtml('📚', 'Add 15 new words', mWordsAcc, MISSION_WORDS, mWordsDone)}
                ${missionHtml('💧', 'Review 15 words', mReviewAcc, MISSION_REVIEWS, mReviewDone)}
                ${missionHtml('🎯', 'Quiz master (90% coverage)', quizCoverage, MISSION_ACCURACY, mQuizDone, quizSubtitle)}
            </div>

            <!-- Word count goals -->
            <div style="margin-bottom:1.1rem">
                <div style="font-size:0.78rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.6rem">
                    Word Collection Goals
                </div>
                <div class="word-goals">${goalsHtml}</div>
                <div style="text-align:center;font-size:0.82rem;color:#888">${totalWords} words in your collection</div>
            </div>

            <!-- XP bar -->
            <div class="card" style="margin-bottom:1rem;padding:0.75rem 1rem">
                <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#666;margin-bottom:5px">
                    <span>${xpLabel}</span><span>${progress}%</span>
                </div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" style="width:${progress}%"></div>
                </div>
            </div>

            <!-- Quick nav -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.6rem;margin-bottom:1.25rem">
                <a href="#/learner/quiz"        class="btn btn-secondary" style="text-align:center;font-size:0.85rem;padding:0.65rem">📝 Quiz</a>
                <a href="#/learner/garden"      class="btn btn-secondary" style="text-align:center;font-size:0.85rem;padding:0.65rem">🌱 Garden</a>
                <a href="#/learner/achievements" class="btn btn-secondary" style="text-align:center;font-size:0.85rem;padding:0.65rem">🏅 Awards</a>
            </div>

            <!-- Calendar (collapsible) -->
            <div style="border-top:1px solid #eee;padding-top:1rem">
                <button id="calToggleBtn" style="background:none;border:none;cursor:pointer;font-size:0.82rem;color:#888;padding:0;display:flex;align-items:center;gap:0.35rem;margin-bottom:0.6rem">
                    <span id="calChevron">▸</span> Activity Calendar
                </button>
                <div id="calSection" style="display:none">
                    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.6rem">
                        <button id="calPrev" class="btn btn-secondary btn-sm">←</button>
                        <span id="calTitle" style="flex:1;text-align:center;font-weight:600;font-size:0.88rem"></span>
                        <button id="calNext" class="btn btn-secondary btn-sm">→</button>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;margin-bottom:2px">
                        ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d =>
                            `<div style="font-size:0.65rem;color:#aaa;padding:2px 0">${d}</div>`
                        ).join('')}
                    </div>
                    <div id="calGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
                    <div style="display:flex;gap:1rem;margin-top:0.5rem;font-size:0.7rem;color:#888">
                        <span><span style="display:inline-block;width:7px;height:7px;background:#007bff;border-radius:2px;margin-right:3px;vertical-align:middle"></span>Added</span>
                        <span><span style="display:inline-block;width:7px;height:7px;background:#28a745;border-radius:2px;margin-right:3px;vertical-align:middle"></span>Tests</span>
                    </div>
                </div>
            </div>
        </div>`;

    // Focus CTA buttons (add-word variants)
    document.getElementById('focusAddWordBtn')?.addEventListener('click', () => {
        sessionStorage.setItem('openAddDrawer', 'true');
        location.hash = '#/learner/words';
    });

    // Calendar toggle
    document.getElementById('calToggleBtn').addEventListener('click', () => {
        const section = document.getElementById('calSection');
        const chevron = document.getElementById('calChevron');
        const open = section.style.display === 'none';
        section.style.display = open ? 'block' : 'none';
        chevron.textContent   = open ? '▾' : '▸';
        if (open && !calRendered) { calRendered = true; renderCalendar(); }
    });

    // Calendar
    let calYear     = new Date().getFullYear();
    let calMonth    = new Date().getMonth();
    let calAdded    = {};
    let calReviewed = {};
    let calRendered = false;

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

        const start = new Date(calYear, calMonth, 1).toISOString();
        const end   = new Date(calYear, calMonth + 1, 1).toISOString();

        const [wordsRes, testsRes] = await Promise.all([
            supabase.from('words').select('created_at').eq('user_id', user.id).gte('created_at', start).lt('created_at', end),
            supabase.from('test_results').select('tested_at').eq('user_id', user.id).gte('tested_at', start).lt('tested_at', end),
        ]);

        calAdded    = {};
        calReviewed = {};
        for (const w of wordsRes.data  || []) { const d = localYMD(new Date(w.created_at)); calAdded[d]    = (calAdded[d]    || 0) + 1; }
        for (const t of testsRes.data  || []) { const d = localYMD(new Date(t.tested_at)); calReviewed[d] = (calReviewed[d] || 0) + 1; }

        const today        = localYMD(new Date());
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
    const addedHtml   = nAdded > 0 ? `<div style="font-size:0.6rem;color:#007bff;line-height:1.2">+${nAdded}</div>` : '';
    const reviewedHtml = nTests > 0 ? `<div style="font-size:0.6rem;color:#28a745;line-height:1.2">${nTests}</div>` : '';
    return `<div data-date="${ds}" style="min-height:48px;border:1px solid ${border};border-radius:5px;padding:3px 4px;background:${bg};cursor:${cursor}"><div style="font-size:0.7rem;font-weight:${weight};color:${color}">${d}</div>${addedHtml}${reviewedHtml}</div>`;
}

function localYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function esc(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
