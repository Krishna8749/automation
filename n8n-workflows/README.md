# n8n GMB Lead Generation & Outreach Pipeline

This folder contains a complete, 100% cost-free GMB lead generation and cold outreach pipeline that runs locally on your PC. It uses **no paid API keys** and instead relies on local Playwright browser automation and your custom local ChatGPT API.

---

## Files in this Directory

1. **[gmb-scraper.js](file:///c:/Linkedin%20Posting/n8n-workflows/gmb-scraper.js)**: A headless Playwright script that searches Google Maps for a query, scrolls to gather results, clicks each business card to extract name/phone/website details, and then crawls their website homepage to scrape contact emails and raw copy.
2. **[send-individual-email.js](file:///c:/Linkedin%20Posting/n8n-workflows/send-individual-email.js)**: A command-line script that invokes your saved Gmail session profile to compose and send individual cold emails using HTML files.
3. **[lead-pipeline-workflow.json](file:///c:/Linkedin%20Posting/n8n-workflows/lead-pipeline-workflow.json)**: The complete n8n JSON workflow template.

---

## Setup & Import Guide

### Step 1: Open n8n and Import Workflow
1. Open your local **n8n** instance (usually at `http://localhost:5678`).
2. Click on **Workflows** → **Add Workflow** (or create a blank workflow).
3. In the top-right menu of the workflow editor, click the three dots (`...`) and select **Import from File**.
4. Choose the `n8n-workflows/lead-pipeline-workflow.json` file.
5. The full visual pipeline (Manual Trigger → Run Scraper → Parse Scraper JSON → Query ChatGPT → Filter → Send Gmail → Send WhatsApp) will load immediately.

### Step 2: Configure Workspace Paths
Double-click on the following nodes to check/update the absolute path coordinates on your machine:

1. **Run GMB Scraper (Execute Command Node)**:
   - Make sure the path points correctly to your project directory, e.g.:
     `node "C:\Linkedin Posting\n8n-workflows\gmb-scraper.js" "web development Dallas" 5`
   - You can replace `"web development Dallas"` with any category/city search query, and `5` with the number of leads you want to fetch.

2. **Send Gmail Outreach (Execute Command Node)**:
   - Ensure the command string correctly matches your project path:
     ```bash
     node -e "require('fs').writeFileSync('temp_email.html', process.argv[1])" "{{ $json.pitchHtml }}" && node "C:\Linkedin Posting\n8n-workflows\send-individual-email.js" --to="{{ $json.emails[0] }}" --cc="sales@webnovacrew.com" --subject="App Development Opportunity for {{ $json.name }}" --bodyFile="temp_email.html"
     ```

### Step 3: Run the Pipeline
1. Ensure your local server is running: `npm run start-server` (this runs the ChatGPT & WhatsApp bot relay on port 3000).
2. Click **Execute Workflow** inside n8n.
3. **What happens**:
   - Playwright opens and crawls Google Maps.
   - For each place found, it reads their homepage content.
   - The workflow queries your local ChatGPT instance on port 3000 to identify if they need a mobile app, extracts emails, and writes an HTML pitch.
   - The workflow automatically dispatches the email using your logged-in Gmail Chrome profile.
   - You receive a real-time WhatsApp message notifying you of the outreach!
