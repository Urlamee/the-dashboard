# 📊 Habits Log System Guide

## ✅ Quick Start Checklist

- [x] Table created in Supabase
- [ ] Test connection with `testHabitsLogConnection()` in browser console
- [ ] Click habit icons to start logging data
- [ ] Verify data in Supabase Table Editor

## 🔍 Testing the System

### Test Connection
Open browser console and run:
```javascript
testHabitsLogConnection()
```

### Check if Data is Logging
After clicking a habit icon, check console for:
```
📊 Habit logged: exercise on 2025-01-XX = true
```

### Query Your Data
```javascript
// Today's habits
const today = new Date().toISOString().split('T')[0];
getAllHabitLogs(today, today).then(logs => console.log(logs));

// Last 7 days
const endDate = new Date().toISOString().split('T')[0];
const startDate = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
getAllHabitLogs(startDate, endDate).then(logs => console.log(logs));
```

## 📈 Useful SQL Queries

### View Today's Habits
```sql
SELECT * FROM habits_log 
WHERE date = CURRENT_DATE 
ORDER BY habit_name;
```

### Completion Rate This Week
```sql
SELECT 
  habit_name,
  COUNT(*) as total_days,
  SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completed_days,
  ROUND(100.0 * SUM(CASE WHEN completed THEN 1 ELSE 0 END) / COUNT(*), 2) as completion_rate
FROM habits_log
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY habit_name
ORDER BY completion_rate DESC;
```

### View Habit Streak
```sql
SELECT date, completed 
FROM habits_log 
WHERE habit_name = 'exercise' 
AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

### All Habits This Month
```sql
SELECT 
  date,
  habit_name,
  completed,
  created_at
FROM habits_log
WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY date DESC, habit_name;
```

## 🎯 How It Works

1. **Click a habit icon** → Logs to database automatically
2. **Each click creates/updates** a record with:
   - `date`: Today's date (YYYY-MM-DD)
   - `habit_name`: Name of the habit (exercise, water, etc.)
   - `completed`: true or false
3. **Data persists** in Supabase and localStorage
4. **Historical data** builds up over time for analytics

## 📊 Available Functions

- `testHabitsLogConnection()` - Test if table is accessible
- `getAllHabitLogs(startDate, endDate)` - Get logs for date range
- `initializeHabitsLogTable()` - Show SQL schema (if needed)

## 🔧 Troubleshooting

### Data not saving?
- Check browser console for errors
- Verify `SUPABASE_CONFIG.enabled = true` in `storage.js`
- Test connection: `testHabitsLogConnection()`
- Check Supabase RLS policies allow anonymous access

### Can't see data in Supabase?
- Refresh Table Editor
- Check you're looking at the `habits_log` table
- Verify date format is YYYY-MM-DD

## 🚀 Next Steps

Now that logging is set up, you can:
- Build analytics dashboards
- Create habit streak tracking
- Generate weekly/monthly reports
- Visualize completion rates over time

