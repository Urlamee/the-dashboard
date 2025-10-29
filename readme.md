# 📋 Working Dashboard

A beautiful and functional productivity dashboard that combines task management with mindful breathing exercises. Stay organized while taking care of your mental wellbeing. This is an evolving project with more features and tools planned for the future.


## ✨ Features

### 📝 Task Management
- **Intuitive Todo List** - Add, complete, and manage your daily tasks
- **Priority System** - Organize tasks by priority levels (high, medium, low)
  - Set priority via dropdown or using `!` mark in task text
  - Click priority indicator to cycle through priorities (low → medium → high)
- **Smart Tag Parsing** - Use natural syntax for task organization:
  - `@name` - Assign tasks to people (assignee)
  - `#supplier` - Tag tasks with suppliers or topics
  - `!` - Mark as high priority
  - All tags can be combined: `Buy groceries @mom #store !`
- **Task Organization** - Automatic separation of tasks:
  - Unassigned tasks appear first
  - Assigned tasks grouped separately with divider
- **Task Editing** - Click edit button to modify tasks and tags
- **Cloud Storage Sync** - Advanced storage with Supabase integration:
  - Automatic cloud synchronization to Supabase
  - localStorage fallback for offline support
  - Seamless sync across devices when configured
  - All changes saved locally and synced to cloud in real-time
- **Persistent Storage** - Tasks saved automatically with dual-layer storage
- **Clean Interface** - Modern, responsive design that works on all devices
- **Dynamic Quotes** - Motivational quotes loaded from Google Sheets API:
  - Fetches quotes from external API with intelligent CSV parsing
  - Fallback quotes if API unavailable
  - Daily rotation based on day of year
- **Git Integration** - Real-time repository information:
  - Terminal bar displays: last push timestamp and author name
  - Footer shows version number: `v1.[commits]-[hash]` (hover for commit message)
  - Automatic version tracking based on commit count

### 🧘 Breathing Exercises
- **Multiple Techniques** - Choose from 4 breathing methods:
  - Box Breathing (4-4-4-4)
  - 4-7-8 Breathing
  - Wim Hof Method
  - Tummo Breathing
- **Technique Navigation** - Use arrow buttons or keyboard arrows to switch between techniques
- **Flexible Sessions** - Select from preset durations or custom time:
  - Quick: 2-minute sessions
  - Standard: 5 or 10-minute sessions
  - Custom: Set any duration from 1-60 minutes
- **Session Control** - Hover over breathing circle during session to reveal stop button
- **Visual Guidance** - Animated breathing circle guides you through each phase
  - Smooth scale animations for inhale/exhale
  - Real-time phase indicators
- **Theme Options** - Choose from 6 beautiful color themes:
  - Forest Breeze (default)
  - Ocean Calm
  - Sunset Serenity
  - Lavender Mist
  - Citrine Glow
  - Sand
  - Theme preference saved to localStorage
- **Progress Tracking** - Visual timer bar at top shows session progress
  - Animated gradient progress indicator
  - Smooth water-like flow effects

### 🎨 Design Features
- **Responsive Layout** - Optimized for desktop, tablet, and mobile
- **Modern UI** - Clean gradient designs and smooth animations
- **Easy Navigation** - Subtle header menu for quick access to features
- **Accessibility** - ARIA labels and keyboard navigation support

## ⚙️ Configuration

### Authentication Setup
The dashboard uses a simple codename-based authentication system that **requires Supabase**. The codename must be stored in your Supabase database.

**⚠️ Important:** There is no default codename. You must set up Supabase and insert your codename in the database.

**Setup Steps:**

1. **Configure Supabase** (if not already done):
   - Set up your Supabase project in `storage.js` (see Cloud Storage Setup section below)

2. **Insert your codename into Supabase:**
   - Run this SQL in your Supabase dashboard (SQL Editor):
   ```sql
   -- Create the app_settings table
   CREATE TABLE IF NOT EXISTS app_settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Enable Row Level Security
   ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

   -- Create policy for anonymous access
   CREATE POLICY "Allow anonymous access" ON app_settings
     FOR ALL
     USING (true)
     WITH CHECK (true);

   -- Insert your codename (REPLACE 'YOUR_CODENAME_HERE' with your actual codename)
   INSERT INTO app_settings (key, value, updated_at)
   VALUES ('auth_codename', 'YOUR_CODENAME_HERE', NOW())
   ON CONFLICT (key) 
   DO UPDATE SET 
     value = EXCLUDED.value,
     updated_at = NOW();
   ```

3. **How it works:**
   - On first visit, you'll see a login screen
   - Enter your codename (stored in Supabase) to access the dashboard
   - **Session timeout:** You stay logged in for **30 days** (configurable in `auth.js`)
   - Session is automatically validated on each page load
   - Authentication only accepts codenames from Supabase database
   - **Logout:** Click the menu button (☰) in the header and select "Logout"

**Security Notes:**
- Only codenames stored in your Supabase `app_settings` table will work
- If Supabase is not configured or codename not found, authentication will fail
- This is suitable for personal use. For production apps, consider using Supabase Auth or similar services.

### Cloud Storage Setup (Supabase)
The dashboard supports cloud synchronization via Supabase. To enable cloud sync:

1. Open `storage.js`
2. Find the `SUPABASE_CONFIG` object at the top of the file
3. Update the configuration:
```javascript
const SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',  // Your Supabase project URL
  anonKey: 'your-anon-key',                 // Your Supabase anonymous key
  enabled: true                              // Set to true to enable cloud sync
};
```

4. Create the todos table in your Supabase dashboard (SQL Editor):
```sql
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
```

5. Test the connection by opening browser console and running: `testSupabaseConnection()`

**Note:** 
- If Supabase is not configured, the app automatically falls back to localStorage
- Data is always saved locally first, then synced to cloud
- Works offline with automatic sync when connection is restored

### Git Integration Setup
The terminal bar displays real-time Git repository information using the GitHub API. To configure it for your repository:

1. Open `script.js`
2. Find the `GIT_CONFIG` object near the top of the file
3. Update the values:
```javascript
const GIT_CONFIG = {
  owner: 'your-github-username',  // Your GitHub username
  repo: 'your-repository-name',   // Your repository name
  branch: 'main'                  // Your default branch (main or master)
};
```

**Note:** This uses the public GitHub API, so it works best with public repositories. For private repositories, you would need to implement authentication.

