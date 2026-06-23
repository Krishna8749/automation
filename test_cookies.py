"""
Test script to validate LinkedIn cookies
"""
import requests
from cookie_helper import parse_cookie_string, extract_essential_cookies, format_cookies_for_api


def test_linkedin_cookies(cookies_json: str):
    """
    Test if LinkedIn cookies are valid by making a request to LinkedIn API
    """
    try:
        cookies = json.loads(cookies_json)
        session = requests.Session()
        
        # Add cookies to session
        for cookie in cookies:
            session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain', '.linkedin.com'))
        
        # Test by making a request to LinkedIn's me endpoint
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'csrf-token': cookies[0]['value'] if cookies else ''
        }
        
        response = session.get('https://www.linkedin.com/voyager/api/me', headers=headers)
        
        if response.status_code == 200:
            print("✅ Cookies are valid!")
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"❌ Cookies may be invalid. Status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing cookies: {e}")
        return False


if __name__ == "__main__":
    # Example cookie string from your curl command
    example_cookies = """li_sugr=c17aa5ba-22a0-4f75-9366-751b3f0e8927; bcookie="v=2&276e7051-a772-4e66-8fa4-4140d910bc07"; bscookie="v=1&202603260021227ad01046-808e-4523-8b79-42823676d0a2AQFF5fahPbfPTB_IZo3ra_1_X7zO30vT"; JSESSIONID="ajax:8809572657310085638"; _guid=61ef4705-a5d9-4c89-bf4b-40cc58cdaa1e; li_at=AQEDAVRV8ywD47YiAAABnvDxti8AAAGfFP46L1YAiUZbd0t-3-_xi5jeigym6PJ6M_ghc9OaAnn0Y8nOtCze_xcefNKCsqNbZMMF8gRSDUFQ6ON1QenElSLUlImMGN7wbn5lBqxPfuYzvhOC4KCeuvLG; liap=true; lidc="b=OB56:s=O:r=O:a=O:p=O:g=5389:u=355:x=1:i=1782158834:t=1782240743:v=2:sig=AQEJl8HtoPcair0omuhjGtdkVJBv8Jar\""""
    
    cookies = parse_cookie_string(example_cookies)
    essential_cookies = extract_essential_cookies(cookies)
    cookies_json = format_cookies_for_api(essential_cookies)
    
    print("Testing LinkedIn cookies...")
    test_linkedin_cookies(cookies_json)
