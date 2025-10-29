-- Habits Log Table Setup for Supabase
-- Run this SQL in your Supabase SQL Editor to create the habits_log table

CREATE TABLE IF NOT EXISTS habits_log (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  habit_name TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, habit_name)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_habits_log_date ON habits_log(date);
CREATE INDEX IF NOT EXISTS idx_habits_log_habit_name ON habits_log(habit_name);
CREATE INDEX IF NOT EXISTS idx_habits_log_date_habit ON habits_log(date, habit_name);

-- Enable Row Level Security
ALTER TABLE habits_log ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write access
CREATE POLICY "Allow anonymous access" ON habits_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Optional: Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_habits_log_updated_at BEFORE UPDATE ON habits_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

