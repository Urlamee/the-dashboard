## 📝 Developer Notes

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


  


