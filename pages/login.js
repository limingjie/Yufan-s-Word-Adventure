/**
 * Login Page
 * User authentication interface
 */

import { login, isAuthenticated } from "../js/auth.js";
import { showLoading, showError } from "../js/app.js";

export async function renderLoginPage() {
    const contentEl = document.getElementById("content");

    contentEl.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>🌍 Word Adventure</h1>
          <p>Learn vocabulary through interactive games</p>
        </div>

        <form id="loginForm" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="learner1@example.com"
              required
            >
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              required
            >
          </div>

          <div id="errorMessage" class="form-error" style="display: none;"></div>

          <button type="submit" class="btn btn-primary btn-block">
            Sign In
          </button>
        </form>

        <div class="login-footer">
          <p>Demo credentials:</p>
          <ul>
            <li><code>learner1@example.com</code></li>
            <li><code>learner2@example.com</code></li>
          </ul>
        </div>
      </div>
    </div>
  `;

    // Add styles for login page
    addLoginStyles();

    // Attach event handlers
    const form = document.getElementById("loginForm");
    form.addEventListener("submit", handleLoginSubmit);
}

/**
 * Handle login form submission
 */
async function handleLoginSubmit(e) {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const errorEl = document.getElementById("errorMessage");

    showLoading(true);

    try {
        const result = await login(email, password);

        if (result.success) {
            // Redirect to home
            setTimeout(() => {
                window.location.hash = "#home";
            }, 500);
        } else {
            errorEl.textContent = result.error || "Login failed";
            errorEl.style.display = "block";
        }
    } catch (err) {
        errorEl.textContent = err.message || "An error occurred";
        errorEl.style.display = "block";
    } finally {
        showLoading(false);
    }
}

/**
 * Add login-specific styles
 */
function addLoginStyles() {
    const style = document.createElement("style");
    style.textContent = `
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: var(--spacing-lg);
    }

    .login-card {
      background-color: white;
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-lg);
      padding: var(--spacing-xl);
      max-width: 400px;
      width: 100%;
    }

    .login-header {
      text-align: center;
      margin-bottom: var(--spacing-xl);
    }

    .login-header h1 {
      font-size: var(--font-size-2xl);
      margin-bottom: var(--spacing-sm);
      color: var(--dark-color);
    }

    .login-header p {
      color: var(--secondary-color);
      margin: 0;
    }

    .login-form {
      margin-bottom: var(--spacing-lg);
    }

    .login-footer {
      background-color: var(--light-color);
      padding: var(--spacing-lg);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
    }

    .login-footer p {
      margin: 0 0 var(--spacing-sm) 0;
      font-weight: 500;
      color: var(--dark-color);
    }

    .login-footer ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .login-footer li {
      padding: var(--spacing-xs) 0;
      color: var(--secondary-color);
    }

    .login-footer code {
      background-color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      color: var(--primary-color);
    }
  `;
    document.head.appendChild(style);
}
