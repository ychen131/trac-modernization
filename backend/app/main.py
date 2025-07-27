"""
HobbyTrack FastAPI Backend - Main Application
"""

from fastapi import FastAPI, HTTPException, Depends, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional, List, Union
import logging
import os
import sys
import time
import jwt
import requests
import hashlib
import shutil
from pathlib import Path
from pydantic import BaseModel, validator
from dotenv import load_dotenv
import urllib.parse

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
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY", "")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")

# Development mode check
DEVELOPMENT_MODE = not all([CLERK_SECRET_KEY, CLERK_JWKS_URL])
if DEVELOPMENT_MODE:
    logger.warning("Running in DEVELOPMENT MODE - Some Clerk features may not work properly without proper configuration!")

# Security scheme for authentication
security = HTTPBearer(auto_error=False)

# Cache for JWKS to avoid repeated requests
_jwks_cache = None

# Pydantic Models for API responses
class TicketModel(BaseModel):
    """Individual ticket model with validation."""
    id: int
    summary: str
    status: str
    priority: str
    reporter: str
    owner: str
    created: int
    
    @validator('summary')
    def summary_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Summary cannot be empty')
        return v.strip()
    
    @validator('status')
    def status_must_be_valid(cls, v):
        valid_statuses = ['new', 'assigned', 'accepted', 'closed', 'reopened']
        if v not in valid_statuses:
            logger.warning(f"Unexpected ticket status: {v}")
        return v

class TicketCreateRequest(BaseModel):
    """Request model for creating tickets."""
    summary: str
    description: Optional[str] = ""
    priority: Optional[str] = "medium"
    component: Optional[str] = "general"
    status: Optional[str] = "new"
    
    @validator('summary')
    def summary_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Summary cannot be empty')
        return v.strip()
    
    @validator('priority')
    def priority_must_be_valid(cls, v):
        if v:
            valid_priorities = ['low', 'medium', 'high', 'critical']
            if v not in valid_priorities:
                raise ValueError(f'Priority must be one of: {", ".join(valid_priorities)}')
        return v or "medium"
    
    @validator('status')
    def status_must_be_valid(cls, v):
        if v:
            valid_statuses = ['new', 'assigned', 'accepted', 'closed', 'reopened']
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v or "new"

class TicketCreateResponse(BaseModel):
    """Response model for ticket creation."""
    status: str
    message: str
    ticket: TicketModel

class TicketsResponse(BaseModel):
    """Response model for tickets endpoint."""
    status: str
    user_id: str
    user_email: str
    tickets: List[TicketModel]
    total_count: int
    message: Optional[str] = None

class TicketUpdateRequest(BaseModel):
    """Request model for updating tickets."""
    status: Optional[str] = None
    priority: Optional[str] = None
    owner: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    
    @validator('status')
    def status_must_be_valid(cls, v):
        if v:
            valid_statuses = ['new', 'assigned', 'accepted', 'closed', 'reopened']
            if v not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v
    
    @validator('priority')
    def priority_must_be_valid(cls, v):
        if v:
            valid_priorities = ['low', 'medium', 'high', 'critical']
            if v not in valid_priorities:
                raise ValueError(f'Priority must be one of: {", ".join(valid_priorities)}')
        return v
    
    @validator('summary')
    def summary_must_not_be_empty(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Summary cannot be empty')
        return v.strip() if v else v

class TicketUpdateResponse(BaseModel):
    """Response model for ticket updates."""
    status: str
    message: str
    ticket: TicketModel

class TicketDeleteResponse(BaseModel):
    """Response model for ticket deletion."""
    status: str
    message: str
    deleted_ticket_id: int

class ClerkUser(BaseModel):
    """User information from Clerk authentication."""
    user_id: str
    email: str
    first_name: str
    last_name: str

class AttachmentModel(BaseModel):
    """Individual attachment model with validation."""
    filename: str
    size: int
    description: Optional[str] = ""
    author: str
    uploaded: int
    
    @validator('filename')
    def filename_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Filename cannot be empty')
        return v.strip()

class AttachmentCreateResponse(BaseModel):
    """Response model for attachment creation."""
    status: str
    message: str
    attachment: AttachmentModel

class AttachmentListResponse(BaseModel):
    """Response model for listing attachments."""
    status: str
    ticket_id: int
    attachments: List[AttachmentModel]
    total_count: int


class AuthenticationError(Exception):
    """Custom exception for authentication errors."""
    pass


def get_jwks():
    """Fetch JWKS from Clerk's endpoint with caching."""
    global _jwks_cache
    
    if _jwks_cache is None and CLERK_JWKS_URL:
        try:
            response = requests.get(CLERK_JWKS_URL, timeout=10)
            response.raise_for_status()
            _jwks_cache = response.json()
            logger.info("Successfully fetched JWKS from Clerk")
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="Authentication service unavailable"
            )
    
    return _jwks_cache


def get_public_key(kid: str):
    """Get public key for JWT verification."""
    jwks = get_jwks()
    if not jwks:
        return None
    
    for key in jwks.get('keys', []):
        if key.get('kid') == kid:
            # Convert JWK to PEM format using jose library
            from jose import jwk
            return jwk.construct(key)
    
    raise HTTPException(
        status_code=401,
        detail="Invalid token - key not found"
    )


