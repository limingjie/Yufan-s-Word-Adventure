import { supabase } from '../js/supabase.js';
import { srsLabel, srsBadgeClass } from '../js/lib/srs.js';

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
    let allWords = [];

    const tabsHTML = learners.map(l =>
        `<button class="leaderboard-tab${l.id === activeLearner ? ' active' : ''}" data-id="${l.id}">${esc(l.display_name)}</button>`
    ).join('');

    container.innerHTML = `
        <div style="max-width:700px;margin:0 auto">
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap">
                <h2 style="margin:0">Word Lists</h2>
                <a href="#/parent/dashboard" class="btn btn-secondary btn-sm" style="margin-left:auto">Dashboard</a>
            </div>
            <div class="leaderboard-tabs" style="margin-bottom:1rem">${tabsHTML}</div>
            <input type="search" id="searchInput" placeholder="Search words…" style="margin-bottom:1rem">
            <div id="wordList"></div>
        </div>`;

    async function loadWords(learnerId) {
        const { data } = await supabase
            .from('words')
            .select('*')
            .eq('user_id', learnerId)
            .order('created_at', { ascending: false });

        allWords = data || [];
        renderWords();
    }

    function renderWords() {
        const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
        const filtered = allWords.filter(w =>
            w.word.toLowerCase().includes(q) || (w.english_definition || '').toLowerCase().includes(q)
        );

        const list = document.getElementById('wordList');
        if (filtered.length === 0) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><h3>No words found</h3></div>`;
            return;
        }

        list.innerHTML = filtered.map(w => `
            <div class="word-card">
                <div class="word-card-header">
                    <span class="word-card-title">${esc(w.word)}</span>
                    ${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ''}
                    <span class="srs-badge ${srsBadgeClass(w.review_level || 0)}">${srsLabel(w.review_level || 0)}</span>
                </div>
                <div class="word-card-body">
                    ${w.english_definition ? `<p><strong>EN:</strong> ${esc(w.english_definition)}</p>` : ''}
                    ${w.chinese_definition ? `<p><strong>中:</strong> ${esc(w.chinese_definition)}</p>` : ''}
                    ${w.example_sentence   ? `<p style="font-style:italic;color:#555">"${esc(w.example_sentence)}"</p>` : ''}
                </div>
            </div>`).join('');

        list.querySelectorAll('.word-card-header').forEach(h =>
            h.addEventListener('click', () => h.closest('.word-card').classList.toggle('expanded'))
        );
    }

    document.querySelectorAll('.leaderboard-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
            activeLearner = btn.dataset.id;
            document.querySelectorAll('.leaderboard-tab').forEach(b => b.classList.toggle('active', b.dataset.id === activeLearner));
            document.getElementById('wordList').innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;
            await loadWords(activeLearner);
        });
    });

    document.getElementById('searchInput').addEventListener('input', renderWords);

    await loadWords(activeLearner);
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
