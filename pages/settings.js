import { supabase } from '../js/supabase.js';
import { getCurrentUser, getCurrentProfile } from '../js/auth.js';

export async function render(container) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;

    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()]);

    container.innerHTML = `
        <div style="max-width:480px;margin:0 auto">
            <h2 style="margin-bottom:1.5rem">Settings</h2>

            <div class="card" style="margin-bottom:1rem">
                <h3 style="margin:0 0 1rem">Profile</h3>
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
                    <div class="avatar" style="background:${profile?.avatar_color || '#007BFF'};width:52px;height:52px;font-size:1.3rem">
                        ${(profile?.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600">${esc(profile?.display_name || '')}</div>
                        <div style="font-size:0.85rem;color:#666">${esc(user?.email || '')}</div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="displayName">Display name</label>
                    <input type="text" id="displayName" value="${esc(profile?.display_name || '')}" maxlength="30">
                </div>

                <div class="form-group">
                    <label for="avatarColor">Avatar color</label>
                    <input type="color" id="avatarColor" value="${profile?.avatar_color || '#007BFF'}"
                           style="width:60px;height:44px;padding:2px;cursor:pointer;border-radius:8px">
                </div>

                <button id="saveProfileBtn" class="btn btn-primary">Save Profile</button>
                <div id="profileMsg" style="margin-top:0.75rem;font-size:0.9rem;display:none"></div>
            </div>

            <div class="card">
                <h3 style="margin:0 0 0.75rem">Privacy</h3>
                <label style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;font-weight:400">
                    <input type="checkbox" id="isPublic" ${profile?.is_public ? 'checked' : ''}
                           style="width:20px;height:20px;cursor:pointer;min-height:20px">
                    <div>
                        <div style="font-weight:500">Show my profile on the leaderboard</div>
                        <div style="font-size:0.8rem;color:#666;margin-top:2px">
                            Other learners can see your name and score when this is on.
                        </div>
                    </div>
                </label>
                <button id="savePrivacyBtn" class="btn btn-secondary" style="margin-top:1rem">Save Privacy</button>
                <div id="privacyMsg" style="margin-top:0.75rem;font-size:0.9rem;display:none"></div>
            </div>
        </div>`;

    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        const btn  = document.getElementById('saveProfileBtn');
        const msg  = document.getElementById('profileMsg');
        const name = document.getElementById('displayName').value.trim();
        const color = document.getElementById('avatarColor').value;

        if (!name) { showMsg(msg, 'Name cannot be empty.', 'danger'); return; }

        btn.disabled = true;
        const { error } = await supabase
            .from('profiles')
            .update({ display_name: name, avatar_color: color, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        btn.disabled = false;
        showMsg(msg, error ? `Error: ${error.message}` : 'Profile saved!', error ? 'danger' : 'success');
    });

    document.getElementById('savePrivacyBtn').addEventListener('click', async () => {
        const btn  = document.getElementById('savePrivacyBtn');
        const msg  = document.getElementById('privacyMsg');
        const pub  = document.getElementById('isPublic').checked;

        btn.disabled = true;
        const { error } = await supabase
            .from('profiles')
            .update({ is_public: pub, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        btn.disabled = false;
        showMsg(msg, error ? `Error: ${error.message}` : 'Privacy setting saved!', error ? 'danger' : 'success');
    });
}

function showMsg(el, text, type) {
    el.textContent = text;
    el.style.color = type === 'success' ? '#155724' : '#721c24';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
