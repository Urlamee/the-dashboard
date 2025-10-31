const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const todoList = document.getElementById('todo-list');

let todos = [];

let dailyAdvice = [];
let quotesData = []; // Store full quote objects for stats

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
  await fetchQuotesFromSupabase();
  fetchGitInfo();
  startTerminalClock();
  initHabitsTracker();
  initNotesModal();
  initEditTodoModal();
  initSortable();
  initTaskSearch();
  
  todoForm.addEventListener('submit', addTodo);
  todoList.addEventListener('click', handleTodoClick);
  todoList.addEventListener('dblclick', handleTodoDoubleClick);
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

// Normalize any free-text input to lowercase
function toLowercaseInput(input) {
  return (input || '').toString().toLowerCase();
}

// Add new todo or quote
async function addTodo(e) {
  e.preventDefault();
  
  const text = todoInput.value.trim();
  
  if (!text) {
    await customAlert('Please enter a todo item', 'Required');
    return;
  }

  // @quote input
  if (/^@quote:?\s+/i.test(text)) {
    const quoteText = text.replace(/^@quote:?\s+/i, '').trim();
    if (!quoteText) {
      await customAlert('Please enter a quote after @quote', 'Required');
      todoInput.value = '';
      return;
    }
    const result = await addQuoteToSupabase(quoteText);
    if (result.ok) {
      await customAlert('Quote added!', 'Success');
      await fetchQuotesFromSupabase(); // refresh dailyAdvice
      updateTaskStats(); // refresh stats
    } else {
      await customAlert(`Error adding quote (${result.status}): ${result.error || 'Unknown error'}`, 'Error');
      console.error('Quote insert error', result);
    }
    todoInput.value = '';
    return;
  }

  // @log input
  if (/^@log:?\s+/i.test(text)) {
    const logText = text.replace(/^@log:?\s+/i, '').trim();
    if (!logText) {
      await customAlert('Please enter a log message after @log', 'Required');
      todoInput.value = '';
      return;
    }
    const result = await addLogToSupabase(toLowercaseInput(logText));
    if (result.ok) {
      await customAlert('Work log saved!', 'Success');
      updateTaskStats(); // refresh stats
    } else {
      await customAlert(`Error adding log (${result.status}): ${result.error || 'Unknown error'}`, 'Error');
      console.error('Log insert error', result);
    }
    todoInput.value = '';
    return;
  }
  
  const lowerInput = toLowercaseInput(text);
  const { cleanText: afterWhoText, who } = parseAssigneeFromText(lowerInput);
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
    archived: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    notes: null,
    order: todos.length
  };
  
  todos.unshift(newTodo);
  await saveTodos();
  renderTodos();
  
  todoInput.value = '';
  prioritySelect.value = 'low';
}

// -- SEARCH/FILTER LOGIC --
let searchQuery = '';

function initTaskSearch() {
  const searchInput = document.getElementById('task-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTodos();
    });
  }
}

async function updateTaskStats() {
  const statsEl = document.getElementById('task-stats');
  if (!statsEl) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Count active todos
  const activeTodos = todos.filter(t => !t.archived && !t.completed);
  
  // Count completed today
  const completedToday = todos.filter(t => {
    if (!t.completedAt) return false;
    const completedDate = new Date(t.completedAt);
    return completedDate.toDateString() === today.toDateString();
  });
  
  // Count logs added today
  let logsToday = 0;
  try {
    const logs = await loadLogsFromSupabase();
    if (logs && logs.length > 0) {
      logsToday = logs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate.toDateString() === today.toDateString();
      }).length;
    }
  } catch (e) {
    logsToday = 0;
  }
  
  // Count quotes added today
  const quotesToday = quotesData.filter(q => {
    const quoteDate = new Date(q.created_at);
    return quoteDate.toDateString() === today.toDateString();
  }).length;
  
  // Build cryptic stats: "Xa · Xd · Xl · Xq" (always show all)
  const statsText = `${activeTodos.length}a · ${completedToday.length}d · ${logsToday}l · ${quotesToday}q`;
  
  statsEl.textContent = statsText;
}

function filterTodos(todosList) {
  if (!searchQuery) return todosList;
  
  return todosList.filter(todo => {
    const searchText = (
      todo.text.toLowerCase() + ' ' +
      (todo.who || '').toLowerCase() + ' ' +
      (todo.what || '').toLowerCase() + ' ' +
      (todo.notes || '').toLowerCase()
    );
    return searchText.includes(searchQuery);
  });
}

