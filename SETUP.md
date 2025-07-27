# 🛠️ HobbyTrack Setup Guide

This guide provides detailed setup instructions for HobbyTrack, covering different deployment scenarios and troubleshooting steps.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Authentication Setup](#authentication-setup)
- [Docker Setup (Recommended)](#docker-setup-recommended)
- [Local Development Setup](#local-development-setup)
- [Environment Configuration](#environment-configuration)
- [Verification Steps](#verification-steps)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### For Docker Setup (Recommended)
- **Docker**: Version 20.0 or higher
- **Docker Compose**: Version 2.0 or higher
- **Git**: For cloning the repository
- **Web Browser**: Chrome, Firefox, Safari, or Edge

### For Local Development
- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (usually comes with Node.js)
- **Python**: Version 3.9 or higher
- **pip**: Python package installer

### Check Your System

Run these commands to verify your system meets the requirements:

```bash
# Check Docker
docker --version
docker-compose --version

# Check Node.js and npm
node --version
npm --version

# Check Python and pip
python --version
python -m pip --version
```

## Authentication Setup

HobbyTrack requires Clerk authentication for user management. This setup is required for both Docker and local development.

### Step 1: Create a Clerk Account

1. Go to [clerk.dev](https://clerk.dev)
2. Sign up for a free account
3. Verify your email address

### Step 2: Create a New Application

1. In your Clerk dashboard, click "Create Application"
2. Choose a name for your application (e.g., "HobbyTrack")
3. Select the authentication methods you want to enable:
   - **Email/Password**: For traditional login
   - **Google**: For Google OAuth (recommended)
   - **GitHub**: For GitHub OAuth (recommended)

### Step 3: Configure Social Providers

#### For Google OAuth:
1. Go to "User & Authentication" → "Social Connections"
2. Enable "Google"
3. Follow Clerk's guide to create a Google OAuth application
4. Add your OAuth client ID and secret in Clerk

#### For GitHub OAuth:
1. Go to "User & Authentication" → "Social Connections"  
2. Enable "GitHub"
3. Follow Clerk's guide to create a GitHub OAuth application
4. Add your OAuth client ID and secret in Clerk

### Step 4: Get Your API Keys

1. Go to "API Keys" in your Clerk dashboard
2. Copy the following keys:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)
3. Note your application domain (e.g., `your-app-name.clerk.accounts.dev`)

### Step 5: Create Environment File

Create a `.env` file in the project root directory:

```bash
# Frontend environment variable (used during build)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Backend environment variables (used during runtime)
CLERK_SECRET_KEY=sk_test_your_secret_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_JWKS_URL=https://your-app-domain.clerk.accounts.dev/.well-known/jwks.json
```

**Important**: Replace `your-app-domain` with your actual Clerk application domain.

## Docker Setup (Recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/hobbytrack.git
cd hobbytrack
```

### Step 2: Create Environment File

Follow the [Authentication Setup](#authentication-setup) section to create your `.env` file.

### Step 3: Build and Start

```bash
# Start HobbyTrack (this will build the containers automatically)
docker-compose up

# Or start in detached mode (runs in background)
docker-compose up -d
```

The first build may take 5-10 minutes as it downloads dependencies and builds the application.

### Step 4: Verify Installation

1. **Check containers are running**:
   ```bash
   docker-compose ps
   ```

2. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Health check: http://localhost:8000/api/health

3. **Check logs if needed**:
   ```bash
   docker-compose logs hobbytrack
   ```

### Docker Management Commands

```bash
# Stop the application
docker-compose down

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up

# View logs
docker-compose logs -f hobbytrack

# Remove all data (caution: this deletes your projects and tasks)
docker-compose down -v
```

## Local Development Setup

Use this setup if you want to develop features or prefer running without Docker.

### Step 1: Clone and Setup

```bash
git clone https://github.com/your-username/hobbytrack.git
cd hobbytrack
```

### Step 2: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at http://localhost:8000

### Step 3: Frontend Setup

Open a new terminal window:

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at http://localhost:3000

### Step 4: Environment Configuration

Create a `.env` file in the **project root** (not in frontend or backend directories) following the [Authentication Setup](#authentication-setup) instructions.

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend | `pk_test_abc123...` |
| `CLERK_SECRET_KEY` | Clerk secret key for backend | `sk_test_xyz789...` |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key for backend | `pk_test_abc123...` |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint | `https://your-app.clerk.accounts.dev/.well-known/jwks.json` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENV` | Environment mode | `development` |
| `PYTHONPATH` | Python path for backend | `/app` (in Docker) |

### Environment File Locations

- **Docker**: `.env` in project root
- **Local Development**: `.env` in project root

## Verification Steps

After setup, verify everything is working:

### 1. Health Checks

```bash
# Check backend health
curl http://localhost:8000/api/health

# Should return: {"status": "healthy"}
```

### 2. Authentication Test

1. Open http://localhost:3000
2. Click "Sign In"
3. Choose your configured OAuth provider (Google/GitHub)
4. Complete the OAuth flow
5. You should be redirected back to HobbyTrack and see the main interface

### 3. Basic Functionality Test

1. **Create a project**: Click "Create New Project"
2. **Add a task**: Click the "+" button in any column
3. **Move a task**: Drag a task between columns
4. **Edit a task**: Click on a task to open the details modal
5. **Upload a file**: In the task details, try uploading an image

## Troubleshooting

### Common Issues

#### Authentication Not Working

**Symptoms**: Login redirects fail, infinite loops, or "Authentication Error"

**Solutions**:
1. Double-check your `.env` file has the correct Clerk keys
2. Verify the `CLERK_JWKS_URL` domain matches your Clerk application
3. Check that your Clerk application has the correct domain settings
4. Clear browser cache and cookies
5. Check browser developer console for errors

#### Docker Build Fails

**Symptoms**: `docker-compose up` fails during build

**Solutions**:
1. Ensure you have at least 4GB RAM allocated to Docker
2. Check that ports 3000 and 8000 are not in use by other applications
3. Verify your `.env` file exists and has the required variables
4. Try a clean build:
   ```bash
   docker-compose down
   docker system prune -f
   docker-compose build --no-cache
   docker-compose up
   ```

#### Port Conflicts

**Symptoms**: "Port already in use" errors

**Solutions**:
1. Change ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "8080:8000"  # Change 8080 to any available port
   ```
2. Or stop the conflicting service:
   ```bash
   # Find what's using the port
   lsof -i :8000
   # Kill the process if safe to do so
   ```

#### Frontend Not Loading

**Symptoms**: Blank page, "Cannot connect to backend"

**Solutions**:
1. Check that both frontend and backend are running
2. Verify backend at http://localhost:8000/api/health
3. Check browser developer console for errors
4. Ensure `.env` file is in the correct location
5. Try hard refresh (Ctrl+Shift+R)

#### Data Not Persisting

**Symptoms**: Tasks disappear after restart

**Solutions**:
1. For Docker, check that the volume is created:
   ```bash
   docker volume ls | grep hobbytrack
   ```
2. Ensure Docker has write permissions to the volume directory
3. Check that you're not using `docker-compose down -v` which removes volumes

### Getting Additional Help

If you're still having issues:

1. **Check the logs**:
   ```bash
   # Docker logs
   docker-compose logs hobbytrack
   
   # Local development - check the terminal where you started the servers
   ```

2. **Browser Developer Tools**:
   - Press F12 to open developer tools
   - Check the Console tab for JavaScript errors
   - Check the Network tab for failed API requests

3. **System Information**:
   Gather this information for bug reports:
   ```bash
   # System info
   docker --version
   docker-compose --version
   node --version
   npm --version
   python --version
   
   # OS info
   uname -a  # On macOS/Linux
   systeminfo  # On Windows
   ```

4. **File an Issue**:
   Include your system information, error messages, and steps to reproduce the issue.

---

**Need more help?** Check the main [README.md](README.md) or file an issue on GitHub. 