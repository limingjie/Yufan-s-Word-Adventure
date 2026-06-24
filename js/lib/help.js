// ============================================================================
// help.js — "How do I earn?" explainer modal (shared by home & garden)
// ============================================================================
// Plain, kid-friendly explanation of the two currencies. Reuses the celebrate
// overlay styling for a dismissible card.

export function showEarnHelp() {
    const el = document.createElement('div');
    el.className = 'celebrate-overlay show';
    el.innerHTML = `
        <div class="celebrate-card help-card">
            <div class="help-title">☀️ Sunlight & 🪙 Coins</div>

            <div class="help-section">
                <div class="help-head">☀️ Sunlight grows your rank</div>
                <ul>
                    <li>➕ Add a word — <b>+1</b></li>
                    <li>💧 Finish a review — <b>+2</b></li>
                    <li>✅ Each correct answer — <b>+3</b></li>
                </ul>
                <p class="help-note">More Sunlight = a higher gardener rank and a spot on the leaderboard. You never spend it.</p>
            </div>

            <div class="help-section">
                <div class="help-head">🪙 Coins to spend in the Garden Shop</div>
                <ul>
                    <li>➕ Add a word — <b>+1</b></li>
                    <li>📝 Each question you answer — <b>+1</b></li>
                    <li>✅ Each correct answer — <b>+1</b> more</li>
                    <li>🏅 Each new badge — <b>+5</b></li>
                </ul>
                <p class="help-note">Spend coins on butterflies, fountains, a cottage and more. Keep learning to keep earning!</p>
            </div>

            <button class="btn btn-primary celebrate-ok" type="button">Got it! 🌱</button>
        </div>`;
    document.body.appendChild(el);

    const close = () => el.remove();
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('.celebrate-ok').addEventListener('click', close);
}
