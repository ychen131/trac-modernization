from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from .. import schemas, security
from ..crud import projects as crud_projects

router = APIRouter()

@router.post(
    "/projects",
    response_model=schemas.ProjectCreateResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Projects"]
)
async def create_project(
    project_data: schemas.ProjectCreateRequest,
    user: schemas.ClerkUser = Depends(security.require_auth)
):
    """
    Create a new project for the authenticated user.
    
    - **name**: Project name (required)
    - **description**: Project description (optional)
    
    The project will be automatically associated with the authenticated user.
    """
    try:
        created_project = crud_projects.create_project(project_data, user)
        return schemas.ProjectCreateResponse(
            status="success",
            message="Project created successfully",
            project=created_project
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project"
        )

@router.get(
    "/projects",
    response_model=schemas.ProjectListResponse,
    tags=["Projects"]
)
async def get_projects(
    user: schemas.ClerkUser = Depends(security.require_auth)
):
    """
    Get all projects owned by the authenticated user.
    
    Returns a list of projects with their details.
    """
    try:
        projects = crud_projects.get_projects_for_user(user)
        return schemas.ProjectListResponse(
            status="success",
            user_id=user.user_id,
            user_email=user.email,
            projects=projects,
            total_count=len(projects)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve projects"
        )

@router.get(
    "/projects/{project_id}",
    response_model=schemas.ProjectModel,
    tags=["Projects"]
)
async def get_project(
    project_id: str,
    user: schemas.ClerkUser = Depends(security.require_auth)
):
    """
    Get a specific project by ID if owned by the authenticated user.
    
    - **project_id**: The unique identifier of the project
    """
    project = crud_projects.get_project_by_id(project_id, user)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or not owned by user"
        )
    return project

@router.put(
    "/projects/{project_id}",
    response_model=schemas.ProjectCreateResponse,
    tags=["Projects"]
)
async def update_project(
    project_id: str,
    project_data: schemas.ProjectCreateRequest,
    user: schemas.ClerkUser = Depends(security.require_auth)
):
    """
    Update a project if owned by the authenticated user.
    
    - **project_id**: The unique identifier of the project
    - **name**: Updated project name
    - **description**: Updated project description
    """
    updated_project = crud_projects.update_project(project_id, project_data, user)
    if not updated_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or not owned by user"
        )
    
    return schemas.ProjectCreateResponse(
        status="success",
        message="Project updated successfully",
        project=updated_project
    )

@router.delete(
    "/projects/{project_id}",
    tags=["Projects"]
)
async def delete_project(
    project_id: str,
    user: schemas.ClerkUser = Depends(security.require_auth)
):
    """
    Delete a project if owned by the authenticated user.
    
    - **project_id**: The unique identifier of the project
    """
    success = crud_projects.delete_project(project_id, user)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or not owned by user"
        )
    
    return {
        "status": "success",
        "message": "Project deleted successfully"
    } 