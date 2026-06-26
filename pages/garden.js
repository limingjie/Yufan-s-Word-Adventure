import { getWordsWithSRS, getWordsForReviewToday, getUserSunlight, getUserCoins, getGardenItems, buyGardenItem, completeReview, recordTestResult,
         getGardenPlants, setPlantPosition, setPlantPositions, placeGardenItem, removeGardenItem } from '../js/db.js';
import { getRankInfo }   from '../js/lib/growth.js';
import { gardenStats }   from '../js/lib/garden.js';
import { srsLabel }      from '../js/lib/srs.js';
import { createGarden }  from '../js/lib/garden3d.js';
import { shopList, SHOP, isPlaceable } from '../js/lib/coins.js';
import { runAfterActivity } from '../js/lib/awards.js';
import { toast, celebrateEvents } from '../js/lib/celebrate.js';
import { showEarnHelp } from '../js/lib/help.js';
import { ensureStarted, stopMusic, toggle as toggleMusic, isOn as musicOn } from '../js/lib/audio.js';

const THEME_KEY = 'wordAdventureGardenTheme';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><p>Growing your garden…</p></div>`;

    const [words, dueRows, sunData, coins, items, plantRows] = await Promise.all([
        getWordsWithSRS(),
        getWordsForReviewToday(),
        getUserSunlight(),
        getUserCoins(),
        getGardenItems(),
        getGardenPlants(),
    ]);

    const dueIds   = new Set(dueRows.map(r => r.word_id));
    const wordById = new Map(words.map(w => [w.id, w]));
    const rank     = getRankInfo(sunData.sun);
    const owned    = new Set(items.map(i => i.item_code));
    const itemCounts = new Map();
    items.forEach(i => itemCounts.set(i.item_code, (itemCounts.get(i.item_code) || 0) + 1));
    let   balance  = coins.balance;
    let   activeTheme = initialTheme(owned);

    // Stored layout: plant positions + positioned ground items. Structures and
    // animals are passed even when col is null so the garden auto-assigns +
    // persists homes for them.
    const STRUCTURES = ['pond', 'fountain', 'cottage'];
    const isAnimal   = (code) => !!SHOP[code]?.animal;
    const isGround   = (code) => isPlaceable(code) || STRUCTURES.includes(code) || isAnimal(code);
    const plantPos = new Map(plantRows.map(p => [p.word_id, { col: p.col, row: p.grid_row }]));
    const placed   = items.filter(i => STRUCTURES.includes(i.item_code) || isAnimal(i.item_code) || (isPlaceable(i.item_code) && i.col != null))
                          .map(i => ({ id: i.id, code: i.item_code, col: i.col ?? null, row: i.grid_row ?? null, rotation: i.rotation || 0 }));
    let   unplaced = items.filter(i => isPlaceable(i.item_code) && i.col == null)
                          .map(i => ({ id: i.id, code: i.item_code }));
    // Free-roaming decorations only (sky critters / gnome) still passed by code.
    const decorCodes = items.filter(i => !isGround(i.item_code)).map(i => i.item_code);

    // Recomputed live after an in-garden review (word objects are shared with `words`).
    const countsHtml = () => {
        const c = gardenStats(words);
        return `
            <span title="Seeds">🌱 ${c[0]}</span>
            <span title="Sprouts">🌿 ${c[1]}</span>
            <span title="Flowers">🌷 ${c[2]}</span>
            <span title="Trees">🌳 ${c[3]}</span>
            <span title="Golden">🏆 ${c[4] + c[5]}</span>`;
    };
    const waterCtaHtml = () => {
        const n = dueIds.size;
        return n > 0
            ? `<a class="btn btn-primary btn-sm" href="#/learner/review">💧 ${n} need watering — Review all →</a>`
            : `<span class="gt-allgood">✓ All plants happy</span>`;
    };

    container.innerHTML = `
        <div class="garden-fs" data-night="${activeTheme === 'night' ? '1' : '0'}" data-theme="${activeTheme}" data-rank="${rank.level}">
            <div class="garden-topbar">
                <div class="gt-row gt-top">
                    <span class="gt-rank">${rank.emoji} ${esc(rank.name)}</span>
                    <span class="gt-sun">☀️ ${sunData.sun}</span>
                    <span class="gt-counts">${countsHtml()}</span>
                    <span id="themeSwitch" class="theme-switch"${owned.has('night') || owned.has('sunnyday') ? '' : ' hidden'}>${themeSwitchHtml(activeTheme, owned.has('night'))}</span>
                    <span style="flex:1"></span>
                    <span class="coin-chip" id="coinWallet">🪙 ${balance}</span>
                    <button id="shopBtn" class="btn btn-secondary btn-sm gt-icon-btn">🛒 Shop</button>
                    <button id="musicBtn" class="btn btn-secondary btn-sm gt-icon-btn" title="Music">${musicOn() ? '🔊' : '🔇'}</button>
                    <button id="helpBtn" class="help-btn" title="How to earn">?</button>
                </div>
                <div class="gt-row gt-actions">
                    <span id="waterSlot">${waterCtaHtml()}</span>
                    <button id="arrangeBtn" class="btn btn-secondary btn-sm">✋ Arrange</button>
                </div>
            </div>

            <div class="garden-sky-decor" aria-hidden="true">
                <span id="skyBody" class="sky-body">${activeTheme === 'night' ? '🌙' : '☀️'}</span>
                <span class="sky-cloud sky-cloud-a">☁️</span>
                <span class="sky-cloud sky-cloud-b">☁️</span>
                <span class="sky-cloud sky-cloud-c">☁️</span>
            </div>

            ${words.length === 0
                ? `<div class="garden-empty"><div style="font-size:3rem">🌱</div>
                     <p>Add words and review them to grow your garden!</p>
                     <a href="#/learner/words" class="btn btn-primary">Add your first word</a></div>`
                : `<canvas id="gardenCanvas" class="garden-canvas"></canvas>`}

            <div id="plantPopup" class="garden-popup garden-popup-fs" style="display:none">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">
                    <span id="popupWord" style="font-size:1.4rem;font-weight:700"></span>
                    <span id="popupLevel" style="font-size:0.9rem"></span>
                </div>
                <p id="popupDef" style="font-size:0.88rem;color:#555;margin:0 0 0.2rem"></p>
                <p id="popupChi" style="font-size:0.9rem;margin:0 0 0.65rem"></p>
                <div id="popupActions"></div>
            </div>

            <div id="shopDrawer" class="garden-shop" style="display:none"></div>

            <div id="arrangeTray" class="garden-tray" style="display:none"></div>
            <div id="itemPanel" class="garden-itempanel" style="display:none"></div>
        </div>`;

    // ── 3D scene ────────────────────────────────────────────────────────────
    let controller = null;
    if (words.length) {
        const canvas = document.getElementById('gardenCanvas');
        controller = createGarden(canvas, {
            words, dueIds, plantPos, placed,
            items: decorCodes,                        // sky critters / gnome (stack)
            night: activeTheme === 'night',
            warm:  activeTheme === 'sunnyday' && owned.has('sunnyday'),
            onPlantClick: (id) => showPlantPopup(wordById.get(id)),
            onAssignHomes: (homes) => { if (homes.length) setPlantPositions(homes).catch(() => {}); },
            onPlantMoved:  (wordId, col, row) => { setPlantPosition(wordId, col, row).catch(() => {}); },
            onItemMoved:   (id, col, row, rotation) => {
                placeGardenItem(id, col, row, rotation).catch(() => {});
                if (unplaced.some(u => u.id === id)) { unplaced = unplaced.filter(u => u.id !== id); renderTray(); }
            },
            onItemRemoved: (id) => onItemRemoved(id),
            onSelectItem:  (id) => showItemPanel(id),
            onInvalidDrop: (reason) => toast(reason),
        });
    }

    // Start chiptune on the first tap (browser autoplay rules); pref persists.
    const startAudioOnce = () => { ensureStarted(); document.removeEventListener('pointerdown', startAudioOnce); };
    document.addEventListener('pointerdown', startAudioOnce);

    // Dispose the WebGL scene + stop music when navigating away.
    let cleanedUp = false;
    const cleanupGarden = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        controller?.dispose();
        stopMusic();
        document.removeEventListener('pointerdown', startAudioOnce);
        globalThis.removeEventListener('hashchange', cleanupGarden);
    };
    globalThis.addEventListener('hashchange', cleanupGarden);

    // ── Top-bar buttons: help + music ──────────────────────────────────────────
    document.getElementById('helpBtn').addEventListener('click', showEarnHelp);
    document.getElementById('musicBtn').addEventListener('click', (e) => {
        e.currentTarget.textContent = toggleMusic() ? '🔊' : '🔇';
    });
    bindThemeButtons();

    // ── Plant popup ───────────────────────────────────────────────────────────
    const popup = document.getElementById('plantPopup');

    function refreshTopbar() {
        document.querySelector('.gt-counts').innerHTML = countsHtml();
        document.getElementById('waterSlot').innerHTML = waterCtaHtml();
    }

    function setActiveTheme(theme) {
        if (theme === 'night' && !owned.has('night')) return;
        activeTheme = theme === 'night' ? 'night' : 'sunnyday';
        localStorage.setItem(THEME_KEY, activeTheme);
        applyTheme();
    }

    function applyTheme() {
        const fs = document.querySelector('.garden-fs');
        const night = activeTheme === 'night';
        fs.dataset.night = night ? '1' : '0';
        fs.dataset.theme = activeTheme;
        document.getElementById('skyBody').textContent = night ? '🌙' : '☀️';
        document.getElementById('themeSwitch').innerHTML = themeSwitchHtml(activeTheme, owned.has('night'));
        controller?.setTheme({ night, warm: activeTheme === 'sunnyday' && owned.has('sunnyday') });
        bindThemeButtons();
    }

    function bindThemeButtons() {
        document.querySelectorAll('.theme-choice').forEach(b =>
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                setActiveTheme(b.dataset.themeChoice);
            }));
    }

    function showPlantPopup(word) {
        if (!word) return;
        const level = word.review_level ?? 0;
        const isDue = dueIds.has(word.id);
        const primaryDef = (word.english_definition || '').split('\n').find(Boolean) || '';
        const defEl = document.getElementById('popupDef');
        const chiEl = document.getElementById('popupChi');
        const actions = document.getElementById('popupActions');

        document.getElementById('popupWord').textContent  = word.word;
        document.getElementById('popupLevel').textContent = srsLabel(level);
        defEl.textContent = primaryDef;
        chiEl.textContent = word.chinese_definition ? '🇨🇳 ' + word.chinese_definition : '';

        if (!isDue) {
            defEl.style.display = chiEl.style.display = 'block';
            actions.innerHTML = '<span style="color:#52c41a;font-size:0.85rem">✓ Feeling great — no water needed yet</span>';
            popup.style.display = 'block';
            return;
        }

        // Due → quick in-garden review (no page jump). Hide the answer first.
        defEl.style.display = chiEl.style.display = 'none';
        actions.innerHTML = '<button id="gWater" class="btn btn-primary btn-sm" style="width:100%">💧 Water it — do you remember?</button>';
        popup.style.display = 'block';
        document.getElementById('gWater').addEventListener('click', (e) => {
            e.stopPropagation();
            defEl.style.display = chiEl.style.display = 'block';
            actions.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
                    <button id="gWrong" class="btn btn-danger btn-sm">✗ Forgot</button>
                    <button id="gRight" class="btn btn-success btn-sm">✓ I knew it</button>
                </div>`;
            document.getElementById('gRight').addEventListener('click', (e) => {
                e.stopPropagation();
                handleGardenReview(word, true);
            });
            document.getElementById('gWrong').addEventListener('click', (e) => {
                e.stopPropagation();
                handleGardenReview(word, false);
            });
        });
    }

    async function handleGardenReview(word, correct) {
        popup.style.display = 'none';
        const [newLevel] = await Promise.all([
            completeReview(word.id, correct),
            recordTestResult(word.id, 'review', correct),
        ]);
        dueIds.delete(word.id);
        word.review_level = newLevel;          // shared ref → gardenStats picks it up
        controller?.growPlant(word.id, newLevel);
        refreshTopbar();

        const result = await runAfterActivity({
            sessionType: 'review', answered: 1, correct: correct ? 1 : 0,
            perfectSession: correct, maxCombo: correct ? 1 : 0,
        });
        balance = result.coins.balance;
        document.getElementById('coinWallet').textContent = `🪙 ${balance}`;
        document.querySelector('.gt-sun').textContent = `☀️ ${result.sun}`;
        celebrateEvents(result.events);
    }
    // Tap anywhere that isn't the canvas (raycaster handles that) or the popup closes it.
    document.querySelector('.garden-fs').addEventListener('click', (e) => {
        if (e.target.id === 'gardenCanvas') return;
        if (e.target.closest('.garden-topbar, .garden-shop')) return;
        if (popup.style.display === 'block' && !popup.contains(e.target)) popup.style.display = 'none';
    });

    // ── Arrange mode: tray + drag-to-place + selected-item panel ───────────────
    const tray  = document.getElementById('arrangeTray');
    const panel = document.getElementById('itemPanel');
    let arrangeOn = false;

    const arrangeBtn = document.getElementById('arrangeBtn');
    arrangeBtn?.addEventListener('click', () => setArrange(!arrangeOn));

    function setArrange(on) {
        arrangeOn = on && !!controller;
        controller?.setArrangeMode(arrangeOn);
        arrangeBtn.textContent = arrangeOn ? '✓ Done' : '✋ Arrange';
        arrangeBtn.classList.toggle('btn-primary', arrangeOn);
        tray.style.display = arrangeOn ? 'flex' : 'none';
        panel.style.display = 'none';
        popup.style.display = 'none';
        if (arrangeOn) renderTray();
    }

    function renderTray() {
        // group unplaced placeable items by code, show one draggable chip each
        const byCode = new Map();
        unplaced.forEach(u => byCode.set(u.code, (byCode.get(u.code) || 0) + 1));
        const chips = [...byCode.entries()].map(([code, n]) =>
            `<button class="tray-chip" data-code="${code}">
                <span class="tray-ic">${SHOP[code].icon}</span>
                <span class="tray-name">${esc(SHOP[code].name)}</span>
                <span class="tray-n">×${n}</span>
             </button>`).join('');
        tray.innerHTML = `
            <div class="tray-hint">${unplaced.length
                ? 'Drag onto a block. Tap a placed item to rotate or remove it.'
                : 'Buy roads, rails, fences, cars or trains in the 🛒 Shop, then drag them here.'}</div>
            <div class="tray-row">${chips}</div>`;
        tray.querySelectorAll('.tray-chip').forEach(chip =>
            chip.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const code = chip.dataset.code;
                const next = unplaced.find(u => u.code === code);
                if (next) controller?.beginPlaceFromTray(code, next.id, e);
            }));
    }

    function showItemPanel(id) {
        if (!id) { panel.style.display = 'none'; return; }
        panel.innerHTML = `<button id="delItem" class="btn btn-danger btn-sm">🗑 Remove</button>`;
        panel.style.display = 'flex';
        panel.querySelector('#delItem').addEventListener('click', () => controller?.removeSelected());
    }

    async function onItemRemoved(id) {
        panel.style.display = 'none';
        const row = items.find(i => i.id === id);
        try {
            await removeGardenItem(id);
            if (row) {
                itemCounts.set(row.item_code, Math.max(0, (itemCounts.get(row.item_code) || 1) - 1));
                balance += SHOP[row.item_code]?.cost || 0;     // derived balance refunds on delete
                document.getElementById('coinWallet').textContent = `🪙 ${balance}`;
            }
            unplaced = unplaced.filter(u => u.id !== id);
            toast('Removed — coins refunded.');
        } catch {
            toast('Could not remove that.');
        }
    }

    // ── Shop drawer ─────────────────────────────────────────────────────────
    const drawer = document.getElementById('shopDrawer');
    document.getElementById('shopBtn').addEventListener('click', () => {
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
        if (drawer.style.display === 'block') renderShop();
    });

    // Shop renders as a grid of card "blocks", grouped by category (scales better
    // than rows as the catalog grows).
    const CATS = [
        ['playset',    '🚦 Roads & Rails'],
        ['structures', '🏡 Structures'],
        ['animals',    '🐾 Animals'],
        ['decor',      '✨ Decorations'],
        ['themes',     '🌗 Themes & Boosters'],
    ];
    function shopCard(it) {
        const qty    = itemCounts.get(it.code) || 0;
        const afford = balance >= it.cost;
        const oneOff = !!it.oneOff || it.type === 'theme' || it.type === 'booster';
        let btn;
        if (oneOff && qty > 0) {
            btn = it.type === 'theme'
                ? (it.code === activeTheme
                    ? `<span class="shop-owned">Active ✓</span>`
                    : `<button class="btn btn-secondary btn-sm shop-theme" data-code="${it.code}">Use</button>`)
                : `<span class="shop-owned">Owned ✓</span>`;
        } else {
            btn = `<button class="btn btn-primary btn-sm shop-buy" data-code="${it.code}" ${afford ? '' : 'disabled'}>${it.cost} 🪙</button>`;
        }
        const countBadge = (!oneOff && qty > 0) ? `<span class="shop-count">×${qty}</span>` : '';
        const tag = it.type === 'theme' ? ' <span class="shop-tag">theme</span>'
                  : it.type === 'booster' ? ' <span class="shop-tag">booster</span>' : '';
        return `
            <div class="shop-item ${qty > 0 ? 'owned' : ''}">
                <span class="shop-ic">${it.icon}</span>
                <div class="shop-name">${esc(it.name)}${tag}${countBadge}</div>
                ${it.desc ? `<div class="shop-desc">${esc(it.desc)}</div>` : ''}
                ${btn}
            </div>`;
    }
    function renderShop() {
        const all = shopList();
        const sections = CATS.map(([cat, label]) => {
            const cards = all.filter(it => (it.cat || 'decor') === cat).map(shopCard).join('');
            return cards ? `<div class="shop-section"><h4 class="shop-cat">${label}</h4><div class="shop-grid">${cards}</div></div>` : '';
        }).join('');

        drawer.innerHTML = `
            <div class="shop-head">
                <strong>🛒 Garden Shop</strong>
                <span class="coin-chip">🪙 ${balance}</span>
                <button id="shopClose" class="modal-close" style="margin-left:auto">✕</button>
            </div>
            ${sections}`;

        drawer.querySelector('#shopClose').addEventListener('click', () => { drawer.style.display = 'none'; });
        drawer.querySelectorAll('.shop-buy').forEach(b =>
            b.addEventListener('click', () => buy(b.dataset.code)));
        drawer.querySelectorAll('.shop-theme').forEach(b =>
            b.addEventListener('click', () => {
                setActiveTheme(b.dataset.code);
                renderShop();
            }));
    }

    async function buy(code) {
        try {
            const res = await buyGardenItem(code);
            balance = res.balance;
            owned.add(code);
            itemCounts.set(code, (itemCounts.get(code) || 0) + 1);
            items.push({ id: res.id, item_code: code, col: null, grid_row: null, rotation: 0 });
            document.getElementById('coinWallet').textContent = `🪙 ${balance}`;
            if (SHOP[code]?.type === 'theme') setActiveTheme(code);
            document.getElementById('themeSwitch').hidden = !(owned.has('night') || owned.has('sunnyday'));
            if (isPlaceable(code)) {
                // Goes to the tray; the shop STAYS OPEN so the learner can stock
                // up on roads/rails, then hit ✋ Arrange and drag them on.
                unplaced.push({ id: res.id, code });
                if (arrangeOn) renderTray();
                toast(`${SHOP[code].icon} ${SHOP[code].name} added to your tray — open ✋ Arrange to place it.`);
                renderShop();
                return;
            }
            if (STRUCTURES.includes(code)) {
                controller?.addStructure(res.id, code);   // auto-placed + persisted live
                toast(`${SHOP[code].icon} ${SHOP[code].name} added to your garden!`);
                renderShop();
                return;
            }
            if (isAnimal(code)) {
                controller?.addAnimal(res.id, code);      // auto-placed + persisted live
                toast(`${SHOP[code].icon} ${SHOP[code].name} added to your garden!`);
                renderShop();
                return;
            }
            controller?.addDecoration(code);   // adds ONE instance (theme/boosters skipped inside)
            toast(`${SHOP[code].icon} ${SHOP[code].name} added to your garden!`);
            renderShop();
        } catch (err) {
            toast(err.message === 'Not enough coins' ? '🪙 Not enough coins yet — keep learning!' : (err.message === 'Already owned' ? 'Already in your garden.' : 'Could not buy that.'));
        }
    }
}

function initialTheme(owned) {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'night' && owned.has('night')) return 'night';
    return 'sunnyday';
}

function themeSwitchHtml(activeTheme, canUseNight = false) {
    const activeDay = activeTheme !== 'night';
    return `
        <button class="theme-choice${activeDay ? ' active' : ''}" data-theme-choice="sunnyday" title="Sunny day">☀️</button>
        <button class="theme-choice${!activeDay ? ' active' : ''}${canUseNight ? '' : ' locked'}" data-theme-choice="night" title="${canUseNight ? 'Night' : 'Buy Night Theme to use'}" ${canUseNight ? '' : 'disabled'}>🌙</button>`;
}

function esc(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
