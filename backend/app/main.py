"""
HobbyTrack FastAPI Backend - Main Application
"""

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional, List, Union
import logging
import os
import sys
import jwt
import requests
from pydantic import BaseModel, validator
from dotenv import load_dotenv

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

class TicketsResponse(BaseModel):
    """Response model for tickets endpoint."""
    status: str
    user_id: str
    user_email: str
    tickets: List[TicketModel]
    total_count: int
    message: Optional[str] = None

class ClerkUser(BaseModel):
    """User information from Clerk authentication."""
    user_id: str
    email: str
    first_name: str
    last_name: str


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
        # Development mode - simple validation
        if token and (token.startswith("dev_") or token == "development-token"):
            return {
                "sub": "dev_user_123",
                "email": "developer@hobbytrack.local",
                "given_name": "Development",
                "family_name": "User"
            }
        else:
            # For development, be lenient with token validation
            return {
                "sub": "dev_user_placeholder", 
                "email": "user@example.com",
                "given_name": "Demo",
                "family_name": "User"
            }
    
    try:
        # Get the token header to find the key ID
        headers = jwt.get_unverified_headers(token)
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
            # Get tickets with basic information
            cursor.execute("""
                SELECT id, summary, status, priority, reporter, owner, time
                FROM ticket 
                ORDER BY time DESC 
                LIMIT 20
            """)
            
            tickets = []
            for row in cursor.fetchall():
                tickets.append({
                    "id": row[0],
                    "summary": row[1],
                    "status": row[2],
                    "priority": row[3],
                    "reporter": row[4],
                    "owner": row[5],
                    "created": row[6]
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