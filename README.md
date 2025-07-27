# 🚀 HobbyTrack

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](COPYING)
[![Docker](https://img.shields.io/badge/docker-compose-blue.svg)](docker-compose.yml)
[![React](https://img.shields.io/badge/react-18.2.0-blue.svg)](frontend/package.json)
[![FastAPI](https://img.shields.io/badge/fastapi-0.104.1-green.svg)](backend/requirements.txt)

Modern project tracking for hobbyists - a beautifully redesigned version of the powerful Trac project management system.

## ✨ What is HobbyTrack?

HobbyTrack transforms the robust Trac project management engine into a modern, visual, and motivating application designed specifically for personal projects and hobbies. Whether you're building a robot, learning to paint, or organizing a home renovation, HobbyTrack helps you stay organized and motivated.

### 🎯 Key Features

- **🚀 One-Click Setup**: Get running in under 2 minutes with Docker
- **🎨 Modern Visual Interface**: Clean React TypeScript frontend with Tailwind CSS
- **📋 Interactive Kanban Boards**: Drag-and-drop task management
- **📎 File Attachments**: Upload images, documents, and progress photos
- **🔐 Secure Authentication**: OAuth integration with Google and GitHub via Clerk
- **📱 Fully Responsive**: Works perfectly on desktop, tablet, and mobile
- **🗂️ Multi-Project Support**: Switch between different projects effortlessly
- **💾 Local-First**: All data stored locally with SQLite - no cloud dependencies

## 🏁 Quick Start

### Prerequisites

- **Docker & Docker Compose** (recommended) - [Install Docker](https://docs.docker.com/get-docker/)
- OR **Node.js 18+** and **Python 3.9+** for local development

### Option 1: One-Click Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/hobbytrack.git
   cd hobbytrack
   ```

2. **Set up authentication** (required for login functionality)
   - Sign up for a free account at [Clerk.dev](https://clerk.dev)
   - Create a new application in your Clerk dashboard
   - Copy the example environment file:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and add your Clerk keys (see [Authentication Setup](#authentication-setup) below)

3. **Launch HobbyTrack**
   ```bash
   docker-compose up
   ```

4. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

That's it! 🎉 Your personal project tracker is ready to use.

### Option 2: Local Development Setup

<details>
<summary>Click to expand local development instructions</summary>

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

#### Environment Setup
Create a `.env` file in the project root with your Clerk credentials (see [Authentication Setup](#authentication-setup)).

</details>

## 🔐 Authentication Setup

HobbyTrack uses [Clerk](https://clerk.dev) for secure, modern authentication with Google and GitHub OAuth.

### Step-by-Step Clerk Setup

1. **Create a Clerk Account**
   - Go to [clerk.dev](https://clerk.dev) and sign up for free
   - Create a new application

2. **Configure Social Providers**
   - In your Clerk dashboard, go to "User & Authentication" → "Social Connections"
   - Enable Google and/or GitHub
   - Follow Clerk's guides to set up OAuth applications

3. **Get Your API Keys**
   - Go to "API Keys" in your Clerk dashboard
   - Copy your **Publishable Key** and **Secret Key**

4. **Set Environment Variables**
   Create a `.env` file in the project root:
   ```bash
   # Frontend (build-time variable)
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

   # Backend (runtime variables)
   CLERK_SECRET_KEY=sk_test_your_secret_key_here
   CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   CLERK_JWKS_URL=https://your-app-domain.clerk.accounts.dev/.well-known/jwks.json
   ```

   Replace `your-app-domain` with your actual Clerk application domain (found in your Clerk dashboard under Settings → Domains).

## 📖 User Guide

### Getting Started with Your First Project

1. **Sign In**: Use the "Sign In" button and choose Google or GitHub
2. **Create a Project**: Click "Create New Project" and give it a name
3. **Add Your First Task**: Click the "+" button in any column to create a task
4. **Organize Tasks**: Drag tasks between columns (To Do, In Progress, Done)
5. **Add Details**: Click on any task to edit details, add files, or update status

### Managing Tasks

- **Create**: Click "+" in any column
- **Edit**: Click on a task to open the details modal
- **Move**: Drag tasks between columns or use the status dropdown
- **Attach Files**: Upload images, documents, and progress photos
- **Delete**: Use the delete button in the task details modal

### Project Management

- **Switch Projects**: Use the project dropdown in the top navigation
- **Create Projects**: Click "Create New Project" in the dropdown
- **Project Data**: Each project maintains its own set of tasks and files

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │    │   FastAPI Backend │    │  SQLite Database │
│   (TypeScript)   │◄──►│   (Python)       │◄──►│   (Local File)   │
│   Port 3000      │    │   Port 8000      │    │   ./data/        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Legacy Trac    │
                    │   (Data Layer)   │
                    └──────────────────┘
```

- **Frontend**: React 18 with TypeScript, Vite, Tailwind CSS
- **Backend**: FastAPI wrapping legacy Trac functionality
- **Database**: SQLite for local-first data storage
- **Authentication**: Clerk for OAuth with Google/GitHub
- **Deployment**: Single Docker container with multi-stage build

## 🔧 Troubleshooting

### Common Issues

#### 🚫 "Authentication Error" or Login Not Working

**Problem**: Clerk authentication failing or infinite redirect loops

**Solutions**:
1. Verify your `.env` file contains the correct Clerk keys
2. Check that `CLERK_JWKS_URL` matches your Clerk domain exactly
3. Ensure your Clerk application has the correct domain settings
4. For Docker: Make sure you're passing environment variables correctly in `docker-compose.yml`

**Check your setup**:
```bash
# Verify environment variables are loaded
docker-compose config

# Check backend logs for authentication errors
docker-compose logs hobbytrack
```

#### 🐳 Docker Issues

**Problem**: `docker-compose up` fails or containers don't start

**Solutions**:
1. **Port conflicts**: Change ports in `docker-compose.yml` if 8000 is in use
2. **Missing environment file**: Ensure `.env` file exists with Clerk keys
3. **Docker memory**: Ensure Docker has enough allocated memory (4GB+ recommended)
4. **Clean restart**: 
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up
   ```

#### 📱 Frontend Not Loading

**Problem**: Blank page or "Cannot connect to backend"

**Solutions**:
1. **Backend health check**: Visit http://localhost:8000/api/health
2. **CORS issues**: Check browser developer console for errors
3. **Port conflicts**: Ensure ports 3000 and 8000 are available
4. **Cache issues**: Hard refresh (Ctrl+Shift+R) or clear browser cache

#### 💾 Data Not Persisting

**Problem**: Tasks disappear after restart

**Solutions**:
1. **Docker volume**: Ensure `hobbytrack_data` volume is created
2. **Permissions**: Check that Docker can write to the volume
3. **Volume inspection**:
   ```bash
   docker volume ls
   docker volume inspect hobbytrack_data
   ```

#### 🔄 Tasks Not Syncing or Updating

**Problem**: Changes not saving or UI not updating

**Solutions**:
1. **Network connectivity**: Check browser network tab for failed requests
2. **Authentication**: Ensure you're still logged in (check for auth errors)
3. **Browser console**: Look for JavaScript errors
4. **Backend logs**: Check for server-side errors

### Getting Help

#### 🆘 Still Need Help?

1. **Check logs**:
   ```bash
   # Docker logs
   docker-compose logs hobbytrack
   
   # Local development
   # Check terminal where you're running the backend/frontend
   ```

2. **Browser Developer Tools**:
   - Open F12 → Console tab for JavaScript errors
   - Network tab to see failed API requests

3. **File an Issue**:
   - Include your OS, Docker version, and error messages
   - Share relevant logs (remove any sensitive information)
   - Describe steps to reproduce the issue

#### 📋 Environment Information

For bug reports, please include:
```bash
# System info
docker --version
docker-compose --version

# Node/npm versions (if doing local development)
node --version
npm --version

# Python version (if doing local development)
python --version
```

## 🛠️ Development

### Project Structure

```
hobbytrack/
├── 📁 backend/               # FastAPI application
│   ├── 📁 app/              # Main application code
│   │   ├── 📁 core/         # Core functionality
│   │   ├── 📁 routers/      # API route handlers
│   │   └── 📁 crud/         # Database operations
│   ├── 🐳 Dockerfile        # Backend container config
│   └── 📄 requirements.txt  # Python dependencies
├── 📁 frontend/             # React TypeScript application
│   ├── 📁 src/             # Source code
│   │   ├── 📁 components/  # React components
│   │   ├── 📁 hooks/       # Custom React hooks
│   │   └── 📁 utils/       # Utility functions
│   ├── 🐳 Dockerfile       # Frontend container config
│   └── 📄 package.json     # Node.js dependencies
├── 📁 trac-legacy/         # Legacy Trac codebase
├── 🐳 docker-compose.yml   # One-click deployment
└── 📄 README.md            # This file
```

### Development Commands

```bash
# Frontend development
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Check code style

# Backend development
cd backend
uvicorn app.main:app --reload  # Start development server
python -m pytest              # Run tests

# Docker development
docker-compose up --build     # Rebuild and start
docker-compose down           # Stop all services
docker-compose logs           # View logs
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project builds upon the Trac project management system and respects its original licensing. See [COPYING](COPYING) for details.

## 🙏 Acknowledgments

- **Trac Project** - For the robust foundation and data models
- **Clerk** - For modern, secure authentication
- **FastAPI** - For the excellent Python web framework
- **React Team** - For the powerful frontend framework

---

**Made with ❤️ for hobbyists and makers everywhere** 