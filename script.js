const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const todoList = document.getElementById('todo-list');

let todos = [];

const QUOTES_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHESDUKRMcYfz1CeEJxfkKtR1oOVptvny3yq4CkuUPu488JtF1imxtKcffANnVyZExQOYuqdkfoiBF/pub?output=csv';

const fallbackQuotes = [
  '"The way to get started is to quit talking and begin doing." - Walt Disney',
  '"Success is not final, failure is not fatal: it is the courage to continue that counts." - Winston Churchill',
  '"The future belongs to those who believe in the beauty of their dreams." - Eleanor Roosevelt',
  '"It is during our darkest moments that we must focus to see the light." - Aristotle',
  '"The only way to do great work is to love what you do." - Steve Jobs',
  '"Innovation distinguishes between a leader and a follower." - Steve Jobs',
  '"Life is what happens to you while you\'re busy making other plans." - John Lennon',
  '"Don\'t be afraid to give up the good to go for the great." - John D. Rockefeller',
  '"You miss 100% of the shots you don\'t take." - Wayne Gretzky',
  '"The only impossible journey is the one you never begin." - Tony Robbins',
  '"Success is walking from failure to failure with no loss of enthusiasm." - Winston Churchill'
];

let dailyAdvice = [...fallbackQuotes];

const GIT_CONFIG = {
  owner: 'Urlamee',
  repo: 'the-dashboard',
  branch: 'main'
};

let gitInfo = {
  commitHash: '…',
  fullHash: '…',
  commitMessage: '',
  commitCount: 0,
  pushTimestamp: '…',
  authorName: '…',
  branch: GIT_CONFIG.branch
};

async function init() {
  await loadTodos();
  fetchQuotesFromAPI();
  fetchGitInfo();
  startTerminalClock();
  initHabitsTracker();
  
  todoForm.addEventListener('submit', addTodo);
  todoList.addEventListener('click', handleTodoClick);
}

// Load todos (now uses storage.js which handles Supabase + localStorage)
async function loadTodos() {
  todos = await loadTodosFromStorage();
  renderTodos();
}

