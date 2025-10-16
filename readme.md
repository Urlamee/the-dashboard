# 📋 Working Dashboard

A beautiful and functional productivity dashboard that combines task management with mindful breathing exercises. Stay organized while taking care of your mental wellbeing. This is an evolving project with more features and tools planned for the future.


## ✨ Features

### 📝 Task Management
- **Intuitive Todo List** - Add, complete, and manage your daily tasks
- **Priority System** - Organize tasks by priority levels (high, medium, low)
- **Assignee & Supplier Tags** - Use @name to assign tasks and #supplier for suppliers
- **Persistent Storage** - Tasks are saved automatically using localStorage
- **Clean Interface** - Modern, responsive design that works on all devices
- **Motivational Quotes** - Get inspired with daily advice and quotes
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
- **Flexible Sessions** - Select 2, 5, 10 minute sessions or set custom duration
- **Visual Guidance** - Animated breathing circle guides you through each phase
- **Theme Options** - Choose from 6 beautiful color themes
- **Progress Tracking** - Visual timer bar shows session progress

### 🎨 Design Features
- **Responsive Layout** - Optimized for desktop, tablet, and mobile
- **Modern UI** - Clean gradient designs and smooth animations
- **Easy Navigation** - Subtle header menu for quick access to features
- **Accessibility** - ARIA labels and keyboard navigation support

## ⚙️ Configuration

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

