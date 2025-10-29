const AUTH_CONFIG = {
  sessionKey: 'dashboard_auth_session',
  sessionTimeout: 30 * 24 * 60 * 60 * 1000,
  codeNameKey: 'auth_codename'
};

function isAuthenticated() {
  const session = localStorage.getItem(AUTH_CONFIG.sessionKey);
  if (!session) return false;
  
  try {
    const sessionData = JSON.parse(session);
    const now = Date.now();
    if (now > sessionData.expiresAt) {
      localStorage.removeItem(AUTH_CONFIG.sessionKey);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function createSession() {
  const sessionData = {
    authenticated: true,
    createdAt: Date.now(),
    expiresAt: Date.now() + AUTH_CONFIG.sessionTimeout
  };
  localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(sessionData));
}

function getSessionInfo() {
  const session = localStorage.getItem(AUTH_CONFIG.sessionKey);
  if (!session) return null;
  
  try {
    const sessionData = JSON.parse(session);
    return {
      createdAt: new Date(sessionData.createdAt),
      expiresAt: new Date(sessionData.expiresAt),
      timeRemaining: sessionData.expiresAt - Date.now()
    };
  } catch (e) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(AUTH_CONFIG.sessionKey);
}

function handleLogout() {
  clearSession();
  
  // Show login screen and hide dashboard
  showLoginScreen();
  
  // Clear any form inputs
  const codenameInput = document.getElementById('codename-input');
  if (codenameInput) {
    codenameInput.value = '';
  }
}

async function getStoredCodename() {
  if (typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) {
    return null;
  }
  
  try {
    const response = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/app_settings?key=eq.${AUTH_CONFIG.codeNameKey}`,
      {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.length > 0 && data[0].value) {
        return data[0].value;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function saveCodenameToSupabase(codename) {
  if (typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) {
    return false;
  }
  
  try {
    const response = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/app_settings`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify([{
          key: AUTH_CONFIG.codeNameKey,
          value: codename
        }])
      }
    );
    
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function verifyCodename(inputCodename) {
  const storedCodename = await getStoredCodename();
  
  // If no codename found in Supabase, authentication fails
  if (!storedCodename) {
    return false;
  }
  
  // Compare input with codename from Supabase
  return inputCodename.trim() === storedCodename.trim();
}

// Initialize Supabase auth settings table (run this SQL in Supabase dashboard)
function getAuthTableSQL() {
  return `
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access" ON app_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
  `;
}

// Show login screen
function showLoginScreen() {
  const loginModal = document.getElementById('login-modal');
  const dashboard = document.querySelector('.container');
  
  if (loginModal) {
    loginModal.style.display = 'flex';
  }
  if (dashboard) {
    dashboard.style.display = 'none';
  }
  
  // Also hide header and footer
  const header = document.querySelector('.app-header');
  const footer = document.querySelector('.app-footer');
  if (header) header.style.display = 'none';
  if (footer) footer.style.display = 'none';
  
  // Focus on input
  setTimeout(() => {
    const input = document.getElementById('codename-input');
    if (input) input.focus();
  }, 100);
}

// Hide login screen and show dashboard
function hideLoginScreen() {
  const loginModal = document.getElementById('login-modal');
  const dashboard = document.querySelector('.container');
  
  if (loginModal) {
    loginModal.style.display = 'none';
  }
  if (dashboard) {
    dashboard.style.display = 'block';
  }
  
  // Show header and footer
  const header = document.querySelector('.app-header');
  const footer = document.querySelector('.app-footer');
  if (header) header.style.display = 'block';
  if (footer) footer.style.display = 'block';
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const input = document.getElementById('codename-input');
  const errorMsg = document.getElementById('login-error');
  const submitBtn = document.querySelector('#login-form button[type="submit"]');
  
  if (!input) return;
  
  const codename = input.value.trim();
  
  if (!codename) {
    if (errorMsg) {
      errorMsg.textContent = 'Please enter a codename';
      errorMsg.style.display = 'block';
    }
    return;
  }
  
  // Show loading state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
  }
  
  // Verify codename
  const isValid = await verifyCodename(codename);
  
  if (isValid) {
    // Success - create session and show dashboard
    createSession();
    hideLoginScreen();
    
    // Initialize app
    if (typeof init === 'function') {
      await init();
    }
  } else {
    // Show error - check if Supabase is configured
    if (errorMsg) {
      const isSupabaseConfig = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
      if (!isSupabaseConfig) {
        errorMsg.textContent = 'Authentication not configured. Please set up Supabase.';
      } else {
        const storedCodename = await getStoredCodename();
        if (!storedCodename) {
          errorMsg.textContent = 'Codename not found in database. Please run SETUP_CODENAME.sql first.';
        } else {
          errorMsg.textContent = 'Invalid codename. Please try again.';
        }
      }
      errorMsg.style.display = 'block';
    }
    if (input) {
      input.value = '';
      input.focus();
    }
  }
  
  // Reset button
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Access Dashboard';
  }
}

// Initialize authentication check
async function initAuth() {
  // Check if authenticated
  if (isAuthenticated()) {
    hideLoginScreen();
    return true;
  } else {
    showLoginScreen();
    return false;
  }
}

// Initialize logout button
function initLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to logout?')) {
        handleLogout();
      }
    });
  }
}

// Make functions globally accessible
if (typeof window !== 'undefined') {
  window.initAuth = initAuth;
  window.handleLogin = handleLogin;
  window.handleLogout = handleLogout;
  window.getAuthTableSQL = getAuthTableSQL;
  window.clearAuthSession = clearSession;
  window.getSessionInfo = getSessionInfo;
}