// Save todos (now uses storage.js which handles Supabase + localStorage)
async function saveTodos() {
  try {
    await saveTodosToStorage(todos);
  } catch (error) {
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Add new todo
async function addTodo(e) {
  e.preventDefault();
  
  const text = todoInput.value.trim();
  
  if (!text) {
    alert('Please enter a todo item');
    return;
  }
  
  const { cleanText: afterWhoText, who } = parseAssigneeFromText(text);
  const { cleanText: afterWhatText, what } = parseSupplierFromText(afterWhoText);
  const { cleanText, priority: parsedPriority } = parsePriorityFromText(afterWhatText);
  
  const priority = parsedPriority || prioritySelect.value || 'low';
  
  const newTodo = {
    id: generateId(),
    text: cleanText,
    who: who || null,
    what: what || null,
    priority: priority,
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  todos.unshift(newTodo);
  await saveTodos();
  renderTodos();
  
  todoInput.value = '';
  prioritySelect.value = 'low';
}

function renderTodos() {
  todoList.innerHTML = '';
  
  const unassigned = todos.filter(t => !t.who);
  const assigned = todos.filter(t => t.who);

  unassigned.forEach(todo => {
    const li = createTodoElement(todo);
    todoList.appendChild(li);
  });

  if (assigned.length > 0) {
    const divider = document.createElement('li');
    divider.className = 'todo-divider';
    divider.innerHTML = '<span>Assigned tasks</span>';
    todoList.appendChild(divider);
  }

  assigned.forEach(todo => {
    const li = createTodoElement(todo);
    todoList.appendChild(li);
  });
}

// Create todo element
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
  li.dataset.id = todo.id;
  
  li.innerHTML = `
    <div class="todo-content">
      <input 
        type="checkbox" 
        class="todo-checkbox" 
        ${todo.completed ? 'checked' : ''}
      >
      <div class="todo-main">
        <div class="todo-text-line">
          <span class="todo-priority priority-${todo.priority}" data-priority="${todo.priority}" title="${getPriorityText(todo.priority)} (click to change)"></span>
          <span class="todo-text">${escapeHtml(todo.text)}</span>
        </div>
        ${todo.who || todo.what ? `<div class="todo-tags">
          ${todo.who ? `<span class="todo-assignee" title="Who">@${escapeHtml(todo.who)}</span>` : ''}
          ${todo.what ? `<span class="todo-supplier" title="What">#${escapeHtml(todo.what)}</span>` : ''}
        </div>` : ''}
      </div>
    </div>
    <div class="todo-actions">
      <button class="btn-link edit-btn" title="Edit">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn-link remove-btn" title="Delete">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `;
  
  return li;
}

async function handleTodoClick(e) {
  const todoItem = e.target.closest('.todo-item');
  if (!todoItem) return;
  
  const todoId = todoItem.dataset.id;
  const todo = todos.find(t => t.id === todoId);
  
  if (e.target.classList.contains('todo-checkbox')) {
    todo.completed = !todo.completed;
    await saveTodos();
    renderTodos();
  } else if (e.target.closest('.edit-btn')) {
    await editTodo(todo);
  } else if (e.target.closest('.remove-btn')) {
    await removeTodo(todoId);
  } else if (e.target.closest('.todo-priority')) {
    await changePriority(todo);
  }
}

async function editTodo(todo) {
  const currentText = todo.text + 
    (todo.who ? ` @${todo.who}` : '') + 
    (todo.what ? ` #${todo.what}` : '') + 
    (todo.priority === 'high' ? ' !' : '');
  
  const newText = prompt('Edit todo:', currentText);
  if (newText !== null && newText.trim()) {
    const { cleanText: afterWhoText, who } = parseAssigneeFromText(newText.trim());
    const { cleanText: afterWhatText, what } = parseSupplierFromText(afterWhoText);
    const { cleanText, priority: parsedPriority } = parsePriorityFromText(afterWhatText);
    
    todo.text = cleanText;
    todo.who = who || null;
    todo.what = what || null;
    todo.priority = parsedPriority || todo.priority;
    await saveTodos();
    renderTodos();
  }
}

async function removeTodo(todoId) {
  if (confirm('Are you sure you want to delete this todo?')) {
    todos = todos.filter(todo => todo.id !== todoId);
    await saveTodos();
    renderTodos();
  }
}

async function changePriority(todo) {
  const priorities = ['low', 'medium', 'high'];
  const currentIndex = priorities.indexOf(todo.priority);
  const nextIndex = (currentIndex + 1) % priorities.length;
  todo.priority = priorities[nextIndex];
  await saveTodos();
  renderTodos();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function fetchGitInfo() {
  try {
    const commitUrl = `https://api.github.com/repos/${GIT_CONFIG.owner}/${GIT_CONFIG.repo}/commits/${GIT_CONFIG.branch}`;
    const commitResponse = await fetch(commitUrl);
    
    if (commitResponse.ok) {
      const data = await commitResponse.json();
      
      gitInfo.fullHash = data.sha;
      gitInfo.commitHash = data.sha.substring(0, 7);
      gitInfo.commitMessage = data.commit.message || 'No commit message';
      gitInfo.authorName = data.commit.author.name;
      
      const pushDate = new Date(data.commit.author.date);
      gitInfo.pushTimestamp = formatRelativeTime(pushDate);
      
      const commitsUrl = `https://api.github.com/repos/${GIT_CONFIG.owner}/${GIT_CONFIG.repo}/commits?sha=${GIT_CONFIG.branch}&per_page=1`;
      const commitsResponse = await fetch(commitsUrl);
      
      if (commitsResponse.ok) {
        // Get the Link header which contains pagination info
        const linkHeader = commitsResponse.headers.get('Link');
        if (linkHeader) {
          // Parse the last page number from Link header
          const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (lastPageMatch) {
            gitInfo.commitCount = parseInt(lastPageMatch[1]);
          } else {
            gitInfo.commitCount = 1; // Only one page means very few commits
          }
        } else {
          gitInfo.commitCount = 1;
        }
      }
      
      updateVersionDisplay();
    } else {
      gitInfo.commitHash = 'local';
      gitInfo.fullHash = '';
      gitInfo.commitMessage = '';
      gitInfo.commitCount = 0;
      gitInfo.pushTimestamp = 'unknown';
      gitInfo.authorName = 'dev';
      updateVersionDisplay();
      }
    } catch (error) {
      gitInfo.commitHash = 'local';
    gitInfo.fullHash = '';
    gitInfo.commitMessage = '';
    gitInfo.commitCount = 0;
    gitInfo.pushTimestamp = 'unknown';
    gitInfo.authorName = 'dev';
    updateVersionDisplay();
  }
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  const month = date.toLocaleDateString(undefined, { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

// Update version display in footer
function updateVersionDisplay() {
  const versionEl = document.getElementById('version-number');
  const versionHashEl = document.getElementById('version-hash-text');
  if (!versionEl) return;
  
  if (gitInfo.commitCount > 0) {
    versionEl.textContent = `v2.${gitInfo.commitCount}-${gitInfo.commitHash}`;
    if (versionHashEl && gitInfo.commitMessage) {
      versionHashEl.textContent = gitInfo.commitMessage;
    }
  } else {
    versionEl.textContent = 'v2.0-dev';
    if (versionHashEl) {
      versionHashEl.textContent = 'Development version';
    }
  }
}

async function fetchQuotesFromAPI() {
  try {
    const response = await fetch(QUOTES_API_URL);
    const csvText = await response.text();
    
    const lines = csvText.split('\n');
    const quotes = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const columns = parseCSVLine(line);
        
        if (columns.length >= 2) {
          const id = columns[0];
          const quote = columns[1];
          
          const cleanQuote = quote.replace(/^"(.*)"$/, '$1').trim();
          
          if (cleanQuote && 
              cleanQuote.length > 10 && 
              cleanQuote.length < 1000 && 
              !cleanQuote.includes('undefined') &&
              !cleanQuote.includes('null')) {
            quotes.push(cleanQuote);
          }
        }
      }
    }
    
    if (quotes.length > 0) {
      dailyAdvice = quotes;
    } else {
      dailyAdvice = [...fallbackQuotes];
    }
  } catch (error) {
    dailyAdvice = [...fallbackQuotes];
  }
  
  // Set the daily advice after fetching
  setDailyAdvice();
}

// Set daily advice
function setDailyAdvice() {
  const adviceElement = document.getElementById('advice-text');
  if (dailyAdvice.length > 0) {
    // Get today's date to determine which advice to show
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const adviceIndex = dayOfYear % dailyAdvice.length;

    const text = dailyAdvice[adviceIndex];
    if (adviceElement) adviceElement.textContent = text;
  }
}

// Terminal bar clock and git info display
function startTerminalClock() {
  const el = document.getElementById('terminal-clock');
  if (!el) return;

  const update = () => {
    const timestamp = gitInfo.pushTimestamp || '…';
    const author = gitInfo.authorName || '…';
    
    el.textContent = `Last push: ${timestamp} · @${author}`;
  };

  update();
  setInterval(update, 1000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getPriorityText(priority) {
  const priorityMap = {
    'low': 'Low Priority',
    'medium': 'Medium Priority',
    'high': 'High Priority'
  };
  return priorityMap[priority] || 'Low Priority';
}

function parseAssigneeFromText(input) {
  const regex = /(?:^|\s)@([A-Za-z0-9_\-]+)/;
  const match = input.match(regex);
  if (!match) {
    return { cleanText: input, who: null };
  }

  const who = match[1];
  const cleanText = input.replace(regex, (m) => m.replace(/@([A-Za-z0-9_\-]+)/, '').trim()).replace(/\s{2,}/g, ' ').trim();
  return { cleanText, who };
}

function parseSupplierFromText(input) {
  const regex = /(?:^|\s)#([A-Za-z0-9_\-]+)/;
  const match = input.match(regex);
  if (!match) {
    return { cleanText: input, what: null };
  }

  const what = match[1];
  const cleanText = input.replace(regex, (m) => m.replace(/#([A-Za-z0-9_\-]+)/, '').trim()).replace(/\s{2,}/g, ' ').trim();
  return { cleanText, what };
}

function parsePriorityFromText(input) {
  const regex = /(?:^|\s)!\s*/;
  const match = input.match(regex);
  
  if (!match) {
    return { cleanText: input, priority: null };
  }

  const priority = 'high';
  const cleanText = input.replace(regex, ' ').replace(/\s{2,}/g, ' ').trim();
  return { cleanText, priority };
}

function getTodayDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

async function loadHabits() {
  const today = getTodayDateString();
  
  const habits = await loadHabitLogsForDate(today);
  
  return habits || {};
}

async function initHabitsTracker() {
  const habits = await loadHabits();
  const habitIcons = document.querySelectorAll('.habit-icon');
  
  habitIcons.forEach(icon => {
    const habitName = icon.dataset.habit;
    if (habits[habitName]) {
      icon.classList.add('completed');
    } else {
      icon.classList.remove('completed');
    }
    
    icon.addEventListener('click', () => toggleHabit(habitName));
  });
  
  scheduleMidnightReset();
}

async function toggleHabit(habitName) {
  const today = getTodayDateString();
  const currentHabits = await loadHabits();
  
  const newState = !currentHabits[habitName];
  
  await saveHabitLogForDate(today, habitName, newState);
  
  const icon = document.querySelector(`.habit-icon[data-habit="${habitName}"]`);
  if (icon) {
    if (newState) {
      icon.classList.add('completed');
    } else {
      icon.classList.remove('completed');
    }
  }
}

function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;
  
  setTimeout(async () => {
    const today = getTodayDateString();
    
    const habits = await loadHabits();
    
    document.querySelectorAll('.habit-icon').forEach(icon => {
      const habitName = icon.dataset.habit;
      if (habits[habitName]) {
        icon.classList.add('completed');
      } else {
        icon.classList.remove('completed');
      }
    });
    
    scheduleMidnightReset();
  }, msUntilMidnight);
}

document.addEventListener('DOMContentLoaded', async () => {
  const isAuth = await initAuth();
  
  if (isAuth) {
    await init();
    if (typeof initLogoutButton === 'function') {
      initLogoutButton();
    }
  } else {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
  }
});


