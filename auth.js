// Authentication system for single-user dashboard
// Uses SHA-256 password hashing and sessionStorage for auth state

// ⚠️ IMPORTANT: Set your password hash here
// To generate your password hash:
// 1. Open browser console
// 2. Run: await hashPassword('your_password_here')
// 3. Copy the output and paste it below
// Example: const PASSWORD_HASH = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';

const PASSWORD_HASH = 'ead6a49e5902b1e475b73aa44dd892858b32a0f7374959267f9309ca45ef496d'; // Password: "spark45"

// Session configuration
const SESSION_KEY = 'dashboard_auth_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Hash password using SHA-256
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password in hex format
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Attempt to log in with provided password
 * @param {string} password - Plain text password
 * @returns {Promise<boolean>} - True if login successful
 */
async function login(password) {
  try {
    const hashedInput = await hashPassword(password);
    
    if (hashedInput === PASSWORD_HASH) {
      // Create session
      const session = {
        authenticated: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };
      
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      
      console.log('Login successful');
      return true;
    } else {
      console.log('Login failed: incorrect password');
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    return false;
  }
}

/**
 * Log out current user
 */
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  console.log('Logged out successfully');
  window.location.href = 'login.html';
}

/**
 * Check if user is authenticated
 * @returns {boolean} - True if authenticated and session is valid
 */
function checkAuth() {
  try {
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    
    if (!sessionData) {
      return false;
    }
    
    const session = JSON.parse(sessionData);
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      console.log('Session expired');
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    
    // Session is valid
    return session.authenticated === true;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

/**
 * Require authentication - redirect to login if not authenticated
 */
function requireAuth() {
  if (!checkAuth()) {
    window.location.href = 'login.html';
  }
}

/**
 * Get session expiration time
 * @returns {Date|null} - Expiration date or null if not authenticated
 */
function getSessionExpiration() {
  try {
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    return new Date(session.expiresAt);
  } catch (error) {
    return null;
  }
}

/**
 * Extend session duration (refresh timestamp)
 */
function extendSession() {
  try {
    const sessionData = sessionStorage.getItem(SESSION_KEY);
    if (!sessionData) return;
    
    const session = JSON.parse(sessionData);
    session.expiresAt = Date.now() + SESSION_DURATION;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Error extending session:', error);
  }
}

// Extend session on activity (optional - keeps user logged in during active use)
if (typeof document !== 'undefined') {
  let activityTimeout;
  
  function resetActivityTimer() {
    clearTimeout(activityTimeout);
    activityTimeout = setTimeout(() => {
      if (checkAuth()) {
        extendSession();
      }
    }, 5 * 60 * 1000); // Extend session every 5 minutes of activity
  }
  
  // Track user activity
  ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetActivityTimer, { passive: true });
  });
}

// Helper function to generate password hash (for setup)
// Use this in browser console to generate your password hash
window.generatePasswordHash = async function(password) {
  const hash = await hashPassword(password);
  console.log('Password hash:', hash);
  console.log('Copy this hash and paste it in auth.js as PASSWORD_HASH');
  return hash;
};

