# LinkedIn Automation Backend

A comprehensive backend system for automating LinkedIn posting, lead extraction, and client data management for both personal profiles and company pages.

## Features

- **Automated Posting**: Schedule and post daily banner posters and articles to personal profiles and company pages
- **Lead Extraction**: Extract app development leads from LinkedIn search results
- **Client Data Management**: Store and manage client information extracted from LinkedIn
- **Post Generation**: Generate banner images and article content automatically
- **Scheduling System**: Schedule posts for specific times with automatic processing
- **Template Management**: Create and manage reusable post templates
- **Cookie Authentication**: Use LinkedIn cookies for authentication (preferred method)

## Tech Stack

- **Backend**: FastAPI
- **Database**: SQLAlchemy (SQLite/PostgreSQL)
- **LinkedIn Integration**: LinkedIn API + Selenium for scraping + Cookie-based authentication
- **Scheduling**: APScheduler
- **Image Generation**: Pillow (PIL)

## Installation

1. Clone the repository and navigate to the project directory

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
```

## Authentication Methods

### Method 1: Cookie Authentication (Recommended)

This method uses LinkedIn cookies for authentication and doesn't require OAuth setup.

**How to get LinkedIn cookies:**

1. Log in to LinkedIn in your browser
2. Open Developer Tools (F12)
3. Go to the Application/Storage tab
4. Find Cookies under https://www.linkedin.com
5. Export all cookies as JSON

**Format for cookies:**
```json
[
  {
    "name": "li_at",
    "value": "your_cookie_value",
    "domain": ".linkedin.com",
    "path": "/"
  },
  ...
]
```

**Save cookies via API:**
```bash
curl -X POST http://localhost:8000/auth/cookies \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "cookies": "[{\"name\":\"li_at\",\"value\":\"...\",\"domain\":\".linkedin.com\",\"path\":\"/\"}]"
  }'
```

### Method 2: OAuth API (Legacy)

If you prefer to use OAuth, you'll need LinkedIn API credentials.

**Getting LinkedIn API Credentials:**

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create a new application
3. Add the following OAuth 2.0 scopes:
   - `r_liteprofile` - View user profile
   - `r_emailaddress` - View user email
   - `w_member_social` - Post to personal profile
   - `w_organization_social` - Post to company pages
4. Copy your Client ID and Client Secret to the `.env` file

**Edit `.env` and add your LinkedIn API credentials:**
```env
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:8000/auth/callback
LINKEDIN_ACCESS_TOKEN=your_access_token
LINKEDIN_COMPANY_PAGE_ID=your_company_page_id
```

## Running the Application

Start the server:
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### Authentication
- `GET /auth/url` - Get LinkedIn OAuth authorization URL (legacy)
- `POST /auth/callback` - Handle OAuth callback and get access token (legacy)
- `POST /auth/cookies` - Save LinkedIn cookies for a user (recommended)
- `GET /auth/cookies/{user_id}` - Get stored cookies for a user

### Users
- `POST /users` - Create a new user
- `GET /users/{user_id}` - Get user by ID

### Post Scheduling
- `POST /posts/schedule` - Schedule a new post
- `GET /posts/user/{user_id}` - Get all posts for a user
- `GET /posts/{post_id}` - Get post by ID
- `DELETE /posts/{post_id}` - Delete a scheduled post
- `POST /posts/post-now` - Post immediately to LinkedIn

### Post Generation
- `POST /generate/banner` - Generate a banner image
- `POST /generate/article` - Generate article content
- `POST /generate/daily` - Generate a daily post

### Lead Extraction
- `POST /leads/extract` - Extract leads from LinkedIn
- `POST /leads` - Create a new lead
- `GET /leads/user/{user_id}` - Get all leads for a user
- `PUT /leads/{lead_id}/contact` - Mark a lead as contacted

### Client Information
- `POST /clients` - Create a new client info entry
- `GET /clients/user/{user_id}` - Get all client info for a user
- `GET /clients/{client_id}` - Get client by ID

### Post Templates
- `POST /templates` - Create a new post template
- `GET /templates/user/{user_id}` - Get all templates for a user

### Scheduler Management
- `POST /scheduler/daily` - Update daily post schedule
- `POST /scheduler/process` - Manually trigger processing of pending posts

## Usage Examples

### 1. Authenticate with LinkedIn (Cookie Method - Recommended)

First, create a user:
```bash
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{
    "linkedin_id": "your_linkedin_id",
    "email": "your_email@example.com",
    "name": "Your Name"
  }'
