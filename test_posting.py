import requests
import json
from post_generator import PostGenerator

# Base URL for the API
BASE_URL = "http://localhost:8000"

def create_user():
    """Create a test user"""
    user_data = {
        "linkedin_id": "1414918956",
        "email": "webnovacrew@gmail.com",
        "name": "Web Nova Crew"
    }
    response = requests.post(f"{BASE_URL}/users", json=user_data)
    print(f"Create User Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.json()

def save_cookies(user_id):
    """Save LinkedIn cookies for the user"""
    cookies = [
        {
            "name": "li_at",
            "value": "AQEDAVRV8ywD47YiAAABnvDxti8AAAGfFP46L1YAiUZbd0t-3-_xi5jeigym6PJ6M_ghc9OaAnn0Y8nOtCze_xcefNKCsqNbZMMF8gRSDUFQ6ON1QenElSLUlImMGN7wbn5lBqxPfuYzvhOC4KCeuvLG",
            "domain": ".linkedin.com",
            "path": "/"
        },
        {
            "name": "li_sugr",
            "value": "c17aa5ba-22a0-4f75-9366-751b3f0e8927",
            "domain": ".linkedin.com",
            "path": "/"
        },
        {
            "name": "bcookie",
            "value": "v=2&276e7051-a772-4e66-8fa4-4140d910bc07",
            "domain": ".linkedin.com",
            "path": "/"
        },
        {
            "name": "bscookie",
            "value": "v=1&202603260021227ad01046-808e-4523-8b79-42823676d0a2AQFF5fahPbfPTB_IZo3ra_1_X7zO30vT",
            "domain": ".linkedin.com",
            "path": "/"
        },
        {
            "name": "JSESSIONID",
            "value": "ajax:8809572657310085638",
            "domain": ".linkedin.com",
            "path": "/"
        },
        {
            "name": "_guid",
            "value": "61ef4705-a5d9-4c89-bf4b-40cc58cdaa1e",
            "domain": ".linkedin.com",
            "path": "/"
        },
        {
            "name": "liap",
            "value": "true",
            "domain": ".linkedin.com",
            "path": "/"
        }
    ]
    
    cookie_data = {
        "user_id": user_id,
        "cookies": json.dumps(cookies)
    }
    
    response = requests.post(f"{BASE_URL}/auth/cookies", json=cookie_data)
    print(f"Save Cookies Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.json()

def generate_banner():
    """Generate a test banner image"""
    generator = PostGenerator()
    filename = generator.generate_banner("Test Post - LinkedIn Automation", template="tech")
    print(f"Generated banner: {filename}")
    return filename

def test_post_now(user_id, image_filename):
    """Test posting immediately to LinkedIn"""
    post_data = {
        "user_id": user_id,
        "post_type": "banner",
        "target": "personal",
        "content": "Test post from LinkedIn Automation Backend! 🚀 #Automation #LinkedIn",
        "media_url": image_filename,
        "use_cookies": True
    }
    
    response = requests.post(f"{BASE_URL}/posts/post-now", json=post_data)
    print(f"Post Status: {response.status_code}")
    print(f"Response: {response.json()}")
    return response.json()

if __name__ == "__main__":
    print("=== LinkedIn Automation Test ===")
    
    try:
        # Step 1: Create user
        print("\n1. Creating user...")
        user = create_user()
        user_id = user["id"]
        
        # Step 2: Save cookies
        print("\n2. Saving cookies...")
        save_cookies(user_id)
        
        # Step 3: Generate banner
        print("\n3. Generating banner...")
        banner_file = generate_banner()
        
        # Step 4: Test posting
        print("\n4. Testing post to LinkedIn...")
        result = test_post_now(user_id, banner_file)
        
        print("\n=== Test Complete ===")
        if "error" in result:
            print(f"❌ Post failed: {result.get('error')}")
        else:
            print(f"✅ Post successful!")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
