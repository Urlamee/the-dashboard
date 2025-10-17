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

### 🔐 Security & Authentication
- **Password Protection** - Secure login page for single-user access
- **SHA-256 Encryption** - Passwords are hashed using industry-standard SHA-256
- **Session Management** - 24-hour session duration with automatic extension on activity
- **Logout Functionality** - Secure logout button in navigation menu
- **No Registration** - Simple single-user system designed for personal use

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

### Authentication Setup
The dashboard is password-protected for single-user access. Follow these steps to set your password:

1. Open the dashboard in your browser and open the browser console (F12 or Right-click → Inspect → Console)
2. Generate your password hash by running:
   ```javascript
   await generatePasswordHash('your_password_here')
   ```
3. Copy the generated hash from the console output
4. Open `auth.js` and find the `PASSWORD_HASH` constant
5. Replace the default hash with your generated hash:
   ```javascript
   const PASSWORD_HASH = 'your_generated_hash_here';
   ```
6. Save the file and refresh the page

**Default Password:** The system comes with a default password `"admin"` - make sure to change this immediately!

**Security Notes:**
- The password hash is stored in the code, so keep your `auth.js` file secure
- Sessions last 24 hours and auto-extend with activity
- Use the logout button in the menu when you're done

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

