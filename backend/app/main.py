"""
HobbyTrack FastAPI Backend - Main Application
"""

from fastapi import FastAPI, HTTPException, Depends, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional, List, Union
import logging
import os
import sys
import time
import hashlib
import shutil
from pathlib import Path
from dotenv import load_dotenv
import urllib.parse

from . import schemas, security
from .crud import tickets as crud_tickets, attachments as crud_attachments
from .routers import tickets as tickets_router, attachments as attachments_router

# Add the project root to Python path to import Trac modules
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Load environment variables from .env file in project root
env_path = os.path.join(project_root, ".env")
load_dotenv(env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info(f"Loading environment variables from: {env_path}")

# Clerk configuration
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown events."""
    # Startup
    logger.info("HobbyTrack API starting up...")
    yield
    # Shutdown
    logger.info("HobbyTrack API shutting down...")


# Create FastAPI application
app = FastAPI(
    title="HobbyTrack API",
    description="Modern API wrapper for Trac legacy system",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins since we're serving from same container
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets_router.router, prefix="/api")
app.include_router(attachments_router.router, prefix="/api")


# Mount static files for serving Vite-built frontend
static_dir = "/app/static"
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    # Mount assets directory separately for direct access
    assets_dir = "/app/static/assets"
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/")
async def serve_spa():
    """Serve the React SPA index.html at root."""
    index_file = "/app/static/index.html"
    if os.path.exists(index_file):
        return FileResponse(index_file)
    # Fallback if static files not found (development mode)
    return {"message": "HobbyTrack API is running", "version": "0.1.0"}


@app.get("/api/health")
async def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "service": "hobbytrack-api"}


@app.get("/api/debug/mode")
async def debug_mode():
    """Debug endpoint to check current mode and configuration"""
    return {
        "development_mode": security.DEVELOPMENT_MODE,
        "clerk_secret_key_set": bool(os.getenv("CLERK_SECRET_KEY", "")),
        "clerk_jwks_url_set": bool(os.getenv("CLERK_JWKS_URL", "")),
        "clerk_publishable_key_set": bool(CLERK_PUBLISHABLE_KEY),
        "clerk_secret_key_length": len(os.getenv("CLERK_SECRET_KEY", "")),
        "clerk_jwks_url_value": os.getenv("CLERK_JWKS_URL", "not set")
    }


@app.get("/api/auth/status")
async def auth_status(user: schemas.ClerkUser = Depends(security.require_auth)) -> Dict[str, Any]:
    """
    Protected endpoint to check authentication status.
    Returns current user information.
    """
    return {
        "authenticated": True,
        "user": {
            "id": user.user_id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name
        },
        "mode": "development" if security.DEVELOPMENT_MODE else "production"
    }


# SPA Fallback - catch all non-API routes and serve index.html
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """
    Catch-all route for SPA fallback routing.
    Serves index.html for all non-API routes to enable client-side routing.
    """
    # Don't interfere with API routes
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    # Serve index.html for all other routes (SPA routing)
    index_file = "/app/static/index.html"
    if os.path.exists(index_file):
        return FileResponse(index_file)
    
    # Fallback if static files not available
    raise HTTPException(status_code=404, detail="Application not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True) 