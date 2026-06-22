import { getWordsWithSRS, getTrashedWords, deleteWord, restoreWord, permanentlyDeleteWord, addWord, updateWord, getUserXP, getUserStreak } from '../js/db.js';
import { srsLabel, srsBadgeClass } from '../js/lib/srs.js';
import { checkAndAward } from '../js/lib/achievements.js';

const PARTS_OF_SPEECH = ['noun','verb','adjective','adverb','pronoun','preposition','conjunction','interjection'];

export async function render(container) {
    container.innerHTML = `
        <div style="max-width:700px;margin:0 auto">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;flex-wrap:wrap">
                <h2 style="margin:0;flex:1">My Words</h2>
                <div style="position:relative">
                    <button id="sortBtn" class="btn btn-secondary btn-sm">📅 By Date ▾</button>
                    <div id="sortMenu" style="display:none;position:absolute;right:0;top:calc(100% + 4px);background:#fff;border:1px solid #dee2e6;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:20;min-width:140px;overflow:hidden">
                        <button class="sort-opt" data-sort="date"  style="display:block;width:100%;text-align:left;padding:0.5rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.85rem">📅 By Date</button>
                        <button class="sort-opt" data-sort="alpha" style="display:block;width:100%;text-align:left;padding:0.5rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.85rem">A–Z</button>
                        <button class="sort-opt" data-sort="level" style="display:block;width:100%;text-align:left;padding:0.5rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.85rem">⭐ By Level</button>
                    </div>
                </div>
                <button id="calPickerBtn" class="btn btn-secondary btn-sm" title="Filter by date">📅 Date</button>
                <button id="openDrawerBtn" class="btn btn-primary btn-sm">+ Add Word</button>
            </div>
            <input type="search" id="searchInput" placeholder="Search words…" style="width:100%;margin-bottom:0.5rem">
            <div id="dateFilterChip" style="display:none;align-items:center;gap:0.5rem;margin-bottom:0.5rem;padding:0.35rem 0.75rem;background:#e8f0fe;border-radius:20px;font-size:0.82rem;color:#1a56db">
                <span id="dateFilterLabel">📅</span>
                <button id="clearDateFilter" style="background:none;border:none;cursor:pointer;font-size:1.1rem;line-height:1;color:#1a56db;padding:0;margin-left:auto">×</button>
            </div>
            <div id="calendarPicker" style="display:none;background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:0.75rem;margin-bottom:0.75rem;box-shadow:0 2px 8px rgba(0,0,0,.08)">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
                    <button id="calPickPrev" class="btn btn-secondary btn-sm">←</button>
                    <span id="calPickTitle" style="flex:1;text-align:center;font-weight:600;font-size:0.88rem"></span>
                    <button id="calPickNext" class="btn btn-secondary btn-sm">→</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;margin-bottom:3px">
                    ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div style="font-size:0.65rem;color:#aaa;padding:2px 0">${d}</div>`).join('')}
                </div>
                <div id="calPickGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
            </div>
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

    let allWords      = await getWordsWithSRS();
    let currentSort   = 'date';
    let editingWordId = null;
    let lookupResult  = null; // null | 'found' | 'not_found'
    let audioUrlUK      = null;
    let audioUrlUS      = null;
    let currentWordForms = null;

    // Date filter passed from Home calendar via sessionStorage
    let dateFilter = sessionStorage.getItem('wordDateFilter') || null;
    sessionStorage.removeItem('wordDateFilter');

    const todayStr     = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const expandedDates = new Set([todayStr, yesterdayStr]);
    if (dateFilter) expandedDates.add(dateFilter);
    let dateGroups = new Map();

    // Show date filter chip if navigated here from calendar
    function updateDateChip() {
        const chip = document.getElementById('dateFilterChip');
        if (dateFilter) {
            document.getElementById('dateFilterLabel').textContent = `📅 ${formatDate(dateFilter)}`;
            chip.style.display = 'flex';
        } else {
            chip.style.display = 'none';
        }
        redraw();
    }

    // Open the add drawer if Home's "+ Add Word" button triggered navigation
    if (sessionStorage.getItem('openAddDrawer')) {
        sessionStorage.removeItem('openAddDrawer');
        // defer until DOM is ready (render hasn't returned yet)
        setTimeout(() => openDrawerForAdd(), 0);
    }

    // ── List rendering ─────────────────────────────────────────────────────────

    function filteredWords() {
        const q = document.getElementById('searchInput').value.toLowerCase();
        let words = allWords.filter(w =>
            w.word.toLowerCase().includes(q) ||
            (w.english_definition || '').toLowerCase().includes(q) ||
            (w.synonyms || '').toLowerCase().includes(q)
        );
        if (dateFilter) {
            words = words.filter(w => (w.created_at || '').startsWith(dateFilter));
        }
        return words;
    }

    function redraw() {
        const words = filteredWords();
        const list  = document.getElementById('wordList');
        if (!list) return;

        if (words.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <h3>No words found</h3>
                    <p>Try a different search, or click <strong>+ Add Word</strong>.</p>
                </div>`;
            return;
        }

        if (currentSort === 'alpha') {
            const sorted = [...words].sort((a, b) => a.word.localeCompare(b.word));
            list.innerHTML = sorted.map(wordCard).join('');
        } else if (currentSort === 'level') {
            const sorted = [...words].sort((a, b) => (b.review_level || 0) - (a.review_level || 0));
            list.innerHTML = sorted.map(wordCard).join('');
        } else {
            // Date sort: group by created_at date, newest first; lazy-expand
            dateGroups = new Map();
            for (const w of words) {
                const d = (w.created_at || '').split('T')[0] || 'unknown';
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

    function updateSortBtn() {
        document.getElementById('sortBtn').textContent = `${SORT_LABELS[currentSort]} ▾`;
    }

    document.getElementById('sortBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('sortMenu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        document.getElementById('calendarPicker').style.display = 'none';
    });

    document.getElementById('sortMenu').addEventListener('click', (e) => {
        e.stopPropagation();
        const opt = e.target.closest('.sort-opt');
        if (!opt) return;
        currentSort = opt.dataset.sort;
        updateSortBtn();
        document.getElementById('sortMenu').style.display = 'none';
        redraw();
    });

    // ── Calendar picker ───────────────────────────────────────────────────────
    let calPickYear  = new Date().getFullYear();
    let calPickMonth = new Date().getMonth();

    function computeWordActivity() {
        const counts = {};
        for (const w of allWords) {
            const d = (w.created_at || '').split('T')[0];
            if (d) counts[d] = (counts[d] || 0) + 1;
        }
        return counts;
    }

    function renderCalPick() {
        document.getElementById('calPickTitle').textContent = new Date(calPickYear, calPickMonth, 1)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const activity     = computeWordActivity();
        const today        = new Date().toISOString().split('T')[0];
        const daysInMonth  = new Date(calPickYear, calPickMonth + 1, 0).getDate();
        const firstWeekday = new Date(calPickYear, calPickMonth, 1).getDay();
        const mm           = String(calPickMonth + 1).padStart(2, '0');
        let html = '<div></div>'.repeat(firstWeekday);
        for (let d = 1; d <= daysInMonth; d++) {
            const ds = `${calPickYear}-${mm}-${String(d).padStart(2, '0')}`;
            html += buildPickDay(ds, d, ds === today, ds === dateFilter, activity[ds] || 0);
        }
        document.getElementById('calPickGrid').innerHTML = html;
    }

    document.getElementById('calPickerBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const picker = document.getElementById('calendarPicker');
        const open   = picker.style.display === 'none';
        picker.style.display = open ? 'block' : 'none';
        document.getElementById('sortMenu').style.display = 'none';
        if (open) renderCalPick();
    });

    document.getElementById('calendarPicker').addEventListener('click', (e) => {
        e.stopPropagation();
        const cell = e.target.closest('[data-date]');
        if (!cell) return;
        const ds       = cell.dataset.date;
        const activity = computeWordActivity();
        if (!activity[ds]) return;
        dateFilter = dateFilter === ds ? null : ds;
        if (dateFilter) expandedDates.add(dateFilter);
        updateDateChip();
        renderCalPick();
        if (dateFilter) document.getElementById('calendarPicker').style.display = 'none';
    });

    document.getElementById('calPickPrev').addEventListener('click', (e) => {
        e.stopPropagation();
        calPickMonth--;
        if (calPickMonth < 0) { calPickMonth = 11; calPickYear--; }
        renderCalPick();
    });

    document.getElementById('calPickNext').addEventListener('click', (e) => {
        e.stopPropagation();
        calPickMonth++;
        if (calPickMonth > 11) { calPickMonth = 0; calPickYear++; }
        renderCalPick();
    });

    // Close sort menu and calendar when clicking anywhere else
    document.addEventListener('click', () => {
        document.getElementById('sortMenu')?.style && (document.getElementById('sortMenu').style.display = 'none');
        document.getElementById('calendarPicker')?.style && (document.getElementById('calendarPicker').style.display = 'none');
    });

    // ── Word list click handlers (extracted to keep complexity manageable) ──────

    function handleGroupToggle(e) {
        const groupHeader = e.target.closest('.date-group-header');
        if (!groupHeader) return false;
        const date    = groupHeader.dataset.date;
        const body    = document.querySelector(`.date-group-body[data-date="${date}"]`);
        const chevron = groupHeader.querySelector('.date-chevron');
        if (expandedDates.has(date)) {
            expandedDates.delete(date);
            body.innerHTML      = '';
            body.style.display  = 'none';
            chevron.textContent = '▸';
        } else {
            expandedDates.add(date);
            body.innerHTML      = (dateGroups.get(date) || []).map(wordCard).join('');
            body.style.display  = '';
            chevron.textContent = '▾';
        }
        return true;
    }

    function handleMoreToggle(e) {
        const moreBtn = e.target.closest('.expand-more-btn');
        if (!moreBtn) return false;
        e.stopPropagation();
        const extra = document.getElementById('extra-' + moreBtn.dataset.id);
        if (!extra) return true;
        const open = extra.style.display !== 'none';
        extra.style.display = open ? 'none' : 'block';
        moreBtn.textContent = open ? 'More ▾' : 'Less ▴';
        return true;
    }

    async function handleDeleteBtn(e) {
        const deleteBtn = e.target.closest('.delete-btn');
        if (!deleteBtn) return false;
        e.stopPropagation();
        const { id, word } = deleteBtn.dataset;
        if (!confirm(`Delete "${word}"? This cannot be undone.`)) return true;
        deleteBtn.textContent = '…';
        deleteBtn.disabled    = true;
        await deleteWord(id);
        allWords = allWords.filter(w => w.id !== id);
        redraw();
        return true;
    }

    function handleEditBtn(e) {
        const editBtn = e.target.closest('.edit-btn');
        if (!editBtn) return false;
        e.stopPropagation();
        const word = allWords.find(w => w.id === editBtn.dataset.id);
        if (word) openDrawerForEdit(word);
        return true;
    }

    document.getElementById('wordList').addEventListener('click', async (e) => {
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
    document.getElementById('clearDateFilter').addEventListener('click', () => {
        dateFilter = null;
        updateDateChip();
    });
    updateDateChip();

    // ── Trash ─────────────────────────────────────────────────────────────────

    let trashedWords = [];
    let trashOpen    = false;

    async function loadTrash() {
        trashedWords = await getTrashedWords();
        const section = document.getElementById('trashSection');
        document.getElementById('trashLabel').textContent = `🗑 Trash (${trashedWords.length})`;
        section.style.display = trashedWords.length > 0 ? 'block' : 'none';
        if (trashOpen) renderTrash();
    }

    function renderTrash() {
        document.getElementById('trashList').innerHTML = trashedWords.map(w => `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid #f0f0f0">
                <span style="flex:1;font-size:0.9rem;color:#aaa;text-decoration:line-through">${esc(w.word)}</span>
                <button class="restore-btn btn btn-secondary btn-sm" data-id="${w.id}"
                        style="font-size:0.75rem;padding:2px 8px">Restore</button>
                <button class="perm-delete-btn btn btn-danger btn-sm" data-id="${w.id}" data-word="${esc(w.word)}"
                        style="font-size:0.75rem;padding:2px 8px">Delete forever</button>
            </div>`).join('') || '<p style="color:#aaa;font-size:0.85rem;margin:0.5rem 0">Trash is empty.</p>';
    }

    document.getElementById('trashToggle').addEventListener('click', () => {
        trashOpen = !trashOpen;
        document.getElementById('trashChevron').textContent = trashOpen ? '▼' : '▶';
        document.getElementById('trashList').style.display  = trashOpen ? 'block' : 'none';
        if (trashOpen) renderTrash();
    });

    document.getElementById('trashList').addEventListener('click', async (e) => {
        const restoreBtn = e.target.closest('.restore-btn');
        const permBtn    = e.target.closest('.perm-delete-btn');

        if (restoreBtn) {
            restoreBtn.disabled    = true;
            restoreBtn.textContent = '…';
            await restoreWord(restoreBtn.dataset.id);
            allWords = await getWordsWithSRS();
            redraw();
            await loadTrash();
            return;
        }
        if (permBtn) {
            const { id, word } = permBtn.dataset;
            if (!confirm(`Permanently delete "${word}"? This cannot be undone.`)) return;
            permBtn.disabled = true;
            await permanentlyDeleteWord(id);
            await loadTrash();
        }
    });

    loadTrash();

    // ── Drawer ────────────────────────────────────────────────────────────────

    function openDrawer() {
        document.getElementById('addDrawer').style.display  = 'block';
        document.getElementById('drawerOverlay').style.display = 'block';
        document.getElementById('drawerWordInput').focus();
    }

    function openDrawerForAdd() {
        editingWordId = null;
        resetDrawer();
        document.getElementById('drawerTitle').textContent    = 'Add Word';
        document.getElementById('drawerSaveBtn').textContent  = 'Save';
        openDrawer();
    }

    function openDrawerForEdit(word) {
        editingWordId = word.id;
        resetDrawer();
        document.getElementById('drawerTitle').textContent   = 'Edit Word';
        document.getElementById('drawerSaveBtn').textContent = 'Update';
        document.getElementById('drawerWordInput').value = word.word;
        currentWordForms = word.word_forms ?? null;
        drawerFill({
            ipa:                word.ipa,
            part_of_speech:     word.part_of_speech,
            english_definition: word.english_definition,
            chinese_definition: word.chinese_definition,
            example_sentence:   word.example_sentence,
            synonyms:           word.synonyms,
            antonyms:           word.antonyms,
            quotes:             word.quotes,
            word_forms:         word.word_forms,
        });

        // Restore saved audio URLs; parse usIpa$ukIpa for button labels (US first)
        audioUrlUS = word.audio_url_us ?? null;
        audioUrlUK = word.audio_url_uk ?? null;
        if (audioUrlUS || audioUrlUK) {
            const ipaParts = (word.ipa || '').split('$');
            const editUsIpa = ipaParts[0] || '';
            const editUkIpa = ipaParts[1] || '';
            const panel = document.getElementById('drawerPronPanel');
            const usBtn = document.getElementById('drawerPronUS');
            const ukBtn = document.getElementById('drawerPronUK');
            panel.style.display = 'block';
            if (audioUrlUS) { usBtn.textContent = editUsIpa ? `🔊 US ${editUsIpa}` : '🔊 US'; usBtn.dataset.src = audioUrlUS; usBtn.style.display = 'inline-flex'; }
            if (audioUrlUK) { ukBtn.textContent = editUkIpa ? `🔊 UK ${editUkIpa}` : '🔊 UK'; ukBtn.dataset.src = audioUrlUK; ukBtn.style.display = 'inline-flex'; }
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
            el.style.display = 'none';
            el.textContent   = '';
        });
        document.getElementById('drawerDetails').style.display  = 'none';
        document.getElementById('drawerPronPanel').style.display = 'none';
        document.getElementById('drawerPronUK').style.display   = 'none';
        document.getElementById('drawerPronUS').style.display   = 'none';
        document.getElementById('drawerWordInput').value       = '';
        document.getElementById('drawerIpa').value             = '';
        document.getElementById('drawerPos').value             = '';
        document.getElementById('drawerEngDef').value          = '';
        document.getElementById('drawerChiDef').value          = '';
        document.getElementById('drawerExample').value         = '';
        document.getElementById('drawerSynonyms').value        = '';
        document.getElementById('drawerAntonyms').value        = '';
        document.getElementById('drawerQuotes').value          = '';
        document.getElementById('drawerFormsRow').style.display    = 'none';
        document.getElementById('drawerFormsChips').innerHTML      = '';
        document.getElementById('drawerMoreSection').style.display = 'none';
        document.getElementById('drawerMoreBtn').textContent       = 'More details ▾';
        lookupResult     = null;
        audioUrlUK       = null;
        audioUrlUS       = null;
        currentWordForms = null;
    }

    function renderFormsChips(forms) {
        const row   = document.getElementById('drawerFormsRow');
        const chips = document.getElementById('drawerFormsChips');
        if (!forms || !Object.keys(forms).length) { row.style.display = 'none'; return; }
        chips.innerHTML = FORMS_ORDER
            .filter(k => forms[k])
            .map(k => `<span style="background:#f0f4ff;border-radius:3px;padding:2px 6px;font-size:0.78rem;color:#444">${FORMS_LABELS[k]}: <strong>${esc(forms[k])}</strong></span>`)
            .join('');
        row.style.display = 'block';
    }

    async function drawerLookup() {
        const word = document.getElementById('drawerWordInput').value.trim().toLowerCase();
        if (!word) return;

        // Block lookup if word already exists (add mode only)
        const dupWord = editingWordId === null ? allWords.find(w => w.word === word) : null;
        if (dupWord) {
            const learnedOn = dupWord.created_at
                ? formatDate(dupWord.created_at.split('T')[0])
                : null;
            const status = document.getElementById('drawerStatus');
            status.style.display = 'block';
            status.style.color   = '#e67e22';
            status.textContent   = learnedOn
                ? `"${word}" is already in your word list — learned ${learnedOn}.`
                : `"${word}" is already in your word list.`;
            // Do NOT reveal drawerDetails — it still holds the previous word's data
            return;
        }

        const status = document.getElementById('drawerStatus');
        const btn    = document.getElementById('drawerLookupBtn');

        // Clear stale values from any previous lookup
        document.getElementById('drawerIpa').value              = '';
        document.getElementById('drawerPos').value              = '';
        document.getElementById('drawerEngDef').value           = '';
        document.getElementById('drawerChiDef').value           = '';
        document.getElementById('drawerExample').value          = '';
        document.getElementById('drawerSynonyms').value         = '';
        document.getElementById('drawerAntonyms').value         = '';
        document.getElementById('drawerQuotes').value           = '';
        document.getElementById('drawerFormsRow').style.display = 'none';
        document.getElementById('drawerFormsChips').innerHTML   = '';
        document.getElementById('drawerPronPanel').style.display = 'none';
        document.getElementById('drawerPronUK').style.display    = 'none';
        document.getElementById('drawerPronUS').style.display    = 'none';
        currentWordForms = null;

        status.style.display = 'block';
        status.style.color   = '#666';
        status.textContent   = 'Looking up…';
        btn.disabled = true;

        try {
            const dictRes = await fetch(
                `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}?translations=true`
            );
            if (dictRes.ok) {
                const data   = await dictRes.json();
                const entry  = data.entries?.[0];
                const ps     = entry?.pronunciations ?? [];
                const senses = entry?.senses ?? [];
                const sense  = senses[0];

                const ukIpa = ps.find(p => p.type === 'ipa' && p.tags?.includes('Received Pronunciation'))?.text ?? null;
                const usIpa = ps.find(p => p.type === 'ipa' && p.tags?.includes('General American'))?.text ?? null;
                const baseIpa = ukIpa ?? usIpa ?? ps.find(p => p.type === 'ipa')?.text ?? null;
                // Store as usIpa$ukIpa (US first); omit second part when only one exists
                let ipa;
                if (usIpa && ukIpa) { ipa = `${usIpa}$${ukIpa}`; }
                else                { ipa = usIpa ?? ukIpa ?? baseIpa; }

                // First example found across all senses
                const example = senses.reduce((found, s) => found ?? s.examples?.[0] ?? null, null);
                const chineseDef = await fetchChineseDefinition(word, sense);

                currentWordForms = extractForms(entry, word);
                drawerFill({
                    ipa,
                    part_of_speech:     entry?.partOfSpeech ?? null,
                    english_definition: extractDefinitions(data.entries),
                    chinese_definition: chineseDef,
                    example_sentence:   example,
                    synonyms:           extractSynonyms(entry),
                    antonyms:           extractAntonyms(entry),
                    quotes:             extractQuotes(entry),
                    word_forms:         currentWordForms,
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
        audioUrlUS = null;
        audioUrlUK = null;

        const usUrl = `https://api.dictionaryapi.dev/media/pronunciations/en/${word}-us.mp3`;
        const ukUrl = `https://api.dictionaryapi.dev/media/pronunciations/en/${word}-uk.mp3`;
        const [usOk, ukOk] = await Promise.all([probeAudio(usUrl), probeAudio(ukUrl)]);

        if (usOk) {
            audioUrlUS    = usUrl;
            usBtn.textContent  = usIpa ? `🔊 US ${usIpa}` : '🔊 US';
            usBtn.dataset.src  = usUrl;
            usBtn.style.display = 'inline-flex';
        }
        if (ukOk) {
            audioUrlUK    = ukUrl;
            ukBtn.textContent  = ukIpa ? `🔊 UK ${ukIpa}` : '🔊 UK';
            ukBtn.dataset.src  = ukUrl;
            ukBtn.style.display = 'inline-flex';
        }
        panel.style.display = usOk || ukOk ? 'block' : 'none';
    }

    function drawerFill(data) {
        if (data.ipa != null)               document.getElementById('drawerIpa').value      = data.ipa;
        if (data.part_of_speech != null)    document.getElementById('drawerPos').value       = data.part_of_speech;
        if (data.english_definition != null)document.getElementById('drawerEngDef').value    = data.english_definition;
        if (data.chinese_definition != null)document.getElementById('drawerChiDef').value    = data.chinese_definition;
        if (data.example_sentence != null)  document.getElementById('drawerExample').value   = data.example_sentence;
        if (data.synonyms != null)          document.getElementById('drawerSynonyms').value  = data.synonyms;
        if (data.antonyms != null)          document.getElementById('drawerAntonyms').value  = data.antonyms;
        if (data.quotes != null)            document.getElementById('drawerQuotes').value    = data.quotes;
        if (data.word_forms != null)        renderFormsChips(data.word_forms);
    }

    async function drawerSave() {
        const word  = document.getElementById('drawerWordInput').value.trim().toLowerCase();
        const errEl = document.getElementById('drawerError');
        const okEl  = document.getElementById('drawerSuccess');
        errEl.style.display = 'none';
        okEl.style.display  = 'none';

        if (!word) {
            errEl.textContent = 'Enter a word first.';
            errEl.style.display = 'block';
            return;
        }

        // Spelling warning (only in add mode — edit mode doesn't re-lookup)
        if (editingWordId === null && lookupResult === 'not_found') {
            if (!globalThis.confirm(`"${word}" wasn't found in the dictionary — it may be misspelled. Save anyway?`)) return;
        }

        // Duplicate check
        const dupExists = editingWordId === null
            ? allWords.some(w => w.word === word)
            : allWords.some(w => w.word === word && w.id !== editingWordId);
        if (dupExists) {
            errEl.textContent = `"${word}" is already in your word list.`;
            errEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('drawerSaveBtn');
        btn.textContent = '…';
        btn.disabled = true;

        const payload = {
            ipa:               document.getElementById('drawerIpa').value.trim()        || null,
            partOfSpeech:      document.getElementById('drawerPos').value               || null,
            englishDefinition: document.getElementById('drawerEngDef').value.trim()     || null,
            chineseDefinition: document.getElementById('drawerChiDef').value.trim()     || null,
            exampleSentence:   document.getElementById('drawerExample').value.trim()    || null,
            synonyms:          document.getElementById('drawerSynonyms').value.trim()   || null,
            antonyms:          document.getElementById('drawerAntonyms').value.trim()   || null,
            quotes:            document.getElementById('drawerQuotes').value.trim()     || null,
            audioUrlUK,
            audioUrlUS,
            wordForms: currentWordForms,
        };

        try {
            if (editingWordId) {
                const saved = await updateWord(editingWordId, {
                    word,
                    ipa:                payload.ipa,
                    part_of_speech:     payload.partOfSpeech,
                    english_definition: payload.englishDefinition,
                    chinese_definition: payload.chineseDefinition,
                    example_sentence:   payload.exampleSentence,
                    audio_url_uk:       payload.audioUrlUK,
                    audio_url_us:       payload.audioUrlUS,
                    word_forms:         payload.wordForms,
                    synonyms:           payload.synonyms,
                    antonyms:           payload.antonyms,
                    quotes:             payload.quotes,
                    updated_at:         new Date().toISOString(),
                });
                allWords = allWords.map(w => w.id === editingWordId ? { ...w, ...saved } : w);
                redraw();
                okEl.textContent = 'Updated.';
                okEl.style.display = 'block';
                setTimeout(() => closeDrawer(), 1000);
            } else {
                const saved = await addWord({ word, category: 'general', ...payload });
                allWords = [{ ...saved, review_level: 0 }, ...allWords];
                redraw();

                const { wordsAdded } = await getUserXP();
                const streak = await getUserStreak();
                checkAndAward({ wordsAdded, streak });

                okEl.textContent = `"${word}" saved!`;
                okEl.style.display = 'block';
                resetDrawer();
                document.getElementById('drawerTitle').textContent   = 'Add Word';
                document.getElementById('drawerSaveBtn').textContent = 'Save';
                document.getElementById('drawerWordInput').focus();
                setTimeout(() => { okEl.style.display = 'none'; }, 3000);
            }
        } catch (err) {
            errEl.textContent = `Could not save: ${err.message}`;
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
    document.getElementById('drawerPronUK').addEventListener('click', () => playAudio(document.getElementById('drawerPronUK').dataset.src));
    document.getElementById('drawerPronUS').addEventListener('click', () => playAudio(document.getElementById('drawerPronUS').dataset.src));
    document.getElementById('drawerMoreBtn').addEventListener('click', () => {
        const sec  = document.getElementById('drawerMoreSection');
        const btn  = document.getElementById('drawerMoreBtn');
        const open = sec.style.display !== 'none';
        sec.style.display = open ? 'none' : 'block';
        btn.textContent   = open ? 'More details ▾' : 'Less details ▴';
    });
}

// ── Module-level helpers ──────────────────────────────────────────────────────

async function fetchChineseDefinition(word, sense) {
    const zhEntry = sense?.translations?.find(t => t.language?.code?.startsWith('zh'));
    if (zhEntry) return extractSimplified(zhEntry.word);
    try {
        const zh = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`);
        if (zh.ok) return (await zh.json())?.responseData?.translatedText ?? null;
    } catch { /* non-fatal */ }
    return null;
}

async function probeAudio(url) {
    try {
        const r = await fetch(url);
        r.body?.cancel();   // cancel body download — we only needed the status code
        return r.ok;
    } catch { return false; }
}

function playAudio(src) {
    new Audio(src).play().catch(() => {});
}

function extractSimplified(word) {
    const slash = word.indexOf('/');
    return (slash >= 0 ? word.slice(slash + 1) : word).trim();
}

function formatDate(dateStr) {
    const today    = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yestStr  = new Date(today - 86400000).toISOString().split('T')[0];
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yestStr)  return 'Yesterday';
    if (dateStr === 'unknown' || dateStr == null || dateStr === '') return 'Unknown date';
    const [y, m, d] = dateStr.split('-').map(Number);
    const yearOpt  = y === today.getFullYear() ? {} : { year: 'numeric' };
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...yearOpt });
}

// ipaBodyHtml — colored IPA spans shown at the top of the expanded word card body.
// ipa stored as usIpa$ukIpa (US first); single value is reused for both accents.
function ipaBodyHtml(w) {
    if (!w.ipa) return '';
    const parts = w.ipa.split('$');
    const usIpa = parts[0] || null;
    const ukIpa = parts[1] || usIpa;
    const chips = [];
    if (usIpa) chips.push(`<span class="pron-chip pron-chip-us" style="opacity:0.88;cursor:default">US ${esc(usIpa)}</span>`);
    if (ukIpa) chips.push(`<span class="pron-chip pron-chip-uk" style="opacity:0.88;cursor:default">UK ${esc(ukIpa)}</span>`);
    if (!chips.length) return '';
    return '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.45rem">' + chips.join('') + '</div>';
}

// wordCardPronRow — audio play chips in the card header; IPA text lives in the expanded body.
function wordCardPronRow(w) {
    const parts = [];
    if (w.part_of_speech) parts.push(`<em style="color:#888;font-size:0.8rem">${esc(w.part_of_speech)}</em>`);
    if (w.audio_url_us) parts.push(`<button class="play-btn pron-chip pron-chip-us" data-src="${esc(w.audio_url_us)}">🔊 US</button>`);
    if (w.audio_url_uk) parts.push(`<button class="play-btn pron-chip pron-chip-uk" data-src="${esc(w.audio_url_uk)}">🔊 UK</button>`);
    if (!parts.length) return '';
    const dot = '<span style="color:#ccc;font-size:0.7rem">·</span>';
    const sep = ' ' + dot + ' ';
    return `<span style="display:inline-flex;align-items:center;gap:0.3rem;flex-wrap:wrap">${dot} ${parts.join(sep)}</span>`;
}

function wordCard(w) {
    const level = w.review_level ?? 0;
    return `
        <div class="word-card" data-id="${w.id}">
            <div class="word-card-header">
                <span class="word-card-title">${esc(w.word)}</span>
                ${wordCardPronRow(w)}
                <span class="srs-badge ${srsBadgeClass(level)}" style="margin-left:auto">${srsLabel(level)}</span>
                <button class="edit-btn btn btn-secondary btn-sm" data-id="${w.id}"
                        style="width:26px;height:26px;padding:0;font-size:0.75rem;display:inline-flex;align-items:center;justify-content:center" title="Edit">✏️</button>
                <button class="delete-btn btn btn-danger btn-sm" data-id="${w.id}" data-word="${esc(w.word)}"
                        style="width:26px;height:26px;padding:0;font-size:0.75rem;display:inline-flex;align-items:center;justify-content:center" title="Delete">✕</button>
            </div>
            <div class="word-card-body">
                ${wordCardBody(w)}
            </div>
        </div>`;
}

// wordCardBody — simplified layout for an 11-year-old.
// Primary view: IPA, forms, Chinese meaning, first English definition.
// Everything else collapses behind "More ▾".
function wordCardBody(w) {
    const lines      = (w.english_definition || '').split('\n').filter(Boolean);
    const primaryDef = lines[0]
        ? `<p style="font-size:0.93rem;color:#333;margin:0.2rem 0 0.1rem">${esc(lines[0])}</p>`
        : '';
    const chiHtml = w.chinese_definition
        ? `<p style="font-size:1rem;font-weight:500;margin:0.05rem 0 0.25rem">🇨🇳 ${esc(w.chinese_definition)}</p>`
        : '';

    const extraLines  = lines.slice(1);
    const extraDefs   = extraLines.length > 0
        ? `<ol style="margin:0 0 0.25rem 1.1rem;padding:0;font-size:0.85rem;color:#555">${extraLines.map(l => `<li>${esc(l)}</li>`).join('')}</ol>`
        : '';
    const exampleHtml = w.example_sentence
        ? `<p style="font-size:0.85rem;color:#666;font-style:italic;margin:0.15rem 0">"${esc(w.example_sentence)}"</p>`
        : '';
    const synHtml = w.synonyms
        ? `<p style="font-size:0.8rem;color:#555;margin:0.1rem 0"><strong>Syn:</strong> ${esc(w.synonyms)}</p>`
        : '';
    const antHtml = w.antonyms
        ? `<p style="font-size:0.8rem;color:#555;margin:0.1rem 0"><strong>Ant:</strong> ${esc(w.antonyms)}</p>`
        : '';
    const qHtml   = quotesHtml(w.quotes);
    const catHtml = w.category && w.category !== 'general'
        ? `<p style="font-size:0.78rem;color:#999;margin:0.1rem 0">Category: ${esc(w.category)}</p>`
        : '';

    const extraContent = extraDefs + exampleHtml + synHtml + antHtml + qHtml + catHtml;
    const wid = esc(w.id);
    const moreSection  = extraContent
        ? '<button class="expand-more-btn" data-id="' + wid + '"'
          + ' style="background:none;border:none;color:#007bff;font-size:0.8rem;padding:2px 0;margin-top:0.3rem;cursor:pointer;text-decoration:underline">More ▾</button>'
          + '<div id="extra-' + wid + '" style="display:none;margin-top:0.25rem;border-top:1px solid #f0f0f0;padding-top:0.35rem">' + extraContent + '</div>'
        : '';

    return ipaBodyHtml(w) + formsHtml(w.word_forms) + chiHtml + primaryDef + moreSection;
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
            count++;
            if (count >= 2 || defs.length >= 8) break;
        }
        if (defs.length >= 8) break;
    }
    return defs.join('\n') || null;
}

function extractSynonyms(entry) {
    const seen = new Set();
    for (const s of (entry?.senses ?? [])) {
        for (const syn of (s.synonyms ?? [])) {
            seen.add(syn);
            if (seen.size >= 12) return [...seen].join(', ');
        }
    }
    return seen.size > 0 ? [...seen].join(', ') : null;
}

function extractAntonyms(entry) {
    const seen = new Set();
    for (const s of (entry?.senses ?? [])) {
        for (const ant of (s.antonyms ?? [])) {
            seen.add(ant);
            if (seen.size >= 8) return [...seen].join(', ');
        }
    }
    return seen.size > 0 ? [...seen].join(', ') : null;
}

function extractQuotes(entry) {
    const lines = [];
    for (const s of (entry?.senses ?? [])) {
        for (const q of (s.quotes ?? [])) {
            if (!q.text) continue;
            lines.push(q.reference ? `${q.text} — ${q.reference}` : q.text);
            if (lines.length >= 4) return lines.join('\n');
        }
    }
    return lines.length > 0 ? lines.join('\n') : null;
}

const FORM_SKIP = new Set(['archaic','obsolete','colloquial','nonstandard','dialectal','rare','informal','alternative','table-tags','inflection-template','error-unrecognized-form','error-unknown-tag','dated','proscribed']);
const FORM_RULES = [
    { key: 'past',           require: ['past'],                              exclude: ['participle'] },
    { key: 'pastParticiple', require: ['past', 'participle'],                exclude: [] },
    { key: 'thirdPerson',    require: ['third-person', 'present','singular'], exclude: [] },
    { key: 'gerund',         require: ['participle', 'present'],             exclude: [] },
    { key: 'plural',         require: ['plural'],                            exclude: ['past'] },
    { key: 'comparative',    require: ['comparative'],                       exclude: [] },
    { key: 'superlative',    require: ['superlative'],                       exclude: [] },
];

function extractForms(entry, word) {
    const forms = {};
    for (const f of (entry?.forms ?? [])) {
        if (f.word === word || (f.tags ?? []).some(t => FORM_SKIP.has(t))) continue;
        const ts = new Set(f.tags ?? []);
        for (const rule of FORM_RULES) {
            if (!forms[rule.key] && rule.require.every(t => ts.has(t)) && rule.exclude.every(t => !ts.has(t))) {
                forms[rule.key] = f.word;
            }
        }
    }
    return Object.keys(forms).length > 0 ? forms : null;
}

// ── Word card rendering helpers ───────────────────────────────────────────────

function definitionsHtml(defs) {
    if (!defs) return '';
    const lines = defs.split('\n').filter(Boolean);
    if (lines.length <= 1) return `<p><strong>EN:</strong> ${esc(defs)}</p>`;
    const items = lines.map(l => `<li>${esc(l)}</li>`).join('');
    return `<ol style="margin:0.1rem 0 0.35rem 1.25rem;padding:0;font-size:0.88rem;color:#333">${items}</ol>`;
}

const FORMS_ORDER  = ['thirdPerson', 'gerund', 'past', 'pastParticiple', 'plural', 'comparative', 'superlative'];
const FORMS_LABELS = { thirdPerson: '3rd', gerund: '-ing', past: 'past', pastParticiple: 'past part.', plural: 'pl.', comparative: 'comp.', superlative: 'superl.' };

function formsHtml(forms) {
    if (!forms || !Object.keys(forms).length) return '';
    const chips = FORMS_ORDER
        .filter(k => forms[k])
        .map(k => `<span style="background:#f0f4ff;border-radius:3px;padding:1px 5px;font-size:0.75rem;color:#555">${FORMS_LABELS[k]}: <strong>${esc(forms[k])}</strong></span>`)
        .join(' ');
    return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:0.25rem">${chips}</div>`;
}

function quotesHtml(quotes) {
    if (!quotes) return '';
    return quotes.split('\n').filter(Boolean).slice(0, 2).map(quoteLineHtml).join('');
}

function quoteLineHtml(line) {
    const i    = line.lastIndexOf(' — ');
    const text = i > 0 ? line.slice(0, i) : line;
    let refHtml = '';
    if (i > 0) {
        const ref   = line.slice(i + 3);
        const short = ref.length > 80 ? `${ref.slice(0, 80)}…` : ref;
        refHtml = `<br><small style="color:#999">${esc(short)}</small>`;
    }
    return `<blockquote style="margin:0.25rem 0;border-left:2px solid #ddd;padding-left:0.5rem;font-size:0.78rem;color:#666"><em>"${esc(text)}"</em>${refHtml}</blockquote>`;
}

function buildPickDay(ds, d, isToday, isSelected, count) {
    let bg, color, border;
    if (isSelected)    { bg = '#007bff'; color = '#fff';    border = '#007bff'; }
    else if (isToday)  { bg = '#f0f6ff'; color = '#007bff'; border = '#007bff'; }
    else if (count > 0){ bg = '#fafff9'; color = '#333';    border = '#e8e8e8'; }
    else               { bg = '#fff';    color = '#ccc';    border = '#f0f0f0'; }
    const weight     = isToday || isSelected ? '700' : '400';
    const cursor     = count > 0 ? 'pointer' : 'default';
    const countColor = isSelected ? '#fff' : '#007bff';
    const countHtml  = count > 0 ? `<div style="font-size:0.6rem;color:${countColor};line-height:1.2">${count}</div>` : '';
    return `<div data-date="${ds}" style="min-height:38px;border:1px solid ${border};border-radius:5px;padding:3px 4px;background:${bg};cursor:${cursor}"><div style="font-size:0.72rem;font-weight:${weight};color:${color}">${d}</div>${countHtml}</div>`;
}

function esc(str) {
    return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
