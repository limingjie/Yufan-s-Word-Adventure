import { supabase } from '../js/supabase.js';
import { srsLabel, srsBadgeClass } from '../js/lib/srs.js';

const PARTS_OF_SPEECH = ['noun','verb','adjective','adverb','pronoun','preposition','conjunction','interjection'];

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

    // Page state
    let activeLearner    = learners[0];
    let allWords         = [];
    let currentSort      = 'date';
    let editingWordId    = null;
    let lookupResult     = null;
    let audioUrlUK       = null;
    let audioUrlUS       = null;
    let currentWordForms = null;
    let expandedDates    = new Set();
    let dateGroups       = new Map();
    let trashedWords     = [];
    let trashOpen        = false;

    const _now         = new Date();
    const todayStr     = localYMD(_now);
    const yesterdayStr = localYMD(new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() - 1));

    function resetExpandedDates() { expandedDates = new Set([todayStr, yesterdayStr]); }
    resetExpandedDates();

    const tabsHTML = learners.map(l =>
        `<button class="leaderboard-tab${l.id === activeLearner.id ? ' active' : ''}" data-id="${l.id}">${esc(l.display_name)}</button>`
    ).join('');

    container.innerHTML = `
        <div style="max-width:700px;margin:0 auto">
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
                <h2 style="margin:0">Word Lists</h2>
                <a href="#/parent/dashboard" class="btn btn-secondary btn-sm">Dashboard</a>
                <a href="#/parent/activity" class="btn btn-secondary btn-sm">Activity</a>
            </div>
            <div class="leaderboard-tabs" style="margin-bottom:0.75rem">${tabsHTML}</div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap">
                <div style="position:relative">
                    <button id="sortBtn" class="btn btn-secondary btn-sm">📅 By Date ▾</button>
                    <div id="sortMenu" style="display:none;position:absolute;left:0;top:calc(100% + 4px);background:#fff;border:1px solid #dee2e6;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:20;min-width:140px;overflow:hidden">
                        <button class="sort-opt" data-sort="date"  style="display:block;width:100%;text-align:left;padding:0.5rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.85rem">📅 By Date</button>
                        <button class="sort-opt" data-sort="alpha" style="display:block;width:100%;text-align:left;padding:0.5rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.85rem">A–Z</button>
                        <button class="sort-opt" data-sort="level" style="display:block;width:100%;text-align:left;padding:0.5rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.85rem">⭐ By Level</button>
                    </div>
                </div>
                <button id="openDrawerBtn" class="btn btn-primary btn-sm" style="margin-left:auto">+ Add Word</button>
            </div>
            <input type="search" id="searchInput" placeholder="Search words…" style="width:100%;margin-bottom:0.75rem">
            <div id="wordList"><div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div></div>

            <div id="trashSection" style="display:none;margin-top:1.5rem;border-top:1px solid #eee;padding-top:0.75rem">
                <button id="trashToggle" style="background:none;border:none;color:#888;font-size:0.85rem;cursor:pointer;padding:0;display:flex;align-items:center;gap:0.35rem">
                    <span id="trashLabel">🗑 Trash (0)</span>
                    <span id="trashChevron" style="font-size:0.7rem">▶</span>
                </button>
                <div id="trashList" style="display:none;margin-top:0.5rem"></div>
            </div>
        </div>

        <div id="drawerOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:100"></div>
        <div id="addDrawer" style="display:none;position:fixed;top:0;right:0;bottom:0;width:min(400px,100vw);background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.15);z-index:101;overflow-y:auto;padding:1.25rem 1.25rem 2.5rem">
            <div style="display:flex;align-items:center;margin-bottom:1.25rem">
                <h3 id="drawerTitle" style="margin:0;flex:1;font-size:1.1rem">Add Word</h3>
                <button id="closeDrawerBtn" style="background:none;border:none;font-size:1.75rem;line-height:1;cursor:pointer;padding:0 0 0 1rem;color:#666">×</button>
            </div>
            <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
                <input type="text" id="drawerWordInput" autocomplete="off" style="flex:1;text-transform:lowercase;font-size:1rem" placeholder="Word">
                <button id="drawerLookupBtn" class="btn btn-secondary" style="white-space:nowrap">Look Up</button>
            </div>
            <div id="drawerStatus" style="display:none;font-size:0.82rem;color:#666;margin-bottom:0.75rem"></div>
            <div id="drawerDetails" style="display:none">
                <div id="drawerPronPanel" style="display:none;margin-bottom:0.75rem">
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        <button id="drawerPronUS" class="pron-chip pron-chip-us" style="display:none">🔊 US</button>
                        <button id="drawerPronUK" class="pron-chip pron-chip-uk" style="display:none">🔊 UK</button>
                    </div>
                </div>
                <div id="drawerFormsRow" style="display:none;margin-bottom:0.5rem">
                    <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:4px">Forms</label>
                    <div id="drawerFormsChips" style="display:flex;flex-wrap:wrap;gap:4px"></div>
                </div>
                <div style="margin-bottom:0.5rem">
                    <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">Definitions <span style="font-weight:400;color:#aaa">(one per line)</span></label>
                    <textarea id="drawerEngDef" rows="3" style="font-size:0.9rem;width:100%;resize:vertical"></textarea>
                </div>
                <div style="margin-bottom:0.75rem">
                    <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">Chinese</label>
                    <textarea id="drawerChiDef" rows="2" style="font-size:0.9rem;width:100%;resize:vertical"></textarea>
                </div>
                <button id="drawerMoreBtn" style="background:none;border:none;color:#007bff;font-size:0.82rem;padding:0 0 0.6rem;cursor:pointer;text-decoration:underline;display:block">More details ▾</button>
                <div id="drawerMoreSection" style="display:none">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                        <div>
                            <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">IPA</label>
                            <input type="text" id="drawerIpa" style="font-size:0.9rem;width:100%">
                        </div>
                        <div>
                            <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">Part of speech</label>
                            <select id="drawerPos" style="font-size:0.9rem;width:100%">
                                <option value="">—</option>
                                ${PARTS_OF_SPEECH.map(p => `<option value="${p}">${p}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom:0.5rem">
                        <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">Example</label>
                        <textarea id="drawerExample" rows="2" style="font-size:0.9rem;width:100%;resize:vertical"></textarea>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem">
                        <div>
                            <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">Synonyms</label>
                            <textarea id="drawerSynonyms" rows="2" style="font-size:0.85rem;width:100%;resize:vertical" placeholder="comma separated"></textarea>
                        </div>
                        <div>
                            <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">Antonyms</label>
                            <textarea id="drawerAntonyms" rows="2" style="font-size:0.85rem;width:100%;resize:vertical" placeholder="comma separated"></textarea>
                        </div>
                    </div>
                    <div style="margin-bottom:0.75rem">
                        <label style="font-size:0.78rem;color:#555;display:block;margin-bottom:2px">Quotes <span style="font-weight:400;color:#aaa">(one per line)</span></label>
                        <textarea id="drawerQuotes" rows="3" style="font-size:0.82rem;width:100%;resize:vertical" placeholder="quote text — source"></textarea>
                    </div>
                </div>
                <div id="drawerError"   style="display:none;color:#dc3545;font-size:0.82rem;margin-bottom:0.5rem"></div>
                <div id="drawerSuccess" style="display:none;color:#28a745;font-size:0.82rem;margin-bottom:0.5rem"></div>
                <button id="drawerSaveBtn" class="btn btn-primary btn-block">Save</button>
            </div>
        </div>`;

    // ── Load words ─────────────────────────────────────────────────────────────

    async function loadWords(learner) {
        activeLearner = learner;
        document.getElementById('wordList').innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

        const [wordsRes, schedRes] = await Promise.all([
            supabase.from('words').select('*').eq('user_id', learner.id).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('review_schedule').select('word_id,review_level').eq('user_id', learner.id),
        ]);
        const levelMap = new Map((schedRes.data || []).map(s => [s.word_id, s.review_level]));
        allWords = (wordsRes.data || []).map(w => ({ ...w, review_level: levelMap.get(w.id) ?? 0 }));

        resetExpandedDates();
        redraw();
        loadTrash(learner.id);
    }

    // ── List rendering ─────────────────────────────────────────────────────────

    function filteredWords() {
        const q = document.getElementById('searchInput').value.toLowerCase();
        return allWords.filter(w =>
            w.word.toLowerCase().includes(q) ||
            (w.english_definition || '').toLowerCase().includes(q) ||
            (w.synonyms || '').toLowerCase().includes(q)
        );
    }

    function redraw() {
        const words = filteredWords();
        const list  = document.getElementById('wordList');
        if (!list) return;

        if (words.length === 0) {
            list.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><h3>No words found</h3><p>Try a different search or click <strong>+ Add Word</strong>.</p></div>`;
            return;
        }

        if (currentSort === 'alpha') {
            list.innerHTML = [...words].sort((a, b) => a.word.localeCompare(b.word)).map(wordCard).join('');
        } else if (currentSort === 'level') {
            list.innerHTML = [...words].sort((a, b) => (b.review_level || 0) - (a.review_level || 0)).map(wordCard).join('');
        } else {
            dateGroups = new Map();
            for (const w of words) {
                const d = w.created_at ? localYMD(new Date(w.created_at)) : 'unknown';
                if (!dateGroups.has(d)) dateGroups.set(d, []);
                dateGroups.get(d).push(w);
            }
            const sortedDates = [...dateGroups.keys()].sort((a, b) => b.localeCompare(a));
            list.innerHTML = sortedDates.map(date => {
                const isExpanded = expandedDates.has(date);
                const count      = dateGroups.get(date).length;
                return `
                    <div class="date-group-header" data-date="${date}"
                         style="display:flex;align-items:center;justify-content:space-between;font-size:0.8rem;font-weight:600;color:#888;padding:0.6rem 0 0.3rem;border-top:1px solid #eee;margin-top:0.5rem;cursor:pointer;user-select:none">
                        <span>${formatDate(date)} <span style="font-weight:400">(${count})</span></span>
                        <span class="date-chevron" style="font-size:0.7rem">${isExpanded ? '▾' : '▸'}</span>
                    </div>
                    <div class="date-group-body" data-date="${date}" style="${isExpanded ? '' : 'display:none'}">
                        ${isExpanded ? dateGroups.get(date).map(wordCard).join('') : ''}
                    </div>`;
            }).join('');
        }
    }

    // ── Sort dropdown ─────────────────────────────────────────────────────────

    const SORT_LABELS = { date: '📅 By Date', alpha: 'A–Z', level: '⭐ By Level' };

    document.getElementById('sortBtn').addEventListener('click', e => {
        e.stopPropagation();
        const menu = document.getElementById('sortMenu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('sortMenu').addEventListener('click', e => {
        e.stopPropagation();
        const opt = e.target.closest('.sort-opt');
        if (!opt) return;
        currentSort = opt.dataset.sort;
        document.getElementById('sortBtn').textContent = `${SORT_LABELS[currentSort]} ▾`;
        document.getElementById('sortMenu').style.display = 'none';
        redraw();
    });

    document.addEventListener('click', () => {
        document.getElementById('sortMenu')?.style && (document.getElementById('sortMenu').style.display = 'none');
    });

    // ── Word list click handlers ───────────────────────────────────────────────

    function handleGroupToggle(e) {
        const h = e.target.closest('.date-group-header');
        if (!h) return false;
        const date    = h.dataset.date;
        const body    = document.querySelector(`.date-group-body[data-date="${date}"]`);
        const chevron = h.querySelector('.date-chevron');
        if (expandedDates.has(date)) {
            expandedDates.delete(date);
            body.innerHTML     = '';
            body.style.display = 'none';
            chevron.textContent = '▸';
        } else {
            expandedDates.add(date);
            body.innerHTML     = (dateGroups.get(date) || []).map(wordCard).join('');
            body.style.display = '';
            chevron.textContent = '▾';
        }
        return true;
    }

    function handleMoreToggle(e) {
        const btn = e.target.closest('.expand-more-btn');
        if (!btn) return false;
        e.stopPropagation();
        const extra = document.getElementById('extra-' + btn.dataset.id);
        if (!extra) return true;
        const open = extra.style.display !== 'none';
        extra.style.display = open ? 'none' : 'block';
        btn.textContent = open ? 'More ▾' : 'Less ▴';
        return true;
    }

    async function handleDeleteBtn(e) {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return false;
        e.stopPropagation();
        const { id, word } = btn.dataset;
        if (!confirm(`Move "${word}" to trash?`)) return true;
        btn.textContent = '…';
        btn.disabled    = true;
        await supabase.from('words').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        allWords = allWords.filter(w => w.id !== id);
        redraw();
        loadTrash(activeLearner.id);
        return true;
    }

    function handleEditBtn(e) {
        const btn = e.target.closest('.edit-btn');
        if (!btn) return false;
        e.stopPropagation();
        const word = allWords.find(w => w.id === btn.dataset.id);
        if (word) openDrawerForEdit(word);
        return true;
    }

    document.getElementById('wordList').addEventListener('click', async e => {
        if (handleGroupToggle(e)) return;
        const playBtn = e.target.closest('.play-btn');
        if (playBtn) { e.stopPropagation(); playAudio(playBtn.dataset.src); return; }
        if (handleMoreToggle(e)) return;
        if (await handleDeleteBtn(e)) return;
        if (handleEditBtn(e)) return;
        const header = e.target.closest('.word-card-header');
        if (header) header.closest('.word-card').classList.toggle('expanded');
    });

    document.getElementById('searchInput').addEventListener('input', redraw);

    // ── Learner tabs ──────────────────────────────────────────────────────────

    document.querySelectorAll('.leaderboard-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
            const learner = learners.find(l => l.id === btn.dataset.id);
            if (!learner || learner.id === activeLearner.id) return;
            document.querySelectorAll('.leaderboard-tab').forEach(b => b.classList.toggle('active', b.dataset.id === learner.id));
            allWords  = [];
            trashOpen = false;
            document.getElementById('trashList').style.display  = 'none';
            document.getElementById('trashChevron').textContent = '▶';
            await loadWords(learner);
        });
    });

    // ── Trash ─────────────────────────────────────────────────────────────────

    async function loadTrash(learnerId) {
        const { data } = await supabase.from('words').select('id, word')
            .eq('user_id', learnerId).not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        trashedWords = data || [];
        document.getElementById('trashLabel').textContent = `🗑 Trash (${trashedWords.length})`;
        document.getElementById('trashSection').style.display = trashedWords.length > 0 ? 'block' : 'none';
        if (trashOpen) renderTrash();
    }

    function renderTrash() {
        document.getElementById('trashList').innerHTML = trashedWords.map(w => `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid #f0f0f0">
                <span style="flex:1;font-size:0.9rem;color:#aaa;text-decoration:line-through">${esc(w.word)}</span>
                <button class="restore-btn btn btn-secondary btn-sm" data-id="${w.id}" style="font-size:0.75rem;padding:2px 8px">Restore</button>
                <button class="perm-delete-btn btn btn-danger btn-sm" data-id="${w.id}" data-word="${esc(w.word)}" style="font-size:0.75rem;padding:2px 8px">Delete forever</button>
            </div>`).join('') || '<p style="color:#aaa;font-size:0.85rem;margin:0.5rem 0">Trash is empty.</p>';
    }

    document.getElementById('trashToggle').addEventListener('click', () => {
        trashOpen = !trashOpen;
        document.getElementById('trashChevron').textContent = trashOpen ? '▼' : '▶';
        document.getElementById('trashList').style.display  = trashOpen ? 'block' : 'none';
        if (trashOpen) renderTrash();
    });

    document.getElementById('trashList').addEventListener('click', async e => {
        const restoreBtn = e.target.closest('.restore-btn');
        const permBtn    = e.target.closest('.perm-delete-btn');
        if (restoreBtn) {
            restoreBtn.disabled    = true;
            restoreBtn.textContent = '…';
            await supabase.from('words').update({ deleted_at: null }).eq('id', restoreBtn.dataset.id);
            const [wordsRes, schedRes] = await Promise.all([
                supabase.from('words').select('*').eq('user_id', activeLearner.id).is('deleted_at', null).order('created_at', { ascending: false }),
                supabase.from('review_schedule').select('word_id,review_level').eq('user_id', activeLearner.id),
            ]);
            const levelMap = new Map((schedRes.data || []).map(s => [s.word_id, s.review_level]));
            allWords = (wordsRes.data || []).map(w => ({ ...w, review_level: levelMap.get(w.id) ?? 0 }));
            redraw();
            loadTrash(activeLearner.id);
        }
        if (permBtn) {
            if (!confirm(`Permanently delete "${permBtn.dataset.word}"? This cannot be undone.`)) return;
            permBtn.disabled = true;
            await supabase.from('words').delete().eq('id', permBtn.dataset.id);
            loadTrash(activeLearner.id);
        }
    });

    // ── Drawer ────────────────────────────────────────────────────────────────

    function openDrawer() {
        document.getElementById('addDrawer').style.display     = 'block';
        document.getElementById('drawerOverlay').style.display = 'block';
        document.getElementById('drawerWordInput').focus();
    }

    function openDrawerForAdd() {
        editingWordId = null;
        resetDrawer();
        document.getElementById('drawerTitle').textContent   = `Add Word for ${activeLearner.display_name}`;
        document.getElementById('drawerSaveBtn').textContent = 'Save';
        openDrawer();
    }

    function openDrawerForEdit(word) {
        editingWordId = word.id;
        resetDrawer();
        document.getElementById('drawerTitle').textContent   = 'Edit Word';
        document.getElementById('drawerSaveBtn').textContent = 'Update';
        document.getElementById('drawerWordInput').value     = word.word;
        currentWordForms = word.word_forms ?? null;
        drawerFill({
            ipa: word.ipa, part_of_speech: word.part_of_speech,
            english_definition: word.english_definition, chinese_definition: word.chinese_definition,
            example_sentence: word.example_sentence, synonyms: word.synonyms,
            antonyms: word.antonyms, quotes: word.quotes, word_forms: word.word_forms,
        });
        audioUrlUS = word.audio_url_us ?? null;
        audioUrlUK = word.audio_url_uk ?? null;
        if (audioUrlUS || audioUrlUK) {
            const parts = (word.ipa || '').split('$');
            const panel = document.getElementById('drawerPronPanel');
            const usBtn = document.getElementById('drawerPronUS');
            const ukBtn = document.getElementById('drawerPronUK');
            panel.style.display = 'block';
            if (audioUrlUS) { usBtn.textContent = parts[0] ? `🔊 US ${parts[0]}` : '🔊 US'; usBtn.dataset.src = audioUrlUS; usBtn.style.display = 'inline-flex'; }
            if (audioUrlUK) { ukBtn.textContent = parts[1] ? `🔊 UK ${parts[1]}` : '🔊 UK'; ukBtn.dataset.src = audioUrlUK; ukBtn.style.display = 'inline-flex'; }
        }
        document.getElementById('drawerDetails').style.display = 'block';
        openDrawer();
    }

    function closeDrawer() {
        document.getElementById('addDrawer').style.display     = 'none';
        document.getElementById('drawerOverlay').style.display = 'none';
        editingWordId = null;
    }

    function resetDrawer() {
        ['drawerStatus','drawerError','drawerSuccess'].forEach(id => {
            const el = document.getElementById(id);
            el.style.display = 'none'; el.textContent = '';
        });
        ['drawerDetails','drawerPronPanel','drawerFormsRow','drawerMoreSection'].forEach(id =>
            (document.getElementById(id).style.display = 'none'));
        ['drawerPronUS','drawerPronUK'].forEach(id => (document.getElementById(id).style.display = 'none'));
        ['drawerWordInput','drawerIpa','drawerEngDef','drawerChiDef','drawerExample','drawerSynonyms','drawerAntonyms','drawerQuotes'].forEach(id =>
            (document.getElementById(id).value = ''));
        document.getElementById('drawerPos').value          = '';
        document.getElementById('drawerFormsChips').innerHTML = '';
        document.getElementById('drawerMoreBtn').textContent  = 'More details ▾';
        lookupResult = null; audioUrlUK = null; audioUrlUS = null; currentWordForms = null;
    }

    function renderFormsChips(forms) {
        const row   = document.getElementById('drawerFormsRow');
        const chips = document.getElementById('drawerFormsChips');
        if (!forms || !Object.keys(forms).length) { row.style.display = 'none'; return; }
        chips.innerHTML = FORMS_ORDER.filter(k => forms[k])
            .map(k => `<span style="background:#f0f4ff;border-radius:3px;padding:2px 6px;font-size:0.78rem;color:#444">${FORMS_LABELS[k]}: <strong>${esc(forms[k])}</strong></span>`)
            .join('');
        row.style.display = 'block';
    }

    async function drawerLookup() {
        const word = document.getElementById('drawerWordInput').value.trim().toLowerCase();
        if (!word) return;

        const dup = editingWordId === null ? allWords.find(w => w.word === word) : null;
        if (dup) {
            const status = document.getElementById('drawerStatus');
            status.style.display = 'block'; status.style.color = '#e67e22';
            const on = dup.created_at ? formatDate(localYMD(new Date(dup.created_at))) : null;
            status.textContent = on
                ? `"${word}" is already in ${activeLearner.display_name}'s list — learned ${on}.`
                : `"${word}" is already in ${activeLearner.display_name}'s list.`;
            return;
        }

        const status = document.getElementById('drawerStatus');
        const btn    = document.getElementById('drawerLookupBtn');

        ['drawerIpa','drawerPos','drawerEngDef','drawerChiDef','drawerExample','drawerSynonyms','drawerAntonyms','drawerQuotes'].forEach(id =>
            (document.getElementById(id).value = ''));
        document.getElementById('drawerFormsRow').style.display  = 'none';
        document.getElementById('drawerFormsChips').innerHTML    = '';
        document.getElementById('drawerPronPanel').style.display = 'none';
        document.getElementById('drawerPronUS').style.display    = 'none';
        document.getElementById('drawerPronUK').style.display    = 'none';
        currentWordForms = null;

        status.style.display = 'block'; status.style.color = '#666';
        status.textContent   = 'Looking up…';
        btn.disabled = true;

        try {
            const res = await fetch(`https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}?translations=true`);
            if (res.ok) {
                const data   = await res.json();
                const entry  = data.entries?.[0];
                const ps     = entry?.pronunciations ?? [];
                const senses = entry?.senses ?? [];
                const ukIpa  = ps.find(p => p.type === 'ipa' && p.tags?.includes('Received Pronunciation'))?.text ?? null;
                const usIpa  = ps.find(p => p.type === 'ipa' && p.tags?.includes('General American'))?.text ?? null;
                const baseIpa = ukIpa ?? usIpa ?? ps.find(p => p.type === 'ipa')?.text ?? null;
                const ipa = (usIpa && ukIpa) ? `${usIpa}$${ukIpa}` : (usIpa ?? ukIpa ?? baseIpa);
                const example    = senses.reduce((f, s) => f ?? s.examples?.[0] ?? null, null);
                const chineseDef = await fetchChineseDefinition(word, senses[0]);
                currentWordForms = extractForms(entry, word);
                drawerFill({
                    ipa, part_of_speech: entry?.partOfSpeech ?? null,
                    english_definition: extractDefinitions(data.entries), chinese_definition: chineseDef,
                    example_sentence: example, synonyms: extractSynonyms(entry),
                    antonyms: extractAntonyms(entry), quotes: extractQuotes(entry), word_forms: currentWordForms,
                });
                await drawerShowPron(word, usIpa, ukIpa);
                status.textContent = 'Review and edit before saving.';
                lookupResult = 'found';
            } else {
                status.textContent = 'Not found — check spelling or fill in manually.';
                lookupResult = 'not_found';
            }
        } catch {
            status.textContent = 'Could not reach dictionary — fill in manually.';
            lookupResult = 'not_found';
        }

        document.getElementById('drawerDetails').style.display = 'block';
        btn.disabled = false;
    }

    async function drawerShowPron(word, usIpa, ukIpa) {
        const panel = document.getElementById('drawerPronPanel');
        const usBtn = document.getElementById('drawerPronUS');
        const ukBtn = document.getElementById('drawerPronUK');
        audioUrlUS = null; audioUrlUK = null;
        const usUrl = `https://api.dictionaryapi.dev/media/pronunciations/en/${word}-us.mp3`;
        const ukUrl = `https://api.dictionaryapi.dev/media/pronunciations/en/${word}-uk.mp3`;
        const [usOk, ukOk] = await Promise.all([probeAudio(usUrl), probeAudio(ukUrl)]);
        if (usOk) { audioUrlUS = usUrl; usBtn.textContent = usIpa ? `🔊 US ${usIpa}` : '🔊 US'; usBtn.dataset.src = usUrl; usBtn.style.display = 'inline-flex'; }
        if (ukOk) { audioUrlUK = ukUrl; ukBtn.textContent = ukIpa ? `🔊 UK ${ukIpa}` : '🔊 UK'; ukBtn.dataset.src = ukUrl; ukBtn.style.display = 'inline-flex'; }
        panel.style.display = usOk || ukOk ? 'block' : 'none';
    }

    function drawerFill(data) {
        if (data.ipa != null)                document.getElementById('drawerIpa').value      = data.ipa;
        if (data.part_of_speech != null)     document.getElementById('drawerPos').value       = data.part_of_speech;
        if (data.english_definition != null) document.getElementById('drawerEngDef').value    = data.english_definition;
        if (data.chinese_definition != null) document.getElementById('drawerChiDef').value    = data.chinese_definition;
        if (data.example_sentence != null)   document.getElementById('drawerExample').value   = data.example_sentence;
        if (data.synonyms != null)           document.getElementById('drawerSynonyms').value  = data.synonyms;
        if (data.antonyms != null)           document.getElementById('drawerAntonyms').value  = data.antonyms;
        if (data.quotes != null)             document.getElementById('drawerQuotes').value    = data.quotes;
        if (data.word_forms != null)         renderFormsChips(data.word_forms);
    }

    function readPayload(word) {
        return {
            word,
            ipa:                document.getElementById('drawerIpa').value.trim()      || null,
            part_of_speech:     document.getElementById('drawerPos').value             || null,
            english_definition: document.getElementById('drawerEngDef').value.trim()   || null,
            chinese_definition: document.getElementById('drawerChiDef').value.trim()   || null,
            example_sentence:   document.getElementById('drawerExample').value.trim()  || null,
            synonyms:           document.getElementById('drawerSynonyms').value.trim() || null,
            antonyms:           document.getElementById('drawerAntonyms').value.trim() || null,
            quotes:             document.getElementById('drawerQuotes').value.trim()   || null,
            audio_url_uk:       audioUrlUK,
            audio_url_us:       audioUrlUS,
            word_forms:         currentWordForms,
        };
    }

    async function saveEdit(payload, okEl) {
        const { data: saved, error } = await supabase.from('words')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', editingWordId).select().single();
        if (error) throw error;
        allWords = allWords.map(w => w.id === editingWordId ? { ...w, ...saved } : w);
        redraw();
        okEl.textContent = 'Updated.'; okEl.style.display = 'block';
        setTimeout(() => closeDrawer(), 1000);
    }

    async function saveAdd(payload, okEl) {
        const { data: newWord, error: err1 } = await supabase.from('words').insert({
            user_id: activeLearner.id, category: 'general', ...payload,
        }).select().single();
        if (err1) throw err1;
        const { error: err2 } = await supabase.from('review_schedule').insert({
            word_id: newWord.id, user_id: activeLearner.id,
            next_review_date: localYMD(new Date()),
            review_level: 0, interval_days: 1,
        });
        if (err2) throw err2;
        allWords = [{ ...newWord, review_level: 0 }, ...allWords];
        redraw();
        okEl.textContent = `"${payload.word}" added to ${activeLearner.display_name}'s list!`;
        okEl.style.display = 'block';
        resetDrawer();
        document.getElementById('drawerTitle').textContent   = `Add Word for ${activeLearner.display_name}`;
        document.getElementById('drawerSaveBtn').textContent = 'Save';
        document.getElementById('drawerWordInput').focus();
        setTimeout(() => { okEl.style.display = 'none'; }, 3000);
    }

    async function drawerSave() {
        const word  = document.getElementById('drawerWordInput').value.trim().toLowerCase();
        const errEl = document.getElementById('drawerError');
        const okEl  = document.getElementById('drawerSuccess');
        errEl.style.display = 'none'; okEl.style.display = 'none';

        if (!word) { errEl.textContent = 'Enter a word first.'; errEl.style.display = 'block'; return; }

        if (editingWordId === null && lookupResult === 'not_found') {
            if (!globalThis.confirm(`"${word}" wasn't found in the dictionary — it may be misspelled. Save anyway?`)) return;
        }

        const dupExists = editingWordId === null
            ? allWords.some(w => w.word === word)
            : allWords.some(w => w.word === word && w.id !== editingWordId);
        if (dupExists) {
            errEl.textContent   = `"${word}" is already in ${activeLearner.display_name}'s list.`;
            errEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('drawerSaveBtn');
        btn.textContent = '…'; btn.disabled = true;

        try {
            if (editingWordId) {
                await saveEdit(readPayload(word), okEl);
            } else {
                await saveAdd(readPayload(word), okEl);
            }
        } catch (err) {
            errEl.textContent   = `Could not save: ${err.message}`;
            errEl.style.display = 'block';
        }

        btn.textContent = editingWordId ? 'Update' : 'Save';
        btn.disabled    = false;
    }

    document.getElementById('openDrawerBtn').addEventListener('click', openDrawerForAdd);
    document.getElementById('closeDrawerBtn').addEventListener('click', closeDrawer);
    document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
    document.getElementById('drawerLookupBtn').addEventListener('click', drawerLookup);
    document.getElementById('drawerWordInput').addEventListener('keydown', e => { if (e.key === 'Enter') drawerLookup(); });
    document.getElementById('drawerWordInput').addEventListener('input', () => {
        if (lookupResult !== null) {
            lookupResult = null;
            document.getElementById('drawerDetails').style.display = 'none';
            document.getElementById('drawerStatus').style.display  = 'none';
        }
    });
    document.getElementById('drawerSaveBtn').addEventListener('click', drawerSave);
    document.getElementById('drawerPronUS').addEventListener('click', () => playAudio(document.getElementById('drawerPronUS').dataset.src));
    document.getElementById('drawerPronUK').addEventListener('click', () => playAudio(document.getElementById('drawerPronUK').dataset.src));
    document.getElementById('drawerMoreBtn').addEventListener('click', () => {
        const sec  = document.getElementById('drawerMoreSection');
        const open = sec.style.display !== 'none';
        sec.style.display = open ? 'none' : 'block';
        document.getElementById('drawerMoreBtn').textContent = open ? 'More details ▾' : 'Less details ▴';
    });

    await loadWords(activeLearner);
}

