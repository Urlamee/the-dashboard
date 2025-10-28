// DOM Elements
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const todoList = document.getElementById('todo-list');
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');

// State
let todos = [];

// API URL for quotes
const QUOTES_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTHESDUKRMcYfz1CeEJxfkKtR1oOVptvny3yq4CkuUPu488JtF1imxtKcffANnVyZExQOYuqdkfoiBF/pub?output=csv';

// Fallback quotes in case API fails
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

// Store fetched quotes
let dailyAdvice = [...fallbackQuotes];

// Git repository information for terminal bar
// Configure your repository information here
const GIT_CONFIG = {
  owner: 'Urlamee', // Replace with your GitHub username
  repo: 'the-dashboard', // Replace with your repository name
  branch: 'main' // Replace with your default branch
};

// Git info state
let gitInfo = {
  commitHash: '…',
  fullHash: '…',
  commitMessage: '',
  commitCount: 0,
  pushTimestamp: '…',
  authorName: '…',
  branch: GIT_CONFIG.branch
};

// Initialize app
async function init() {
  await loadTodos();
  fetchQuotesFromAPI();
  fetchGitInfo();
  startTerminalClock();
  
  // Event listeners
  todoForm.addEventListener('submit', addTodo);
  todoList.addEventListener('click', handleTodoClick);
  
  // Menu toggle
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      menuToggle.classList.toggle('active');
    });
  }
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (navMenu && menuToggle && !e.target.closest('.app-header')) {
      navMenu.classList.remove('active');
      menuToggle.classList.remove('active');
    }
  });
}

// Load todos (now uses storage.js which handles Supabase + localStorage)
async function loadTodos() {
  todos = await loadTodosFromStorage();
  renderTodos();
}

// Save todos (now uses storage.js which handles Supabase + localStorage)
async function saveTodos() {
  await saveTodosToStorage(todos);
}

