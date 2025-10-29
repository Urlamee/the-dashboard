// Simple Codename Authentication
// Stores codename in Supabase and verifies user input

const AUTH_CONFIG = {
  // Session storage key
  sessionKey: 'dashboard_auth_session',
  
  // Session timeout in milliseconds (30 days = 30 * 24 * 60 * 60 * 1000)
  sessionTimeout: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Supabase table for storing codename (will use existing Supabase config)
  codeNameKey: 'auth_codename'
};

// Check if user is authenticated (has valid session)
function isAuthenticated() {
  const session = localStorage.getItem(AUTH_CONFIG.sessionKey);
  if (!session) return false;
  
  try {
    const sessionData = JSON.parse(session);
    // Check if session is still valid (expires after 30 days)
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

// Create a session after successful authentication
function createSession() {
  const sessionData = {
    authenticated: true,
    createdAt: Date.now(),
    expiresAt: Date.now() + AUTH_CONFIG.sessionTimeout
  };
  localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(sessionData));
}

// Get session expiration info
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

// Clear session (logout)
function clearSession() {
  localStorage.removeItem(AUTH_CONFIG.sessionKey);
}

// Handle logout with UI update
function handleLogout() {
  // Clear session
  clearSession();
  
  // Show login screen and hide dashboard
  showLoginScreen();
  
  // Clear any form inputs
  const codenameInput = document.getElementById('codename-input');
  if (codenameInput) {
    codenameInput.value = '';
  }
  
  console.log('✅ Logged out successfully');
}

// Get codename from Supabase ONLY (no fallback)
async function getStoredCodename() {
  // Check if Supabase is configured
  if (typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured. Authentication requires Supabase.');
    return null;
  }
  
  try {
    // Get codename from Supabase
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
    
    // Codename not found in database
    console.warn('⚠️ Codename not found in Supabase. Please run SETUP_CODENAME.sql first.');
    return null;
  } catch (error) {
    console.error('❌ Error getting codename from Supabase:', error);
    return null;
  }
}

// Save codename to Supabase
async function saveCodenameToSupabase(codename) {
  if (typeof isSupabaseConfigured !== 'function' || !isSupabaseConfigured()) {
    return false;
  }
  
  try {
    // Upsert the codename
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
    console.error('Error saving codename to Supabase:', error);
    return false;
  }
}

// Verify codename (only accepts codename from Supabase)
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
  console.log('✅ Auth functions loaded!');
}

