# LinkedIn Cookie Setup Guide

## Extracting Cookies from Your Curl Commands

From your provided curl commands, here are the essential LinkedIn cookies:

```json
[
  {
    "name": "li_at",
    "value": "AQEDAVRV8ywD47YiAAABnvDxti8AAAGfFP46L1YAiUZbd0t-3-_xi5jeigym6PJ6M_ghc9OaAnn0Y8nOtCze_xcefNKCsqNbZMMF8gRSDUFQ6ON1QenElSLUlImMGN7wbn5lBqxPfuYzvhOC4KCeuvLG",
    "domain": ".linkedin.com",
    "path": "/"
  },
  {
    "name": "li_sugr",
    "value": "c17aa5ba-22a0-4f75-9366-751b3f0e8927",
    "domain": ".linkedin.com",
    "path": "/"
  },
  {
    "name": "bcookie",
    "value": "v=2&276e7051-a772-4e66-8fa4-4140d910bc07",
    "domain": ".linkedin.com",
    "path": "/"
  },
  {
    "name": "bscookie",
    "value": "v=1&202603260021227ad01046-808e-4523-8b79-42823676d0a2AQFF5fahPbfPTB_IZo3ra_1_X7zO30vT",
    "domain": ".linkedin.com",
    "path": "/"
  },
  {
    "name": "JSESSIONID",
    "value": "ajax:8809572657310085638",
    "domain": ".linkedin.com",
    "path": "/"
  },
  {
    "name": "_guid",
    "value": "61ef4705-a5d9-4c89-bf4b-40cc58cdaa1e",
    "domain": ".linkedin.com",
    "path": "/"
  },
  {
    "name": "liap",
    "value": "true",
    "domain": ".linkedin.com",
    "path": "/"
  }
]
```

## Quick Setup Steps

### 1. Create a User
```bash
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{
    "linkedin_id": "1414918956",
    "email": "webnovacrew@gmail.com",
    "name": "Web Nova Crew"
  }'
```

### 2. Save Your Cookies
```bash
curl -X POST http://localhost:8000/auth/cookies \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "cookies": "[{\"name\":\"li_at\",\"value\":\"AQEDAVRV8ywD47YiAAABnvDxti8AAAGfFP46L1YAiUZbd0t-3-_xi5jeigym6PJ6M_ghc9OaAnn0Y8nOtCze_xcefNKCsqNbZMMF8gRSDUFQ6ON1QenElSLUlImMGN7wbn5lBqxPfuYzvhOC4KCeuvLG\",\"domain\":\".linkedin.com\",\"path\":\"/\"},{\"name\":\"li_sugr\",\"value\":\"c17aa5ba-22a0-4f75-9366-751b3f0e8927\",\"domain\":\".linkedin.com\",\"path\":\"/\"},{\"name\":\"bcookie\",\"value\":\"v=2&276e7051-a772-4e66-8fa4-4140d910bc07\",\"domain\":\".linkedin.com\",\"path\":\"/\"},{\"name\":\"bscookie\",\"value\":\"v=1&202603260021227ad01046-808e-4523-8b79-42823676d0a2AQFF5fahPbfPTB_IZo3ra_1_X7zO30vT\",\"domain\":\".linkedin.com\",\"path\":\"/\"},{\"name\":\"JSESSIONID\",\"value\":\"ajax:8809572657310085638\",\"domain\":\".linkedin.com\",\"path\":\"/\"},{\"name\":\"_guid\",\"value\":\"61ef4705-a5d9-4c89-bf4b-40cc58cdaa1e\",\"domain\":\".linkedin.com\",\"path\":\"/\"},{\"name\":\"liap\",\"value\":\"true\",\"domain\":\".linkedin.com\",\"path\":\"/\"}]"
  }'
```

### 3. Validate Cookies
```bash
curl -X POST http://localhost:8000/auth/cookies/validate \
  -H "Content-Type: application/json" \
  -d '{
    "cookies": "[{\"name\":\"li_at\",\"value\":\"AQEDAVRV8ywD47YiAAABnvDxti8AAAGfFP46L1YAiUZbd0t-3-_xi5jeigym6PJ6M_ghc9OaAnn0Y8nOtCze_xcefNKCsqNbZMMF8gRSDUFQ6ON1QenElSLUlImMGN7wbn5lBqxPfuYzvhOC4KCeuvLG\",\"domain\":\".linkedin.com\",\"path\":\"/\"}]"
  }'
```

### 4. Test Lead Extraction
```bash
curl -X POST http://localhost:8000/leads/extract \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "keywords": "app development, mobile app",
    "location": "global"
  }'
```

## Using the Cookie Helper Script

Run the helper script to extract cookies from your browser or curl commands:

```bash
python cookie_helper.py
```

This will output the properly formatted cookies for API submission.

## Important Notes

- The `li_at` cookie is the most important - it's your main authentication token
- Cookies expire over time, so you'll need to refresh them periodically
- The system automatically uses cookie authentication when available
- All LinkedIn operations (posting, lead extraction) will use these cookies

## Cookie Refresh

When your cookies expire (typically after 30 days), repeat the login process in your browser and extract the new cookies using the same method.
