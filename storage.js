// Storage utility with Supabase cloud storage and localStorage fallback
// Version: 2.0 - Fixed UPSERT logic
// Configure your Supabase credentials below

const SUPABASE_CONFIG = {
  url: 'https://vdrzaluohnjhucdccwin.supabase.co', // Your Supabase project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcnphbHVvaG5qaHVjZGNjd2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTExMjQsImV4cCI6MjA3NzE4NzEyNH0.tudrEVEKh2BG-ajvjOoYxir9AwMN2U2VsBAtdV826PQ', // Your Supabase anon/public key
  enabled: true // Set to true after configuring credentials above
};

// Storage key in Supabase
const STORAGE_KEY = 'todos';

// Check if Supabase is configured
function isSupabaseConfigured() {
  return SUPABASE_CONFIG.enabled && 
         SUPABASE_CONFIG.url && 
         SUPABASE_CONFIG.anonKey;
}

// Load todos from Supabase
async function loadTodosFromSupabase() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    console.log('🔄 Loading todos from Supabase...');
    const loadUrl = `${SUPABASE_CONFIG.url}/rest/v1/todos?order=created_at.desc&limit=1000`;
    console.log('🔄 Making fetch request to:', loadUrl);
    
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
    
    console.log('🔄 Load response status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Loaded ${data.length} todos from Supabase`);
      // Convert Supabase format to app format
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
      const errorText = await response.text();
      console.error('❌ Failed to load from Supabase:', errorText);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading from Supabase:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      type: error.constructor.name
    });
    
    // Check for specific error types
    if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
      console.error('❌ CORS or Network Error detected.');
    }
    
    return null;
  }
}

// Save todos to Supabase
async function saveTodosToSupabase(todos) {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping cloud save');
    return false;
  }

  try {
    console.log(`🔄 Syncing ${todos.length} todos to Supabase...`);
    console.log('Supabase Config Check:', {
      enabled: SUPABASE_CONFIG.enabled,
      hasUrl: !!SUPABASE_CONFIG.url,
      hasKey: !!SUPABASE_CONFIG.anonKey,
      url: SUPABASE_CONFIG.url
    });
    
    // If no todos, clear Supabase by deleting all (with proper WHERE clause)
    if (todos.length === 0) {
      // Get all existing IDs first, then delete them
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
          // Delete each one individually (Supabase requires WHERE clause)
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
          console.log(`✅ Cleared ${existing.length} todos from Supabase`);
        }
      }
      return true;
    }

    // Get current todos to find ones that need to be deleted
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

    // Delete todos that no longer exist
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
      if (todosToDelete.length > 0) {
        console.log(`🗑️ Deleted ${todosToDelete.length} removed todos from Supabase`);
      }
    }

    // Upsert (insert or update) all todos using PATCH with ON CONFLICT
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

      // Use UPSERT strategy: POST with resolution=merge-duplicates header
      const upsertUrl = `${SUPABASE_CONFIG.url}/rest/v1/todos`;
      console.log('🔄 Making upsert request to:', upsertUrl);
      console.log('🔄 Request payload:', JSON.stringify(todosToUpsert).substring(0, 200) + '...');
      
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
      
      console.log('🔄 Upsert response status:', upsertResponse.status, upsertResponse.statusText);

      if (!upsertResponse.ok) {
        // If merge-duplicates doesn't work, try individual upserts
        const errorText = await upsertResponse.text().catch(() => 'Unable to read error response');
        console.error('⚠️ Batch upsert failed:', errorText);
        console.error('Response status:', upsertResponse.status);
        console.log('⚠️ Trying individual updates...');
        
        let successCount = 0;
        let failCount = 0;
        for (const todo of todosToUpsert) {
          // Try to update first
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
            // If update fails, try insert (maybe it's a new todo)
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
              const insertError = await insertResponse.text().catch(() => 'Unknown error');
              console.error(`❌ Failed to update/insert todo ${todo.id}:`);
              console.error(`   Update error: ${updateError}`);
              console.error(`   Insert error: ${insertError}`);
            }
          }
        }

        if (successCount === todos.length) {
          console.log(`✅ Successfully synced ${successCount} todos to Supabase (individual upserts)`);
          return true;
        } else {
          console.error(`❌ Failed to sync some todos: ${successCount}/${todos.length} succeeded, ${failCount} failed`);
          // Show user-friendly error
          if (typeof window !== 'undefined') {
            console.warn('⚠️ Some todos failed to sync. Check console for details.');
          }
          return false;
        }
      } else {
        const savedData = await upsertResponse.json();
        console.log(`✅ Successfully synced ${savedData.length} todos to Supabase`);
        return true;
      }
    } else {
      console.log('✅ No todos to sync (list is empty)');
      return true;
    }
  } catch (error) {
    console.error('❌ Error saving to Supabase:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      type: error.constructor.name
    });
    
    // Check for specific error types
    if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
      console.error('❌ CORS or Network Error detected. This might be a CORS configuration issue.');
      console.error('💡 Possible solutions:');
      console.error('   1. Check Supabase project settings for CORS configuration');
      console.error('   2. Verify the API URL and key are correct');
      console.error('   3. Check browser network tab for CORS errors');
    }
    
    // Show error to user if in browser
    if (typeof window !== 'undefined' && error.message) {
      console.warn('⚠️ Failed to sync to Supabase. Please check browser console for details.');
    }
    return false;
  }
}

