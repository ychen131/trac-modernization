import os
import logging
from typing import Dict, Optional
from fastapi import HTTPException, Request, Header
from trac.env import Environment

logger = logging.getLogger(__name__)

# Cache for Trac environments to avoid reloading
_trac_env_cache: Dict[str, Environment] = {}

def get_project_env_path(project_id: str) -> str:
    """Get the file system path for a project's Trac environment."""
    # Use Docker path if running in container, otherwise local path
    if os.path.exists("/app/data"):
        base_path = "/app/data/trac-projects"
    else:
        # For development
        base_path = os.path.join(os.getcwd(), "..", "data", "trac-projects")
    
    return os.path.join(base_path, f"project-{project_id}")

def ensure_project_directory(project_id: str) -> str:
    """Ensure the project directory exists and return its path."""
    env_path = get_project_env_path(project_id)
    os.makedirs(env_path, exist_ok=True)
    return env_path

def initialize_trac_environment(project_id: str, project_name: str) -> Environment:
    """Initialize a new Trac environment for a project."""
    env_path = ensure_project_directory(project_id)
    
    try:
        # Check if Trac environment already exists
        if os.path.exists(os.path.join(env_path, "conf", "trac.ini")):
            logger.info(f"Loading existing Trac environment for project {project_id} at {env_path}")
            env = Environment(env_path)
        else:
            logger.info(f"Creating new Trac environment for project {project_id} at {env_path}")
            # Initialize a new Trac environment
            from trac.admin.console import TracAdmin
            
            # Create the environment
            admin = TracAdmin(env_path)
            admin.onecmd(f"initenv '{project_name}' sqlite:db/trac.db")
            
            # Load the newly created environment
            env = Environment(env_path)
            
            logger.info(f"Successfully created Trac environment for project {project_id}")
        
        # Cache the environment
        _trac_env_cache[project_id] = env
        return env
        
    except Exception as e:
        logger.error(f"Failed to initialize Trac environment for project {project_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize project environment: {str(e)}"
        )

def get_trac_env_for_project(project_id: str, project_name: Optional[str] = None) -> Environment:
    """Get or create a Trac environment for a specific project."""
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID is required")
    
    # Check cache first
    if project_id in _trac_env_cache:
        return _trac_env_cache[project_id]
    
    # Load or create the environment
    try:
        env_path = get_project_env_path(project_id)
        
        if os.path.exists(os.path.join(env_path, "conf", "trac.ini")):
            # Environment exists, load it
            env = Environment(env_path)
            _trac_env_cache[project_id] = env
            return env
        elif project_name:
            # Environment doesn't exist, create it
            return initialize_trac_environment(project_id, project_name)
        else:
            raise HTTPException(
                status_code=404,
                detail="Project environment not found and no project name provided to create it"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get Trac environment for project {project_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to load project environment"
        )

def get_trac_env(request: Request, x_project_id: Optional[str] = Header(None)) -> Environment:
    """
    Get Trac environment based on project ID from header.
    Falls back to default environment if no project ID provided.
    """
    if x_project_id:
        return get_trac_env_for_project(x_project_id)
    
    # Fallback to the original hardcoded environment for backward compatibility
    if not hasattr(request.app.state, 'trac_env') or request.app.state.trac_env is None:
        raise HTTPException(status_code=503, detail="Trac environment not available")
    return request.app.state.trac_env 