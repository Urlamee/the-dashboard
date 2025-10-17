## 📝 Developer Notes

### 🚀 Future Features & Roadmap

---

#### 2. Persistent Task Storage with Firebase Firestore 🔥 PRIORITY
**Goal**: Save all tasks permanently to cloud database
- Tasks persist across browsers and devices
- Automatic real-time sync
- No data loss from browser cache clearing
- Integrates seamlessly with admin login

**Step-by-Step Implementation**:

1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Click "Add project" or use existing project from admin login
   - Name it (e.g., "working-dashboard")
   - Disable Google Analytics (optional for personal use)
   - Click "Create project"

2. **Enable Firestore Database**
   - In Firebase Console, go to "Build" → "Firestore Database"
   - Click "Create database"
   - Choose "Start in test mode" (we'll add security rules later)
   - Select nearest region (e.g., us-central)
   - Click "Enable"

3. **Get Firebase Configuration**
   - In Project Settings (gear icon), scroll to "Your apps"
   - Click web icon (`</>`) to add web app
   - Register app name: "Working Dashboard"
   - Copy the Firebase config object (firebaseConfig)

4. **Add Firebase SDK to Project**
   - Add to `index.html` before closing `</body>` tag (before `script.js`):
     ```html
     <!-- Firebase SDK -->
     <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
     <script src="firebase-config.js"></script>
     ```

5. **Create Firebase Config File**
   - Create new file: `firebase-config.js`
   - Add your configuration:
     ```javascript
     // Initialize Firebase
     const firebaseConfig = {
       apiKey: "your-api-key",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "your-sender-id",
       appId: "your-app-id"
     };
     
     firebase.initializeApp(firebaseConfig);
     const db = firebase.firestore();
     ```

6. **Update saveTodos() Function**
   - In `script.js`, replace current `saveTodos()`:
     ```javascript
     async function saveTodos() {
       try {
         // Save to Firestore
         await db.collection('todos').doc('userTodos').set({
           tasks: todos,
           lastUpdated: new Date().toISOString()
         });
         console.log('Tasks saved to Firestore');
       } catch (error) {
         console.error('Error saving tasks:', error);
         // Fallback to localStorage
         localStorage.setItem('todos', JSON.stringify(todos));
       }
     }
     ```

7. **Update loadTodos() Function**
   - Replace current `loadTodos()`:
     ```javascript
     async function loadTodos() {
       try {
         // Load from Firestore
         const doc = await db.collection('todos').doc('userTodos').get();
         if (doc.exists) {
           todos = doc.data().tasks || [];
           console.log('Tasks loaded from Firestore');
         } else {
           // Try localStorage as fallback
           const stored = localStorage.getItem('todos');
           todos = stored ? JSON.parse(stored) : [];
         }
       } catch (error) {
         console.error('Error loading tasks:', error);
         // Fallback to localStorage
         const stored = localStorage.getItem('todos');
         todos = stored ? JSON.parse(stored) : [];
       }
     }
     ```

8. **Make init() Function Async**
   - Update in `script.js`:
     ```javascript
     async function init() {
       await loadTodos();  // Wait for todos to load
       renderTodos();
       fetchQuotesFromAPI();
       fetchGitInfo();
       startTerminalClock();
       
       // Event listeners...
     }
     
     // Update DOMContentLoaded
     document.addEventListener('DOMContentLoaded', () => {
       init();
     });
     ```

9. **Set Up Firestore Security Rules**
   - In Firebase Console → Firestore Database → Rules
   - Add security rules (for now, allow all since it's single user):
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /todos/{document=**} {
           allow read, write: if true;  // For now, update after login is implemented
         }
       }
     }
     ```
   - Later, update to require authentication:
     ```
     allow read, write: if request.auth != null;
     ```

10. **Test the Implementation**
    - Open the dashboard
    - Add a new task
    - Check Firestore Console to see the data
    - Refresh the page - tasks should persist
    - Open in different browser - tasks should sync
    - Clear localStorage - tasks should still load from Firestore

11. **Optional: Real-Time Sync**
    - Add real-time listener for live updates:
      ```javascript
      db.collection('todos').doc('userTodos').onSnapshot((doc) => {
        if (doc.exists) {
          todos = doc.data().tasks || [];
          renderTodos();
        }
      });
      ```

12. **Migrate Existing localStorage Data**
    - Add one-time migration in `loadTodos()`:
      ```javascript
      // Check if we need to migrate from localStorage
      const localData = localStorage.getItem('todos');
      if (localData && todos.length === 0) {
        todos = JSON.parse(localData);
        await saveTodos();  // Save to Firestore
        console.log('Migrated data from localStorage to Firestore');
      }
      ```

**Files to create**: `firebase-config.js`
**Files to modify**: `index.html`, `script.js`
**Estimated time**: 2-3 hours

---

#### 3. Task Rollout Feature
- Implement expandable tasks with note/details option
- Allow users to add detailed descriptions or context to tasks
- Consider accordion-style UI for expanded task details
- Support markdown formatting in task notes

---

#### 4. Reminders Section
- Create a dedicated reminders section similar to "Assigned tasks"
- Features to include:
  - Remind me to do something for someone (person-specific reminders)
  - Event reminders with date/time
  - Separate visual section or category in the UI
  - Optional notification system for due reminders
  - Integration with @ tags for person-based reminders

---

#### 5. Habits & Rituals Tracker
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

---

### ✅ Completed Features

#### Admin Login (Single User)
- ✅ Password-protected access for personal use only
- ✅ No sign-up or registration system required
- ✅ Single admin user access
- ✅ Clean login page matching dashboard design
- ✅ Session-based authentication (24-hour sessions)
- ✅ SHA-256 password hashing for security
- ✅ Automatic redirect to login if not authenticated
- ✅ Logout button in navigation menu
- ✅ Activity-based session extension
- Configuration:
  - Default password is "admin" (hash included in `auth.js`)
  - To change password: Use `generatePasswordHash('your_password')` in browser console
  - Update `PASSWORD_HASH` constant in `auth.js` with generated hash
  - See `readme.md` for detailed setup instructions
- Files created: `login.html`, `auth.js`
- Files modified: `index.html`, `style.css`, `readme.md`

#### Terminal Bar & Git Integration
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


