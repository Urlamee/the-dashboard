-- Migration: Rename columns from assignee/supplier to who/what
-- Run this in your Supabase SQL Editor

-- Step 1: Rename the columns directly
ALTER TABLE todos 
  RENAME COLUMN assignee TO who;

ALTER TABLE todos 
  RENAME COLUMN supplier TO what;

-- That's it! The columns are now renamed.
-- Your existing data will be preserved automatically.

-- Optional: Verify the changes worked:
-- SELECT id, text, who, what, priority, completed FROM todos LIMIT 5;