def decode_clerk_token(token: str) -> Dict[str, Any]:
    """Decode and verify Clerk JWT token."""
    if DEVELOPMENT_MODE:
        # Development mode - return different users for different tokens to test ownership
        if token == "dev_test_token_123":
            return {
                "sub": "dev_user_123",
                "email": "user1@hobbytrack.local",
                "given_name": "Test",
                "family_name": "User1"
            }
        elif token == "development-token":
            return {
                "sub": "dev_user_456", 
                "email": "user2@hobbytrack.local",
                "given_name": "Test",
                "family_name": "User2"
            }
        elif token and token.startswith("dev_"):
            # Other dev tokens
            return {
                "sub": "dev_user_generic",
                "email": "developer@hobbytrack.local",
                "given_name": "Development",
                "family_name": "User"
            }
        else:
            # Invalid tokens in development mode should still fail
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )
    
    try:
        # Get the token header to find the key ID
        headers = jwt.get_unverified_header(token)
        kid = headers.get('kid')
        
        if not kid:
            raise HTTPException(
                status_code=401,
                detail="Invalid token - missing key ID"
            )
        
        # Get the public key for verification
        public_key = get_public_key(kid)
        if not public_key:
            raise HTTPException(
                status_code=401,
                detail="Invalid token - cannot verify signature"
            )
        
        # Decode and verify the token
        decoded = jwt.decode(
            token,
            public_key.to_pem().decode('utf-8'),
            algorithms=['RS256'],
            options={
                "verify_exp": True,
                "verify_nbf": True,
                "verify_signature": True
            }
        )
        
        logger.info(f"Successfully verified token for user: {decoded.get('sub', 'unknown')}")
        return decoded
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )


async def verify_clerk_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> ClerkUser:
    """
    Verify Clerk JWT token and return user information.
    This is a FastAPI dependency that can be used to protect routes.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials required"
        )
    
    try:
        token = credentials.credentials
        decoded = decode_clerk_token(token)
        
        # Extract user information from the decoded token
        user_id = decoded.get('sub', 'unknown')
        email = decoded.get('email', 'unknown@example.com')
        first_name = decoded.get('given_name', decoded.get('first_name', 'User'))
        last_name = decoded.get('family_name', decoded.get('last_name', ''))
        
        return ClerkUser(
            user_id=user_id,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )


def require_auth(user: ClerkUser = Depends(verify_clerk_token)) -> ClerkUser:
    """
    Dependency that requires authentication.
    Use this for routes that need authenticated users.
    """
    return user


def require_auth_decorator(func):
    """
    Decorator version of authentication.
    Alternative to dependency injection for those who prefer decorator patterns.
    
    Usage:
    @require_auth_decorator
    async def my_protected_route(request: Request):
        # Access user via request.state.user
        user = request.state.user
        return {"user_id": user.user_id}
    """
    from functools import wraps
    
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        # Extract credentials manually
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="Authentication credentials required"
            )
        
        # Create credentials object for verification
        class MockCredentials:
            def __init__(self, token: str):
                self.credentials = token.replace("Bearer ", "")
        
        credentials = MockCredentials(auth_header)
        
        # Verify the token using our existing function
        user = await verify_clerk_token(credentials)
        
        # Store user in request state for access in the route
        request.state.user = user
        
        # Call the original function
        return await func(request, *args, **kwargs)
    
    return wrapper


async def check_ticket_ownership(ticket_id: int, user: ClerkUser, env) -> Optional[Dict[str, Any]]:
    """
    Check if the authenticated user has permission to update the specified ticket.
    Returns ticket data if user has permission, None otherwise.
    
    Permission rules:
    - User can update tickets they are the owner of
    - User can update tickets they are the reporter of (created)
    """
    try:
        with env.db_transaction as db:
            cursor = db.cursor()
            cursor.execute("""
                SELECT id, summary, status, priority, reporter, owner, time, description
                FROM ticket 
                WHERE id = %s
            """, (ticket_id,))
            
            ticket_row = cursor.fetchone()
            if not ticket_row:
                return None
            
            # Extract ticket data
            ticket_data = {
                'id': ticket_row[0],
                'summary': ticket_row[1],
                'status': ticket_row[2],
                'priority': ticket_row[3],
                'reporter': ticket_row[4],
                'owner': ticket_row[5],
                'time': ticket_row[6],
                'description': ticket_row[7] if len(ticket_row) > 7 else ""
            }
            
            # Check ownership permissions
            user_can_update = (
                ticket_data['owner'] == user.email or 
                ticket_data['reporter'] == user.email
            )
            
            if user_can_update:
                return ticket_data
            else:
                return None
                
    except Exception as e:
        logger.error(f"Error checking ticket ownership: {str(e)}")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown events."""
    # Startup
    logger.info("HobbyTrack API starting up...")
    if CLERK_JWKS_URL:
        logger.info("Clerk authentication enabled with proper JWT verification")
    else:
        logger.warning("Clerk authentication in development mode - set CLERK_JWKS_URL for production")
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
        "development_mode": DEVELOPMENT_MODE,
        "clerk_secret_key_set": bool(CLERK_SECRET_KEY),
        "clerk_jwks_url_set": bool(CLERK_JWKS_URL),
        "clerk_publishable_key_set": bool(CLERK_PUBLISHABLE_KEY),
        "clerk_secret_key_length": len(CLERK_SECRET_KEY) if CLERK_SECRET_KEY else 0,
        "clerk_jwks_url_value": CLERK_JWKS_URL if CLERK_JWKS_URL else "not set"
    }


@app.get("/api/auth/status")
async def auth_status(user: ClerkUser = Depends(require_auth)) -> Dict[str, Any]:
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
        "mode": "development" if DEVELOPMENT_MODE else "production"
    }


@app.get("/api/auth/status-decorator")
@require_auth_decorator
async def auth_status_decorator_example(request: Request) -> Dict[str, Any]:
    """
    Example of using the @require_auth_decorator pattern.
    This demonstrates an alternative to dependency injection.
    """
    user = request.state.user
    return {
        "authenticated": True,
        "user": {
            "id": user.user_id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name
        },
        "mode": "development" if DEVELOPMENT_MODE else "production",
        "auth_method": "decorator"
    }