// Generate unique ID
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
  
  // Parse @assignee, #supplier, and $priority tags from the input text
  const { cleanText: afterAssigneeText, assignee } = parseAssigneeFromText(text);
  const { cleanText: afterSupplierText, supplier } = parseSupplierFromText(afterAssigneeText);
  const { cleanText, priority: parsedPriority } = parsePriorityFromText(afterSupplierText);
  
  // Use parsed priority if available, otherwise use select value or default to 'low'
  const priority = parsedPriority || prioritySelect.value || 'low';
  
  const newTodo = {
    id: generateId(),
    text: cleanText,
    assignee: assignee || null,
    supplier: supplier || null,
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

// Render todos
function renderTodos() {
  // Clear current list
  todoList.innerHTML = '';
  
  // Split into unassigned and assigned (has assignee)
  const unassigned = todos.filter(t => !t.assignee);
  const assigned = todos.filter(t => t.assignee);

  // Render unassigned first
  unassigned.forEach(todo => {
    const li = createTodoElement(todo);
    todoList.appendChild(li);
  });

  // Add divider if there are assigned tasks
  if (assigned.length > 0) {
    const divider = document.createElement('li');
    divider.className = 'todo-divider';
    divider.innerHTML = '<span>Assigned tasks</span>';
    todoList.appendChild(divider);
  }

  // Render assigned tasks
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
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      ${todo.assignee ? `<span class="todo-assignee" title="Assignee">@${escapeHtml(todo.assignee)}</span>` : ''}
      ${todo.supplier ? `<span class="todo-supplier" title="Supplier">#${escapeHtml(todo.supplier)}</span>` : ''}
      <span class="todo-priority priority-${todo.priority}" data-priority="${todo.priority}" title="${getPriorityText(todo.priority)} (click to change)"></span>
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

// Handle todo item clicks
async function handleTodoClick(e) {
  const todoItem = e.target.closest('.todo-item');
  if (!todoItem) return;
  
  const todoId = todoItem.dataset.id;
  const todo = todos.find(t => t.id === todoId);
  
  if (e.target.classList.contains('todo-checkbox')) {
    // Toggle completion
    todo.completed = !todo.completed;
    await saveTodos();
    renderTodos();
  } else if (e.target.closest('.edit-btn')) {
    // Edit todo
    await editTodo(todo);
  } else if (e.target.closest('.remove-btn')) {
    // Remove todo
    await removeTodo(todoId);
  } else if (e.target.classList.contains('todo-priority')) {
    // Change priority
    await changePriority(todo);
  } else {
    // Do nothing; only the checkbox toggles completion
  }
}

// Edit todo
async function editTodo(todo) {
  // Get priority number for display
  const priorityNumMap = {
    'high': '1',
    'medium': '2',
    'low': '3'
  };
  const priorityNum = priorityNumMap[todo.priority] || '3';
  
  const currentText = todo.text + 
    (todo.assignee ? ` @${todo.assignee}` : '') + 
    (todo.supplier ? ` #${todo.supplier}` : '') + 
    ` $${priorityNum}`;
  
  const newText = prompt('Edit todo:', currentText);
  if (newText !== null && newText.trim()) {
    const { cleanText: afterAssigneeText, assignee } = parseAssigneeFromText(newText.trim());
    const { cleanText: afterSupplierText, supplier } = parseSupplierFromText(afterAssigneeText);
    const { cleanText, priority: parsedPriority } = parsePriorityFromText(afterSupplierText);
    
    todo.text = cleanText;
    todo.assignee = assignee || null;
    todo.supplier = supplier || null;
    todo.priority = parsedPriority || todo.priority; // Keep existing priority if not specified
    await saveTodos();
    renderTodos();
  }
}

// Remove todo
async function removeTodo(todoId) {
  if (confirm('Are you sure you want to delete this todo?')) {
    todos = todos.filter(todo => todo.id !== todoId);
    await saveTodos();
    renderTodos();
  }
}

// Change priority
async function changePriority(todo) {
  const priorities = ['low', 'medium', 'high'];
  const currentIndex = priorities.indexOf(todo.priority);
  const nextIndex = (currentIndex + 1) % priorities.length;
  todo.priority = priorities[nextIndex];
  await saveTodos();
  renderTodos();
}


// Parse CSV line handling quoted fields with commas
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

// Fetch Git repository information from GitHub API
async function fetchGitInfo() {
  try {
    // Fetch the latest commit from the default branch
    const commitUrl = `https://api.github.com/repos/${GIT_CONFIG.owner}/${GIT_CONFIG.repo}/commits/${GIT_CONFIG.branch}`;
    const commitResponse = await fetch(commitUrl);
    
    if (commitResponse.ok) {
      const data = await commitResponse.json();
      
      // Extract commit information
      gitInfo.fullHash = data.sha;
      gitInfo.commitHash = data.sha.substring(0, 7); // Short hash (first 7 chars)
      gitInfo.commitMessage = data.commit.message || 'No commit message';
      gitInfo.authorName = data.commit.author.name;
      
      // Format timestamp
      const pushDate = new Date(data.commit.author.date);
      gitInfo.pushTimestamp = formatRelativeTime(pushDate);
      
      // Fetch commit count
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
      
      console.log('Git info loaded successfully:', gitInfo);
      updateVersionDisplay();
    } else {
      console.log('Failed to fetch git info from GitHub API');
      gitInfo.commitHash = 'local';
      gitInfo.fullHash = '';
      gitInfo.commitMessage = '';
      gitInfo.commitCount = 0;
      gitInfo.pushTimestamp = 'unknown';
      gitInfo.authorName = 'dev';
      updateVersionDisplay();
    }
  } catch (error) {
    console.log('Error fetching git info:', error);
    gitInfo.commitHash = 'local';
    gitInfo.fullHash = '';
    gitInfo.commitMessage = '';
    gitInfo.commitCount = 0;
    gitInfo.pushTimestamp = 'unknown';
    gitInfo.authorName = 'dev';
    updateVersionDisplay();
  }
}

// Format relative time (e.g., "2 hours ago", "3 days ago")
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
  
  // For older dates, show the actual date
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
    versionEl.textContent = `v1.${gitInfo.commitCount}-${gitInfo.commitHash}`;
    if (versionHashEl && gitInfo.commitMessage) {
      versionHashEl.textContent = gitInfo.commitMessage;
    }
  } else {
    versionEl.textContent = 'v1.0-dev';
    if (versionHashEl) {
      versionHashEl.textContent = 'Development version';
    }
  }
}

