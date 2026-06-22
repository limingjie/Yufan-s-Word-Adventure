import { login, getUserRole } from '../js/auth.js';

export async function render(container) {
    container.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <div class="login-header">
                    <h1>Word Adventure</h1>
                    <p>Your personal vocabulary journey</p>
                </div>
                <form id="loginForm">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" placeholder="your@email.com" required autocomplete="email">
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" placeholder="Password" required autocomplete="current-password">
                    </div>
                    <div id="loginError" class="form-error" style="display:none;margin-bottom:1rem"></div>
                    <button type="submit" id="submitBtn" class="btn btn-primary btn-block">Sign In</button>
                </form>
            </div>
        </div>`;

    ensureStyles();

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const errEl    = document.getElementById('loginError');
        const btn      = document.getElementById('submitBtn');

        errEl.style.display = 'none';
        btn.textContent = 'Signing in…';
        btn.disabled = true;

        const result = await login(email, password);

        if (result.success) {
            const role = await getUserRole();
            globalThis.location.hash = role === 'parent' ? '#/parent/dashboard' : '#/learner/home';
        } else {
            errEl.textContent = 'Incorrect email or password. Please try again.';
            errEl.style.display = 'block';
            btn.textContent = 'Sign In';
            btn.disabled = false;
        }
    });
}

function ensureStyles() {
    if (document.getElementById('login-styles')) return;
    const s = document.createElement('style');
    s.id = 'login-styles';
    s.textContent = `
        .login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1a73e8 0%, #6c3ec5 100%);
            padding: 1.5rem;
        }
        .login-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            padding: 2.5rem 2rem;
            width: 100%;
            max-width: 380px;
        }
        .login-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .login-header h1 {
            font-size: 1.75rem;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 0.5rem;
        }
        .login-header p {
            color: #666;
            margin: 0;
        }
        #loginForm .form-group {
            margin-bottom: 1.25rem;
        }
    `;
    document.head.appendChild(s);
}