// Load todos with fallback to localStorage
async function loadTodosFromStorage() {
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    const cloudTodos = await loadTodosFromSupabase();
    if (cloudTodos !== null) {
      // Sync to localStorage as backup
      localStorage.setItem('todos', JSON.stringify(cloudTodos));
      return cloudTodos;
    }
    // If Supabase fails, fall back to localStorage
    console.warn('Supabase load failed, using localStorage');
  }

  // Fallback to localStorage
  const stored = localStorage.getItem('todos');
  if (stored) {
    return JSON.parse(stored);
  }
  
  return [];
}

// Save todos with Supabase sync
async function saveTodosToStorage(todos) {
  // Always save to localStorage immediately
  localStorage.setItem('todos', JSON.stringify(todos));

  // Also save to Supabase if configured
  if (isSupabaseConfigured()) {
    const saved = await saveTodosToSupabase(todos);
    if (!saved) {
      console.warn('Failed to sync to Supabase, but saved to localStorage');
    }
  }
}

// Test Supabase connection (run this in browser console: testSupabaseConnection())
async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase connection...');
  console.log('Config:', { 
    enabled: SUPABASE_CONFIG.enabled, 
    url: SUPABASE_CONFIG.url,
    hasKey: !!SUPABASE_CONFIG.anonKey 
  });
  
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured properly');
    return false;
  }

  try {
    // Test 1: Try to read from the table
    console.log('\n📖 Test 1: Reading from todos table...');
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
    
    console.log('Response status:', readResponse.status);
    
    if (readResponse.status === 404 || readResponse.status === 406) {
      const errorText = await readResponse.text();
      console.error('❌ Table does not exist or wrong schema!');
      console.error('Error:', errorText);
      console.log('\n💡 SOLUTION: Run this SQL in your Supabase dashboard:');
      console.log(`
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  who TEXT,
  what TEXT,
  priority TEXT DEFAULT 'low',
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access" ON todos
  FOR ALL
  USING (true)
  WITH CHECK (true);
      `);
      return false;
    }
    
    if (!readResponse.ok) {
      const errorText = await readResponse.text();
      console.error('❌ Read failed:', errorText);
      return false;
    }
    
    const readData = await readResponse.json();
    console.log('✅ Read successful! Found', readData.length, 'todos');
    
    // Test 2: Try to write a test todo
    console.log('\n📝 Test 2: Writing test todo...');
    const testTodo = {
      id: 'test_' + Date.now(),
      text: 'Test todo from connection test',
      who: null, // Database column name
      what: null, // Database column name
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
    
    console.log('Response status:', writeResponse.status);
    
    if (!writeResponse.ok) {
      const errorText = await writeResponse.text();
      console.error('❌ Write failed:', errorText);
      console.error('Response:', await writeResponse.text());
      return false;
    }
    
    const writeData = await writeResponse.json();
    console.log('✅ Write successful! Created:', writeData);
    
    // Clean up test todo
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
    
    console.log('\n✅✅✅ All tests passed! Supabase is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

// Make test function globally accessible immediately
if (typeof window !== 'undefined') {
  window.testSupabaseConnection = testSupabaseConnection;
  console.log('✅ Supabase test function loaded! Type: testSupabaseConnection()');
}

// ============================================
// Habits Log Storage Functions
// ============================================

// Save habit completion to Supabase
async function saveHabitLogToSupabase(date, habitName, completed) {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping habit log save');
    return false;
  }

  try {
    console.log(`🔄 Saving habit log: ${habitName} on ${date} = ${completed}`);
    
    // Try to update existing record first
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
        console.log(`✅ Updated habit log for ${habitName} on ${date}`);
        return true;
      }
    }

    // If update didn't work, try inserting new record
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
      console.log(`✅ Created new habit log for ${habitName} on ${date}`);
      return true;
    } else {
      const errorText = await insertResponse.text();
      console.error('❌ Failed to save habit log:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error saving habit log to Supabase:', error);
    return false;
  }
}

// Load habit logs from Supabase for a date range
async function loadHabitLogsFromSupabase(startDate, endDate) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    console.log(`🔄 Loading habit logs from ${startDate} to ${endDate}`);
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
      console.log(`✅ Loaded ${data.length} habit log entries from Supabase`);
      
      // Convert to more convenient format: { date: { habitName: completed } }
      const logs = {};
      data.forEach(entry => {
        if (!logs[entry.date]) {
          logs[entry.date] = {};
        }
        logs[entry.date][entry.habit_name] = entry.completed;
      });
      
      return logs;
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to load habit logs from Supabase:', errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading habit logs from Supabase:', error);
    return null;
  }
}

