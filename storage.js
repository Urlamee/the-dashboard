// Storage utility with Supabase cloud storage and localStorage fallback
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
    const response = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/todos?order=created_at.desc&limit=1000`,
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
      console.log(`✅ Loaded ${data.length} todos from Supabase`);
      // Convert Supabase format to app format
      return data.map(item => ({
        id: item.id,
        text: item.text,
        assignee: item.assignee,
        supplier: item.supplier,
        priority: item.priority,
        completed: item.completed,
        createdAt: item.created_at
      }));
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to load from Supabase:', errorText);
      console.error('Response status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading from Supabase:', error);
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
    
    // First, delete all existing todos
    const deleteResponse = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/todos`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Prefer': 'return=minimal'
        }
      }
    );

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      const errorText = await deleteResponse.text();
      console.warn('⚠️ Failed to clear existing todos:', errorText);
      // Don't return false here - might be a permission issue but we can still try to insert
    } else {
      console.log('✅ Cleared existing todos from Supabase');
    }

    // Then insert all todos (Supabase supports batch inserts with array)
    if (todos.length > 0) {
      const todosToInsert = todos.map(todo => ({
        id: todo.id,
        text: todo.text,
        assignee: todo.assignee || null,
        supplier: todo.supplier || null,
        priority: todo.priority || 'low',
        completed: todo.completed || false,
        created_at: todo.createdAt || new Date().toISOString()
      }));

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
          body: JSON.stringify(todosToInsert)
        }
      );

      if (!insertResponse.ok) {
        const errorText = await insertResponse.text();
        console.error('❌ Failed to save to Supabase:', errorText);
        console.error('Response status:', insertResponse.status);
        return false;
      }
      
      const savedData = await insertResponse.json();
      console.log(`✅ Successfully saved ${savedData.length} todos to Supabase`);
      return true;
    } else {
      console.log('✅ No todos to save (list is empty)');
      return true; // Empty list is fine
    }
  } catch (error) {
    console.error('❌ Error saving to Supabase:', error);
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