// Fetch quotes from Google Sheets API
async function fetchQuotesFromAPI() {
  try {
    const response = await fetch(QUOTES_API_URL);
    const csvText = await response.text();
    
    // Parse CSV data
    const lines = csvText.split('\n');
    const quotes = [];
    
    for (let i = 1; i < lines.length; i++) { // Skip header row
      const line = lines[i].trim();
      if (line) {
        const columns = parseCSVLine(line);
        
        // Check if we have at least 2 columns (id_quote, quote)
        if (columns.length >= 2) {
          const id = columns[0];
          const quote = columns[1];
          
          // Clean up the quote (remove extra quotes and whitespace)
          const cleanQuote = quote.replace(/^"(.*)"$/, '$1').trim();
          
          // Filter out invalid quotes
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
      console.log(`Loaded ${quotes.length} quotes from API`);
    } else {
      console.log('No valid quotes found in API, using fallback quotes');
      dailyAdvice = [...fallbackQuotes];
    }
  } catch (error) {
    console.log('Failed to fetch quotes from API, using fallback quotes:', error);
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
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const day = now.toLocaleDateString(undefined, { weekday: 'short' });
    const month = now.toLocaleDateString(undefined, { month: 'short' });
    const date = String(now.getDate()).padStart(2, '0');

    // Display git information (commit hash now in footer)
    const timestamp = gitInfo.pushTimestamp || '…';
    const author = gitInfo.authorName || '…';
    
    el.textContent = `${hours}:${minutes} · ${day}, ${month} ${date} · Last push: ${timestamp} · @${author}`;
  };

  update();
  setInterval(update, 1000);
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get priority text from value
function getPriorityText(priority) {
  const priorityMap = {
    'low': 'Low Priority',
    'medium': 'Medium Priority',
    'high': 'High Priority'
  };
  return priorityMap[priority] || 'Low Priority';
}

// Parse @assignee from text. Returns { cleanText, assignee }
function parseAssigneeFromText(input) {
  // Match first @word (letters, numbers, underscores, hyphens). Ignore email-like @ in the middle of words
  const regex = /(?:^|\s)@([A-Za-z0-9_\-]+)/;
  const match = input.match(regex);
  if (!match) {
    return { cleanText: input, assignee: null };
  }

  const assignee = match[1];
  // Remove the matched tag (preserve surrounding spaces) and trim
  const cleanText = input.replace(regex, (m) => m.replace(/@([A-Za-z0-9_\-]+)/, '').trim()).replace(/\s{2,}/g, ' ').trim();
  return { cleanText, assignee };
}

// Parse #supplier from text. Returns { cleanText, supplier }
function parseSupplierFromText(input) {
  const regex = /(?:^|\s)#([A-Za-z0-9_\-]+)/;
  const match = input.match(regex);
  if (!match) {
    return { cleanText: input, supplier: null };
  }

  const supplier = match[1];
  const cleanText = input.replace(regex, (m) => m.replace(/#([A-Za-z0-9_\-]+)/, '').trim()).replace(/\s{2,}/g, ' ').trim();
  return { cleanText, supplier };
}

// Parse $priority from text. Returns { cleanText, priority }
// $1 = high, $2 = medium, $3 = low
function parsePriorityFromText(input) {
  const regex = /\s*\$([123])\s*/;
  const match = input.match(regex);
  if (!match) {
    return { cleanText: input, priority: null };
  }

  const priorityNum = match[1];
  const priorityMap = {
    '1': 'high',
    '2': 'medium',
    '3': 'low'
  };
  const priority = priorityMap[priorityNum];
  const cleanText = input.replace(regex, ' ').replace(/\s{2,}/g, ' ').trim();
  return { cleanText, priority };
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);