// ── Module-level helpers ──────────────────────────────────────────────────────

async function fetchChineseDefinition(word, sense) {
    const zh = sense?.translations?.find(t => t.language?.code?.startsWith('zh'));
    if (zh) return extractSimplified(zh.word);
    try {
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`);
        if (r.ok) return (await r.json())?.responseData?.translatedText ?? null;
    } catch { /* non-fatal */ }
    return null;
}

async function probeAudio(url) {
    try { const r = await fetch(url); r.body?.cancel(); return r.ok; } catch { return false; }
}

function playAudio(src) { new Audio(src).play().catch(() => {}); }

function extractSimplified(word) {
    const i = word.indexOf('/');
    return (i >= 0 ? word.slice(i + 1) : word).trim();
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
    if (!dateStr || dateStr === 'unknown') return 'Unknown date';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(y === today.getFullYear() ? {} : { year: 'numeric' }) });
}

function ipaBodyHtml(w) {
    if (!w.ipa) return '';
    const [us, uk] = w.ipa.split('$');
    const chips = [];
    if (us) chips.push(`<span class="pron-chip pron-chip-us" style="opacity:0.88;cursor:default">US ${esc(us)}</span>`);
    if (uk || us) chips.push(`<span class="pron-chip pron-chip-uk" style="opacity:0.88;cursor:default">UK ${esc(uk || us)}</span>`);
    return chips.length ? `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.45rem">${chips.join('')}</div>` : '';
}

function wordCardPronRow(w) {
    const parts = [];
    if (w.part_of_speech) parts.push(`<em style="color:#888;font-size:0.8rem">${esc(w.part_of_speech)}</em>`);
    if (w.audio_url_us)   parts.push(`<button class="play-btn pron-chip pron-chip-us" data-src="${esc(w.audio_url_us)}">🔊 US</button>`);
    if (w.audio_url_uk)   parts.push(`<button class="play-btn pron-chip pron-chip-uk" data-src="${esc(w.audio_url_uk)}">🔊 UK</button>`);
    if (!parts.length) return '';
    const dot = '<span style="color:#ccc;font-size:0.7rem">·</span>';
    return `<span style="display:inline-flex;align-items:center;gap:0.3rem;flex-wrap:nowrap">${dot} ${parts.join(' ' + dot + ' ')}</span>`;
}

function wordCard(w) {
    return `
        <div class="word-card" data-id="${w.id}">
            <div class="word-card-header">
                <span class="word-card-title">${esc(w.word)}</span>
                ${wordCardPronRow(w)}
                <span class="srs-badge ${srsBadgeClass(w.review_level ?? 0)}" style="margin-left:auto">${srsLabel(w.review_level ?? 0)}</span>
            </div>
            <div class="word-card-body">${wordCardBody(w)}</div>
        </div>`;
}

function wordCardBody(w) {
    const lines      = (w.english_definition || '').split('\n').filter(Boolean);
    const primaryDef = lines[0] ? `<p style="font-size:0.93rem;color:#333;margin:0.2rem 0 0.1rem">${esc(lines[0])}</p>` : '';
    const chiHtml    = w.chinese_definition ? `<p style="font-size:1rem;font-weight:500;margin:0.05rem 0 0.25rem">🇨🇳 ${esc(w.chinese_definition)}</p>` : '';
    const extraDefs  = lines.slice(1).length > 0
        ? `<ol style="margin:0 0 0.25rem 1.1rem;padding:0;font-size:0.85rem;color:#555">${lines.slice(1).map(l => '<li>' + esc(l) + '</li>').join('')}</ol>` : '';
    const exHtml  = w.example_sentence ? `<p style="font-size:0.85rem;color:#666;font-style:italic;margin:0.15rem 0">"${esc(w.example_sentence)}"</p>` : '';
    const synHtml = w.synonyms ? `<p style="font-size:0.8rem;color:#555;margin:0.1rem 0"><strong>Syn:</strong> ${esc(w.synonyms)}</p>` : '';
    const antHtml = w.antonyms ? `<p style="font-size:0.8rem;color:#555;margin:0.1rem 0"><strong>Ant:</strong> ${esc(w.antonyms)}</p>` : '';
    const qHtml   = quotesHtml(w.quotes);
    const catHtml = w.category && w.category !== 'general' ? `<p style="font-size:0.78rem;color:#999;margin:0.1rem 0">Category: ${esc(w.category)}</p>` : '';

    const extraContent = extraDefs + exHtml + synHtml + antHtml + qHtml + catHtml;
    const wid = esc(w.id);
    const moreSection = extraContent
        ? `<button class="expand-more-btn" data-id="${wid}" style="background:none;border:none;color:#007bff;font-size:0.8rem;padding:2px 0;margin-top:0.3rem;cursor:pointer;text-decoration:underline">More ▾</button><div id="extra-${wid}" style="display:none;margin-top:0.25rem;border-top:1px solid #f0f0f0;padding-top:0.35rem">${extraContent}</div>`
        : '';

    const actionsHtml = `
        <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.6rem;padding-top:0.4rem;border-top:1px solid #f0f0f0">
            <button class="edit-btn btn btn-secondary btn-sm" data-id="${wid}" style="font-size:0.78rem;padding:3px 10px">✏️ Edit</button>
            <button class="delete-btn btn btn-danger btn-sm" data-id="${wid}" data-word="${esc(w.word)}" style="font-size:0.78rem;padding:3px 10px">Trash</button>
        </div>`;

    return ipaBodyHtml(w) + formsHtml(w.word_forms) + chiHtml + primaryDef + moreSection + actionsHtml;
}

// ── API extraction helpers ────────────────────────────────────────────────────

function extractDefinitions(entries) {
    const defs = [];
    for (const entry of (entries ?? [])) {
        const pos = entry.partOfSpeech ? `(${entry.partOfSpeech}) ` : '';
        let count = 0;
        for (const sense of (entry.senses ?? [])) {
            if (!sense.definition) continue;
            defs.push(`${pos}${sense.definition}`);
            if (++count >= 2 || defs.length >= 8) break;
        }
        if (defs.length >= 8) break;
    }
    return defs.join('\n') || null;
}

function extractSynonyms(entry) {
    const seen = new Set();
    for (const s of (entry?.senses ?? []))
        for (const syn of (s.synonyms ?? [])) { seen.add(syn); if (seen.size >= 12) return [...seen].join(', '); }
    return seen.size > 0 ? [...seen].join(', ') : null;
}

function extractAntonyms(entry) {
    const seen = new Set();
    for (const s of (entry?.senses ?? []))
        for (const ant of (s.antonyms ?? [])) { seen.add(ant); if (seen.size >= 8) return [...seen].join(', '); }
    return seen.size > 0 ? [...seen].join(', ') : null;
}

function extractQuotes(entry) {
    const lines = [];
    for (const s of (entry?.senses ?? []))
        for (const q of (s.quotes ?? [])) {
            if (!q.text) continue;
            lines.push(q.reference ? `${q.text} — ${q.reference}` : q.text);
            if (lines.length >= 4) return lines.join('\n');
        }
    return lines.length > 0 ? lines.join('\n') : null;
}

const FORM_SKIP  = new Set(['archaic','obsolete','colloquial','nonstandard','dialectal','rare','informal','alternative','table-tags','inflection-template','error-unrecognized-form','error-unknown-tag','dated','proscribed']);
const FORM_RULES = [
    { key: 'past',           require: ['past'],                               exclude: ['participle'] },
    { key: 'pastParticiple', require: ['past','participle'],                  exclude: [] },
    { key: 'thirdPerson',    require: ['third-person','present','singular'],  exclude: [] },
    { key: 'gerund',         require: ['participle','present'],               exclude: [] },
    { key: 'plural',         require: ['plural'],                             exclude: ['past'] },
    { key: 'comparative',    require: ['comparative'],                        exclude: [] },
    { key: 'superlative',    require: ['superlative'],                        exclude: [] },
];

function extractForms(entry, word) {
    const forms = {};
    for (const f of (entry?.forms ?? [])) {
        if (f.word === word || (f.tags ?? []).some(t => FORM_SKIP.has(t))) continue;
        const ts = new Set(f.tags ?? []);
        for (const rule of FORM_RULES)
            if (!forms[rule.key] && rule.require.every(t => ts.has(t)) && rule.exclude.every(t => !ts.has(t)))
                forms[rule.key] = f.word;
    }
    return Object.keys(forms).length > 0 ? forms : null;
}

const FORMS_ORDER  = ['thirdPerson','gerund','past','pastParticiple','plural','comparative','superlative'];
const FORMS_LABELS = { thirdPerson: '3rd', gerund: '-ing', past: 'past', pastParticiple: 'past part.', plural: 'pl.', comparative: 'comp.', superlative: 'superl.' };

function formsHtml(forms) {
    if (!forms || !Object.keys(forms).length) return '';
    const chips = FORMS_ORDER.filter(k => forms[k])
        .map(k => `<span style="background:#f0f4ff;border-radius:3px;padding:1px 5px;font-size:0.75rem;color:#555">${FORMS_LABELS[k]}: <strong>${esc(forms[k])}</strong></span>`)
        .join(' ');
    return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:0.25rem">${chips}</div>`;
}

function quotesHtml(quotes) {
    if (!quotes) return '';
    return quotes.split('\n').filter(Boolean).slice(0, 2).map(line => {
        const i    = line.lastIndexOf(' — ');
        const text = i > 0 ? line.slice(0, i) : line;
        const ref  = i > 0 ? line.slice(i + 3) : null;
        const refShort = ref && ref.length > 80 ? ref.slice(0, 80) + '…' : ref;
        const refHtml = refShort ? `<br><small style="color:#999">${esc(refShort)}</small>` : '';
        return `<blockquote style="margin:0.25rem 0;border-left:2px solid #ddd;padding-left:0.5rem;font-size:0.78rem;color:#666"><em>"${esc(text)}"</em>${refHtml}</blockquote>`;
    }).join('');
}

function esc(str) {
    return String(str ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}