// -- ARCHIVE VIEW LOGIC --
let archiveMode = false;
const archiveBtn = document.getElementById('archive-btn');
const archivedList = document.getElementById('archived-list');

if (archiveBtn && archivedList) {
  archiveBtn.addEventListener('click', () => {
    archiveMode = !archiveMode;
    archiveBtn.classList.toggle('active', archiveMode);
    archiveBtn.title = archiveMode ? 'Hide Archived Tasks' : 'Show Archived Tasks';
    archiveBtn.setAttribute('aria-label', archiveMode ? 'Hide Archived Tasks' : 'Show Archived Tasks');
    
    // Disable reorder mode when viewing archive
    if (archiveMode && reorderMode) {
      toggleReorderMode();
    }
    
    renderTodos();
  });
}

// -- REORDER MODE LOGIC --
let reorderMode = false;
let sortableInstance = null;
const reorderBtn = document.getElementById('reorder-btn');

if (reorderBtn) {
  reorderBtn.addEventListener('click', () => {
    toggleReorderMode();
  });
}

function toggleReorderMode() {
  reorderMode = !reorderMode;
  reorderBtn.classList.toggle('active', reorderMode);
  reorderBtn.title = reorderMode ? 'Exit Reorder Mode' : 'Reorder Todos';
  reorderBtn.setAttribute('aria-label', reorderMode ? 'Exit reorder mode' : 'Toggle reorder mode');
  
  // Toggle drag handles visibility
  document.body.classList.toggle('reorder-mode', reorderMode);
  
  // Enable/disable sortable
  if (sortableInstance) {
    sortableInstance.option('disabled', !reorderMode);
  }
}

function renderTodos() {
  // Update stats
  updateTaskStats();
  
  if (archiveMode) {
    archivedList.style.display = '';
    todoList.style.display = 'none';
    archivedList.innerHTML = '';
    let archived = todos.filter(t => t.archived);
    archived = filterTodos(archived);
    archived.forEach(todo => {
      const li = createArchivedTodoElement(todo);
      archivedList.appendChild(li);
    });
  } else {
    archivedList.style.display = 'none';
    todoList.style.display = '';
    todoList.innerHTML = '';
    
    // Sort by order field and apply filter
    let unassigned = todos.filter(t => !t.archived && !t.who).sort((a, b) => (a.order || 0) - (b.order || 0));
    let assigned = todos.filter(t => !t.archived && t.who).sort((a, b) => (a.order || 0) - (b.order || 0));
    
    unassigned = filterTodos(unassigned);
    assigned = filterTodos(assigned);
    
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
}

// Create todo element
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
  li.dataset.id = todo.id;
  
  li.innerHTML = `
    <div class="todo-row">
      <button class="btn-link edit-btn" title="Edit Task">
        <i class="fa-solid fa-pen"></i>
      </button>
      <input 
        type="checkbox" 
        class="todo-checkbox" 
        ${todo.completed ? 'checked' : ''}
      >
      <span class="todo-priority priority-${todo.priority}" data-priority="${todo.priority}" title="${getPriorityText(todo.priority)} (click to change)"></span>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <div class="todo-spacer"></div>
      ${todo.who || todo.what ? `<div class="todo-tags">
        ${todo.who ? `<span class="todo-assignee" title="Who">@${escapeHtml(todo.who)}</span>` : ''}
        ${todo.what ? `<span class="todo-supplier" title="What">#${escapeHtml(todo.what)}</span>` : ''}
      </div>` : ''}
      <div class="todo-actions">
        ${todo.notes ? `<span class="notes-indicator" title="Has notes">
          <i class="fa-solid fa-note-sticky"></i>
        </span>` : ''}
        <div class="todo-drag-handle" title="Drag to reorder">
          <i class="fa-solid fa-grip-vertical"></i>
        </div>
      </div>
    </div>
    <div class="todo-notes" style="display: none;">
      ${todo.notes ? `<div class="notes-content">${escapeHtml(todo.notes)}</div>` : ''}
      <button class="btn-link edit-note-btn" title="${todo.notes ? 'Edit note' : 'Add note'}">
        <i class="fa-solid fa-pen"></i>
      </button>
    </div>
  `;
  
  return li;
}

