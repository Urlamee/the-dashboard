# Quick Supabase Setup Checklist

## ✅ Credentials Configured
- URL: `https://vdrzaluohnjhucdccwin.supabase.co`
- API Key: Set ✓
- Enabled: true ✓

## ⚠️ Final Step: Create the Table

**You still need to create the `todos` table in Supabase:**

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/vdrzaluohnjhucdccwin
2. Click **"SQL Editor"** in the left sidebar
3. Click **"+ New query"** 
4. Paste this SQL and click **"Run"**:

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

5. You should see: **"Success. No rows returned"**

## 🧪 Test It

1. Open your app in the browser
2. Open browser console (F12)
3. Add a todo item
4. Check console for any errors
5. Refresh the page - your todo should still be there!
6. Check Supabase Table Editor - you should see your todo in the `todos` table

## 🔍 Troubleshooting

**If you see errors:**
- Make sure you ran the SQL to create the table
- Check browser console for specific error messages
- The app will fall back to localStorage if Supabase fails

**To verify table exists:**
- Go to Supabase → Table Editor
- You should see a `todos` table listed

