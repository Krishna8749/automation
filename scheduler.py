from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import asyncio
from typing import Optional
from sqlalchemy.orm import Session
from database import SessionLocal, ScheduledPost
from linkedin_api import LinkedInAPI
from post_generator import PostGenerator
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PostScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.post_generator = PostGenerator()
    
    def start(self):
        """Start the scheduler"""
        self.scheduler.start()
        logger.info("Scheduler started")
    
    def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")
    
    def schedule_daily_post(self, post_time: str = "09:00", timezone: str = "UTC"):
        """Schedule daily posts at specified time"""
        hour, minute = map(int, post_time.split(':'))
        
        self.scheduler.add_job(
            self.process_scheduled_posts,
            trigger=CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id='daily_post_job',
            name='Daily LinkedIn Posts',
            replace_existing=True
        )
        
        logger.info(f"Scheduled daily posts at {post_time} {timezone}")
    
    async def process_scheduled_posts(self):
        """Process all pending scheduled posts"""
        db = SessionLocal()
        try:
            now = datetime.utcnow()
            
            # Get pending posts that are due
            pending_posts = db.query(ScheduledPost).filter(
                ScheduledPost.status == "pending",
                ScheduledPost.scheduled_time <= now
            ).all()
            
            logger.info(f"Processing {len(pending_posts)} scheduled posts")
            
            for post in pending_posts:
                await self.post_to_linkedin(post, db)
                
        except Exception as e:
            logger.error(f"Error processing scheduled posts: {e}")
        finally:
            db.close()
    
    async def post_to_linkedin(self, post: ScheduledPost, db: Session):
        """Post a scheduled post to LinkedIn"""
        try:
            from linkedin_cookie_api import LinkedInCookieAPI
            
            result = None
            
            # Use cookie-based authentication if available
            if post.user.cookies:
                linkedin_api = LinkedInCookieAPI(cookies=post.user.cookies)
                
                if post.post_type == "banner":
                    media_urls = [post.media_url] if post.media_url else None
                    if post.target == "personal":
                        result = linkedin_api.post_to_personal_profile(post.content, media_urls)
                    else:
                        result = linkedin_api.post_to_company_page(
                            post.user.linkedin_company_page_id,
                            post.content,
                            media_urls
                        )
                
                elif post.post_type == "article":
                    if post.target == "personal":
                        result = linkedin_api.post_to_personal_profile(post.content)
                    else:
                        result = linkedin_api.post_to_company_page(
                            post.user.linkedin_company_page_id,
                            post.content
                        )
            
            # Fallback to OAuth API
            elif post.user.access_token:
                linkedin_api = LinkedInAPI(access_token=post.user.access_token)
                
                if post.post_type == "banner":
                    media_urls = [post.media_url] if post.media_url else None
                    if post.target == "personal":
                        result = linkedin_api.post_to_personal_profile(post.content, media_urls)
                    else:
                        result = linkedin_api.post_to_company_page(
                            post.user.linkedin_company_page_id,
                            post.content,
                            media_urls
                        )
                
                elif post.post_type == "article":
                    if post.target == "personal":
                        result = linkedin_api.publish_article(post.content, post.content.split('\n')[0])
                    else:
                        result = linkedin_api.publish_article(
                            post.content,
                            post.content.split('\n')[0],
                            target="company",
                            company_id=post.user.linkedin_company_page_id
                        )
            
            else:
                post.status = "failed"
                post.error_message = "No authentication method available"
                post.updated_at = datetime.utcnow()
                db.commit()
                logger.error(f"No authentication available for post {post.id}")
                return
            
            # Update post status
            if result and 'id' in result:
                post.status = "posted"
                post.linkedin_post_id = result.get('id')
                post.updated_at = datetime.utcnow()
                logger.info(f"Successfully posted post {post.id}")
            else:
                post.status = "failed"
                post.error_message = str(result)
                post.updated_at = datetime.utcnow()
                logger.error(f"Failed to post post {post.id}: {result}")
            
            db.commit()
            
        except Exception as e:
            post.status = "failed"
            post.error_message = str(e)
            post.updated_at = datetime.utcnow()
            db.commit()
            logger.error(f"Error posting to LinkedIn: {e}")
    
    def schedule_single_post(self, post_id: int, scheduled_time: datetime):
        """Schedule a single post"""
        self.scheduler.add_job(
            self.process_single_post,
            trigger='date',
            run_date=scheduled_time,
            args=[post_id],
            id=f'post_{post_id}',
            replace_existing=True
        )
        logger.info(f"Scheduled post {post_id} for {scheduled_time}")
    
    async def process_single_post(self, post_id: int):
        """Process a single scheduled post"""
        db = SessionLocal()
        try:
            post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
            if post:
                await self.post_to_linkedin(post, db)
        except Exception as e:
            logger.error(f"Error processing single post {post_id}: {e}")
        finally:
            db.close()


# Global scheduler instance
scheduler = PostScheduler()
