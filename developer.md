## 📝 Developer Notes

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