// Load today's habits from Supabase and localStorage
async function loadHabitLogsForDate(date) {
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    const supabaseLogs = await loadHabitLogsFromSupabase(date, date);
    if (supabaseLogs && supabaseLogs[date]) {
      // Sync to localStorage as backup
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
      console.error('Error loading habit logs from localStorage:', e);
    }
  }

  return {};
}

// Save habit log for a specific date
async function saveHabitLogForDate(date, habitName, completed) {
  // Always save to localStorage first
  const stored = localStorage.getItem('habits_log');
  let logs = stored ? JSON.parse(stored) : {};
  
  if (!logs[date]) {
    logs[date] = {};
  }
  logs[date][habitName] = completed;
  localStorage.setItem('habits_log', JSON.stringify(logs));

  // Also save to Supabase if configured
  if (isSupabaseConfigured()) {
    await saveHabitLogToSupabase(date, habitName, completed);
  }
}

// Get all habit logs (for stats/visualization)
async function getAllHabitLogs(startDate = null, endDate = null) {
  // Use today's date if not specified
  if (!startDate) {
    const today = new Date();
    startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  if (!endDate) {
    endDate = startDate;
  }

  // Try Supabase first
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
      console.error('Error loading habit logs from localStorage:', e);
    }
  }

  return {};
}

// Initialize Supabase table (run this once to create the table)
async function initializeSupabaseTable() {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured. Cannot initialize table.');
    return false;
  }

  // This requires running SQL in Supabase dashboard
  // Run this SQL:
  /*
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    assignee TEXT,
    supplier TEXT,
    priority TEXT DEFAULT 'low',
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Enable Row Level Security (optional but recommended)
  ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

  -- Allow anonymous read/write (adjust policies based on your needs)
  CREATE POLICY "Allow anonymous access" ON todos
    FOR ALL
    USING (true)
    WITH CHECK (true);
  */

  console.log('To initialize Supabase table, run the SQL in the Supabase dashboard.');
  return true;
}

// Initialize Supabase habits_log table (run this SQL in Supabase dashboard)
async function initializeHabitsLogTable() {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured. Cannot initialize table.');
    return false;
  }

  // This requires running SQL in Supabase dashboard
  // Run this SQL:
  /*
  CREATE TABLE IF NOT EXISTS habits_log (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    habit_name TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, habit_name)
  );

  -- Create index for faster date queries
  CREATE INDEX IF NOT EXISTS idx_habits_log_date ON habits_log(date);
  CREATE INDEX IF NOT EXISTS idx_habits_log_habit_name ON habits_log(habit_name);

  -- Enable Row Level Security
  ALTER TABLE habits_log ENABLE ROW LEVEL SECURITY;

  -- Allow anonymous read/write (adjust policies based on your needs)
  CREATE POLICY "Allow anonymous access" ON habits_log
    FOR ALL
    USING (true)
    WITH CHECK (true);
  */

  console.log('To initialize habits_log table, run the SQL in the Supabase dashboard.');
  console.log('SQL Schema:');
  console.log(`
CREATE TABLE IF NOT EXISTS habits_log (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  habit_name TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, habit_name)
);

CREATE INDEX IF NOT EXISTS idx_habits_log_date ON habits_log(date);
CREATE INDEX IF NOT EXISTS idx_habits_log_habit_name ON habits_log(habit_name);

ALTER TABLE habits_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access" ON habits_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
  `);
  return true;
}

// Test habits log connection (run in browser console: testHabitsLogConnection())
async function testHabitsLogConnection() {
  console.log('🧪 Testing habits_log table connection...');
  
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured properly');
    return false;
  }

  try {
    // Test 1: Try to read from the table
    console.log('\n📖 Test 1: Reading from habits_log table...');
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
    
    console.log('Response status:', readResponse.status);
    
    if (readResponse.status === 404 || readResponse.status === 406) {
      const errorText = await readResponse.text();
      console.error('❌ Table does not exist or wrong schema!');
      console.error('Error:', errorText);
      console.log('\n💡 SOLUTION: Run the SQL schema shown above in your Supabase dashboard.');
      initializeHabitsLogTable();
      return false;
    }
    
    if (!readResponse.ok) {
      const errorText = await readResponse.text();
      console.error('❌ Read failed:', errorText);
      return false;
    }
    
    const readData = await readResponse.json();
    console.log('✅ Read successful! Found', readData.length, 'habit log entries');
    
    // Test 2: Try to write a test entry
    console.log('\n📝 Test 2: Writing test habit log...');
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
    
    console.log('Response status:', writeResponse.status);
    
    if (!writeResponse.ok) {
      const errorText = await writeResponse.text();
      console.error('❌ Write failed:', errorText);
      return false;
    }
    
    const writeData = await writeResponse.json();
    console.log('✅ Write successful! Created:', writeData);
    
    // Clean up test entry
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
    
    console.log('\n✅✅✅ All tests passed! habits_log table is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

// Make test function globally accessible
if (typeof window !== 'undefined') {
  window.testHabitsLogConnection = testHabitsLogConnection;
  window.initializeHabitsLogTable = initializeHabitsLogTable;
  window.getAllHabitLogs = getAllHabitLogs;
  console.log('✅ Habits log functions loaded! Type: testHabitsLogConnection()');
}