function createArchivedTodoElement(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item completed';
  li.dataset.id = todo.id;
  const completedAt = todo.completedAt ? (new Date(todo.completedAt)).toLocaleString() : '';
  li.innerHTML = `
    <div class="todo-content">
      <input type="checkbox" class="todo-checkbox" checked disabled>
      <div class="todo-main">
        <div class="todo-text-line">
          <span class="todo-priority priority-${todo.priority}" data-priority="${todo.priority}"></span>
          <span class="todo-text">${escapeHtml(todo.text)}</span>
        </div>
        ${(todo.who || todo.what) ? `<div class="todo-tags">${todo.who ? `<span class="todo-assignee">@${escapeHtml(todo.who)}</span>` : ''}${todo.what ? `<span class="todo-supplier">#${escapeHtml(todo.what)}</span>` : ''}</div>` : ''}
        <div class="todo-completed-at">Completed: ${completedAt}</div>
      </div>
    </div>`;
  return li;
}

async function handleTodoClick(e) {
  const todoItem = e.target.closest('.todo-item');
  if (!todoItem) return;
  
  const todoId = todoItem.dataset.id;
  const todo = todos.find(t => t.id === todoId);
  
  if (e.target.classList.contains('todo-checkbox')) {
    if (!todo.completed) {
      // Mark as completed, also archive and set completedAt to now
      todo.completed = true;
      todo.archived = true;
      todo.completedAt = new Date().toISOString();
      
      // Automatically log the completed task to work_log
      const logText = toLowercaseInput(todo.text);
      const result = await addLogToSupabase(logText);
      if (!result.ok) {
        console.error('Failed to log completed task:', result);
      }
    } else {
      // Optionally allow un-completing and unarchiving
      todo.completed = false;
      todo.archived = false;
      todo.completedAt = null;
    }
    await saveTodos();
    renderTodos();
  } else if (e.target.closest('.edit-note-btn')) {
    await openNotesModal(todo);
  } else if (e.target.closest('.edit-btn')) {
    await editTodo(todo);
  } else if (e.target.closest('.todo-priority')) {
    await changePriority(todo);
  }
}

async function editTodo(todo) {
  // Store the todo ID for the modal
  currentEditingTodoForEdit = todo;
  
  const currentText = todo.text + 
    (todo.who ? ` @${todo.who}` : '') + 
    (todo.what ? ` #${todo.what}` : '') + 
    (todo.priority === 'high' ? ' !' : '');
  
  // Open edit modal
  const modal = document.getElementById('edit-todo-modal');
  const textarea = document.getElementById('edit-todo-textarea');
  
  textarea.value = currentText;
  modal.style.display = 'flex';
  
  // Focus textarea
  setTimeout(() => {
    textarea.focus();
    textarea.select();
  }, 100);
}

function toggleNotes(todoItem) {
  const notesDiv = todoItem.querySelector('.todo-notes');
  if (notesDiv) {
    if (notesDiv.style.display === 'none') {
      notesDiv.style.display = 'block';
    } else {
      notesDiv.style.display = 'none';
    }
  }
}

function handleTodoDoubleClick(e) {
  // Ignore double-clicks on buttons, checkboxes, or links
  if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
    return;
  }
  
  const todoItem = e.target.closest('.todo-item');
  if (!todoItem) return;
  
  const todoId = todoItem.dataset.id;
  const todo = todos.find(t => t.id === todoId);
  
  if (!todo) return;
  
  // If no notes exist, open the modal directly
  if (!todo.notes) {
    openNotesModal(todo);
  } else {
    // If notes exist, toggle the notes display
    toggleNotes(todoItem);
  }
}

// Edit todo modal management
let currentEditingTodoForEdit = null;

function closeEditTodoModal() {
  const modal = document.getElementById('edit-todo-modal');
  modal.style.display = 'none';
  currentEditingTodoForEdit = null;
}

