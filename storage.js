const SUPABASE_CONFIG = {
  url: 'https://vdrzaluohnjhucdccwin.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcnphbHVvaG5qaHVjZGNjd2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTExMjQsImV4cCI6MjA3NzE4NzEyNH0.tudrEVEKh2BG-ajvjOoYxir9AwMN2U2VsBAtdV826PQ',
  enabled: true
};

const STORAGE_KEY = 'todos';

function isSupabaseConfigured() {
  return SUPABASE_CONFIG.enabled && 
         SUPABASE_CONFIG.url && 
         SUPABASE_CONFIG.anonKey;
}

async function loadTodosFromSupabase() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const loadUrl = `${SUPABASE_CONFIG.url}/rest/v1/todos?order=created_at.desc&limit=1000`;
    
    const response = await fetch(
      loadUrl,
      {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.map(item => ({
        id: item.id,
        text: item.text,
        who: item.who || null,
        what: item.what || null,
        priority: item.priority,
        completed: item.completed,
        createdAt: item.created_at
      }));
    } else {
      await response.text();
      return null;
    }
  } catch (error) {
    return null;
  }
}

async function saveTodosToSupabase(todos) {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    if (todos.length === 0) {
      const existingResponse = await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/todos?select=id`,
        {
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (existingResponse.ok) {
        const existing = await existingResponse.json();
        if (existing.length > 0) {
          for (const item of existing) {
            await fetch(
              `${SUPABASE_CONFIG.url}/rest/v1/todos?id=eq.${item.id}`,
              {
                method: 'DELETE',
                headers: {
                  'apikey': SUPABASE_CONFIG.anonKey,
                  'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                  'Prefer': 'return=minimal'
                }
              }
            );
          }
        }
      }
      return true;
    }

    const existingResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/todos?select=id`,
      {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let todosToDelete = [];
    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      const currentIds = new Set(todos.map(t => t.id));
      todosToDelete = existing.filter(item => !currentIds.has(item.id)).map(item => item.id);
    }

    if (todosToDelete.length > 0) {
      for (const id of todosToDelete) {
        await fetch(
          `${SUPABASE_CONFIG.url}/rest/v1/todos?id=eq.${id}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_CONFIG.anonKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
              'Prefer': 'return=minimal'
            }
          }
        );
      }
    }

    if (todos.length > 0) {
      const todosToUpsert = todos.map(todo => ({
        id: todo.id,
        text: todo.text,
        who: todo.who || null,
        what: todo.what || null,
        priority: todo.priority || 'low',
        completed: todo.completed || false,
        created_at: todo.createdAt || new Date().toISOString()
      }));

      const upsertUrl = `${SUPABASE_CONFIG.url}/rest/v1/todos`;
      
      const upsertResponse = await fetch(
        upsertUrl,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(todosToUpsert)
        }
      );

      if (!upsertResponse.ok) {
        const errorText = await upsertResponse.text().catch(() => 'Unable to read error response');
        
        let successCount = 0;
        let failCount = 0;
        for (const todo of todosToUpsert) {
          const updateResponse = await fetch(
            `${SUPABASE_CONFIG.url}/rest/v1/todos?id=eq.${todo.id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({
                text: todo.text,
                who: todo.who,
                what: todo.what,
                priority: todo.priority,
                completed: todo.completed,
                created_at: todo.created_at
              })
            }
          );

          if (updateResponse.ok) {
            successCount++;
          } else {
            const updateError = await updateResponse.text().catch(() => 'Unknown error');
            
            const insertResponse = await fetch(
              `${SUPABASE_CONFIG.url}/rest/v1/todos`,
              {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_CONFIG.anonKey,
                  'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation'
                },
                body: JSON.stringify([todo])
              }
            );

            if (insertResponse.ok) {
              successCount++;
            } else {
              failCount++;
              await insertResponse.text().catch(() => 'Unknown error');
            }
          }
        }

        if (successCount === todos.length) {
          return true;
        } else {
          return false;
        }
      } else {
        await upsertResponse.json();
        return true;
      }
    } else {
      return true;
    }
  } catch (error) {
    return false;
  }
}

async function loadTodosFromStorage() {
  if (isSupabaseConfigured()) {
    const cloudTodos = await loadTodosFromSupabase();
    if (cloudTodos !== null) {
      localStorage.setItem('todos', JSON.stringify(cloudTodos));
      return cloudTodos;
    }
  }

  const stored = localStorage.getItem('todos');
  if (stored) {
    return JSON.parse(stored);
  }
  
  return [];
}

async function saveTodosToStorage(todos) {
  localStorage.setItem('todos', JSON.stringify(todos));

  if (isSupabaseConfigured()) {
    await saveTodosToSupabase(todos);
  }
}

