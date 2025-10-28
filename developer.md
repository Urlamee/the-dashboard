## 📝 Developer Notes

### ☁️ Cloud Storage Setup ✅ COMPLETED

#### Permanent Data Storage with Supabase
- ✅ Integrated Supabase for cloud-based permanent storage
- ✅ Automatic fallback to localStorage if Supabase fails
- ✅ Syncs todos across all devices and browsers in real-time
- ✅ Smart sync: Only updates what changed (no duplicates)
- ✅ Automatic error handling and logging

**How It Works:**
- When you add/edit/delete a todo, it saves to Supabase cloud
- All your devices see the same todos automatically
- If cloud is unavailable, it saves locally and syncs later
- Console shows clear messages so you know what's happening

**Setup Instructions:**
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. **Create the todos table using SQL Editor:**
   - Go to **SQL Editor** in your Supabase dashboard
   - Click **"+ New query"**
   - Paste and run this SQL:
   ```sql
   CREATE TABLE IF NOT EXISTS todos (
     id TEXT PRIMARY KEY,
     text TEXT NOT NULL,
     assignee TEXT,
     supplier TEXT,
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
4. Get your credentials from Settings → API:
   - Copy the **Project URL**
   - Copy the **anon/public key** (keep this secure!)
5. Update `storage.js` with your credentials:
   ```javascript
   const SUPABASE_CONFIG = {
     url: 'YOUR_PROJECT_URL_HERE',
     anonKey: 'YOUR_ANON_KEY_HERE',
     enabled: true
   };
   ```
6. Refresh your app - todos will sync to cloud!

**Testing:**
- Open browser console (F12)
- Type: `testSupabaseConnection()` to test the setup
- Add a todo and watch console messages
- Check Supabase Table Editor to see your todos

**Troubleshooting:**
- **Todos not syncing?** Check console for error messages
- **"Table doesn't exist" error?** Run the SQL above in Supabase
- **"Permission denied" error?** Make sure the RLS policy was created
- **Still using localStorage?** Check that `enabled: true` in storage.js

### 🚀 Future Features & Roadmap

#### Terminal Bar & Git Integration ✅ COMPLETED
- ✅ Connected to GitHub API to display repository information
- ✅ Terminal bar displays:
  - ✅ Last git push timestamp (relative time format)
  - ✅ Author name with @ prefix
  - ✅ Current time and date
- ✅ Version number in footer:
  - ✅ Format: `v1.[commit count]-[short hash]` (e.g., v1.42-f5efdd3)
  - ✅ Hover to see commit message in tooltip
  - ✅ Automatic commit count from GitHub API
- Configuration:
  - Update `GIT_CONFIG` object in `script.js` with your GitHub username and repository name
  - The terminal bar displays: `Time · Date · Last push: TimeAgo · @AuthorName`
  - Footer displays copyright on first line, version number on second line: `v1.[commits]-[hash]`

---

### 🔧 Technical Improvements Made

#### Supabase Sync Fixes ✅
- **Problem:** New todos were saved locally but not appearing in Supabase
- **Solution:** Fixed sync logic to properly update existing todos and insert new ones
- **How it works now:**
  - Updates existing todos instead of trying to re-insert them
  - Only deletes todos that were actually removed
  - Handles errors gracefully with clear console messages
  - Uses smart "upsert" (update or insert) to avoid duplicates

#### Error Handling ✅
- Added detailed console logging for debugging
- Clear success/error messages with emoji indicators
- Automatic fallback to localStorage if cloud fails
- Test function to verify Supabase connection

---

### 📋 Remaining Tasks

#### Immediate Fixes Needed
- [ ] **Test on multiple devices** - Verify todos sync across phones/tablets/computers
- [ ] **Handle offline mode** - Store changes locally and sync when connection returns
- [ ] **Optimize sync performance** - Currently syncs all todos, could batch large updates

#### Cloud Storage Enhancements
- [ ] **User authentication** - Add login so each user has their own todos
- [ ] **Conflict resolution** - Handle when same todo is edited on two devices
- [ ] **Sync status indicator** - Show user when last sync happened
- [ ] **Backup/export** - Allow users to download their todos as JSON

#### Task Rollout Feature
- Implement expandable tasks with note/details option
- Allow users to add detailed descriptions or context to tasks
- Consider accordion-style UI for expanded task details
- Support markdown formatting in task notes

#### Reminders Section
- Create a dedicated reminders section similar to "Assigned tasks"
- Features to include:
  - Remind me to do something for someone (person-specific reminders)
  - Event reminders with date/time
  - Separate visual section or category in the UI
  - Optional notification system for due reminders
  - Integration with @ tags for person-based reminders

#### Habits & Rituals Tracker
- Add icon-based system to track daily habits and rituals
- Features to include:
  - Visual icons representing different habits (e.g., meditation, exercise, reading)
  - Click to mark habit as completed for the day
  - Track streaks and consistency
  - Daily reset at midnight
  - Customizable habit icons and names
- UI considerations:
  - Display as a row/grid of icons at the top of dashboard
  - Visual indicators for completed vs pending habits
  - Streak counter or progress indicators
  - Color-coded based on completion status


  


