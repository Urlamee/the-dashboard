## 📝 Developer Notes

### ☁️ Cloud Storage Setup ✅ COMPLETED

#### Permanent Data Storage with Supabase
- ✅ Integrated Supabase for cloud-based permanent storage
- ✅ Automatic fallback to localStorage if Supabase is not configured
- ✅ Syncs todos across all devices and browsers
- **Setup Instructions:**
  1. Create a free account at [supabase.com](https://supabase.com)
  2. Create a new project
  3. **Create the todos table using SQL Editor:**
     - In your Supabase dashboard, look at the left sidebar menu
     - Click on **"SQL Editor"** (it has a database icon)
     - Click the **"+ New query"** button (or it might auto-open a new query)
     - Copy and paste this entire SQL code block into the editor:
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

     -- Enable Row Level Security (optional but recommended)
     ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

     -- Allow anonymous read/write (adjust policies based on your needs)
     CREATE POLICY "Allow anonymous access" ON todos
       FOR ALL
       USING (true)
       WITH CHECK (true);
     ```
     - Click the **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
     - You should see "Success. No rows returned" or similar success message
     - ✅ The table is now created! You can verify by going to **Table Editor** in the left sidebar - you should see a `todos` table
  4. Go to Settings → API and copy:
     - Project URL
     - anon/public key
  5. Open `storage.js` and update the `SUPABASE_CONFIG` object:
     ```javascript
     const SUPABASE_CONFIG = {
       url: 'https://vdrzaluohnjhucdccwin.supabase.co',  // Your Project URL
       anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcnphbHVvaG5qaHVjZGNjd2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTExMjQsImV4cCI6MjA3NzE4NzEyNH0.tudrEVEKh2BG-ajvjOoYxir9AwMN2U2VsBAtdV826PQ',            // Your anon/public key
       enabled: true                              // Set to true to enable
     };
     ```
  6. Save and refresh your app - todos will now sync to the cloud!
- **Note:** The app works without Supabase using localStorage. Configure Supabase only when you want cloud sync.

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


  


