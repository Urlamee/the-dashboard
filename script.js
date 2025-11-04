const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const todoList = document.getElementById('todo-list');

let todos = [];
let reminders = [];

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
  await loadReminders();
  await fetchQuotesFromSupabase();
  fetchGitInfo();
  startTerminalClock();
  initHabitsTracker();
  initNotesModal();
  initEditTodoModal();
  initSortable();
  initRemindersSortable();
  initTaskSearch();
  
  todoForm.addEventListener('submit', addTodo);
  todoList.addEventListener('click', handleTodoClick);
  todoList.addEventListener('dblclick', handleTodoDoubleClick);
  initRemindersView();
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

// Load reminders (now uses storage.js which handles Supabase + localStorage)
async function loadReminders() {
  reminders = await loadRemindersFromStorage();
  updateRemindersWarning();
  renderReminders();
}

// Save reminders (now uses storage.js which handles Supabase + localStorage)
async function saveReminders() {
  try {
    await saveRemindersToStorage(reminders);
  } catch (error) {
    console.error('Error saving reminders:', error);
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

  // @reminder input
  if (/^@reminder:?\s+/i.test(text)) {
    const reminderText = text.replace(/^@reminder:?\s+/i, '').trim();
    if (!reminderText) {
      await customAlert('Please enter a reminder after @reminder', 'Required');
      todoInput.value = '';
      return;
    }
    
    const lowerInput = toLowercaseInput(reminderText);
    const { cleanText: afterWhoText, who } = parseAssigneeFromText(lowerInput);
    const { cleanText: afterWhatText, what } = parseSupplierFromText(afterWhoText);
    const { cleanText, priority: parsedPriority } = parsePriorityFromText(afterWhatText);
    
    const priority = parsedPriority || 'low';
    
    const newReminder = {
      id: generateId(),
      text: cleanText,
      who: who || null,
      what: what || null,
      priority: priority,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      notes: null,
      order: reminders.length
    };
    
          reminders.unshift(newReminder);
      await saveReminders();
      updateRemindersWarning();
      renderReminders();
    
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
      renderReminders();
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

// -- REMINDERS VIEW LOGIC --
let remindersMode = false;
let remindersSortableInstance = null;
const remindersBtn = document.getElementById('reminders-btn');
const remindersList = document.getElementById('reminders-list');

function initRemindersView() {
  if (remindersBtn && remindersList) {
    remindersBtn.addEventListener('click', () => {
      remindersMode = !remindersMode;
      remindersBtn.classList.toggle('active', remindersMode);
      remindersBtn.title = remindersMode ? 'Hide Reminders' : 'Show Reminders';
      remindersBtn.setAttribute('aria-label', remindersMode ? 'Hide Reminders' : 'Show Reminders');
      
      // Disable reorder mode when viewing reminders
      if (remindersMode && reorderMode) {
        toggleReorderMode();
      }
      
      // Disable archive mode when viewing reminders
      if (remindersMode && archiveMode) {
        archiveMode = false;
        archiveBtn.classList.remove('active');
        archiveBtn.title = 'Show Archived Tasks';
        archiveBtn.setAttribute('aria-label', 'Show Archived Tasks');
      }
      
      updateRemindersWarning();
      renderReminders();
      renderTodos();
    });
    
    // Add click handlers for reminders list
    remindersList.addEventListener('click', handleReminderClick);
    remindersList.addEventListener('dblclick', handleReminderDoubleClick);
  }
}

function initRemindersSortable() {
  if (!remindersList) return;
  
  remindersSortableInstance = new Sortable(remindersList, {
    handle: '.todo-drag-handle',
    animation: 150,
    ghostClass: 'todo-ghost',
    dragClass: 'todo-dragging',
    disabled: true, // Start disabled, enable when reorder mode is activated
    onEnd: async function(evt) {
      const reminderItems = Array.from(remindersList.querySelectorAll('.todo-item'));
      const newOrder = [];
      
      reminderItems.forEach((item, index) => {
        const reminderId = item.dataset.id;
        const reminder = reminders.find(r => r.id === reminderId);
        if (reminder) {
          reminder.order = index;
          newOrder.push(reminder);
        }
      });
      
              await saveReminders();
        updateRemindersWarning();
      }
    });
  }

function updateRemindersWarning() {
  if (!remindersBtn) return;
  
  // Count incomplete reminders
  const incompleteReminders = reminders.filter(r => !r.completed);
  const hasReminders = reminders.length > 0;
  const hasIncompleteReminders = incompleteReminders.length > 0;
  
  // Add or remove warning badge
  if (hasIncompleteReminders) {
    remindersBtn.classList.add('has-warning');
    remindersBtn.setAttribute('data-badge', incompleteReminders.length.toString());
  } else if (hasReminders) {
    remindersBtn.classList.add('has-reminders');
    remindersBtn.classList.remove('has-warning');
    remindersBtn.removeAttribute('data-badge');
  } else {
    remindersBtn.classList.remove('has-warning', 'has-reminders');
    remindersBtn.removeAttribute('data-badge');
  }
}

function renderReminders() {
    if (!remindersList) return;
    
    // Update warning indicator
    updateRemindersWarning();
    
    if (remindersMode) {
      remindersList.style.display = '';
      todoList.style.display = 'none';
      archivedList.style.display = 'none';
      remindersList.innerHTML = '';
      
      // Sort by order
      let sortedReminders = [...reminders].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Apply search filter if active
    if (searchQuery) {
      sortedReminders = sortedReminders.filter(reminder => {
        const searchText = (
          reminder.text.toLowerCase() + ' ' +
          (reminder.who || '').toLowerCase() + ' ' +
          (reminder.what || '').toLowerCase() + ' ' +
          (reminder.notes || '').toLowerCase()
        );
        return searchText.includes(searchQuery);
      });
    }
    
    sortedReminders.forEach(reminder => {
      const li = createReminderElement(reminder);
      remindersList.appendChild(li);
    });
    
    // Enable/disable sortable based on reorder mode
    if (remindersSortableInstance) {
      remindersSortableInstance.option('disabled', !reorderMode);
    }
  } else {
    remindersList.style.display = 'none';
  }
}

function createReminderElement(reminder) {
  const li = document.createElement('li');
  li.className = `todo-item ${reminder.completed ? 'completed' : ''}`;
  li.dataset.id = reminder.id;
  
  li.innerHTML = `
    <div class="todo-row">
      <button class="btn-link edit-btn" title="Edit Reminder">
        <i class="fa-solid fa-pen"></i>
      </button>
      <input 
        type="checkbox" 
        class="todo-checkbox" 
        ${reminder.completed ? 'checked' : ''}
      >
      <span class="todo-priority priority-${reminder.priority}" data-priority="${reminder.priority}" title="${getPriorityText(reminder.priority)} (click to change)"></span>
      <span class="todo-text">${escapeHtml(reminder.text)}</span>
      <div class="todo-spacer"></div>
      ${reminder.who || reminder.what ? `<div class="todo-tags">
        ${reminder.who ? `<span class="todo-assignee" title="Who">@${escapeHtml(reminder.who)}</span>` : ''}
        ${reminder.what ? `<span class="todo-supplier" title="What">#${escapeHtml(reminder.what)}</span>` : ''}
      </div>` : ''}
      <div class="todo-actions">
        ${reminder.notes ? `<span class="notes-indicator" title="Has notes">
          <i class="fa-solid fa-note-sticky"></i>
        </span>` : ''}
        <div class="todo-drag-handle" title="Drag to reorder">
          <i class="fa-solid fa-grip-vertical"></i>
        </div>
      </div>
    </div>
    <div class="todo-notes" style="display: none;">
      ${reminder.notes ? `<div class="notes-content">${escapeHtml(reminder.notes)}</div>` : ''}
      <button class="btn-link edit-note-btn" title="${reminder.notes ? 'Edit note' : 'Add note'}">
        <i class="fa-solid fa-pen"></i>
      </button>
    </div>
  `;
  
  return li;
}

async function handleReminderClick(e) {
  const reminderItem = e.target.closest('.todo-item');
  if (!reminderItem) return;
  
  const reminderId = reminderItem.dataset.id;
  const reminder = reminders.find(r => r.id === reminderId);
  
      if (e.target.classList.contains('todo-checkbox')) {
      reminder.completed = !reminder.completed;
      reminder.completedAt = reminder.completed ? new Date().toISOString() : null;
      await saveReminders();
      updateRemindersWarning();
      renderReminders();
  } else if (e.target.closest('.edit-note-btn')) {
    await openNotesModal(reminder, true);
  } else if (e.target.closest('.edit-btn')) {
    await editReminder(reminder);
  } else if (e.target.closest('.todo-priority')) {
    await changeReminderPriority(reminder);
  }
}

function handleReminderDoubleClick(e) {
  if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) {
    return;
  }
  
  const reminderItem = e.target.closest('.todo-item');
  if (!reminderItem) return;
  
  const reminderId = reminderItem.dataset.id;
  const reminder = reminders.find(r => r.id === reminderId);
  
  if (!reminder) return;
  
  if (!reminder.notes) {
    openNotesModal(reminder, true);
  } else {
    toggleNotes(reminderItem);
  }
}

async function editReminder(reminder) {
  currentEditingTodoForEdit = reminder;
  isEditingReminderForEdit = true;
  
  const currentText = reminder.text + 
    (reminder.who ? ` @${reminder.who}` : '') + 
    (reminder.what ? ` #${reminder.what}` : '') + 
    (reminder.priority === 'high' ? ' !' : '');
  
  const modal = document.getElementById('edit-todo-modal');
  const textarea = document.getElementById('edit-todo-textarea');
  const title = document.querySelector('#edit-todo-modal .notes-modal-title');
  
  if (title) title.textContent = 'Edit Reminder';
  textarea.value = currentText;
  modal.style.display = 'flex';
  
  setTimeout(() => {
    textarea.focus();
    textarea.select();
  }, 100);
}

async function changeReminderPriority(reminder) {
  const priorities = ['low', 'medium', 'high'];
  const currentIndex = priorities.indexOf(reminder.priority);
      const nextIndex = (currentIndex + 1) % priorities.length;
    reminder.priority = priorities[nextIndex];
    await saveReminders();
    updateRemindersWarning();
    renderReminders();
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
    
    // Disable reminders mode when viewing archive
    if (archiveMode && remindersMode) {
      remindersMode = false;
      remindersBtn.classList.remove('active');
      remindersBtn.title = 'Show Reminders';
      remindersBtn.setAttribute('aria-label', 'Show Reminders');
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
    remindersList.style.display = 'none';
    archivedList.innerHTML = '';
    let archived = todos.filter(t => t.archived);
    archived = filterTodos(archived);
    // Sort by completedAt date, most recent first
    archived.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
    archived.forEach(todo => {
      const li = createArchivedTodoElement(todo);
      archivedList.appendChild(li);
    });
  } else if (remindersMode) {
    // Reminders view is handled in renderReminders()
    archivedList.style.display = 'none';
    todoList.style.display = 'none';
  } else {
    archivedList.style.display = 'none';
    remindersList.style.display = 'none';
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
  li.className = 'todo-item archived';
  li.dataset.id = todo.id;
  const completedAt = todo.completedAt ? (new Date(todo.completedAt)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const tagsHtml = (todo.who || todo.what) 
    ? `<span class="archived-tags">${todo.who ? `<span class="todo-assignee">@${escapeHtml(todo.who)}</span>` : ''}${todo.what ? `<span class="todo-supplier">#${escapeHtml(todo.what)}</span>` : ''}</span>` 
    : '';
  li.innerHTML = `
    <div class="archived-row">
      <span class="archived-text">${escapeHtml(todo.text)}</span>
      ${tagsHtml}
      <span class="archived-date">${completedAt}</span>
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
  isEditingReminderForEdit = false;
  
  const currentText = todo.text + 
    (todo.who ? ` @${todo.who}` : '') + 
    (todo.what ? ` #${todo.what}` : '') + 
    (todo.priority === 'high' ? ' !' : '');
  
  // Open edit modal
  const modal = document.getElementById('edit-todo-modal');
  const textarea = document.getElementById('edit-todo-textarea');
  const title = document.querySelector('#edit-todo-modal .notes-modal-title');
  
  if (title) title.textContent = 'Edit Task';
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
let isEditingReminderForEdit = false;

function closeEditTodoModal() {
  const modal = document.getElementById('edit-todo-modal');
  modal.style.display = 'none';
  currentEditingTodoForEdit = null;
  isEditingReminderForEdit = false;
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
    
          if (isEditingReminderForEdit) {
        await saveReminders();
        updateRemindersWarning();
        renderReminders();
    } else {
      await saveTodos();
      renderTodos();
    }
  }
  
  closeEditTodoModal();
}

async function deleteFromEditModal() {
  if (!currentEditingTodoForEdit) return;
  
  const title = isEditingReminderForEdit ? 'Delete Reminder' : 'Delete Todo';
  const message = isEditingReminderForEdit 
    ? 'Are you sure you want to delete this reminder?' 
    : 'Are you sure you want to delete this todo?';
  
  const confirmed = await customConfirm(message, title);
  if (confirmed) {
          if (isEditingReminderForEdit) {
        reminders = reminders.filter(r => r.id !== currentEditingTodoForEdit.id);
        await saveReminders();
        updateRemindersWarning();
        renderReminders();
    } else {
      todos = todos.filter(t => t.id !== currentEditingTodoForEdit.id);
      await saveTodos();
      renderTodos();
    }
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
    saveBtn.addEventListener('click', () => {
      if (isEditingReminderForEdit) {
        saveEditedReminder();
      } else {
        saveEditedTodo();
      }
    });
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
        if (isEditingReminderForEdit) {
          saveEditedReminder();
        } else {
          saveEditedTodo();
        }
      }
    });
  }
}

async function saveEditedReminder() {
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
      
      await saveReminders();
      updateRemindersWarning();
      renderReminders();
  }
  
  closeEditTodoModal();
}