async function saveEditedTodo() {
  if (!currentEditingTodoForEdit) return;
  
  const textarea = document.getElementById('edit-todo-textarea');
  const newText = textarea.value.trim();
  
  if (newText) {
    const { cleanText: afterWhoText, who } = parseAssigneeFromText(newText);
    const { cleanText: afterWhatText, what } = parseSupplierFromText(afterWhoText);
    const { cleanText, priority: parsedPriority } = parsePriorityFromText(afterWhatText);
    
    currentEditingTodoForEdit.text = cleanText;
    currentEditingTodoForEdit.who = who || null;
    currentEditingTodoForEdit.what = what || null;
    currentEditingTodoForEdit.priority = parsedPriority || currentEditingTodoForEdit.priority;
    
    await saveTodos();
    renderTodos();
  }
  
  closeEditTodoModal();
}

async function deleteFromEditModal() {
  if (!currentEditingTodoForEdit) return;
  
  const confirmed = await customConfirm('Are you sure you want to delete this todo?', 'Delete Todo');
  if (confirmed) {
    todos = todos.filter(t => t.id !== currentEditingTodoForEdit.id);
    await saveTodos();
    renderTodos();
    closeEditTodoModal();
  }
}

function initEditTodoModal() {
  const modal = document.getElementById('edit-todo-modal');
  const closeBtn = document.getElementById('edit-todo-close');
  const cancelBtn = document.getElementById('edit-todo-cancel');
  const saveBtn = document.getElementById('edit-todo-save');
  const deleteBtn = document.getElementById('edit-todo-delete');
  const textarea = document.getElementById('edit-todo-textarea');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEditTodoModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditTodoModal);
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', saveEditedTodo);
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteFromEditModal);
  }
  
  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEditTodoModal();
      }
    });
  }
  
  // Save with Ctrl/Cmd + Enter
  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveEditedTodo();
      }
    });
  }
}

// Notes modal management
let currentEditingTodo = null;

function openNotesModal(todo) {
  currentEditingTodo = todo;
  const modal = document.getElementById('notes-modal');
  const textarea = document.getElementById('notes-textarea');
  
  textarea.value = todo.notes || '';
  modal.style.display = 'flex';
  
  // Focus textarea after a brief delay to ensure modal is visible
  setTimeout(() => {
    textarea.focus();
  }, 100);
}

function closeNotesModal() {
  const modal = document.getElementById('notes-modal');
  modal.style.display = 'none';
  currentEditingTodo = null;
}

async function saveNotesFromModal() {
  if (!currentEditingTodo) return;
  
  const textarea = document.getElementById('notes-textarea');
  const newNotes = textarea.value.trim();
  
  currentEditingTodo.notes = newNotes || null;
  await saveTodos();
  renderTodos();
  closeNotesModal();
}

async function deleteNotesFromModal() {
  if (!currentEditingTodo) return;
  
  const confirmed = await customConfirm('Delete these notes?', 'Delete Notes');
  if (confirmed) {
    currentEditingTodo.notes = null;
    await saveTodos();
    renderTodos();
    closeNotesModal();
  }
}

// Initialize SortableJS for drag and drop
function initSortable() {
  if (!todoList) return;
  
  sortableInstance = new Sortable(todoList, {
    handle: '.todo-drag-handle',
    animation: 150,
    ghostClass: 'todo-ghost',
    dragClass: 'todo-dragging',
    filter: '.todo-divider',
    disabled: true, // Start disabled, enable when reorder mode is activated
    onEnd: async function(evt) {
      // Get the new order of todos
      const todoItems = Array.from(todoList.querySelectorAll('.todo-item'));
      const newOrder = [];
      
      todoItems.forEach((item, index) => {
        const todoId = item.dataset.id;
        const todo = todos.find(t => t.id === todoId);
        if (todo) {
          todo.order = index;
          newOrder.push(todo);
        }
      });
      
      await saveTodos();
    }
  });
}

// ===== REUSABLE MODAL SYSTEM =====

// Custom Alert Dialog
function customAlert(message, title = 'Alert') {
  return new Promise((resolve) => {
    const modal = document.getElementById('alert-modal');
    const titleEl = document.getElementById('alert-modal-title');
    const messageEl = document.getElementById('alert-modal-message');
    const okBtn = document.getElementById('alert-modal-ok');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    const cleanup = () => {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', handleOk);
      modal.removeEventListener('click', handleBackdrop);
      document.removeEventListener('keydown', handleKeydown);
    };
    
    const handleOk = () => {
      cleanup();
      resolve();
    };
    
    const handleBackdrop = (e) => {
      if (e.target === modal) {
        handleOk();
      }
    };
    
    const handleKeydown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleOk();
      }
    };
    
    okBtn.addEventListener('click', handleOk);
    modal.addEventListener('click', handleBackdrop);
    document.addEventListener('keydown', handleKeydown);
    
    // Focus OK button
    setTimeout(() => okBtn.focus(), 100);
  });
}

