// Simple authentication for personal dashboard
// Username: admin
// Password: spark45

const USERNAME = 'admin';
const PASSWORD = 'spark45';
const AUTH_KEY = 'dashboard_logged_in';

// Check if user is logged in
function isLoggedIn() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

// Login function
function login(username, password) {
  if (username === USERNAME && password === PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

// Logout function
function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.href = 'login.html';
}

// Check if on index.html and not logged in, redirect to login
function checkAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
}
