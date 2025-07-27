import os
import jwt
import requests
import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwk
from jwt import PyJWKClient

from . import schemas

logger = logging.getLogger(__name__)

# Clerk configuration
def get_clerk_config():
    """Get Clerk configuration from environment variables."""
    return {
        "secret_key": os.getenv("CLERK_SECRET_KEY", ""),
        "jwks_url": os.getenv("CLERK_JWKS_URL", ""),
        "publishable_key": os.getenv("CLERK_PUBLISHABLE_KEY", "")
    }

# Global variable to store the JWKS client
_jwks_client = None


def get_jwks_client():
    """Get or create the JWKS client lazily."""
    global _jwks_client
    if _jwks_client is None:
        config = get_clerk_config()
        if config["jwks_url"]:
            _jwks_client = PyJWKClient(config["jwks_url"])
    return _jwks_client


def get_development_mode():
    """Check if the application is in development mode."""
    config = get_clerk_config()
    return not all([config["secret_key"], config["jwks_url"]])

# Security scheme for authentication
security = HTTPBearer(auto_error=False)

# Cache for JWKS
_jwks_cache = None


class AuthenticationError(Exception):
    """Custom exception for authentication errors."""
    pass


def decode_clerk_token(token: str) -> Dict[str, Any]:
    """Decode and verify Clerk JWT token."""
    if get_development_mode():
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
            return {
                "sub": "dev_user_generic",
                "email": "developer@hobbytrack.local",
                "given_name": "Development",
                "family_name": "User"
            }
        else:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )
    
    if not get_jwks_client():
        raise HTTPException(
            status_code=503,
            detail="Authentication service misconfigured"
        )

    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
        
        decoded = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
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
    except HTTPException as e:
        logger.error(f"Token verification failed with HTTPException: {e.detail}")
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        import traceback
        logger.error(f"Token verification failed with an unexpected error: {type(e).__name__} - {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )


async def verify_clerk_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> schemas.ClerkUser:
    """Verify Clerk JWT token and return user information."""
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials required"
        )
    
    try:
        token = credentials.credentials
        decoded = decode_clerk_token(token)
        
        user_id = decoded.get('sub', 'unknown')
        email = decoded.get('email', 'unknown@example.com')
        first_name = decoded.get('given_name', decoded.get('first_name', 'User'))
        last_name = decoded.get('family_name', decoded.get('last_name', ''))
        
        return schemas.ClerkUser(
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


def require_auth(user: schemas.ClerkUser = Depends(verify_clerk_token)) -> schemas.ClerkUser:
    """Dependency that requires authentication."""
    return user 