from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import os
from pydantic import BaseModel, ConfigDict

from database import get_db, User, ScheduledPost, ExtractedLead, ClientInfo, PostTemplate, init_db
from linkedin_api import LinkedInAPI
from linkedin_cookie_api import LinkedInCookieAPI
from linkedin_scraper import LinkedInScraper
from post_generator import PostGenerator
from scheduler import scheduler
from config import settings

# Initialize database
init_db()

# Initialize FastAPI app
app = FastAPI(title="LinkedIn Automation Backend", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class UserCreate(BaseModel):
    linkedin_id: str
    email: str
    name: str
    cookies: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    linkedin_id: str
    email: str
    name: str
    is_active: bool
    created_at: datetime

class ScheduledPostCreate(BaseModel):
    user_id: int
    post_type: str  # 'banner', 'article'
    target: str  # 'personal', 'company'
    content: str
    media_url: Optional[str] = None
    scheduled_time: datetime

class ScheduledPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    post_type: str
    target: str
    content: str
    media_url: Optional[str]
    scheduled_time: datetime
    status: str
    linkedin_post_id: Optional[str]
    created_at: datetime

class LeadCreate(BaseModel):
    user_id: int
    lead_name: str
    lead_company: Optional[str] = None
    lead_title: Optional[str] = None
    lead_linkedin_url: str
    lead_email: Optional[str] = None
    lead_phone: Optional[str] = None
    lead_source: str
    lead_type: str
    score: float = 0.0
    notes: Optional[str] = None

class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    lead_name: str
    lead_company: Optional[str]
    lead_title: Optional[str]
    lead_linkedin_url: str
    lead_email: Optional[str]
    lead_phone: Optional[str]
    lead_source: str
    lead_type: str
    score: float
    contacted: bool
    created_at: datetime

class ClientInfoCreate(BaseModel):
    user_id: int
    client_name: str
    client_company: str
    client_industry: Optional[str] = None
    client_size: Optional[str] = None
    client_location: Optional[str] = None
    client_website: Optional[str] = None
    client_description: Optional[str] = None
    client_linkedin_url: str
    extracted_data: Optional[str] = None

class ClientInfoResponse(BaseModel):
    id: int
    client_name: str
    client_company: str
    client_industry: Optional[str]
    client_size: Optional[str]
    client_location: Optional[str]
    client_website: Optional[str]
    client_description: Optional[str]
    client_linkedin_url: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class PostTemplateCreate(BaseModel):
    user_id: int
    template_name: str
    template_type: str
    content_template: str

class PostTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    template_name: str
    template_type: str
    content_template: str
    is_active: bool
    created_at: datetime


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on startup"""
    scheduler.schedule_daily_post(settings.daily_post_time, settings.timezone)
    scheduler.start()


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Stop scheduler on shutdown"""
    scheduler.stop()


# Health check endpoint
@app.get("/")
async def root():
    return {"status": "healthy", "message": "LinkedIn Automation Backend is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Authentication endpoints
@app.get("/auth/url")
async def get_auth_url():
    """Get LinkedIn OAuth authorization URL (legacy method)"""
    linkedin_api = LinkedInAPI()
    auth_url = linkedin_api.get_auth_url()
    return {"auth_url": auth_url, "note": "OAuth method - consider using cookie authentication instead"}


@app.post("/auth/callback")
async def auth_callback(code: str, db: Session = Depends(get_db)):
    """Handle OAuth callback and get access token (legacy method)"""
    linkedin_api = LinkedInAPI()
    token_data = linkedin_api.get_access_token(code)
    
    if "error" in token_data:
        raise HTTPException(status_code=400, detail=token_data.get("error_description"))
    
    # Get user profile
    linkedin_api.access_token = token_data.get("access_token")
    profile = linkedin_api.get_user_profile()
    
    # Check if user exists
    user = db.query(User).filter(User.linkedin_id == profile.get("id")).first()
    
    if user:
        # Update existing user
        user.access_token = token_data.get("access_token")
        user.refresh_token = token_data.get("refresh_token")
        user.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
        db.commit()
    else:
        # Create new user
        user = User(
            linkedin_id=profile.get("id"),
            email=profile.get("email", ""),
            name=profile.get("localizedFirstName", "") + " " + profile.get("localizedLastName", ""),
            access_token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
        )
        db.add(user)
        db.commit()
    
    return {"access_token": token_data.get("access_token"), "user_id": user.id}


@app.post("/auth/cookies")
async def save_cookies(user_id: int, cookies: str, db: Session = Depends(get_db)):
    """Save LinkedIn cookies for a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.cookies = cookies
    db.commit()
    
    return {"message": "Cookies saved successfully", "user_id": user.id}


@app.get("/auth/cookies/{user_id}")
async def get_cookies(user_id: int, db: Session = Depends(get_db)):
    """Get stored cookies for a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    import json
    try:
        cookie_list = json.loads(user.cookies) if user.cookies else []
        return {
            "cookies": user.cookies,
            "user_id": user.id,
            "cookie_count": len(cookie_list),
            "has_li_at": any(c.get('name') == 'li_at' for c in cookie_list)
        }
    except:
        return {"cookies": user.cookies, "user_id": user.id, "cookie_count": 0, "has_li_at": False}


@app.post("/auth/cookies/validate")
async def validate_cookies(cookies: str):
    """Validate LinkedIn cookies by testing them against LinkedIn API"""
    try:
        import json
        from linkedin_cookie_api import LinkedInCookieAPI
        
        cookie_list = json.loads(cookies)
        linkedin_api = LinkedInCookieAPI(cookies=cookies)
        profile = linkedin_api.get_user_profile()
        
        if profile and 'error' not in profile:
            return {
                "valid": True,
                "message": "Cookies are valid",
                "profile": profile
            }
        else:
            return {
                "valid": False,
                "message": "Cookies are invalid or expired",
                "error": profile.get('error', 'Unknown error')
            }
    except Exception as e:
        return {
            "valid": False,
            "message": f"Error validating cookies: {str(e)}"
        }


# User endpoints
@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    db_user = User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# Post scheduling endpoints
@app.post("/posts/schedule", response_model=ScheduledPostResponse)
async def schedule_post(post: ScheduledPostCreate, db: Session = Depends(get_db)):
    """Schedule a new post"""
    db_post = ScheduledPost(**post.dict())
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    # Schedule the post
    scheduler.schedule_single_post(db_post.id, db_post.scheduled_time)
    
    return db_post


@app.get("/posts/user/{user_id}", response_model=List[ScheduledPostResponse])
async def get_user_posts(user_id: int, db: Session = Depends(get_db)):
    """Get all posts for a user"""
    posts = db.query(ScheduledPost).filter(ScheduledPost.user_id == user_id).all()
    return posts


@app.get("/posts/{post_id}", response_model=ScheduledPostResponse)
async def get_post(post_id: int, db: Session = Depends(get_db)):
    """Get post by ID"""
    post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@app.delete("/posts/{post_id}")
async def delete_post(post_id: int, db: Session = Depends(get_db)):
    """Delete a scheduled post"""
    post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Remove from scheduler
    try:
        scheduler.scheduler.remove_job(f'post_{post_id}')
    except:
        pass
    
    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}


# Immediate posting endpoints
@app.post("/posts/post-now")
async def post_now(
    user_id: int,
    post_type: str,
    target: str,
    content: str,
    media_url: Optional[str] = None,
    use_cookies: bool = True,
    db: Session = Depends(get_db)
):
    """Post immediately to LinkedIn"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = None
    
    # Use cookie-based authentication if available and preferred
    if use_cookies and user.cookies:
        linkedin_api = LinkedInCookieAPI(cookies=user.cookies)
        
        if post_type == "banner":
            media_urls = [media_url] if media_url else None
            if target == "personal":
                result = linkedin_api.post_to_personal_profile(content, media_urls)
            else:
                result = linkedin_api.post_to_company_page(user.linkedin_company_page_id, content, media_urls)
        
        elif post_type == "article":
            # Article posting with cookies
            if target == "personal":
                result = linkedin_api.post_to_personal_profile(content)
            else:
                result = linkedin_api.post_to_company_page(user.linkedin_company_page_id, content)
    
    # Fallback to OAuth API
    elif user.access_token:
        linkedin_api = LinkedInAPI(access_token=user.access_token)
        
        if post_type == "banner":
            media_urls = [media_url] if media_url else None
            if target == "personal":
                result = linkedin_api.post_to_personal_profile(content, media_urls)
            else:
                result = linkedin_api.post_to_company_page(user.linkedin_company_page_id, content, media_urls)
        
        elif post_type == "article":
            if target == "personal":
                result = linkedin_api.publish_article(content, content.split('\n')[0])
            else:
                result = linkedin_api.publish_article(content, content.split('\n')[0], target="company", company_id=user.linkedin_company_page_id)
    
    else:
        raise HTTPException(status_code=400, detail="No authentication method available. Please provide cookies or access token.")
    
    if result and 'error' in result:
        raise HTTPException(status_code=400, detail=result.get('error'))
    
    return result


# Post generation endpoints
@app.post("/generate/banner")
async def generate_banner(topic: str, template: str = "tech"):
    """Generate a banner image"""
    post_generator = PostGenerator()
    filename = post_generator.generate_banner(topic, template)
    return {"filename": filename, "message": "Banner generated successfully"}


@app.post("/generate/article")
async def generate_article(topic: str, template: str = "tech_tip"):
    """Generate article content"""
    post_generator = PostGenerator()
    article = post_generator.generate_article_content(topic, template)
    return article


@app.post("/generate/daily")
async def generate_daily_post(post_type: str = "banner", topic: Optional[str] = None):
    """Generate a daily post"""
    post_generator = PostGenerator()
    post = post_generator.generate_daily_post(post_type, topic)
    return post


# Lead extraction endpoints
@app.post("/leads/extract")
async def extract_leads(
    user_id: int,
    keywords: Optional[str] = None,
    location: str = "global",
    db: Session = Depends(get_db)
):
    """Extract leads from LinkedIn using cookie authentication"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.cookies:
        raise HTTPException(status_code=400, detail="No cookies found. Please save cookies first using /auth/cookies endpoint")
    
    try:
        # Use cookie-based scraper
        scraper = LinkedInScraper(headless=True, cookies=user.cookies)
        
        if keywords is None:
            keywords = settings.lead_extraction_keywords
        
        leads = scraper.get_app_development_leads(keywords, location)
        
        # Save leads to database
        saved_leads = []
        for lead in leads:
            db_lead = ExtractedLead(
                user_id=user_id,
                lead_name=lead.get('name'),
                lead_company=lead.get('company'),
                lead_title=lead.get('title'),
                lead_linkedin_url=lead.get('linkedin_url'),
                lead_source='linkedin_search',
                lead_type=lead.get('lead_type'),
                score=0.0
            )
            db.add(db_lead)
            saved_leads.append(db_lead)
        
        db.commit()
        
        scraper.close()
        
        return {
            "message": f"Extracted {len(leads)} leads",
            "leads": leads,
            "saved_count": len(saved_leads)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lead extraction failed: {str(e)}")


@app.post("/leads", response_model=LeadResponse)
async def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    """Create a new lead"""
    db_lead = ExtractedLead(**lead.dict())
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead


@app.get("/leads/user/{user_id}", response_model=List[LeadResponse])
async def get_user_leads(user_id: int, db: Session = Depends(get_db)):
    """Get all leads for a user"""
    leads = db.query(ExtractedLead).filter(ExtractedLead.user_id == user_id).all()
    return leads


@app.put("/leads/{lead_id}/contact")
async def mark_lead_contacted(lead_id: int, db: Session = Depends(get_db)):
    """Mark a lead as contacted"""
    lead = db.query(ExtractedLead).filter(ExtractedLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead.contacted = True
    db.commit()
    return {"message": "Lead marked as contacted"}


# Client info endpoints
@app.post("/clients", response_model=ClientInfoResponse)
async def create_client(client: ClientInfoCreate, db: Session = Depends(get_db)):
    """Create a new client info entry"""
    db_client = ClientInfo(**client.dict())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


@app.get("/clients/user/{user_id}", response_model=List[ClientInfoResponse])
async def get_user_clients(user_id: int, db: Session = Depends(get_db)):
    """Get all client info for a user"""
    clients = db.query(ClientInfo).filter(ClientInfo.user_id == user_id).all()
    return clients


@app.get("/clients/{client_id}", response_model=ClientInfoResponse)
async def get_client(client_id: int, db: Session = Depends(get_db)):
    """Get client by ID"""
    client = db.query(ClientInfo).filter(ClientInfo.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


# Post template endpoints
@app.post("/templates", response_model=PostTemplateResponse)
async def create_template(template: PostTemplateCreate, db: Session = Depends(get_db)):
    """Create a new post template"""
    db_template = PostTemplate(**template.dict())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@app.get("/templates/user/{user_id}", response_model=List[PostTemplateResponse])
async def get_user_templates(user_id: int, db: Session = Depends(get_db)):
    """Get all templates for a user"""
    templates = db.query(PostTemplate).filter(PostTemplate.user_id == user_id).all()
    return templates


# Scheduler management endpoints
@app.post("/scheduler/daily")
async def update_daily_schedule(post_time: str, timezone: str = "UTC"):
    """Update daily post schedule"""
    scheduler.schedule_daily_post(post_time, timezone)
    return {"message": f"Daily posts scheduled for {post_time} {timezone}"}


@app.post("/scheduler/process")
async def process_pending_posts():
    """Manually trigger processing of pending posts"""
    await scheduler.process_scheduled_posts()
    return {"message": "Pending posts processed"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.app_host, port=settings.app_port)
