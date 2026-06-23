from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import settings

engine = create_engine(settings.database_url, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    linkedin_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    cookies = Column(Text)  # JSON string of cookies
    access_token = Column(Text)  # Optional: for API fallback
    refresh_token = Column(Text)
    token_expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    scheduled_posts = relationship("ScheduledPost", back_populates="user")
    extracted_leads = relationship("ExtractedLead", back_populates="user")


class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    post_type = Column(String)  # 'banner', 'article'
    target = Column(String)  # 'personal', 'company'
    content = Column(Text)
    media_url = Column(String, nullable=True)
    scheduled_time = Column(DateTime)
    status = Column(String, default="pending")  # 'pending', 'posted', 'failed'
    linkedin_post_id = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="scheduled_posts")


class ExtractedLead(Base):
    __tablename__ = "extracted_leads"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lead_name = Column(String)
    lead_company = Column(String, nullable=True)
    lead_title = Column(String, nullable=True)
    lead_linkedin_url = Column(String)
    lead_email = Column(String, nullable=True)
    lead_phone = Column(String, nullable=True)
    lead_source = Column(String)  # 'linkedin_search', 'company_page', etc.
    lead_type = Column(String)  # 'app_development', 'web_development', etc.
    score = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    contacted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="extracted_leads")


class ClientInfo(Base):
    __tablename__ = "client_info"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    client_name = Column(String)
    client_company = Column(String)
    client_industry = Column(String, nullable=True)
    client_size = Column(String, nullable=True)
    client_location = Column(String, nullable=True)
    client_website = Column(String, nullable=True)
    client_description = Column(Text, nullable=True)
    client_linkedin_url = Column(String)
    extracted_data = Column(Text, nullable=True)  # JSON string of additional data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PostTemplate(Base):
    __tablename__ = "post_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    template_name = Column(String)
    template_type = Column(String)  # 'banner', 'article'
    content_template = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
