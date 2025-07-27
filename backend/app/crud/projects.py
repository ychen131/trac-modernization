import json
import os
import time
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from .. import schemas
from ..core.dependencies import initialize_trac_environment

logger = logging.getLogger(__name__)

# Project storage file path
PROJECTS_FILE = "/app/data/projects.json"

def ensure_data_directory():
    """Ensure the data directory exists."""
    os.makedirs(os.path.dirname(PROJECTS_FILE), exist_ok=True)

def load_projects() -> List[Dict[str, Any]]:
    """Load projects from JSON file."""
    ensure_data_directory()
    if not os.path.exists(PROJECTS_FILE):
        return []
    
    try:
        with open(PROJECTS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        logger.warning(f"Could not load projects file: {e}")
        return []

def save_projects(projects: List[Dict[str, Any]]):
    """Save projects to JSON file."""
    ensure_data_directory()
    try:
        with open(PROJECTS_FILE, 'w') as f:
            json.dump(projects, f, indent=2)
    except Exception as e:
        logger.error(f"Could not save projects file: {e}")
        raise

def create_project(project_data: schemas.ProjectCreateRequest, user: schemas.ClerkUser) -> schemas.ProjectModel:
    """Create a new project and associate it with the authenticated user."""
    projects = load_projects()
    
    # Generate unique project ID
    project_id = str(uuid.uuid4())
    
    # Create project object
    new_project = {
        "id": project_id,
        "name": project_data.name,
        "description": project_data.description,
        "owner_id": user.user_id,
        "owner_email": user.email,
        "created_at": datetime.utcnow().isoformat()
    }
    
    try:
        # Initialize Trac environment for the new project
        initialize_trac_environment(project_id, project_data.name)
        logger.info(f"Initialized Trac environment for project '{project_data.name}'")
    except Exception as e:
        logger.error(f"Failed to initialize Trac environment for project '{project_data.name}': {e}")
        # Continue with project creation even if Trac environment fails
        # The environment will be created on first access
    
    projects.append(new_project)
    save_projects(projects)
    
    logger.info(f"Created project '{project_data.name}' for user {user.email}")
    
    return schemas.ProjectModel(**new_project)

def get_projects_for_user(user: schemas.ClerkUser) -> List[schemas.ProjectModel]:
    """Retrieve all projects owned by the authenticated user."""
    projects = load_projects()
    
    user_projects = [
        project for project in projects 
        if project.get("owner_id") == user.user_id
    ]
    
    return [schemas.ProjectModel(**project) for project in user_projects]

def get_project_by_id(project_id: str, user: schemas.ClerkUser) -> Optional[schemas.ProjectModel]:
    """Retrieve a specific project by ID if owned by the user."""
    projects = load_projects()
    
    for project in projects:
        if project.get("id") == project_id and project.get("owner_id") == user.user_id:
            return schemas.ProjectModel(**project)
    
    return None

def update_project(project_id: str, project_data: schemas.ProjectCreateRequest, user: schemas.ClerkUser) -> Optional[schemas.ProjectModel]:
    """Update an existing project if owned by the user."""
    projects = load_projects()
    
    for i, project in enumerate(projects):
        if project.get("id") == project_id and project.get("owner_id") == user.user_id:
            projects[i]["name"] = project_data.name
            projects[i]["description"] = project_data.description
            save_projects(projects)
            
            logger.info(f"Updated project '{project_data.name}' for user {user.email}")
            return schemas.ProjectModel(**projects[i])
    
    return None

def delete_project(project_id: str, user: schemas.ClerkUser) -> bool:
    """Delete a project if owned by the user."""
    projects = load_projects()
    
    for i, project in enumerate(projects):
        if project.get("id") == project_id and project.get("owner_id") == user.user_id:
            deleted_project = projects.pop(i)
            save_projects(projects)
            
            logger.info(f"Deleted project '{deleted_project['name']}' for user {user.email}")
            return True
    
    return False 