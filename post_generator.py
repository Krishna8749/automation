from PIL import Image, ImageDraw, ImageFont
import textwrap
from typing import Optional, List
from datetime import datetime
import random


class PostGenerator:
    def __init__(self):
        self.banner_templates = {
            "tech": {
                "bg_color": (44, 62, 80),
                "text_color": (255, 255, 255),
                "accent_color": (52, 152, 219)
            },
            "business": {
                "bg_color": (39, 174, 96),
                "text_color": (255, 255, 255),
                "accent_color": (46, 204, 113)
            },
            "creative": {
                "bg_color": (155, 89, 182),
                "text_color": (255, 255, 255),
                "accent_color": (142, 68, 173)
            }
        }
        
        self.article_templates = {
            "tech_tip": {
                "title": "Tech Tip Tuesday",
                "structure": "Introduction\n\nMain Point 1\n\nMain Point 2\n\nConclusion"
            },
            "industry_insight": {
                "title": "Industry Insight",
                "structure": "Current Trend\n\nAnalysis\n\nFuture Outlook"
            },
            "case_study": {
                "title": "Case Study",
                "structure": "Challenge\n\nSolution\n\nResults"
            }
        }
    
    def generate_banner(self, text: str, template: str = "tech", width: int = 1200, height: int = 627) -> str:
        """Generate a banner image with text"""
        template_config = self.banner_templates.get(template, self.banner_templates["tech"])
        
        # Create image
        img = Image.new('RGB', (width, height), color=template_config["bg_color"])
        draw = ImageDraw.Draw(img)
        
        # Try to load a font, fall back to default if not available
        try:
            title_font = ImageFont.truetype("arial.ttf", 48)
            text_font = ImageFont.truetype("arial.ttf", 32)
        except:
            title_font = ImageFont.load_default()
            text_font = ImageFont.load_default()
        
        # Add accent border
        border_width = 10
        draw.rectangle(
            [(border_width, border_width), (width - border_width, height - border_width)],
            outline=template_config["accent_color"],
            width=border_width
        )
        
        # Wrap text
        wrapped_text = textwrap.fill(text, width=30)
        
        # Calculate text position (centered)
        bbox = draw.textbbox((0, 0), wrapped_text, font=text_font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        x = (width - text_width) // 2
        y = (height - text_height) // 2
        
        # Draw text
        draw.text((x, y), wrapped_text, fill=template_config["text_color"], font=text_font)
        
        # Add date
        date_text = datetime.now().strftime("%B %d, %Y")
        try:
            date_font = ImageFont.truetype("arial.ttf", 24)
        except:
            date_font = ImageFont.load_default()
        
        date_bbox = draw.textbbox((0, 0), date_text, font=date_font)
        date_width = date_bbox[2] - date_bbox[0]
        draw.text((width - date_width - 30, height - 50), date_text, fill=template_config["accent_color"], font=date_font)
        
        # Save image
        filename = f"banner_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        img.save(filename)
        
        return filename
    
    def generate_article_content(self, topic: str, template: str = "tech_tip") -> dict:
        """Generate article content based on template"""
        template_config = self.article_templates.get(template, self.article_templates["tech_tip"])
        
        article = {
            "title": f"{template_config['title']}: {topic}",
            "content": self._build_article_content(topic, template_config["structure"])
        }
        
        return article
    
    def _build_article_content(self, topic: str, structure: str) -> str:
        """Build article content based on structure"""
        sections = structure.split('\n\n')
        content_parts = []
        
        for section in sections:
            if section == "Introduction":
                content_parts.append(f"🚀 {topic}\n\nIn today's fast-paced digital landscape, understanding {topic} is crucial for business success. Let's dive into what makes this topic so important.")
            
            elif section == "Main Point 1":
                content_parts.append(f"\n💡 Key Insight\n\nThe first thing to understand about {topic} is its impact on modern business operations. Companies that embrace this approach see significant improvements in efficiency and productivity.")
            
            elif section == "Main Point 2":
                content_parts.append(f"\n🎯 Practical Application\n\nImplementing {topic} doesn't have to be complicated. Start with small steps and gradually build up your capabilities. The key is consistency and continuous improvement.")
            
            elif section == "Conclusion":
                content_parts.append(f"\n✨ Takeaway\n\n{topic} is more than just a trend—it's a fundamental shift in how we approach business. Start today and stay ahead of the competition.")
            
            elif section == "Current Trend":
                content_parts.append(f"📈 {topic} - The Current Landscape\n\nWe're seeing a significant shift in how businesses approach {topic}. Industry leaders are adopting new strategies and seeing remarkable results.")
            
            elif section == "Analysis":
                content_parts.append(f"\n🔍 Deep Dive\n\nThe data shows that organizations focusing on {topic} are outperforming their competitors by significant margins. This trend is expected to accelerate in the coming months.")
            
            elif section == "Future Outlook":
                content_parts.append(f"\n🔮 What's Next\n\nThe future of {topic} looks promising. Emerging technologies and changing consumer behaviors are creating new opportunities for innovation and growth.")
            
            elif section == "Challenge":
                content_parts.append(f"⚠️ The Challenge\n\nMany organizations struggle with {topic}. The complexity and rapid pace of change can be overwhelming, but the right approach makes all the difference.")
            
            elif section == "Solution":
                content_parts.append(f"\n✅ Our Solution\n\nWe developed a comprehensive approach to tackle {topic}. By combining best practices with innovative strategies, we've helped numerous clients achieve their goals.")
            
            elif section == "Results":
                content_parts.append(f"\n📊 The Results\n\nThe impact has been remarkable. Clients have seen significant improvements in key metrics, demonstrating the value of a well-executed strategy.")
            
            else:
                content_parts.append(f"\n{section}")
        
        return '\n'.join(content_parts)
    
    def generate_daily_post(self, post_type: str = "banner", topic: str = None) -> dict:
        """Generate a daily post (banner or article)"""
        if topic is None:
            topics = [
                "Digital Transformation",
                "App Development Best Practices",
                "Cloud Computing Trends",
                "AI in Business",
                "Mobile App Strategy",
                "Web Development Innovation",
                "Software Architecture",
                "Tech Leadership"
            ]
            topic = random.choice(topics)
        
        if post_type == "banner":
            filename = self.generate_banner(topic)
            return {
                "type": "banner",
                "media_url": filename,
                "content": topic,
                "caption": f"💡 {topic}\n\n#Tech #Innovation #DigitalTransformation"
            }
        
        elif post_type == "article":
            article = self.generate_article_content(topic)
            return {
                "type": "article",
                "title": article["title"],
                "content": article["content"],
                "hashtags": "#Tech #Innovation #Business #Growth"
            }
        
        else:
            raise ValueError(f"Invalid post type: {post_type}")