async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const readResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/todos?limit=1`,
      {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (readResponse.status === 404 || readResponse.status === 406) {
      await readResponse.text();
      return false;
    }
    
    if (!readResponse.ok) {
      await readResponse.text();
      return false;
    }
    
    await readResponse.json();
    
    const testTodo = {
      id: 'test_' + Date.now(),
      text: 'Test todo from connection test',
      who: null,
      what: null,
      priority: 'low',
      completed: false,
      created_at: new Date().toISOString()
    };
    
    const writeResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/todos`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([testTodo])
      }
    );
    
    if (!writeResponse.ok) {
      await writeResponse.text();
      await writeResponse.text();
      return false;
    }
    
    await writeResponse.json();
    
    await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/todos?id=eq.${testTodo.id}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      }
    );
    
    return true;
    
  } catch (error) {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.testSupabaseConnection = testSupabaseConnection;
}

async function saveHabitLogToSupabase(date, habitName, completed) {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const updateResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/habits_log?date=eq.${date}&habit_name=eq.${habitName}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          completed: completed,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (updateResponse.ok) {
      const data = await updateResponse.json();
      if (data.length > 0) {
        return true;
      }
    }

    const insertResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/habits_log`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([{
          date: date,
          habit_name: habitName,
          completed: completed
        }])
      }
    );

    if (insertResponse.ok) {
      return true;
    } else {
      await insertResponse.text();
      return false;
    }
  } catch (error) {
    return false;
  }
}

async function loadHabitLogsFromSupabase(startDate, endDate) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const loadUrl = `${SUPABASE_CONFIG.url}/rest/v1/habits_log?date=gte.${startDate}&date=lte.${endDate}&order=date.desc`;
    
    const response = await fetch(
      loadUrl,
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
      
      const logs = {};
      data.forEach(entry => {
        if (!logs[entry.date]) {
          logs[entry.date] = {};
        }
        logs[entry.date][entry.habit_name] = entry.completed;
      });
      
      return logs;
    } else {
      await response.text();
      return null;
    }
  } catch (error) {
    return null;
  }
}

async function loadHabitLogsForDate(date) {
  if (isSupabaseConfigured()) {
    const supabaseLogs = await loadHabitLogsFromSupabase(date, date);
    if (supabaseLogs && supabaseLogs[date]) {
      const stored = localStorage.getItem('habits_log');
      let localLogs = stored ? JSON.parse(stored) : {};
      localLogs[date] = supabaseLogs[date];
      localStorage.setItem('habits_log', JSON.stringify(localLogs));
      return supabaseLogs[date];
    }
  }

  // Fallback to localStorage
  const stored = localStorage.getItem('habits_log');
  if (stored) {
    try {
      const logs = JSON.parse(stored);
      return logs[date] || {};
    } catch (e) {
    }
  }

  return {};
}

async function saveHabitLogForDate(date, habitName, completed) {
  const stored = localStorage.getItem('habits_log');
  let logs = stored ? JSON.parse(stored) : {};
  
  if (!logs[date]) {
    logs[date] = {};
  }
  logs[date][habitName] = completed;
  localStorage.setItem('habits_log', JSON.stringify(logs));

  if (isSupabaseConfigured()) {
    await saveHabitLogToSupabase(date, habitName, completed);
  }
}

async function getAllHabitLogs(startDate = null, endDate = null) {
  if (!startDate) {
    const today = new Date();
    startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  if (!endDate) {
    endDate = startDate;
  }

  if (isSupabaseConfigured()) {
    const supabaseLogs = await loadHabitLogsFromSupabase(startDate, endDate);
    if (supabaseLogs !== null) {
      return supabaseLogs;
    }
  }

  // Fallback to localStorage
  const stored = localStorage.getItem('habits_log');
  if (stored) {
    try {
      const logs = JSON.parse(stored);
      // Filter by date range
      const filtered = {};
      Object.keys(logs).forEach(date => {
        if (date >= startDate && date <= endDate) {
          filtered[date] = logs[date];
        }
      });
      return filtered;
    } catch (e) {
    }
  }

  return {};
}

async function initializeSupabaseTable() {
  if (!isSupabaseConfigured()) {
    return false;
  }
  return true;
}

async function initializeHabitsLogTable() {
  if (!isSupabaseConfigured()) {
    return false;
  }
  return true;
}

async function testHabitsLogConnection() {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const readResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/habits_log?limit=1`,
      {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (readResponse.status === 404 || readResponse.status === 406) {
      await readResponse.text();
      initializeHabitsLogTable();
      return false;
    }
    
    if (!readResponse.ok) {
      await readResponse.text();
      return false;
    }
    
    await readResponse.json();
    
    const today = new Date().toISOString().split('T')[0];
    const testLog = {
      date: today,
      habit_name: 'test_habit',
      completed: true
    };
    
    const writeResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/habits_log`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([testLog])
      }
    );
    
    if (!writeResponse.ok) {
      await writeResponse.text();
      return false;
    }
    
    const writeData = await writeResponse.json();
    
    if (writeData.length > 0 && writeData[0].id) {
      await fetch(
        `${SUPABASE_CONFIG.url}/rest/v1/habits_log?id=eq.${writeData[0].id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          }
        }
      );
    }
    
    return true;
    
  } catch (error) {
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.testHabitsLogConnection = testHabitsLogConnection;
  window.initializeHabitsLogTable = initializeHabitsLogTable;
  window.getAllHabitLogs = getAllHabitLogs;
}

