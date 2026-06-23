# 🎨 ChatGPT Image Automation

Automates ChatGPT image generation **without an API key** — uses your real browser session via cookies.

## 🚀 Quick Start

### Step 1 — Install dependencies (one time)
```bash
npm install
npx playwright install chromium
```

### Step 2 — Save your ChatGPT cookies (one time)
```bash
npm run setup-cookies
```
> A Chrome browser will open. Log into [chatgpt.com](https://chatgpt.com) normally, then press **ENTER** in the terminal.

### Step 3 — Generate images!
```bash
# Interactive mode (recommended)
npm run interactive

# Single image from command line
node generate.js "A sunset over the ocean with vibrant colors"

# Batch mode - multiple prompts
node generate.js "Prompt 1" "Prompt 2" "Prompt 3"

# Batch from file
node generate.js --file prompts.txt
```

---

## 📁 Project Structure

```
chatgpt-image-automation/
├── bot.js              # Core automation engine (Playwright)
├── interactive.js      # Interactive CLI with commands
├── generate.js         # Batch/CLI image generator
├── setup-cookies.js    # One-time login & cookie saver
├── index.js            # Demo / entry point
├── prompts.txt         # Sample prompts for batch mode
├── cookies.json        # Your session (auto-created, keep private!)
└── generated-images/   # Output folder (auto-created)
```

---

## 🖥️ Interactive Mode Commands

| Command | Description |
|---------|-------------|
| `/new` | Start a fresh chat (reset context) |
| `/save <name>` | Name the next image file |
| `/list` | Show recently generated images |
| `/open` | Open output folder in Explorer |
| `/quit` | Exit the program |

---

## 💡 Tips for Better Images

- Be specific and descriptive in your prompts
- Include style words: `photorealistic`, `watercolor`, `oil painting`, `cinematic`
- Add lighting: `golden hour`, `studio lighting`, `dramatic shadows`
- Specify mood: `serene`, `epic`, `minimalist`, `vibrant`

---

## ⚠️ Notes

- **Cookies expire** — if login fails, run `npm run setup-cookies` again
- Images are saved to `./generated-images/` with timestamps
- ChatGPT may rate-limit heavy usage — the bot adds delays between requests
- `cookies.json` is in `.gitignore` — never commit it!

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---------|-----|
| "Not logged in" | Run `npm run setup-cookies` again |
| "Could not find chat input" | ChatGPT UI changed — set `headless: false` and check manually |
| Image not downloading | The CDN URL may be session-locked; check `generated-images/` for partial saves |
| Rate limited | Increase delay between prompts in `bot.js` → `_waitForGeneratedImage` |
