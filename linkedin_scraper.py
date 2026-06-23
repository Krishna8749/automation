from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import json
from typing import List, Dict, Optional
from config import settings


class LinkedInScraper:
    def __init__(self, headless: bool = True, cookies: str = None):
        self.driver = None
        self.headless = headless
        self.cookies = cookies
        self.setup_driver()
    
    def setup_driver(self):
        """Setup Chrome WebDriver"""
        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # Load cookies if provided
        if self.cookies:
            self.load_cookies(self.cookies)
    
    def load_cookies(self, cookies_string: str):
        """Load cookies from JSON string"""
        try:
            import json
            cookies = json.loads(cookies_string)
            
            # First visit LinkedIn to set domain
            self.driver.get("https://www.linkedin.com")
            time.sleep(2)
            
            # Add each cookie
            for cookie in cookies:
                try:
                    self.driver.add_cookie(cookie)
                except Exception as e:
                    print(f"Error adding cookie: {e}")
            
            # Refresh to apply cookies
            self.driver.refresh()
            time.sleep(2)
            
        except Exception as e:
            print(f"Error loading cookies: {e}")
    
    def get_cookies(self) -> str:
        """Get current cookies as JSON string"""
        try:
            import json
            cookies = self.driver.get_cookies()
            return json.dumps(cookies)
        except Exception as e:
            print(f"Error getting cookies: {e}")
            return "[]"
    
    def login(self, email: str, password: str):
        """Login to LinkedIn (fallback method)"""
        self.driver.get("https://www.linkedin.com/login")
        
        # Enter email
        email_field = WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.ID, "username"))
        )
        email_field.send_keys(email)
        
        # Enter password
        password_field = self.driver.find_element(By.ID, "password")
        password_field.send_keys(password)
        
        # Click login button
        login_button = self.driver.find_element(By.XPATH, "//button[@type='submit']")
        login_button.click()
        
        # Wait for login to complete
        time.sleep(3)
    
    def search_leads(self, keywords: str, location: str = "global", limit: int = 20) -> List[Dict]:
        """Search for leads based on keywords and location"""
        search_url = f"https://www.linkedin.com/search/results/people/?keywords={keywords}&location={location}"
        self.driver.get(search_url)
        time.sleep(3)
        
        leads = []
        scroll_count = 0
        max_scrolls = 5
        
        while len(leads) < limit and scroll_count < max_scrolls:
            # Scroll down to load more results
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            scroll_count += 1
            
            # Parse current page
            page_source = self.driver.page_source
            soup = BeautifulSoup(page_source, 'html.parser')
            
            # Find lead cards
            lead_cards = soup.find_all('div', class_='entity-result')
            
            for card in lead_cards:
                if len(leads) >= limit:
                    break
                
                try:
                    lead_data = self.extract_lead_data(card)
                    if lead_data:
                        leads.append(lead_data)
                except Exception as e:
                    print(f"Error extracting lead: {e}")
                    continue
        
        return leads
    
    def extract_lead_data(self, card) -> Optional[Dict]:
        """Extract lead data from a search result card"""
        try:
            # Name
            name_elem = card.find('span', {'aria-hidden': 'true'})
            name = name_elem.text.strip() if name_elem else "N/A"
            
            # Title
            title_elem = card.find('div', class_='entity-result__primary-subtitle')
            title = title_elem.text.strip() if title_elem else "N/A"
            
            # Company
            company_elem = card.find('div', class_='entity-result__secondary-subtitle')
            company = company_elem.text.strip() if company_elem else "N/A"
            
            # Profile URL
            link_elem = card.find('a', class_='app-aware-link')
            profile_url = link_elem['href'] if link_elem else "N/A"
            
            # Location
            location_elem = card.find('div', class_='entity-result__meta')
            location = location_elem.text.strip() if location_elem else "N/A"
            
            return {
                "name": name,
                "title": title,
                "company": company,
                "linkedin_url": profile_url,
                "location": location,
                "lead_type": self.classify_lead_type(title, company)
            }
        except Exception as e:
            print(f"Error extracting lead data: {e}")
            return None
    
    def classify_lead_type(self, title: str, company: str) -> str:
        """Classify lead type based on title and company"""
        title_lower = title.lower()
        
        if any(keyword in title_lower for keyword in ['cto', 'vp of engineering', 'director of technology', 'head of engineering']):
            return "executive"
        elif any(keyword in title_lower for keyword in ['manager', 'lead', 'senior']):
            return "management"
        elif any(keyword in title_lower for keyword in ['developer', 'engineer', 'programmer']):
            return "technical"
        elif any(keyword in title_lower for keyword in ['founder', 'ceo', 'owner']):
            return "founder"
        else:
            return "other"
    
    def extract_client_info(self, company_url: str) -> Dict:
        """Extract detailed client information from company page"""
        self.driver.get(company_url)
        time.sleep(3)
        
        page_source = self.driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')
        
        client_info = {
            "company_name": "N/A",
            "industry": "N/A",
            "company_size": "N/A",
            "location": "N/A",
            "website": "N/A",
            "description": "N/A"
        }
        
        try:
            # Company name
            name_elem = soup.find('h1', class_='org-top-card-summary__title')
            client_info["company_name"] = name_elem.text.strip() if name_elem else "N/A"
            
            # Industry
            industry_elem = soup.find('dd', class_='org-top-card-summary-info-list__info-item')
            client_info["industry"] = industry_elem.text.strip() if industry_elem else "N/A"
            
            # Company size
            size_elem = soup.find('span', string=lambda x: x and 'employees' in x.lower() if x else False)
            client_info["company_size"] = size_elem.text.strip() if size_elem else "N/A"
            
            # Location
            location_elem = soup.find('div', class_='org-top-card-summary-info-list__info-item')
            client_info["location"] = location_elem.text.strip() if location_elem else "N/A"
            
            # Website
            website_elem = soup.find('a', href=lambda x: x and 'http' in x if x else False)
            client_info["website"] = website_elem['href'] if website_elem else "N/A"
            
            # Description
            desc_elem = soup.find('p', class_='org-about-module__description')
            client_info["description"] = desc_elem.text.strip() if desc_elem else "N/A"
            
        except Exception as e:
            print(f"Error extracting client info: {e}")
        
        return client_info
    
    def get_app_development_leads(self, keywords: str = None, location: str = "global") -> List[Dict]:
        """Extract leads specifically for app development opportunities"""
        if keywords is None:
            keywords = settings.lead_extraction_keywords
        
        search_terms = keywords.split(',')
        all_leads = []
        
        for term in search_terms:
            term = term.strip()
            leads = self.search_leads(term, location, limit=10)
            all_leads.extend(leads)
        
        # Remove duplicates based on LinkedIn URL
        unique_leads = {}
        for lead in all_leads:
            url = lead.get('linkedin_url')
            if url and url not in unique_leads:
                unique_leads[url] = lead
        
        return list(unique_leads.values())
    
    def close(self):
        """Close the browser driver"""
        if self.driver:
            self.driver.quit()