```

Then save your LinkedIn cookies:
```bash
curl -X POST http://localhost:8000/auth/cookies \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "cookies": "[{\"name\":\"li_at\",\"value\":\"your_cookie_value\",\"domain\":\".linkedin.com\",\"path\":\"/\"}]"
  }'
```

### 2. Authenticate with LinkedIn (OAuth Method - Legacy)

```bash
curl http://localhost:8000/auth/url
```
Visit the returned URL to authorize the application.

### 2. Schedule a Banner Post
```bash
curl -X POST http://localhost:8000/posts/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "post_type": "banner",
    "target": "company",
    "content": "Check out our latest app development services!",
    "media_url": "banner_20231201_120000.png",
    "scheduled_time": "2023-12-01T09:00:00"
  }'
```

### 3. Generate a Daily Post
```bash
curl -X POST http://localhost:8000/generate/daily \
  -H "Content-Type: application/json" \
  -d '{
    "post_type": "banner",
    "topic": "Mobile App Development"
  }'
```

### 4. Extract App Development Leads
```bash
curl -X POST http://localhost:8000/leads/extract \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "keywords": "app development, mobile app",
    "location": "global"
  }'
```

### 5. Post Immediately (With Cookies)
```bash
curl -X POST http://localhost:8000/posts/post-now \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "post_type": "article",
    "target": "personal",
    "content": "Today we discuss the future of app development...",
    "use_cookies": true
  }'
```

The system will automatically use cookie authentication if available, falling back to OAuth if cookies are not set.

## Database Models

### User
- LinkedIn ID, email, name
- Access and refresh tokens
- Company page ID

### ScheduledPost
- Post type (banner/article)
- Target (personal/company)
- Content and media URL
- Scheduled time and status
- LinkedIn post ID

### ExtractedLead
- Lead name, company, title
- LinkedIn URL, email, phone
- Lead source and type
- Contact status

### ClientInfo
- Client name and company
- Industry, size, location
- Website and description

### PostTemplate
- Template name and type
- Content template
- Active status

## Scheduling

The system includes a built-in scheduler that:
- Processes pending posts at scheduled times
- Supports daily recurring posts
- Can be configured via environment variables
- Can be manually triggered via API

Configure scheduling in `.env`:
```env
DAILY_POST_TIME=09:00
TIMEZONE=UTC
```

## Lead Extraction

The lead extraction system uses Selenium to:
- Search LinkedIn for specific keywords
- Extract lead information (name, title, company)
- Classify leads by type (executive, management, technical, founder)
- Store leads in the database for follow-up

**Note**: LinkedIn scraping should be used responsibly and in accordance with LinkedIn's Terms of Service.

## Post Generation

### Banner Generation
- Creates professional banner images
- Multiple template options (tech, business, creative)
- Customizable colors and text
- Automatic text wrapping and positioning

### Article Generation
- Multiple article templates (tech tip, industry insight, case study)
- Automatic content generation based on topic
- Professional formatting with emojis
- Hashtag suggestions

## Security Considerations

- Store sensitive credentials in environment variables
- Use HTTPS in production
- Implement proper authentication for API endpoints
- Regularly rotate access tokens and cookies
- Follow LinkedIn's API usage guidelines and Terms of Service
- Cookie authentication should be used responsibly and in accordance with LinkedIn's policies
- Never share your cookies or access tokens publicly

## Troubleshooting

### Cookie Authentication Issues
- Ensure cookies are valid and not expired
- Make sure cookies include the `li_at` cookie (LinkedIn authentication token)
- Verify cookies are in proper JSON format
- Check that cookies have the correct domain (.linkedin.com)

### LinkedIn API Issues
- Ensure your access token is valid and not expired
- Check that you have the required OAuth scopes
- Verify your redirect URI matches the one in LinkedIn app settings

### Database Issues
- Ensure the database file has write permissions
- Check that SQLAlchemy is properly configured
- Verify the DATABASE_URL in `.env`

### Selenium Issues
- Ensure Chrome browser is installed
- Check that ChromeDriver is compatible with your Chrome version
- Verify headless mode is working in your environment

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on the repository.
