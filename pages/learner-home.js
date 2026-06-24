import { getCurrentProfile, getCurrentUser, patchCurrentProfile } from '../js/auth.js';
import { getUserSunlight, getUserCoins, getUserStreak, getDailyProgress, updateAvatar, getBadgeCount } from '../js/db.js';
import { getRankInfo, getRankProgress } from '../js/lib/growth.js';
import { buildMissions, renderMissionList, allMissionsDone } from '../js/lib/missions.js';
import { showEarnHelp } from '../js/lib/help.js';
import { supabase } from '../js/supabase.js';

// Kid-friendly animal & plant quick-picks (18 — the picker also accepts any
// typed emoji or up to 2 letters). 5 per row → 4 tidy rows with the input +
// initial cells, no scrolling.
const AVATAR_EMOJIS = ['🦊','🐰','🐱','🐶','🐼','🐨','🦁','🐯','🐸','🐵','🦉','🦄','🌸','🌻','🌷','🌵','🍀','🌳'];

// Background palette (the picker also accepts any custom color). 9 → 2 rows of 5
// with the custom-color cell.
const AVATAR_COLORS = ['#007BFF','#FF6B6B','#FFA94D','#FFD43B','#51CF66','#20C997','#22B8CF','#845EF7','#F783AC'];

// GitHub-contribution green scale, keyed by words added that day
const CAL_SHADES = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const [profile, user, sunData, coins, streak, daily, badgeCount] = await Promise.all([
        getCurrentProfile(),
        getCurrentUser(),
        getUserSunlight(),
        getUserCoins(),
        getUserStreak(),
        getDailyProgress(),
        getBadgeCount(),
    ]);

    const { sun }   = sunData;
    const rankInfo  = getRankInfo(sun);
    const progress  = getRankProgress(sun);
    const initial   = (profile?.display_name || '?')[0].toUpperCase();
    const color     = profile?.avatar_color || '#007BFF';
    const avatarFace = profile?.avatar_emoji || initial;

    const missions = buildMissions(daily);
    const allDone  = allMissionsDone(missions);

    const sunChip = rankInfo.next
        ? `☀️ ${sun} / ${rankInfo.next.minSun}`
        : `☀️ ${sun} · Max!`;

    container.innerHTML = `
        <div style="max-width:600px;margin:0 auto">

            <!-- Compact header -->
            <div class="home-header">
                <button id="avatarBtn" class="avatar avatar-btn${profile?.avatar_emoji ? ' avatar-emoji' : ''}"
                        style="background:${color}" title="Change avatar">${avatarFace}</button>
                <div class="home-id">
                    <div class="home-name">Hello, ${esc(profile?.display_name)}! 👋</div>
                    <div class="home-meta">
                        <span class="level-badge" style="font-size:0.78rem">${rankInfo.emoji} ${rankInfo.name}</span>
                        <span class="xp-chip">${sunChip}</span>
                        <span class="coin-chip" title="Coins to spend in the Garden">🪙 ${coins.balance}</span>
                        <a href="#/learner/achievements" class="medal-chip" title="See your medals & badges">🏅 ${badgeCount}</a>
                    </div>
                    <div class="xp-mini-wrap"><div class="xp-mini-fill" style="width:${progress}%"></div></div>
                </div>
                <div class="home-actions">
                    ${streak >= 2 ? `<span class="streak-chip">🔥 ${streak}</span>` : ''}
                    <button id="earnHelpBtn" class="help-btn" title="How are Sunlight & Coins earned?">?</button>
                </div>
            </div>

            <!-- Activity calendar (GitHub contribution graph) -->
            <div class="cal-card">
                <div class="ghcal">
                    <div class="ghcal-scroll">
                        <div class="ghcal-inner">
                            <div id="calMonths" class="ghcal-months"></div>
                            <div class="ghcal-body">
                                <div class="ghcal-week-labels">
                                    <span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span>
                                </div>
                                <div id="calGrid" class="ghcal-grid"></div>
                            </div>
                        </div>
                    </div>
                    <div class="cal-legend">
                        <span>Less</span>
                        ${CAL_SHADES.map(c => `<span class="cal-swatch" style="background:${c}"></span>`).join('')}
                        <span>More</span>
                    </div>
                </div>
            </div>

            <!-- Daily missions -->
            <div style="margin:1.1rem 0">
                <div class="section-label">Today's Missions ${allDone ? '🎉' : ''}</div>
                ${allDone ? `<div class="all-done-banner">🎉 All missions complete — amazing work!</div>` : ''}
                ${renderMissionList(missions)}
            </div>
        </div>`;

    // ---- Mission actions (locked cards are non-interactive divs and skipped) ----
    const MISSION_ACTIONS = {
        add:        () => { sessionStorage.setItem('openAddDrawer', 'true'); location.hash = '#/learner/words'; },
        reviewNew:  () => { sessionStorage.setItem('reviewScope', 'new');     location.hash = '#/learner/review'; },
        meaning:    () => { sessionStorage.setItem('quizMode', 'meaning');    location.hash = '#/learner/quiz'; },
        spelling:   () => { sessionStorage.setItem('quizMode', 'spelling');   location.hash = '#/learner/quiz'; },
        reviewCurve:() => { sessionStorage.setItem('reviewScope', 'curve');   location.hash = '#/learner/review'; },
    };
    container.querySelectorAll('button.mission-card').forEach(card => {
        card.addEventListener('click', () => MISSION_ACTIONS[card.dataset.key]?.());
    });

    // ---- Earn help ----
    document.getElementById('earnHelpBtn').addEventListener('click', showEarnHelp);

    // ---- Avatar picker (emoji + background color) ----
    document.getElementById('avatarBtn').addEventListener('click', () => openAvatarPicker());

    function openAvatarPicker() {
        let selEmoji = profile?.avatar_emoji || '';   // '' = use initial
        let selColor = profile?.avatar_color || color;
        // The custom-emoji input only holds a value the quick-picks don't cover.
        const customStart = selEmoji && !AVATAR_EMOJIS.includes(selEmoji) ? selEmoji : '';

        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.innerHTML = `
            <div class="modal-content avatar-modal" style="max-width:360px">
                <div class="modal-header">
                    <h2 style="font-size:1.2rem">Choose your avatar</h2>
                    <button class="modal-close" id="avatarClose">✕</button>
                </div>

                <!-- Preview + confirm -->
                <div class="avatar-preview-row">
                    <div id="avatarPreview" class="avatar avatar-preview"></div>
                    <button class="btn btn-primary" id="avatarSave">Confirm</button>
                </div>

                <!-- Avatar grid: custom input + initial + animal/plant quick-picks -->
                <div class="avatar-section-label">Avatar</div>
                <div class="avatar-grid">
                    <input type="text" id="avatarInput" class="cell-box avatar-input" maxlength="2"
                           inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off"
                           spellcheck="false" value="${esc(customStart)}">
                    <button class="cell-box emoji-option emoji-initial" data-emoji="">${initial}</button>
                    ${AVATAR_EMOJIS.map(e => `<button class="cell-box emoji-option" data-emoji="${e}">${e}</button>`).join('')}
                </div>

                <!-- Background grid: custom color + palette -->
                <div class="avatar-section-label">Background color</div>
                <div class="color-grid">
                    <label class="cell-box color-input-cell">
                        <input type="color" id="avatarColor" value="${selColor}">
                    </label>
                    ${AVATAR_COLORS.map(c => `<button class="cell-box color-swatch" data-color="${c}" style="background:${c}"></button>`).join('')}
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const preview    = overlay.querySelector('#avatarPreview');
        const colorInput = overlay.querySelector('#avatarColor');
        const emojiInput = overlay.querySelector('#avatarInput');

        function syncPreview() {
            preview.textContent = selEmoji || initial;
            preview.style.background = selColor;
            preview.classList.toggle('avatar-emoji', !!selEmoji);

            const isCustom = !!selEmoji && !AVATAR_EMOJIS.includes(selEmoji);
            emojiInput.classList.toggle('selected', isCustom);
            overlay.querySelectorAll('.emoji-option').forEach(b =>
                b.classList.toggle('selected', b.dataset.emoji === selEmoji && !isCustom));
            overlay.querySelectorAll('.color-swatch').forEach(b =>
                b.classList.toggle('selected', b.dataset.color.toLowerCase() === selColor.toLowerCase()));
        }
        syncPreview();

        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#avatarClose').addEventListener('click', close);

        colorInput.addEventListener('input', () => { selColor = colorInput.value; syncPreview(); });
        emojiInput.addEventListener('input', () => { selEmoji = emojiInput.value.trim(); syncPreview(); });
        overlay.querySelectorAll('.emoji-option').forEach(b =>
            b.addEventListener('click', () => { selEmoji = b.dataset.emoji; emojiInput.value = ''; syncPreview(); }));
        overlay.querySelectorAll('.color-swatch').forEach(b =>
            b.addEventListener('click', () => { selColor = b.dataset.color; colorInput.value = selColor; syncPreview(); }));

        overlay.querySelector('#avatarSave').addEventListener('click', async () => {
            const emoji = selEmoji || null;
            const btn = document.getElementById('avatarBtn');
            btn.textContent = emoji || initial;
            btn.style.background = selColor;
            btn.classList.toggle('avatar-emoji', !!emoji);
            close();
            try {
                await updateAvatar(emoji, selColor);
                patchCurrentProfile({ avatar_emoji: emoji, avatar_color: selColor });
                if (profile) { profile.avatar_emoji = emoji; profile.avatar_color = selColor; }
            } catch (err) {
                console.error('Failed to save avatar:', err);
            }
        });
    }

    // ---- Calendar (GitHub contribution graph: weeks = columns, days = rows) ----
    let calAdded    = {};
    let calReviewed = {};

    document.getElementById('calGrid').addEventListener('click', (e) => {
        const cell = e.target.closest('[data-date]');
        if (cell && (calAdded[cell.dataset.date] || calReviewed[cell.dataset.date])) {
            sessionStorage.setItem('wordDateFilter', cell.dataset.date);
            location.hash = '#/learner/words';
        }
    });

    // Squares stay a fixed size; instead we show only as many weeks as fit the
    // current width and re-render on resize. lastWeeks guards against redundant
    // rebuilds (and ResizeObserver feedback loops from our own height changes).
    let lastWeeks = -1;

    function weeksThatFit() {
        const ghcal  = container.querySelector('.ghcal');
        const cs     = getComputedStyle(ghcal);
        const cell   = Number.parseFloat(cs.getPropertyValue('--ghc')) || 14;
        const gap    = Number.parseFloat(cs.getPropertyValue('--ghg')) || 3;
        const labelW = Number.parseFloat(cs.getPropertyValue('--ghw')) || 22;
        const labels = container.querySelector('.ghcal-week-labels');
        const labelsShown = labels && labels.offsetParent !== null;

        const avail = ghcal.clientWidth - (labelsShown ? labelW + gap : 0);
        const n = Math.floor((avail + gap) / (cell + gap));
        return Math.max(6, Math.min(53, n));   // 6 weeks min, ~1 year max
    }

    async function renderCalendar() {
        const numWeeks = weeksThatFit();
        if (numWeeks === lastWeeks) return;     // width unchanged → nothing to rebuild
        lastWeeks = numWeeks;

        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());  // today, local midnight
        const start = new Date(end);
        start.setDate(start.getDate() - end.getDay());          // Sunday of the current week
        start.setDate(start.getDate() - (numWeeks - 1) * 7);    // …then back numWeeks-1 weeks

        const [wordsRes, testsRes] = await Promise.all([
            supabase.from('words').select('created_at').eq('user_id', user.id).gte('created_at', start.toISOString()),
            supabase.from('test_results').select('tested_at').eq('user_id', user.id).gte('tested_at', start.toISOString()),
        ]);

        calAdded    = {};
        calReviewed = {};
        for (const w of wordsRes.data || []) { const d = localYMD(new Date(w.created_at)); calAdded[d]    = (calAdded[d]    || 0) + 1; }
        for (const t of testsRes.data || []) { const d = localYMD(new Date(t.tested_at)); calReviewed[d] = (calReviewed[d] || 0) + 1; }

        const todayYMD = localYMD(end);
        const cells  = [];
        const months = [];
        let lastMonth = -1;

        const cur = new Date(start);
        while (cur <= end) {
            if (cur.getDay() === 0) {   // new column starts on Sunday → emit a month label slot
                const m = cur.getMonth();
                months.push(m === lastMonth ? '' : cur.toLocaleDateString('en-US', { month: 'short' }));
                lastMonth = m;
            }
            const ds = localYMD(cur);
            cells.push(buildCell(ds, ds === todayYMD, calAdded[ds] || 0, calReviewed[ds] || 0));
            cur.setDate(cur.getDate() + 1);
        }

        document.getElementById('calGrid').innerHTML = cells.join('');
        document.getElementById('calMonths').innerHTML =
            months.map(m => `<div class="ghcal-month">${m}</div>`).join('');
    }

    // Re-fit on resize. The observer targets this render's .ghcal node, so it
    // stops mattering once the node is replaced on navigation.
    new ResizeObserver(() => renderCalendar()).observe(container.querySelector('.ghcal'));
}

function shadeIndex(nAdded) {
    if (nAdded <= 0)  return 0;
    if (nAdded <= 3)  return 1;
    if (nAdded <= 9)  return 2;
    if (nAdded <= 14) return 3;
    return 4;
}

function buildCell(ds, isToday, nAdded, nTests) {
    const bg      = CAL_SHADES[shadeIndex(nAdded)];
    const hasData = nAdded > 0 || nTests > 0;
    const cursor  = hasData ? 'pointer' : 'default';

    const dateLabel = new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const wordPart  = `${nAdded} word${nAdded === 1 ? '' : 's'} added`;
    const testPart  = `${nTests} test${nTests === 1 ? '' : 's'}`;
    const tip = hasData ? `${wordPart} · ${testPart} on ${dateLabel}` : `No activity on ${dateLabel}`;

    return `<div class="ghcal-cell${isToday ? ' today' : ''}" data-date="${ds}" title="${tip}" style="background:${bg};cursor:${cursor}"></div>`;
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
