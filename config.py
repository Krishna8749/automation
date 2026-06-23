from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # LinkedIn API (OAuth - legacy)
    linkedin_client_id: Optional[str] = None
    linkedin_client_secret: Optional[str] = None
    linkedin_redirect_uri: str = "http://localhost:8000/auth/callback"
    linkedin_access_token: Optional[str] = None
    linkedin_company_page_id: Optional[str] = None
    
    # Cookie Authentication (preferred method)
    use_cookie_auth: bool = True
    cookie_expiry_days: int = 30
    
    # Database
    database_url: str = "sqlite:///./linkedin_automation.db"
    
    # Application
    app_secret_key: str = "your-secret-key-change-this"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    
    # Scheduling
    daily_post_time: str = "09:00"
    timezone: str = "UTC"
    
    # Lead Extraction
    lead_extraction_keywords: str = "app development, mobile app, web development, software development"
    lead_extraction_locations: str = "global"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