@app.get("/api/test-trac")
async def test_trac_integration() -> Dict[str, Any]:
    """Test endpoint to verify Trac legacy integration."""
    try:
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        # In Docker container, test-projects is at /app/test-projects
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            # Development mode - relative to project root
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Get some basic information to verify integration
        with env.db_transaction as db:
            # Count tickets in the database
            cursor = db.cursor()
            cursor.execute("SELECT COUNT(*) FROM ticket")
            ticket_count = cursor.fetchone()[0]
            
            # Get some sample ticket IDs
            cursor.execute("SELECT id FROM ticket LIMIT 5")
            sample_ticket_ids = [row[0] for row in cursor.fetchall()]
        
        return {
            "status": "success",
            "message": "Trac integration successful",
            "trac_available": True,
            "environment_path": trac_env_path,
            "environment_name": env.project_name,
            "ticket_count": ticket_count,
            "sample_ticket_ids": sample_ticket_ids,
            "trac_version": env.trac_version
        }
    except Exception as e:
        logger.error(f"Trac integration test failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Trac integration error: {str(e)}"
        )


@app.get(
    "/api/tickets",
    response_model=TicketsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Tickets for Authenticated User",
    description="Retrieve a list of tickets from the Trac database for the authenticated user. Returns paginated results with ticket details.",
    responses={
        200: {
            "description": "Successfully retrieved tickets",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "user_id": "user_123",
                        "user_email": "user@example.com",
                        "tickets": [
                            {
                                "id": 1,
                                "summary": "Sample ticket",
                                "status": "new",
                                "priority": "high",
                                "reporter": "user",
                                "owner": "admin",
                                "created": 1640995200
                            }
                        ],
                        "total_count": 1,
                        "message": None
                    }
                }
            }
        },
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Tickets"]
)
async def get_tickets(user: ClerkUser = Depends(require_auth)) -> TicketsResponse:
    """
    **Get Tickets for Authenticated User**
    
    This endpoint retrieves tickets from the legacy Trac database for the authenticated user.
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Returns:**
    - List of tickets with metadata
    - User information
    - Total count
    
    **Example Usage:**
    ```
    curl -H "Authorization: Bearer <your-token>" http://localhost:8000/api/tickets
    ```
    """
    try:
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Get tickets for the authenticated user
        with env.db_transaction as db:
            cursor = db.cursor()
            # Get tickets with basic information for the authenticated user
            cursor.execute("""
                SELECT id, summary, status, priority, reporter, owner, time
                FROM ticket 
                WHERE owner = %s OR reporter = %s
                ORDER BY time DESC 
                LIMIT 20
            """, (user.email, user.email))
            
            tickets = []
            for row in cursor.fetchall():
                # Handle timestamp conversion - Trac might store in microseconds
                raw_timestamp = row[6]
                created_timestamp = raw_timestamp
                
                if raw_timestamp is not None:
                    try:
                        # Convert to integer if it's not already
                        timestamp_int = int(raw_timestamp)
                        
                        # Check if timestamp is in microseconds (13+ digits) vs seconds (10 digits)
                        if timestamp_int > 9999999999:  # More than 10 digits means likely microseconds
                            created_timestamp = timestamp_int // 1000000  # Convert microseconds to seconds
                        else:
                            created_timestamp = timestamp_int
                            
                        # Validate the timestamp is reasonable (between 2000 and 2050)
                        if created_timestamp < 946684800 or created_timestamp > 2524608000:
                            logger.warning(f"Invalid timestamp {created_timestamp} for ticket {row[0]}, using current time")
                            created_timestamp = int(time.time())
                            
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Failed to parse timestamp {raw_timestamp} for ticket {row[0]}: {e}")
                        created_timestamp = int(time.time())  # Use current time as fallback
                else:
                    created_timestamp = int(time.time())  # Use current time if None
                
                tickets.append({
                    "id": row[0],
                    "summary": row[1],
                    "status": row[2],
                    "priority": row[3],
                    "reporter": row[4],
                    "owner": row[5],
                    "created": created_timestamp
                })
        
        return TicketsResponse(
            status="success",
            user_id=user.user_id,
            user_email=user.email,
            tickets=[TicketModel(**ticket) for ticket in tickets],
            total_count=len(tickets)
        )
        
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to fetch tickets: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while fetching tickets"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@app.post(
    "/api/tickets",
    response_model=TicketCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Ticket",
    description="Create a new ticket in the Trac database for the authenticated user. Returns the created ticket details.",
    responses={
        201: {
            "description": "Ticket created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "Ticket created successfully",
                        "ticket": {
                            "id": 42,
                            "summary": "New feature request",
                            "status": "new",
                            "priority": "medium",
                            "reporter": "user@example.com",
                            "owner": "",
                            "created": 1640995200
                        }
                    }
                }
            }
        },
        400: {"description": "Invalid input data"},
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Tickets"]
)
async def create_ticket(
    ticket_data: TicketCreateRequest,
    user: ClerkUser = Depends(require_auth)
) -> TicketCreateResponse:
    """
    **Create New Ticket**
    
    This endpoint creates a new ticket in the legacy Trac database for the authenticated user.
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Request Body:**
    - `summary`: Required ticket title/summary
    - `description`: Optional detailed description
    - `priority`: Optional priority level (low, medium, high, critical)
    - `component`: Optional component name
    - `status`: Optional initial status (defaults to 'new')
    
    **Returns:**
    - Created ticket details
    - Success status and message
    
    **Example Usage:**
    ```
    curl -X POST -H "Authorization: Bearer <token>" \
         -H "Content-Type: application/json" \
         -d '{"summary":"Fix bug","description":"Details here"}' \
         http://localhost:8000/api/tickets
    ```
    """
    try:
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Create new ticket in database
        with env.db_transaction as db:
            cursor = db.cursor()
            
            # Get current timestamp in microseconds (Trac format)
            current_time = int(time.time() * 1000000)
            
            # Insert new ticket using Trac-compatible %s placeholders
            cursor.execute("""
                INSERT INTO ticket (type, time, changetime, component, priority, owner, reporter, status, summary, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                "task",  # Default type
                current_time,
                current_time,
                ticket_data.component,
                ticket_data.priority,
                "",  # Owner starts empty (unassigned)
                user.email,  # Set reporter to authenticated user's email
                ticket_data.status,
                ticket_data.summary,
                ticket_data.description
            ))
            
            # Get the ID of the created ticket
            ticket_id = cursor.lastrowid
            
            logger.info(f"Created ticket {ticket_id} for user {user.email}")
        
        # Create response with the created ticket
        created_ticket = TicketModel(
            id=ticket_id,
            summary=ticket_data.summary,
            status=ticket_data.status,
            priority=ticket_data.priority,
            reporter=user.email,
            owner="",
            created=current_time // 1000000  # Convert back to seconds for response
        )
        
        return TicketCreateResponse(
            status="success",
            message="Ticket created successfully",
            ticket=created_ticket
        )
        
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to create ticket: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while creating ticket"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@app.post("/api/tickets/simple-test")
async def create_ticket_simple_test(ticket_data: TicketCreateRequest):
    """Simple test for ticket creation"""
    try:
        # Test 1: Direct SQLite connection (bypass Trac)
        import sqlite3
        db_path = os.path.join(project_root, "test-projects", "my-drone-project", "db", "trac.db")
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            current_time = int(time.time() * 1000000)
            
            # Use SQLite directly - this should work
            cursor.execute(
                "INSERT INTO ticket (type, time, changetime, component, priority, owner, reporter, status, summary, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ("task", current_time, current_time, ticket_data.component, ticket_data.priority, "", "test@example.com", ticket_data.status, ticket_data.summary, ticket_data.description)
            )
            
            ticket_id = cursor.lastrowid
            conn.commit()
        
        return {"status": "success", "method": "direct_sqlite", "ticket_id": ticket_id, "summary": ticket_data.summary}
        
    except Exception as e:
        return {"status": "error", "error": str(e), "error_type": type(e).__name__}


@app.post("/api/tickets/trac-test")
async def create_ticket_trac_test(ticket_data: TicketCreateRequest):
    """Test ticket creation using Trac environment"""
    try:
        # Import Trac environment
        from trac.env import Environment
        trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        env = Environment(trac_env_path)
        
        # Create new ticket in database using Trac
        with env.db_transaction as db:
            cursor = db.cursor()
            current_time = int(time.time() * 1000000)
            
            # Use Trac's database connection with %s placeholders (Trac converts these to ? internally)
            cursor.execute(
                "INSERT INTO ticket (type, time, changetime, component, priority, owner, reporter, status, summary, description) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                ("task", current_time, current_time, ticket_data.component, ticket_data.priority, "", "test@example.com", ticket_data.status, ticket_data.summary, ticket_data.description)
            )
            
            ticket_id = cursor.lastrowid
        
        return {"status": "success", "method": "trac_environment", "ticket_id": ticket_id, "summary": ticket_data.summary}
        
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "error_type": type(e).__name__, "traceback": traceback.format_exc()}


@app.patch(
    "/api/tickets/{ticket_id}",
    response_model=TicketUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Ticket Status",
    description="Update ticket status and other properties in the Trac database. Users can only update tickets they own or created.",
    responses={
        200: {
            "description": "Ticket updated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "Ticket updated successfully",
                        "ticket": {
                            "id": 1,
                            "summary": "Updated ticket",
                            "status": "assigned",
                            "priority": "high",
                            "reporter": "user@example.com",
                            "owner": "user@example.com",
                            "created": 1640995200
                        }
                    }
                }
            }
        },
        400: {"description": "Invalid input data"},
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden - user doesn't own this ticket"},
        404: {"description": "Ticket not found"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Tickets"]
)
async def update_ticket(
    ticket_id: int,
    update_data: TicketUpdateRequest,
    user: ClerkUser = Depends(require_auth)
) -> TicketUpdateResponse:
    """
    **Update Ticket Status and Properties**
    
    This endpoint updates ticket properties in the legacy Trac database for authenticated users.
    Users can only update tickets they own (assigned to) or created (reporter).
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Ownership Rules:**
    - Users can update tickets they are the `owner` of (assigned to)
    - Users can update tickets they are the `reporter` of (created)
    - Returns 403 Forbidden if user doesn't have permission
    
    **Request Body (all fields optional):**
    - `status`: New status (new, assigned, accepted, closed, reopened)
    - `priority`: New priority (low, medium, high, critical)
    - `owner`: New owner/assignee email
    - `summary`: Updated summary/title
    - `description`: Updated description
    
    **Returns:**
    - Updated ticket details
    - Success status and message
    
    **Example Usage:**
    ```
    curl -X PATCH -H "Authorization: Bearer <token>" \
         -H "Content-Type: application/json" \
         -d '{"status":"assigned","priority":"high"}' \
         http://localhost:8000/api/tickets/1
    ```
    """
    try:
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Check if ticket exists and user has permission to update it
        ticket_data = await check_ticket_ownership(ticket_id, user, env)
        
        if ticket_data is None:
            # First check if ticket exists at all
            with env.db_transaction as db:
                cursor = db.cursor()
                cursor.execute("SELECT id FROM ticket WHERE id = %s", (ticket_id,))
                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Ticket {ticket_id} not found"
                    )
            
            # Ticket exists but user doesn't have permission
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You can only update tickets you own or created."
            )
        
        # Build update query dynamically based on provided fields
        update_fields = []
        update_values = []
        
        if update_data.status is not None:
            update_fields.append("status = %s")
            update_values.append(update_data.status)
        
        if update_data.priority is not None:
            update_fields.append("priority = %s")
            update_values.append(update_data.priority)
        
        if update_data.owner is not None:
            update_fields.append("owner = %s")
            update_values.append(update_data.owner)
        
        if update_data.summary is not None:
            update_fields.append("summary = %s")
            update_values.append(update_data.summary)
        
        if update_data.description is not None:
            update_fields.append("description = %s")
            update_values.append(update_data.description)
        
        # Always update changetime
        current_time = int(time.time() * 1000000)
        update_fields.append("changetime = %s")
        update_values.append(current_time)
        
        # Add ticket_id for WHERE clause
        update_values.append(ticket_id)
        
        if len(update_fields) <= 1:  # Only changetime was added
            # No fields to update (except changetime)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields provided for update"
            )
        
        # Update ticket in database
        with env.db_transaction as db:
            cursor = db.cursor()
            
            update_query = f"""
                UPDATE ticket 
                SET {', '.join(update_fields)}
                WHERE id = %s
            """
            
            cursor.execute(update_query, update_values)
            
            # Fetch updated ticket data
            cursor.execute("""
                SELECT id, summary, status, priority, reporter, owner, time
                FROM ticket 
                WHERE id = %s
            """, (ticket_id,))
            
            updated_row = cursor.fetchone()
            if not updated_row:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to retrieve updated ticket"
                )
            
            # Handle timestamp conversion
            raw_timestamp = updated_row[6]
            created_timestamp = raw_timestamp
            
            if raw_timestamp is not None:
                try:
                    timestamp_int = int(raw_timestamp)
                    if timestamp_int > 9999999999:  # Microseconds to seconds
                        created_timestamp = timestamp_int // 1000000
                    else:
                        created_timestamp = timestamp_int
                        
                    # Validate timestamp is reasonable
                    if created_timestamp < 946684800 or created_timestamp > 2524608000:
                        logger.warning(f"Invalid timestamp {created_timestamp} for ticket {ticket_id}")
                        created_timestamp = int(time.time())
                        
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse timestamp {raw_timestamp} for ticket {ticket_id}: {e}")
                    created_timestamp = int(time.time())
            else:
                created_timestamp = int(time.time())
            
            updated_ticket = TicketModel(
                id=updated_row[0],
                summary=updated_row[1],
                status=updated_row[2],
                priority=updated_row[3],
                reporter=updated_row[4],
                owner=updated_row[5],
                created=created_timestamp
            )
        
        logger.info(f"Updated ticket {ticket_id} for user {user.email}")
        
        return TicketUpdateResponse(
            status="success",
            message="Ticket updated successfully",
            ticket=updated_ticket
        )
        
    except HTTPException:
        raise
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to update ticket {ticket_id}: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while updating ticket"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@app.delete(
    "/api/tickets/{ticket_id}",
    response_model=TicketDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete Ticket",
    description="Delete a ticket from the Trac database. Users can only delete tickets they own or created.",
    responses={
        200: {
            "description": "Ticket deleted successfully",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "Ticket deleted successfully",
                        "deleted_ticket_id": 1
                    }
                }
            }
        },
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden - user doesn't own this ticket"},
        404: {"description": "Ticket not found"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Tickets"]
)
async def delete_ticket(
    ticket_id: int,
    user: ClerkUser = Depends(require_auth)
) -> TicketDeleteResponse:
    """
    **Delete Ticket**
    
    This endpoint deletes a ticket from the legacy Trac database for authenticated users.
    Users can only delete tickets they own (assigned to) or created (reporter).
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Ownership Rules:**
    - Users can delete tickets they are the `owner` of (assigned to)
    - Users can delete tickets they are the `reporter` of (created)
    - Returns 403 Forbidden if user doesn't have permission
    
    **Returns:**
    - Success status and message
    - ID of deleted ticket
    
    **Example Usage:**
    ```
    curl -X DELETE -H "Authorization: Bearer <token>" \
         http://localhost:8000/api/tickets/1
    ```
    """
    try:
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Check if ticket exists and user has permission to delete it
        ticket_data = await check_ticket_ownership(ticket_id, user, env)
        
        if ticket_data is None:
            # First check if ticket exists at all
            with env.db_transaction as db:
                cursor = db.cursor()
                cursor.execute("SELECT id FROM ticket WHERE id = %s", (ticket_id,))
                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Ticket {ticket_id} not found"
                    )
            
            # Ticket exists but user doesn't have permission
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You can only delete tickets you own or created."
            )
        
        # Delete ticket from database
        with env.db_transaction as db:
            cursor = db.cursor()
            
            # Delete the ticket
            cursor.execute("DELETE FROM ticket WHERE id = %s", (ticket_id,))
            
            # Check if any rows were affected
            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to delete ticket"
                )
        
        logger.info(f"Deleted ticket {ticket_id} for user {user.email}")
        
        return TicketDeleteResponse(
            status="success",
            message="Ticket deleted successfully",
            deleted_ticket_id=ticket_id
        )
        
    except HTTPException:
        raise
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to delete ticket {ticket_id}: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while deleting ticket"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@app.get(
    "/api/tickets/{ticket_id}/attachments",
    response_model=AttachmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Attachments for a Specific Ticket",
    description="Retrieve a list of attachments for a specific ticket. Returns paginated results with attachment details.",
    responses={
        200: {
            "description": "Successfully retrieved attachments",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "ticket_id": 1,
                        "attachments": [
                            {
                                "filename": "document.pdf",
                                "size": 1024576,
                                "description": "Project documentation",
                                "author": "user@example.com",
                                "uploaded": 1640995200
                            }
                        ],
                        "total_count": 1,
                        "message": None
                    }
                }
            }
        },
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden - user doesn't own this ticket"},
        404: {"description": "Ticket not found"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Attachments"]
)
async def get_ticket_attachments(
    ticket_id: int,
    user: ClerkUser = Depends(require_auth)
) -> AttachmentListResponse:
    """
    **Get Attachments for a Specific Ticket**
    
    This endpoint retrieves a list of attachments for a specific ticket.
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Ownership Rules:**
    - Users can only view attachments for tickets they own or created.
    - Returns 403 Forbidden if user doesn't have permission.
    
    **Returns:**
    - List of attachments with metadata
    - Total count
    - Ticket ID
    
    **Example Usage:**
    ```
    curl -H "Authorization: Bearer <your-token>" http://localhost:8000/api/tickets/1/attachments
    ```
    """
    try:
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Check if ticket exists and user has permission to view attachments
        ticket_data = await check_ticket_ownership(ticket_id, user, env)
        
        if ticket_data is None:
            # First check if ticket exists at all
            with env.db_transaction as db:
                cursor = db.cursor()
                cursor.execute("SELECT id FROM ticket WHERE id = %s", (ticket_id,))
                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Ticket {ticket_id} not found"
                    )
            
            # Ticket exists but user doesn't have permission
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You can only view attachments for tickets you own or created."
            )
        
        # Get attachments for the ticket
        with env.db_transaction as db:
            cursor = db.cursor()
            cursor.execute("""
                SELECT filename, size, description, author, time
                FROM attachment 
                WHERE type = %s AND id = %s
                ORDER BY time DESC 
                LIMIT 20
            """, ("ticket", ticket_id))
            
            attachments = []
            for row in cursor.fetchall():
                # Handle timestamp conversion - Trac might store in microseconds
                raw_timestamp = row[4]
                uploaded_timestamp = raw_timestamp
                
                if raw_timestamp is not None:
                    try:
                        # Convert to integer if it's not already
                        timestamp_int = int(raw_timestamp)
                        
                        # Check if timestamp is in microseconds (13+ digits) vs seconds (10 digits)
                        if timestamp_int > 9999999999:  # More than 10 digits means likely microseconds
                            uploaded_timestamp = timestamp_int // 1000000  # Convert microseconds to seconds
                        else:
                            uploaded_timestamp = timestamp_int
                            
                        # Validate the timestamp is reasonable (between 2000 and 2050)
                        if uploaded_timestamp < 946684800 or uploaded_timestamp > 2524608000:
                            logger.warning(f"Invalid timestamp {uploaded_timestamp} for attachment {row[0]}, using current time")
                            uploaded_timestamp = int(time.time())
                            
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Failed to parse timestamp {raw_timestamp} for attachment {row[0]}: {e}")
                        uploaded_timestamp = int(time.time())  # Use current time as fallback
                else:
                    uploaded_timestamp = int(time.time())  # Use current time if None
                
                attachments.append({
                    "filename": row[0],
                    "size": row[1],
                    "description": row[2],
                    "author": row[3],
                    "uploaded": uploaded_timestamp
                })
        
        return AttachmentListResponse(
            status="success",
            ticket_id=ticket_id,
            attachments=[AttachmentModel(**attachment) for attachment in attachments],
            total_count=len(attachments)
        )
        
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to fetch attachments for ticket {ticket_id}: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while fetching attachments"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@app.get(
    "/api/tickets/{ticket_id}/attachments/{filename}/download",
    summary="Download a Specific Attachment",
    description="Download a specific attachment file from a ticket. Returns the file with proper headers.",
    responses={
        200: {
            "description": "File downloaded successfully",
            "content": {
                "application/octet-stream": {
                    "example": "Binary file content"
                }
            }
        },
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden - user doesn't own this ticket"},
        404: {"description": "Ticket or attachment not found"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Attachments"]
)
async def download_ticket_attachment(
    ticket_id: int,
    filename: str,
    user: ClerkUser = Depends(require_auth)
):
    """
    **Download a Specific Attachment**
    
    This endpoint allows downloading a specific attachment file from a ticket.
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Ownership Rules:**
    - Users can only download attachments from tickets they own or created.
    - Returns 403 Forbidden if user doesn't have permission.
    
    **Returns:**
    - File content with appropriate Content-Type header
    - Content-Disposition header for download
    
    **Example Usage:**
    ```
    curl -H "Authorization: Bearer <token>" \
         -O http://localhost:8000/api/tickets/1/attachments/document.pdf/download
    ```
    """
    try:
        # Import Trac environment
        from trac.env import Environment
        from fastapi.responses import FileResponse
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Check if ticket exists and user has permission
        ticket_data = await check_ticket_ownership(ticket_id, user, env)
        
        if ticket_data is None:
            # First check if ticket exists at all
            with env.db_transaction as db:
                cursor = db.cursor()
                cursor.execute("SELECT id FROM ticket WHERE id = %s", (ticket_id,))
                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Ticket {ticket_id} not found"
                    )
            
            # Ticket exists but user doesn't have permission
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You can only download attachments from tickets you own or created."
            )
        
        # Check if attachment exists in database
        with env.db_transaction as db:
            cursor = db.cursor()
            cursor.execute("""
                SELECT filename, size, description, author
                FROM attachment 
                WHERE type = %s AND id = %s AND filename = %s
            """, ("ticket", ticket_id, filename))
            
            attachment_row = cursor.fetchone()
            if not attachment_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Attachment '{filename}' not found for ticket {ticket_id}"
                )
        
        # Construct file path using Trac's pattern
        ticket_id_str = str(ticket_id)
        hash_obj = hashlib.sha1(ticket_id_str.encode('utf-8'))
        hash_hex = hash_obj.hexdigest()
        
        # Create hashed filename following Trac's pattern
        filename_hash = hashlib.sha1(filename.encode('utf-8')).hexdigest()
        # Keep the original extension if it exists
        if '.' in filename:
            extension = filename.rsplit('.', 1)[1]
            hashed_filename = f"{filename_hash}.{extension}"
        else:
            hashed_filename = filename_hash
        
        # Construct full file path
        attachments_dir = os.path.join(trac_env_path, "attachments")
        file_path = os.path.join(attachments_dir, "ticket", hash_hex[0:3], hash_hex, hashed_filename)
        
        # Check if file exists on disk
        if not os.path.isfile(file_path):
            logger.error(f"Attachment file not found on disk: {file_path}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attachment file '{filename}' not found on server"
            )
        
        # Determine content type based on file extension
        import mimetypes
        content_type, _ = mimetypes.guess_type(filename)
        if content_type is None:
            content_type = "application/octet-stream"
        
        logger.info(f"User {user.email} downloading attachment '{filename}' from ticket {ticket_id}")
        
        # Properly encode filename for Content-Disposition header
        # Handle Unicode characters by using RFC 5987 encoding
        
        # Try to encode as ASCII first (most compatible)
        try:
            ascii_filename = filename.encode('ascii').decode('ascii')
            content_disposition = f"attachment; filename=\"{ascii_filename}\""
        except UnicodeEncodeError:
            # Fallback to RFC 5987 encoding for Unicode filenames
            encoded_filename = urllib.parse.quote(filename.encode('utf-8'))
            content_disposition = f"attachment; filename*=UTF-8''{encoded_filename}"
        
        # Return file with proper headers
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=content_type,
            headers={
                "Content-Disposition": content_disposition,
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
        
    except HTTPException:
        raise
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database or file system")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database or file system access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to download attachment '{filename}' from ticket {ticket_id}: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while downloading attachment"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@app.delete(
    "/api/tickets/{ticket_id}/attachments/{filename}",
    summary="Delete a Specific Attachment",
    description="Delete a specific attachment file from a ticket. Removes both the file and database record.",
    responses={
        200: {
            "description": "Attachment deleted successfully",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "Attachment deleted successfully",
                        "filename": "document.pdf",
                        "ticket_id": 1
                    }
                }
            }
        },
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden - user doesn't own this ticket"},
        404: {"description": "Ticket or attachment not found"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Attachments"]
)
async def delete_ticket_attachment(
    ticket_id: int,
    filename: str,
    user: ClerkUser = Depends(require_auth)
):
    """
    **Delete a Specific Attachment**
    
    This endpoint allows deleting a specific attachment file from a ticket.
    Removes both the file from disk and the database record.
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Ownership Rules:**
    - Users can only delete attachments from tickets they own or created.
    - Returns 403 Forbidden if user doesn't have permission.
    
    **Returns:**
    - Success confirmation with filename and ticket ID
    
    **Example Usage:**
    ```
    curl -X DELETE -H "Authorization: Bearer <token>" \
         http://localhost:8000/api/tickets/1/attachments/document.pdf
    ```
    """
    try:
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Check if ticket exists and user has permission
        ticket_data = await check_ticket_ownership(ticket_id, user, env)
        
        if ticket_data is None:
            # First check if ticket exists at all
            with env.db_transaction as db:
                cursor = db.cursor()
                cursor.execute("SELECT id FROM ticket WHERE id = %s", (ticket_id,))
                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Ticket {ticket_id} not found"
                    )
            
            # Ticket exists but user doesn't have permission
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You can only delete attachments from tickets you own or created."
            )
        
        # Check if attachment exists and get details
        with env.db_transaction as db:
            cursor = db.cursor()
            cursor.execute("""
                SELECT filename, size, description, author
                FROM attachment 
                WHERE type = %s AND id = %s AND filename = %s
            """, ("ticket", ticket_id, filename))
            
            attachment_row = cursor.fetchone()
            if not attachment_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Attachment '{filename}' not found for ticket {ticket_id}"
                )
            
            # Construct file path using Trac's pattern
            ticket_id_str = str(ticket_id)
            hash_obj = hashlib.sha1(ticket_id_str.encode('utf-8'))
            hash_hex = hash_obj.hexdigest()
            
            # Create hashed filename following Trac's pattern
            filename_hash = hashlib.sha1(filename.encode('utf-8')).hexdigest()
            # Keep the original extension if it exists
            if '.' in filename:
                extension = filename.rsplit('.', 1)[1]
                hashed_filename = f"{filename_hash}.{extension}"
            else:
                hashed_filename = filename_hash
            
            # Construct full file path
            attachments_dir = os.path.join(trac_env_path, "attachments")
            file_path = os.path.join(attachments_dir, "ticket", hash_hex[0:3], hash_hex, hashed_filename)
            
            # Delete from database first (in transaction)
            cursor.execute("""
                DELETE FROM attachment 
                WHERE type = %s AND id = %s AND filename = %s
            """, ("ticket", ticket_id, filename))
            
            # Check if any rows were affected
            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to delete attachment from database"
                )
            
            # Delete file from disk (if it exists)
            if os.path.isfile(file_path):
                try:
                    os.unlink(file_path)
                    logger.info(f"Deleted attachment file: {file_path}")
                except OSError as e:
                    logger.error(f"Failed to delete attachment file {file_path}: {str(e)}")
                    # Don't fail the operation if file deletion fails but DB deletion succeeded
                    # The file might have been manually deleted or corrupted
            else:
                logger.warning(f"Attachment file not found on disk during deletion: {file_path}")
        
        logger.info(f"User {user.email} deleted attachment '{filename}' from ticket {ticket_id}")
        
        return {
            "status": "success",
            "message": "Attachment deleted successfully",
            "filename": filename,
            "ticket_id": ticket_id
        }
        
    except HTTPException:
        raise
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database or file system")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database or file system access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to delete attachment '{filename}' from ticket {ticket_id}: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while deleting attachment"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@app.post(
    "/api/tickets/{ticket_id}/attachments",
    response_model=AttachmentCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload File Attachment to Ticket",
    description="Upload a file attachment to a specific ticket. Users can only upload to tickets they own or created.",
    responses={
        201: {
            "description": "File uploaded successfully",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "File uploaded successfully",
                        "attachment": {
                            "filename": "document.pdf",
                            "size": 1024576,
                            "description": "Project documentation",
                            "author": "user@example.com",
                            "uploaded": 1640995200
                        }
                    }
                }
            }
        },
        400: {"description": "Invalid file or file too large"},
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden - user doesn't own this ticket"},
        404: {"description": "Ticket not found"},
        413: {"description": "File too large"},
        415: {"description": "Unsupported file type"},
        503: {"description": "Trac service unavailable"},
        500: {"description": "Internal server error"}
    },
    tags=["Attachments"]
)
async def upload_ticket_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = "",
    user: ClerkUser = Depends(require_auth)
) -> AttachmentCreateResponse:
    """
    **Upload File Attachment to Ticket**
    
    This endpoint allows authenticated users to upload file attachments to tickets they own or created.
    Files are stored using Trac's attachment system with proper validation and security.
    
    **Authentication Required:** 
    - Bearer token in Authorization header
    - Valid Clerk JWT token
    
    **Ownership Rules:**
    - Users can upload to tickets they are the `owner` of (assigned to)
    - Users can upload to tickets they are the `reporter` of (created)
    - Returns 403 Forbidden if user doesn't have permission
    
    **File Restrictions:**
    - Maximum file size: 10MB
    - Allowed file types: Images (PNG, JPG, JPEG, GIF), Documents (PDF, DOC, DOCX, TXT), Archives (ZIP)
    - Filenames are sanitized and validated
    
    **Form Data:**
    - `file`: Required file to upload
    - `description`: Optional description of the attachment
    
    **Returns:**
    - Uploaded file details and metadata
    - Success status and message
    
    **Example Usage:**
    ```
    curl -X POST -H "Authorization: Bearer <token>" \
         -F "file=@document.pdf" \
         -F "description=Project specs" \
         http://localhost:8000/api/tickets/1/attachments
    ```
    """
    try:
        # File validation constants
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        ALLOWED_MIME_TYPES = {
            # Images
            "image/png", "image/jpeg", "image/jpg", "image/gif",
            # Documents  
            "application/pdf", "text/plain", 
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            # Archives
            "application/zip", "application/x-zip-compressed"
        }
        
        # Validate file size
        if not file.size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File appears to be empty"
            )
        
        if file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({file.size} bytes) exceeds maximum allowed size ({MAX_FILE_SIZE} bytes)"
            )
        
        # Validate file type
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type '{file.content_type}' is not allowed. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}"
            )
        
        # Validate filename
        if not file.filename or not file.filename.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename cannot be empty"
            )
        
        # Sanitize filename - remove path separators and other potentially dangerous characters
        safe_filename = os.path.basename(file.filename).strip()
        if not safe_filename or safe_filename in ['.', '..']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename"
            )
        
        # Import Trac environment
        from trac.env import Environment
        
        # Path to test Trac environment
        if os.path.exists("/app/test-projects"):
            trac_env_path = "/app/test-projects/my-drone-project"
        else:
            trac_env_path = os.path.join(project_root, "test-projects", "my-drone-project")
        
        # Initialize Trac environment
        env = Environment(trac_env_path)
        
        # Check if ticket exists and user has permission to upload to it
        ticket_data = await check_ticket_ownership(ticket_id, user, env)
        
        if ticket_data is None:
            # First check if ticket exists at all
            with env.db_transaction as db:
                cursor = db.cursor()
                cursor.execute("SELECT id FROM ticket WHERE id = %s", (ticket_id,))
                if cursor.fetchone() is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Ticket {ticket_id} not found"
                    )
            
            # Ticket exists but user doesn't have permission
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You can only upload attachments to tickets you own or created."
            )
        
        # Create attachment directory structure following Trac's pattern
        # attachments_dir/ticket/hash[0:3]/hash/
        attachments_dir = os.path.join(trac_env_path, "attachments")
        ticket_dir = os.path.join(attachments_dir, "ticket")
        
        # Create SHA1 hash of ticket ID (as string)
        ticket_id_str = str(ticket_id)
        hash_obj = hashlib.sha1(ticket_id_str.encode('utf-8'))
        hash_hex = hash_obj.hexdigest()
        
        # Create the full directory path
        upload_dir = os.path.join(ticket_dir, hash_hex[0:3], hash_hex)
        os.makedirs(upload_dir, exist_ok=True)
        
        # Create hashed filename following Trac's pattern
        filename_hash = hashlib.sha1(safe_filename.encode('utf-8')).hexdigest()
        # Keep the original extension if it exists
        if '.' in safe_filename:
            extension = safe_filename.rsplit('.', 1)[1]
            hashed_filename = f"{filename_hash}.{extension}"
        else:
            hashed_filename = filename_hash
        
        file_path = os.path.join(upload_dir, hashed_filename)
        
        # Get current timestamp in microseconds (Trac format)
        current_time = int(time.time() * 1000000)
        
        # Save file and create database record atomically
        with env.db_transaction as db:
            cursor = db.cursor()
            
            # Check if filename already exists for this ticket
            cursor.execute("""
                SELECT filename FROM attachment 
                WHERE type = %s AND id = %s AND filename = %s
            """, ("ticket", ticket_id_str, safe_filename))
            
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{safe_filename}' already exists for this ticket. Please use a different filename."
                )
            
            # Save file to disk
            try:
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
            except Exception as e:
                logger.error(f"Failed to save file {file_path}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to save uploaded file"
                )
            
            # Insert attachment record into database
            cursor.execute("""
                INSERT INTO attachment (type, id, filename, size, time, description, author)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                "ticket",  # type (parent realm)
                ticket_id_str,  # id (parent id)
                safe_filename,  # filename (original filename)
                file.size,  # size in bytes
                current_time,  # time in microseconds
                description or "",  # description
                user.email  # author
            ))
            
            logger.info(f"Uploaded attachment '{safe_filename}' to ticket {ticket_id} by user {user.email}")
        
        # Create response with attachment details
        attachment = AttachmentModel(
            filename=safe_filename,
            size=file.size,
            description=description or "",
            author=user.email,
            uploaded=current_time // 1000000  # Convert back to seconds for response
        )
        
        return AttachmentCreateResponse(
            status="success",
            message="File uploaded successfully",
            attachment=attachment
        )
        
    except HTTPException:
        raise
    except FileNotFoundError:
        logger.error("Trac environment not found")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Trac environment is not available. Please check configuration."
        )
    except PermissionError:
        logger.error("Permission denied accessing Trac database or file system")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database or file system access denied. Please check permissions."
        )
    except Exception as e:
        logger.error(f"Failed to upload attachment to ticket {ticket_id}: {str(e)}")
        # Don't expose internal error details in production
        error_detail = str(e) if DEVELOPMENT_MODE else "Internal server error while uploading file"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


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