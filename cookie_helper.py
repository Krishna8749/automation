"""
Helper script to extract and format LinkedIn cookies from curl commands or browser
"""
import json
import re


def extract_cookies_from_curl(curl_command: str) -> list:
    """
    Extract cookies from a curl command's -b flag
    Returns list of cookie dictionaries in the format expected by the system
    """
    # Find the -b flag content
    match = re.search(r'-b\s+[\'"]([^\'"]+)[\'"]', curl_command)
    if not match:
        return []
    
    cookie_string = match.group(1)
    cookies = []
    
    # Parse the cookie string
    for cookie_pair in cookie_string.split('; '):
        if '=' in cookie_pair:
            name, value = cookie_pair.split('=', 1)
            cookies.append({
                'name': name.strip(),
                'value': value.strip(),
                'domain': '.linkedin.com',
                'path': '/'
            })
    
    return cookies


def extract_essential_cookies(cookies: list) -> list:
    """
    Filter to only essential LinkedIn authentication cookies
    """
    essential_cookie_names = [
        'li_at',          # Main authentication token
        'li_sugr',        # LinkedIn session
        'bcookie',        # Browser cookie
        'bscookie',       # Browser session cookie
        'JSESSIONID',     # Session ID
        '_guid',          # User GUID
        'liap',           # LinkedIn app session
        'lidc'            # LinkedIn device context
    ]
    
    return [cookie for cookie in cookies if cookie['name'] in essential_cookie_names]


def format_cookies_for_api(cookies: list) -> str:
    """
    Format cookies as JSON string for API submission
    """
    return json.dumps(cookies)


# Example usage with the cookies from your curl command
example_cookie_string = """li_sugr=c17aa5ba-22a0-4f75-9366-751b3f0e8927; bcookie="v=2&276e7051-a772-4e66-8fa4-4140d910bc07"; bscookie="v=1&202603260021227ad01046-808e-4523-8b79-42823676d0a2AQFF5fahPbfPTB_IZo3ra_1_X7zO30vT"; JSESSIONID="ajax:8809572657310085638"; _guid=61ef4705-a5d9-4c89-bf4b-40cc58cdaa1e; li_at=AQEDAVRV8ywD47YiAAABnvDxti8AAAGfFP46L1YAiUZbd0t-3-_xi5jeigym6PJ6M_ghc9OaAnn0Y8nOtCze_xcefNKCsqNbZMMF8gRSDUFQ6ON1QenElSLUlImMGN7wbn5lBqxPfuYzvhOC4KCeuvLG; liap=true; lidc="b=OB56:s=O:r=O:a=O:p=O:g=5389:u=355:x=1:i=1782158834:t=1782240743:v=2:sig=AQEJl8HtoPcair0omuhjGtdkVJBv8Jar\""""


def parse_cookie_string(cookie_string: str) -> list:
    """
    Parse a cookie string directly (like from browser or curl)
    """
    cookies = []
    for cookie_pair in cookie_string.split('; '):
        if '=' in cookie_pair:
            name, value = cookie_pair.split('=', 1)
            # Clean up quotes
            value = value.strip('"')
            cookies.append({
                'name': name.strip(),
                'value': value,
                'domain': '.linkedin.com',
                'path': '/'
            })
    return cookies


if __name__ == "__main__":
    # Example: Extract cookies from the provided curl command
    cookies = parse_cookie_string(example_cookie_string)
    essential_cookies = extract_essential_cookies(cookies)
    
    print("Essential LinkedIn Cookies:")
    print(json.dumps(essential_cookies, indent=2))
    
    print("\nFormatted for API:")
    print(format_cookies_for_api(essential_cookies))