// Notes modal management
let currentEditingTodo = null;
let isEditingReminder = false;

function openNotesModal(item, isReminder = false) {
  currentEditingTodo = item;
  isEditingReminder = isReminder;
  const modal = document.getElementById('notes-modal');
  const textarea = document.getElementById('notes-textarea');
  
  textarea.value = item.notes || '';
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
  isEditingReminder = false;
}

async function saveNotesFromModal() {
  if (!currentEditingTodo) return;
  
  const textarea = document.getElementById('notes-textarea');
  const newNotes = textarea.value.trim();
  
      currentEditingTodo.notes = newNotes || null;
    
    if (isEditingReminder) {
      await saveReminders();
      updateRemindersWarning();
      renderReminders();
  } else {
    await saveTodos();
    renderTodos();
  }
  closeNotesModal();
}

async function deleteNotesFromModal() {
  if (!currentEditingTodo) return;
  
  const confirmed = await customConfirm('Delete these notes?', 'Delete Notes');
  if (confirmed) {
          currentEditingTodo.notes = null;
      
      if (isEditingReminder) {
        await saveReminders();
        updateRemindersWarning();
        renderReminders();
    } else {
      await saveTodos();
      renderTodos();
    }
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

function shouldHabitReset(habitName, habitData) {
    if (!habitData || !habitData.completed) {
      return false;
    }
    
    // Get reset interval - use stored value or default for this habit type
    let resetIntervalHours;
    if (habitData.reset_interval_hours !== undefined && habitData.reset_interval_hours !== null) {
      resetIntervalHours = habitData.reset_interval_hours;
    } else {
      // Fallback to default based on habit name
      if (typeof getHabitResetInterval === 'function') {
        resetIntervalHours = getHabitResetInterval(habitName);
      } else {
        const hourlyHabits = ['water', 'walk', 'exercise'];
        resetIntervalHours = hourlyHabits.includes(habitName) ? 1 : 24;
      }
    }
    
    // If completed but no timestamp, treat as needing reset (old data)
    if (!habitData.last_completed_at) {
      return true;
    }
    
    const lastCompleted = new Date(habitData.last_completed_at);
    const now = new Date();
    const hoursSinceCompletion = (now - lastCompleted) / (1000 * 60 * 60);
    
    return hoursSinceCompletion >= resetIntervalHours;
  }

function isHabitNeedingAttention(habitName, habitData) {
  // If habit is not completed, it needs attention
  if (!habitData || !habitData.completed) {
    return true;
  }
  
  // If habit should reset but hasn't, it needs attention
  return shouldHabitReset(habitName, habitData);
}

async function initHabitsTracker() {
  await updateHabitsDisplay();
  
  // Update display every minute for hourly resets
  setInterval(() => {
    updateHabitsDisplay();
  }, 60000); // 60 seconds = 1 minute
  
  scheduleMidnightReset();
}

async function updateHabitsDisplay() {
    try {
      const habits = await loadHabits();
      const habitIcons = document.querySelectorAll('.habit-icon');
      
      habitIcons.forEach(icon => {
        const habitName = icon.dataset.habit;
        if (!habitName) return;
        
        const habitData = habits[habitName];
        
        // Remove all state classes
        icon.classList.remove('completed', 'needs-attention');
        
        // Debug logging
        if (habitData) {
          console.log(`Habit ${habitName}:`, {
            completed: habitData.completed,
            last_completed_at: habitData.last_completed_at,
            reset_interval_hours: habitData.reset_interval_hours,
            shouldReset: shouldHabitReset(habitName, habitData),
            needsAttention: isHabitNeedingAttention(habitName, habitData)
          });
        }
        
        // Show as completed only if it's completed AND not reset yet
        if (habitData && habitData.completed === true && !shouldHabitReset(habitName, habitData)) {
          icon.classList.add('completed');
        } else {
          // Show as needing attention if not completed or if it needs reset
          if (isHabitNeedingAttention(habitName, habitData)) {
            icon.classList.add('needs-attention');
          }
        }
        
        // Ensure click handler is only added once
        if (!icon.dataset.listenerAttached) {
          icon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Habit icon clicked:', habitName);
            toggleHabit(habitName);
          });
          icon.dataset.listenerAttached = 'true';
        }
      });
    } catch (error) {
      console.error('Error updating habits display:', error);
    }
  }