// Custom Confirm Dialog
function customConfirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    const cleanup = () => {
      modal.style.display = 'none';
      cancelBtn.removeEventListener('click', handleCancel);
      confirmBtn.removeEventListener('click', handleConfirm);
      modal.removeEventListener('click', handleBackdrop);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const handleBackdrop = (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    };
    
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);
    modal.addEventListener('click', handleBackdrop);
    
    // Focus confirm button
    setTimeout(() => confirmBtn.focus(), 100);
  });
}

// Custom Prompt Dialog
function customPrompt(message, defaultValue = '', title = 'Input') {
  return new Promise((resolve) => {
    const modal = document.getElementById('prompt-modal');
    const titleEl = document.getElementById('prompt-modal-title');
    const messageEl = document.getElementById('prompt-modal-message');
    const inputEl = document.getElementById('prompt-modal-input');
    const cancelBtn = document.getElementById('prompt-modal-cancel');
    const okBtn = document.getElementById('prompt-modal-ok');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    inputEl.value = defaultValue;
    modal.style.display = 'flex';
    
    const cleanup = () => {
      modal.style.display = 'none';
      cancelBtn.removeEventListener('click', handleCancel);
      okBtn.removeEventListener('click', handleOk);
      modal.removeEventListener('click', handleBackdrop);
      inputEl.removeEventListener('keydown', handleKeydown);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(null);
    };
    
    const handleOk = () => {
      cleanup();
      resolve(inputEl.value);
    };
    
    const handleBackdrop = (e) => {
      if (e.target === modal) {
        handleCancel();
      }
    };
    
    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleOk();
      }
    };
    
    cancelBtn.addEventListener('click', handleCancel);
    okBtn.addEventListener('click', handleOk);
    modal.addEventListener('click', handleBackdrop);
    inputEl.addEventListener('keydown', handleKeydown);
    
    // Focus and select input
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 100);
  });
}

// Initialize notes modal event listeners
function initNotesModal() {
  const closeBtn = document.getElementById('notes-modal-close');
  const cancelBtn = document.getElementById('notes-modal-cancel');
  const saveBtn = document.getElementById('notes-modal-save');
  const deleteBtn = document.getElementById('notes-modal-delete');
  const modal = document.getElementById('notes-modal');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeNotesModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeNotesModal);
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', saveNotesFromModal);
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteNotesFromModal);
  }
  
  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeNotesModal();
      }
    });
  }
  
  // Save with Ctrl/Cmd + Enter
  const textarea = document.getElementById('notes-textarea');
  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveNotesFromModal();
      }
    });
  }
}

async function removeTodo(todoId) {
  const confirmed = await customConfirm('Are you sure you want to delete this todo?', 'Delete Todo');
  if (confirmed) {
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

async function fetchQuotesFromSupabase() {
  try {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/quotes?order=created_at.asc`;
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const quotes = await response.json();
      if (quotes.length > 0) {
        quotesData = quotes; // Store full objects for stats
        dailyAdvice = quotes.map(q => q.quote_text);
      } else {
        quotesData = [];
        dailyAdvice = [];
      }
    } else {
      quotesData = [];
      dailyAdvice = [];
    }
  } catch (e) {
    quotesData = [];
    dailyAdvice = [];
  }
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

// Add a new quote via Supabase REST
async function addQuoteToSupabase(quoteText) {
  try {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/quotes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([{quote_text: quoteText}]),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text };
    }
    return { ok: true, status: res.status };
  } catch(e) {
    return { ok: false, status: 0, error: e?.message || String(e) };
  }
}

// Add a new work log via Supabase REST
async function loadLogsFromSupabase() {
  try {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/work_log?select=*&order=created_at.desc`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (res.ok) {
      return await res.json();
    }
    return [];
  } catch (err) {
    console.error('loadLogsFromSupabase error:', err);
    return [];
  }
}

async function addLogToSupabase(logText) {
  try {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/work_log`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([{log_text: logText}]),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text };
    }
    return { ok: true, status: res.status };
  } catch(e) {
    return { ok: false, status: 0, error: e?.message || String(e) };
  }
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


