import requests
import json
from typing import Optional, Dict, List
from config import settings


class LinkedInAPI:
    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or settings.linkedin_access_token
        self.client_id = settings.linkedin_client_id
        self.client_secret = settings.linkedin_client_secret
        self.redirect_uri = settings.linkedin_redirect_uri
        self.base_url = "https://api.linkedin.com/v2"
    
    def get_auth_url(self) -> str:
        """Generate LinkedIn OAuth authorization URL"""
        scopes = ["r_liteprofile", "r_emailaddress", "w_member_social", "w_organization_social"]
        auth_url = (
            f"https://www.linkedin.com/oauth/v2/authorization?"
            f"response_type=code&client_id={self.client_id}&"
            f"redirect_uri={self.redirect_uri}&scope={','.join(scopes)}"
        )
        return auth_url
    
    def get_access_token(self, authorization_code: str) -> Dict:
        """Exchange authorization code for access token"""
        token_url = "https://www.linkedin.com/oauth/v2/accessToken"
        data = {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        response = requests.post(token_url, data=data)
        return response.json()
    
    def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh access token using refresh token"""
        token_url = "https://www.linkedin.com/oauth/v2/accessToken"
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        response = requests.post(token_url, data=data)
        return response.json()
    
    def get_user_profile(self) -> Dict:
        """Get current user's LinkedIn profile"""
        headers = {"Authorization": f"Bearer {self.access_token}"}
        response = requests.get(
            f"{self.base_url}/me",
            headers=headers
        )
        return response.json()
    
    def post_to_personal_profile(self, content: str, media_urls: List[str] = None) -> Dict:
        """Post content to personal LinkedIn profile"""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        # Get user's URN
        profile = self.get_user_profile()
        author_urn = profile.get("id")
        
        post_data = {
            "author": f"urn:li:person:{author_urn}",
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": content
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        # Add media if provided
        if media_urls:
            media_assets = []
            for url in media_urls:
                media_assets.append({
                    "status": "READY",
                    "description": {"text": "Image"},
                    "media": f"urn:li:digitalmediaAsset:{url}",
                    "title": {"text": "Post Image"}
                })
            
            post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
            post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = media_assets
        
        response = requests.post(
            f"{self.base_url}/ugcPosts",
            headers=headers,
            json=post_data
        )
        return response.json()
    
    def post_to_company_page(self, company_id: str, content: str, media_urls: List[str] = None) -> Dict:
        """Post content to LinkedIn company page"""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        post_data = {
            "author": f"urn:li:organization:{company_id}",
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": content
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        # Add media if provided
        if media_urls:
            media_assets = []
            for url in media_urls:
                media_assets.append({
                    "status": "READY",
                    "description": {"text": "Image"},
                    "media": f"urn:li:digitalmediaAsset:{url}",
                    "title": {"text": "Post Image"}
                })
            
            post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
            post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = media_assets
        
        response = requests.post(
            f"{self.base_url}/ugcPosts",
            headers=headers,
            json=post_data
        )
        return response.json()
    
    def publish_article(self, content: str, title: str, target: str = "personal", company_id: str = None) -> Dict:
        """Publish an article on LinkedIn"""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        # Get user's URN
        profile = self.get_user_profile()
        author_urn = profile.get("id")
        
        if target == "company" and company_id:
            author_urn = company_id
        
        article_data = {
            "author": f"urn:li:person:{author_urn}",
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": f"{title}\n\n{content}"
                    },
                    "shareMediaCategory": "ARTICLE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        response = requests.post(
            f"{self.base_url}/ugcPosts",
            headers=headers,
            json=article_data
        )
        return response.json()
    
    def search_people(self, keywords: str, limit: int = 10) -> List[Dict]:
        """Search for people on LinkedIn"""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        params = {
            "keywords": keywords,
            "count": limit
        }
        
        response = requests.get(
            f"{self.base_url}/search",
            headers=headers,
            params=params
        )
        return response.json()
    
    def get_company_info(self, company_id: str) -> Dict:
        """Get company information"""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        response = requests.get(
            f"{self.base_url}/organizations/{company_id}",
            headers=headers
        )
        return response.json()