async function toggleHabit(habitName) {
  try {
    const today = getTodayDateString();
    const currentHabits = await loadHabits();
    
    // Get the reset interval for this habit (synchronous function)
    // Check if function exists in global scope (from storage.js)
    let resetInterval;
    if (typeof getHabitResetInterval === 'function') {
      resetInterval = getHabitResetInterval(habitName);
    } else {
      // Fallback: define hourly habits inline
      const hourlyHabits = ['water', 'walk', 'exercise'];
      resetInterval = hourlyHabits.includes(habitName) ? 1 : 24;
    }
    
    // If habit is completed but should reset, treat as incomplete
    const habitData = currentHabits[habitName];
    let currentState = false;
    if (habitData && habitData.completed) {
      if (shouldHabitReset(habitName, habitData)) {
        currentState = false; // Needs reset
      } else {
        currentState = true; // Still valid
      }
    }
    
    const newState = !currentState;
    
    console.log('Toggling habit:', habitName, 'from', currentState, 'to', newState, 'interval:', resetInterval);
    
    await saveHabitLogForDate(today, habitName, newState, resetInterval);
    
    // Update display
    await updateHabitsDisplay();
  } catch (error) {
    console.error('Error toggling habit:', habitName, error);
  }
}

function scheduleMidnightReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight - now;
  
  setTimeout(async () => {
    await updateHabitsDisplay();
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


