import os
import jwt
import requests
import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwk

from . import schemas

logger = logging.getLogger(__name__)

# Clerk configuration
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "")

# Development mode check
DEVELOPMENT_MODE = not all([CLERK_SECRET_KEY, CLERK_JWKS_URL])

# Security scheme for authentication
security = HTTPBearer(auto_error=False)

# Cache for JWKS
_jwks_cache = None


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
            return jwk.construct(key)
    
    raise HTTPException(
        status_code=401,
        detail="Invalid token - key not found"
    )


def decode_clerk_token(token: str) -> Dict[str, Any]:
    """Decode and verify Clerk JWT token."""
    if DEVELOPMENT_MODE:
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
    
    try:
        headers = jwt.get_unverified_header(token)
        kid = headers.get('kid')
        
        if not kid:
            raise HTTPException(
                status_code=401,
                detail="Invalid token - missing key ID"
            )
        
        public_key = get_public_key(kid)
        if not public_key:
            raise HTTPException(
                status_code=401,
                detail="Invalid token - cannot verify signature"
            )
        
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