# 📚 HobbyTrack User Guide

A complete guide to using HobbyTrack for managing your personal projects and hobbies.

## Table of Contents

- [Getting Started](#getting-started)
- [Managing Projects](#managing-projects)
- [Working with Tasks](#working-with-tasks)
- [File Attachments](#file-attachments)
- [Kanban Board](#kanban-board)
- [User Account Management](#user-account-management)
- [Tips and Best Practices](#tips-and-best-practices)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [FAQ](#frequently-asked-questions)

## Getting Started

### First Time Setup

1. **Access HobbyTrack**: Open your browser and go to http://localhost:3000 (or your deployed URL)
2. **Sign In**: Click the "Sign In" button and choose your preferred method:
   - **Google**: Sign in with your Google account
   - **GitHub**: Sign in with your GitHub account
   - **Email**: Use your email and password (if enabled)

### Your First Project

After signing in, you'll see the main HobbyTrack interface:

1. **Create Your First Project**:
   - Click "Create New Project" in the project dropdown
   - Enter a project name (e.g., "Home Garden", "Arduino Robot", "Learning Spanish")
   - Add an optional description
   - Click "Create"

2. **Explore the Interface**:
   - **Left Side**: Navigation and project selector
   - **Center**: Kanban board with three columns (To Do, In Progress, Done)
   - **Top Right**: User menu and sign out option

## Managing Projects

### Creating Projects

HobbyTrack supports multiple projects, each with its own set of tasks and files.

**To create a project**:
1. Click the project dropdown in the top navigation
2. Select "Create New Project"
3. Fill in the details:
   - **Name**: A descriptive name for your project
   - **Description**: Optional details about the project goals

**Project Examples**:
- **Home Improvement**: "Kitchen Renovation"
- **Hobby Electronics**: "Smart Home Automation"
- **Creative Projects**: "Watercolor Painting Series"
- **Learning**: "Python Programming Course"

### Switching Between Projects

- Use the **project dropdown** in the top navigation
- Click on any project name to switch to it
- Your last selected project is remembered for next time

### Project Data

Each project maintains:
- **Independent task lists**: Tasks in one project don't affect another
- **Separate file storage**: Attachments are organized by project
- **Individual progress tracking**: Each project has its own completion stats

## Working with Tasks

### Task Structure

Each task in HobbyTrack contains:
- **Title**: A brief, descriptive name
- **Description**: Detailed information about what needs to be done
- **Status**: Current state (To Do, In Progress, Done)
- **Priority**: Importance level (High, Medium, Low)
- **Files**: Attached documents, images, or other files
- **Created/Updated dates**: Automatic timestamps

### Creating Tasks

**Quick Creation**:
1. Click the **"+" button** in any column (To Do, In Progress, Done)
2. Enter a task title
3. Click "Add Task"

**Detailed Creation**:
1. Click the "+" button and enter a title
2. Click on the newly created task to open details
3. Add description, set priority, attach files

### Editing Tasks

**To edit a task**:
1. **Click on any task** to open the details modal
2. Modify any field:
   - **Title**: Click to edit the task name
   - **Description**: Add detailed notes or instructions
   - **Priority**: Choose High (red), Medium (yellow), or Low (blue)
   - **Status**: Use dropdown to change column placement
3. **Save**: Changes are saved automatically

### Task Priorities

- **High Priority** (🔴): Urgent or important tasks
- **Medium Priority** (🟡): Standard tasks
- **Low Priority** (🔵): Nice-to-have or future tasks

Priority affects the visual appearance and can help you focus on what matters most.

### Deleting Tasks

**To delete a task**:
1. Open the task details modal
2. Click the **"Delete Task"** button
3. Confirm the deletion

**⚠️ Warning**: Deleted tasks cannot be recovered. Consider moving to "Done" instead if you want to keep a record.

## File Attachments

### Uploading Files

**To attach files to a task**:
1. Open the task details modal
2. Click **"Choose Files"** or drag files into the upload area
3. Select one or more files from your computer
4. Files will upload automatically

**Supported file types**:
- **Images**: JPG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX, TXT
- **Spreadsheets**: XLS, XLSX, CSV
- **Archives**: ZIP, RAR
- **Other**: Most common file types are supported

**File size limit**: 10MB per file

### Managing Attachments

**Viewing attachments**:
- Open task details to see all attached files
- Click on an image to view it full-size
- File names, sizes, and upload dates are displayed

**Downloading files**:
- Click the **download icon** next to any file
- Files download to your browser's default download folder

**Deleting attachments**:
- Click the **delete icon** (🗑️) next to a file
- Confirm the deletion

### File Organization Tips

- **Use descriptive filenames**: "circuit_diagram_v2.png" instead of "image1.png"
- **Upload progress photos**: Document your project's evolution
- **Attach reference materials**: Save relevant guides, manuals, or inspiration
- **Include measurements/specs**: Photos of dimensions, part numbers, etc.

## Kanban Board

The Kanban board is the heart of HobbyTrack's task management system.

### Board Columns

- **To Do**: Tasks you plan to work on
- **In Progress**: Tasks you're currently working on
- **Done**: Completed tasks

### Moving Tasks

**Drag and Drop**:
1. Click and hold on any task
2. Drag it to a different column
3. Release to drop it in the new status

**Alternative Method**:
1. Open task details
2. Use the **Status dropdown** to change the column
3. Task moves automatically

### Board Tips

- **Limit In Progress tasks**: Don't overwhelm yourself with too many active tasks
- **Use Done column**: Keep completed tasks visible for motivation
- **Regular reviews**: Periodically clean up and reorganize your board

## User Account Management

### Profile Settings

Access your account settings through the user menu:

1. Click your **profile icon** in the top right
2. Select **"Manage Account"** to access Clerk's user management
3. Update your profile information, password, or connected accounts

### Connected Accounts

- **Add OAuth providers**: Connect additional Google or GitHub accounts
- **Remove connections**: Unlink accounts you no longer want to use
- **Primary email**: Set which email receives notifications

### Security

- **Two-factor authentication**: Enable 2FA for additional security
- **Active sessions**: View and manage your login sessions
- **Password changes**: Update your password regularly

## Tips and Best Practices

### Project Organization

- **Use clear project names**: "2024 Garden Project" instead of "Project 1"
- **One goal per project**: Keep projects focused on specific outcomes
- **Archive completed projects**: Create a "Completed" naming convention

### Task Management

- **Break down large tasks**: Split big tasks into smaller, actionable items
- **Use descriptive titles**: "Install kitchen sink faucet" vs "Plumbing work"
- **Add context in descriptions**: Include links, measurements, or requirements
- **Regular updates**: Move tasks through columns as you make progress

### File Management

- **Upload early and often**: Document your progress with photos
- **Organize by task**: Attach files to the relevant task
- **Use cloud backup**: Keep important files backed up outside HobbyTrack

### Productivity Tips

- **Daily reviews**: Check your board each morning
- **Weekly planning**: Add new tasks and prioritize your week
- **Celebrate progress**: Look at your "Done" column for motivation
- **Stay realistic**: Don't overcommit; quality over quantity

## Keyboard Shortcuts

Currently, HobbyTrack uses standard web navigation shortcuts:

- **Tab**: Navigate between interactive elements
- **Enter**: Confirm actions in forms
- **Escape**: Close modals and dialogs
- **Ctrl/Cmd + R**: Refresh the page (if needed)

*More keyboard shortcuts may be added in future updates.*

## Frequently Asked Questions

### General Usage

**Q: Can I use HobbyTrack offline?**
A: HobbyTrack requires an internet connection for authentication and data sync. However, the Docker version runs locally on your machine.

**Q: How many projects can I create?**
A: There's no limit on the number of projects you can create.

**Q: Can I share projects with others?**
A: Currently, HobbyTrack is designed for personal use. Each user has their own private projects and tasks.

### Technical Questions

**Q: Where is my data stored?**
A: When using Docker, all data is stored locally in SQLite database files on your machine. Clerk handles authentication data securely.

**Q: Can I export my data?**
A: Currently, there's no built-in export feature. Your data is stored in SQLite format in the Docker volume.

**Q: What happens if I lose my data?**
A: For Docker installations, your data persists in Docker volumes. Make sure to backup the `hobbytrack_data` volume if needed.

### Troubleshooting

**Q: I can't sign in. What should I do?**
A: Check that your Clerk authentication is properly configured. See the [Setup Guide](SETUP.md) for detailed instructions.

**Q: My changes aren't saving. What's wrong?**
A: Ensure you have a stable internet connection and check the browser console for errors. Try refreshing the page.

**Q: Files won't upload. Why?**
A: Check that:
- File size is under 10MB
- File type is supported
- You have a stable internet connection
- Backend server is running

**Q: The app looks broken on mobile. Is this supported?**
A: HobbyTrack is designed to be responsive and work on mobile devices. If you encounter issues, try refreshing or checking your internet connection.

### Getting Help

**Q: I found a bug. How do I report it?**
A: Please file an issue on the GitHub repository with:
- Description of the problem
- Steps to reproduce
- Your browser and operating system
- Any error messages

**Q: Can I request new features?**
A: Yes! Feature requests are welcome on the GitHub repository.

---

**Happy project tracking! 🚀**

For technical setup help, see the [Setup Guide](SETUP.md).
For quick reference, see the main [README](README.md). 