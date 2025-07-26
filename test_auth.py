#!/usr/bin/env python3
"""
Test script for Clerk JWT Authentication

This script tests the authentication implementation to verify:
1. Token verification works correctly
2. User-specific ticket filtering is working
3. Error handling for invalid tokens
4. End-to-end authentication flow
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_ENDPOINTS = {
    "health": "/api/health",
    "tickets": "/api/tickets",
    "auth_status": "/api/auth/status"
}

# Test tokens (these are fake tokens for testing)
TEST_TOKENS = {
    "valid_dev": "dev_test_token_123",
    "development": "development-token", 
    "invalid": "invalid-jwt-token",
    "expired": "expired-jwt-token",
    "malformed": "not.a.jwt.token"
}

class Colors:
    """Terminal colors for pretty output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_success(message: str):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.END}")

def print_header(message: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{message}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

def make_request(endpoint: str, token: Optional[str] = None, method: str = "GET") -> Dict[str, Any]:
    """Make HTTP request with optional authentication"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
            "success": response.status_code < 400
        }
    except requests.exceptions.ConnectionError:
        return {
            "status_code": 0,
            "headers": {},
            "body": "Connection refused - is the backend running?",
            "success": False,
            "error": "connection_error"
        }
    except requests.exceptions.Timeout:
        return {
            "status_code": 0,
            "headers": {},
            "body": "Request timeout",
            "success": False,
            "error": "timeout"
        }
    except Exception as e:
        return {
            "status_code": 0,
            "headers": {},
            "body": str(e),
            "success": False,
            "error": "unknown"
        }

def test_backend_connectivity():
    """Test if the backend is running and accessible"""
    print_header("Testing Backend Connectivity")
    
    result = make_request(TEST_ENDPOINTS["health"])
    
    if result.get("error") == "connection_error":
        print_error("Backend is not running! Start it with:")
        print("  cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        return False
    elif result["success"]:
        print_success(f"Backend is running! Health check returned: {result['body']}")
        return True
    else:
        print_error(f"Backend health check failed: {result['body']}")
        return False

def test_authentication_endpoints():
    """Test authentication with various token scenarios"""
    print_header("Testing Authentication Endpoints")
    
    # Test 1: No token (should get 401)
    print_info("Test 1: No authentication token")
    result = make_request(TEST_ENDPOINTS["tickets"])
    if result["status_code"] == 401:
        print_success("Correctly rejected request without token (401)")
    else:
        print_error(f"Expected 401, got {result['status_code']}: {result['body']}")
    
    # Test 2: Invalid token (should get 401)
    print_info("Test 2: Invalid authentication token")
    result = make_request(TEST_ENDPOINTS["tickets"], TEST_TOKENS["invalid"])
    if result["status_code"] == 401:
        print_success("Correctly rejected invalid token (401)")
    else:
        print_error(f"Expected 401, got {result['status_code']}: {result['body']}")
    
    # Test 3: Valid development token (should work in dev mode)
    print_info("Test 3: Valid development token")
    result = make_request(TEST_ENDPOINTS["tickets"], TEST_TOKENS["valid_dev"])
    if result["success"]:
        print_success(f"Successfully authenticated with dev token")
        if isinstance(result["body"], dict):
            user_email = result["body"].get("user_email", "unknown")
            ticket_count = len(result["body"].get("tickets", []))
            print_info(f"  User: {user_email}")
            print_info(f"  Tickets returned: {ticket_count}")
        else:
            print_warning(f"Unexpected response format: {result['body']}")
    else:
        print_error(f"Failed to authenticate with dev token: {result['status_code']} - {result['body']}")
    
    # Test 4: Alternative development token
    print_info("Test 4: Alternative development token")
    result = make_request(TEST_ENDPOINTS["tickets"], TEST_TOKENS["development"])
    if result["success"]:
        print_success(f"Successfully authenticated with development token")
        if isinstance(result["body"], dict):
            user_email = result["body"].get("user_email", "unknown")
            ticket_count = len(result["body"].get("tickets", []))
            print_info(f"  User: {user_email}")
            print_info(f"  Tickets returned: {ticket_count}")
    else:
        print_error(f"Failed to authenticate with development token: {result['status_code']} - {result['body']}")

def test_auth_status_endpoint():
    """Test the auth status endpoint"""
    print_header("Testing Auth Status Endpoint")
    
    result = make_request(TEST_ENDPOINTS["auth_status"], TEST_TOKENS["valid_dev"])
    if result["success"]:
        print_success("Auth status endpoint working")
        if isinstance(result["body"], dict):
            print_info(f"  User ID: {result['body'].get('user_id', 'unknown')}")
            print_info(f"  Email: {result['body'].get('email', 'unknown')}")
            print_info(f"  Name: {result['body'].get('first_name', '')} {result['body'].get('last_name', '')}")
        else:
            print_warning(f"Unexpected response format: {result['body']}")
    else:
        print_error(f"Auth status endpoint failed: {result['status_code']} - {result['body']}")

def test_user_specific_filtering():
    """Test that ticket filtering is working correctly"""
    print_header("Testing User-Specific Ticket Filtering")
    
    # Get tickets with valid token
    result = make_request(TEST_ENDPOINTS["tickets"], TEST_TOKENS["valid_dev"])
    
    if not result["success"]:
        print_error("Cannot test filtering - authentication failed")
        return
    
    if not isinstance(result["body"], dict):
        print_error("Cannot test filtering - unexpected response format")
        return
    
    user_email = result["body"].get("user_email", "unknown")
    tickets = result["body"].get("tickets", [])
    
    print_info(f"Testing filtering for user: {user_email}")
    print_info(f"Number of tickets returned: {len(tickets)}")
    
    if len(tickets) == 0:
        print_warning("No tickets returned - this might be expected if no tickets exist for this user")
        print_info("To create test tickets, you can:")
        print_info("  1. Add tickets to the Trac database")
        print_info("  2. Set owner or reporter fields to match the test user email")
        return
    
    # Check if tickets are properly filtered
    filtered_correctly = True
    for ticket in tickets:
        owner = ticket.get("owner", "")
        reporter = ticket.get("reporter", "")
        ticket_id = ticket.get("id", "unknown")
        
        if owner == user_email or reporter == user_email:
            print_success(f"  Ticket {ticket_id}: Correctly filtered (owner: {owner}, reporter: {reporter})")
        else:
            print_error(f"  Ticket {ticket_id}: INCORRECTLY included (owner: {owner}, reporter: {reporter})")
            filtered_correctly = False
    
    if filtered_correctly:
        print_success("✅ All tickets are correctly filtered for the authenticated user!")
    else:
        print_error("❌ Some tickets were not properly filtered - check the SQL query in the backend")

def test_error_handling():
    """Test error handling for various scenarios"""
    print_header("Testing Error Handling")
    
    # Test malformed token
    print_info("Testing malformed token handling")
    result = make_request(TEST_ENDPOINTS["tickets"], TEST_TOKENS["malformed"])
    if result["status_code"] == 401:
        print_success("Correctly handled malformed token")
    else:
        print_error(f"Expected 401 for malformed token, got {result['status_code']}")
    
    # Test missing Bearer prefix
    print_info("Testing token without Bearer prefix")
    result = make_request(TEST_ENDPOINTS["tickets"])
    if "Authorization" in result:
        del result["Authorization"]  # Remove auth header completely
    
    # Manual request without Bearer prefix
    try:
        headers = {"Authorization": TEST_TOKENS["valid_dev"]}  # Missing "Bearer "
        response = requests.get(f"{BASE_URL}{TEST_ENDPOINTS['tickets']}", headers=headers, timeout=10)
        if response.status_code == 401:
            print_success("Correctly rejected token without Bearer prefix")
        else:
            print_error(f"Expected 401 for token without Bearer prefix, got {response.status_code}")
    except Exception as e:
        print_error(f"Error testing Bearer prefix: {e}")

def main():
    """Run all authentication tests"""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("🔐 Clerk JWT Authentication Test Suite")
    print("="*50)
    print(f"{Colors.END}")
    
    # Test 1: Backend connectivity
    if not test_backend_connectivity():
        print_error("Cannot continue testing - backend is not accessible")
        sys.exit(1)
    
    # Test 2: Authentication endpoints
    test_authentication_endpoints()
    
    # Test 3: Auth status endpoint  
    test_auth_status_endpoint()
    
    # Test 4: User-specific filtering
    test_user_specific_filtering()
    
    # Test 5: Error handling
    test_error_handling()
    
    print_header("Test Summary")
    print_success("Authentication test suite completed!")
    print_info("If all tests passed, your Clerk JWT authentication is working correctly.")
    print_info("If any tests failed, check the error messages above for details.")
    
    print(f"\n{Colors.YELLOW}💡 Next Steps:{Colors.END}")
    print("1. Test with real Clerk tokens in production")
    print("2. Verify frontend integration with actual Clerk authentication")
    print("3. Test with multiple users to verify filtering works correctly")

if __name__ == "__main__":
    main() 