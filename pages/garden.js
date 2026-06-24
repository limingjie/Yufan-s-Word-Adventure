import { getWordsWithSRS, getWordsForReviewToday, getUserSunlight, getUserCoins, getGardenItems, buyGardenItem, completeReview, recordTestResult } from '../js/db.js';
import { getRankInfo }   from '../js/lib/growth.js';
import { gardenStats }   from '../js/lib/garden.js';
import { srsLabel }      from '../js/lib/srs.js';
import { createGarden }  from '../js/lib/garden3d.js';
import { shopList, SHOP } from '../js/lib/coins.js';
import { runAfterActivity } from '../js/lib/awards.js';
import { toast, celebrateEvents } from '../js/lib/celebrate.js';
import { showEarnHelp } from '../js/lib/help.js';
import { ensureStarted, stopMusic, toggle as toggleMusic, isOn as musicOn } from '../js/lib/audio.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🌱</div><p>Growing your garden…</p></div>`;

    const [words, dueRows, sunData, coins, items] = await Promise.all([
        getWordsWithSRS(),
        getWordsForReviewToday(),
        getUserSunlight(),
        getUserCoins(),
        getGardenItems(),
    ]);

    const dueIds   = new Set(dueRows.map(r => r.word_id));
    const wordById = new Map(words.map(w => [w.id, w]));
    const rank     = getRankInfo(sunData.sun);
    const owned    = new Set(items.map(i => i.item_code));
    const itemCounts = new Map();
    items.forEach(i => itemCounts.set(i.item_code, (itemCounts.get(i.item_code) || 0) + 1));
    let   balance  = coins.balance;

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
        <div class="garden-fs" data-night="${owned.has('night') ? '1' : '0'}" data-rank="${rank.level}">
            <div class="garden-topbar">
                <div class="gt-row gt-top">
                    <span class="gt-rank">${rank.emoji} ${esc(rank.name)}</span>
                    <span class="gt-sun">☀️ ${sunData.sun}</span>
                    <span class="gt-counts">${countsHtml()}</span>
                    <span style="flex:1"></span>
                    <span class="coin-chip" id="coinWallet">🪙 ${balance}</span>
                    <button id="shopBtn" class="btn btn-secondary btn-sm gt-icon-btn">🛒 Shop</button>
                    <button id="musicBtn" class="btn btn-secondary btn-sm gt-icon-btn" title="Music">${musicOn() ? '🔊' : '🔇'}</button>
                    <button id="helpBtn" class="btn btn-secondary btn-sm gt-icon-btn" title="How to earn">?</button>
                </div>
                <div class="gt-row gt-actions">
                    <span id="waterSlot">${waterCtaHtml()}</span>
                    <a class="btn btn-secondary btn-sm" href="#/learner/words">＋ Add</a>
                    <a class="btn btn-secondary btn-sm" href="#/learner/quiz">📝 Quiz</a>
                </div>
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
        </div>`;

    // ── 3D scene ────────────────────────────────────────────────────────────
    let controller = null;
    if (words.length) {
        const canvas = document.getElementById('gardenCanvas');
        controller = createGarden(canvas, {
            words, dueIds,
            items: items.map(i => i.item_code),       // duplicates kept → decorations stack
            night: owned.has('night'),
            warm:  owned.has('sunnyday'),
            onPlantClick: (id) => showPlantPopup(wordById.get(id)),
        });
    }

    // Start chiptune on the first tap (browser autoplay rules); pref persists.
    const startAudioOnce = () => { ensureStarted(); document.removeEventListener('pointerdown', startAudioOnce); };
    document.addEventListener('pointerdown', startAudioOnce);

    // Dispose the WebGL scene + stop music when navigating away.
    const onLeave = () => {
        controller?.dispose();
        stopMusic();
        document.removeEventListener('pointerdown', startAudioOnce);
        globalThis.removeEventListener('hashchange', onLeave);
    };
    globalThis.addEventListener('hashchange', onLeave);

    // ── Top-bar buttons: help + music ──────────────────────────────────────────
    document.getElementById('helpBtn').addEventListener('click', showEarnHelp);
    document.getElementById('musicBtn').addEventListener('click', (e) => {
        e.currentTarget.textContent = toggleMusic() ? '🔊' : '🔇';
    });

    // ── Plant popup ───────────────────────────────────────────────────────────
    const popup = document.getElementById('plantPopup');

    function refreshTopbar() {
        document.querySelector('.gt-counts').innerHTML = countsHtml();
        document.getElementById('waterSlot').innerHTML = waterCtaHtml();
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
        document.getElementById('gWater').addEventListener('click', () => {
            defEl.style.display = chiEl.style.display = 'block';
            actions.innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
                    <button id="gWrong" class="btn btn-danger btn-sm">✗ Forgot</button>
                    <button id="gRight" class="btn btn-success btn-sm">✓ I knew it</button>
                </div>`;
            document.getElementById('gRight').addEventListener('click', () => handleGardenReview(word, true));
            document.getElementById('gWrong').addEventListener('click', () => handleGardenReview(word, false));
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
        if (popup.style.display === 'block' && !popup.contains(e.target)) popup.style.display = 'none';
    });

    // ── Shop drawer ─────────────────────────────────────────────────────────
    const drawer = document.getElementById('shopDrawer');
    document.getElementById('shopBtn').addEventListener('click', () => {
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
        if (drawer.style.display === 'block') renderShop();
    });

    function renderShop() {
        const rows = shopList().map(it => {
            const qty    = itemCounts.get(it.code) || 0;
            const afford = balance >= it.cost;
            const isBooster = it.type === 'booster';
            // Boosters are one-off toggles; decorations stack (buy as many as you like).
            let btn;
            if (isBooster && qty > 0) {
                btn = `<span class="shop-owned">Owned ✓</span>`;
            } else {
                btn = `<button class="btn btn-primary btn-sm shop-buy" data-code="${it.code}" ${afford ? '' : 'disabled'}>${it.cost} 🪙</button>`;
            }
            const countBadge = (!isBooster && qty > 0) ? `<span class="shop-count">×${qty}</span>` : '';
            return `
                <div class="shop-item ${qty > 0 ? 'owned' : ''}">
                    <span class="shop-ic">${it.icon}</span>
                    <div class="shop-info">
                        <div class="shop-name">${esc(it.name)}${isBooster ? ' <span class="shop-tag">booster</span>' : ''}${countBadge}</div>
                        ${it.desc ? `<div class="shop-desc">${esc(it.desc)}</div>` : ''}
                    </div>
                    ${btn}
                </div>`;
        }).join('');

        drawer.innerHTML = `
            <div class="shop-head">
                <strong>🛒 Garden Shop</strong>
                <span class="coin-chip">🪙 ${balance}</span>
                <button id="shopClose" class="modal-close" style="margin-left:auto">✕</button>
            </div>
            <div class="shop-grid">${rows}</div>`;

        drawer.querySelector('#shopClose').addEventListener('click', () => { drawer.style.display = 'none'; });
        drawer.querySelectorAll('.shop-buy').forEach(b =>
            b.addEventListener('click', () => buy(b.dataset.code)));
    }

    async function buy(code) {
        try {
            const res = await buyGardenItem(code);
            balance = res.balance;
            owned.add(code);
            itemCounts.set(code, (itemCounts.get(code) || 0) + 1);
            document.getElementById('coinWallet').textContent = `🪙 ${balance}`;
            if (code === 'night') document.querySelector('.garden-fs').dataset.night = '1';
            controller?.addDecoration(code);   // adds ONE instance (theme/boosters skipped inside)
            toast(`${SHOP[code].icon} ${SHOP[code].name} added to your garden!`);
            renderShop();
        } catch (err) {
            toast(err.message === 'Not enough coins' ? '🪙 Not enough coins yet — keep learning!' : 'Could not buy that.');
        }
    }
}

function esc(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
