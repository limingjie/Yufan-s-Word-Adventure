// ============================================================================
// celebrate.js — instant award effects (vanilla, no dependencies)
// ============================================================================
// Pure DOM + CSS. Styling lives in css/style.css (.celebrate-* classes &
// keyframes). celebrateEvents() takes the events array from awards.js and
// renders each one; the heavy overlays (rankUp, badge) are queued so they
// never stack on top of each other.

const CONFETTI_COLORS = ['#ffd54a', '#ff7eb3', '#7ee787', '#58c4ff', '#c08bff', '#ff9f43'];

// --- low-level helpers -------------------------------------------------------

function spawn(cls, html, parent = document.body) {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    parent.appendChild(el);
    return el;
}

function rect(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    return el ? el.getBoundingClientRect() : null;
}

// --- public effects ----------------------------------------------------------

/** Small chip that slides in at top-center and fades out. */
export function toast(html, ms = 2600) {
    const el = spawn('celebrate-toast', html);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
    }, ms);
    return el;
}

/** Burst of confetti particles, optionally originating from an element. */
export function confettiBurst(origin = null, count = 80) {
    const layer = spawn('celebrate-confetti-layer', '');
    const r = rect(origin);
    const ox = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const oy = r ? r.top + r.height / 2 : window.innerHeight / 3;

    for (let i = 0; i < count; i++) {
        const p = document.createElement('i');
        const angle = Math.random() * Math.PI * 2;
        const dist  = 80 + Math.random() * 240;
        p.style.cssText = `
            left:${ox}px; top:${oy}px;
            background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
            --dx:${Math.cos(angle) * dist}px;
            --dy:${Math.sin(angle) * dist + 120}px;
            --rot:${Math.random() * 720 - 360}deg;
            animation-delay:${Math.random() * 0.12}s;`;
        layer.appendChild(p);
    }
    setTimeout(() => layer.remove(), 1800);
}

/** "+N 🪙" floating toward the wallet target, with a few coin sparks. */
export function coinBurst(amount, target = '.coin-chip') {
    const r = rect(target);
    const el = spawn('celebrate-coin-fly', `+${amount} 🪙`);
    if (r) {
        el.style.left = `${r.left + r.width / 2}px`;
        el.style.top  = `${r.top}px`;
    } else {
        el.style.left = '50%';
        el.style.top  = '70px';
        el.style.transform = 'translateX(-50%)';
    }
    requestAnimationFrame(() => el.classList.add('go'));
    setTimeout(() => el.remove(), 1500);
}

/** Quick centered "🔥 N in a row!" popup during a session. */
export function comboPopup(n) {
    const el = spawn('celebrate-combo', `🔥 ${n} in a row!`);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 350);
    }, 1100);
}

/** Full-screen overlay for a badge unlock. Resolves when dismissed. */
export function badgeUnlock(badge) {
    return overlay(`
        <div class="celebrate-medal">${badge.icon || '🏅'}</div>
        <div class="celebrate-kicker">New badge!</div>
        <div class="celebrate-title">${esc(badge.label || '')}</div>
        <div class="celebrate-sub">${esc(badge.desc || '')}</div>`);
}

/** Full-screen overlay for a rank-up. Resolves when dismissed. */
export function rankUp(rank) {
    return overlay(`
        <div class="celebrate-medal">${rank.emoji || '🌟'}</div>
        <div class="celebrate-kicker">Rank up!</div>
        <div class="celebrate-title">${esc(rank.name || '')}</div>
        <div class="celebrate-sub">You're growing strong ☀️</div>`);
}

/**
 * Render an events[] array from awards.runAfterActivity().
 * Heavy overlays are shown one after another; the coin toast fires immediately.
 */
export async function celebrateEvents(events = []) {
    const coinEvt = events.find(e => e.type === 'coins');
    if (coinEvt) coinBurst(coinEvt.payload.amount);

    // rank-up first, then each badge — sequentially, so they don't overlap.
    const rank = events.find(e => e.type === 'rankUp');
    if (rank) { confettiBurst(); await rankUp(rank.payload); }

    for (const e of events.filter(ev => ev.type === 'badge')) {
        confettiBurst();
        await badgeUnlock(e.payload);
    }
}

// --- internal: dismissible overlay -------------------------------------------

function overlay(innerHtml) {
    return new Promise(resolve => {
        const el = spawn('celebrate-overlay', `
            <div class="celebrate-card">
                ${innerHtml}
                <button class="btn btn-primary celebrate-ok" type="button">Yay! 🎉</button>
            </div>`);
        requestAnimationFrame(() => el.classList.add('show'));

        const close = () => {
            el.classList.remove('show');
            setTimeout(() => { el.remove(); resolve(); }, 300);
        };
        el.addEventListener('click', e => { if (e.target === el) close(); });
        el.querySelector('.celebrate-ok').addEventListener('click', close);
    });
}

function esc(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
