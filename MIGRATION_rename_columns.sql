-- Migration: Rename assignee and supplier columns to who and what
-- Run this in your Supabase SQL Editor

-- Step 1: Add new columns (who and what)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS who TEXT;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS what TEXT;

-- Step 2: Copy data from old columns to new columns
UPDATE todos SET who = assignee WHERE assignee IS NOT NULL;
UPDATE todos SET what = supplier WHERE supplier IS NOT NULL;

-- Step 3: Drop old columns (after verifying data was copied correctly)
-- Uncomment these lines after you verify the migration worked:
-- ALTER TABLE todos DROP COLUMN assignee;
-- ALTER TABLE todos DROP COLUMN supplier;

-- Optional: Clean up - remove these lines after migration is complete
-- DROP COLUMN assignee, DROP COLUMN supplier;

