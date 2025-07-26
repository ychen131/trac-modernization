#!/usr/bin/env python3
"""
Simple debug script to test development mode authentication
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_dev_mode():
    """Test if development mode is working"""
    print("🔍 Testing Development Mode Authentication")
    print("=" * 50)
    
    # Test tokens that should work in development mode
    test_tokens = [
        "dev_test_token_123",
        "development-token",
        "any_random_token",  # Should work due to lenient mode
    ]
    
    for token in test_tokens:
        print(f"\n🧪 Testing token: '{token}'")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            response = requests.get(f"{BASE_URL}/api/tickets", headers=headers)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Success! User: {data.get('user_email', 'unknown')}")
            else:
                print(f"   ❌ Failed: {response.text}")
                
        except Exception as e:
            print(f"   💥 Error: {e}")
    
    # Also test the auth status endpoint
    print(f"\n🔍 Testing auth status endpoint:")
    headers = {"Authorization": f"Bearer dev_test_token_123"}
    try:
        response = requests.get(f"{BASE_URL}/api/auth/status", headers=headers)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Auth Status: {json.dumps(data, indent=2)}")
        else:
            print(f"   ❌ Failed: {response.text}")
    except Exception as e:
        print(f"   💥 Error: {e}")

if __name__ == "__main__":
    test_dev_mode() 