// ─────────────────────────────────────────────────────────────
//  STEP 1 - Cookie Setup Tool
//  Run this ONCE to log into ChatGPT and save your session cookies
//  Usage: npm run setup-cookies
// ─────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          ChatGPT Cookie Setup - One Time Login                ║
╚═══════════════════════════════════════════════════════════════╝

 A Chrome browser will open.
 1. Log into YOUR ChatGPT account normally
 2. Complete any CAPTCHAs or 2FA if prompted
 3. Wait until you can see the chat input ready
 4. The tool will AUTO-DETECT your login and save cookies!
 5. Or press ENTER manually if auto-detect is slow
 
`);

const browser = await chromium.launch({
  headless: false,
  slowMo: 50,
  args: [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1400,900',
    '--start-maximized',
  ],
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  viewport: { width: 1400, height: 900 },
  locale: 'en-US',
  // Grant clipboard permissions
  permissions: ['clipboard-read', 'clipboard-write'],
});

// Anti-detection
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  window.chrome = { runtime: {} };
});

const page = await context.newPage();

// Load any existing cookies first
if (fs.existsSync(COOKIES_FILE)) {
  try {
    const existing = await fs.readJson(COOKIES_FILE);
    await context.addCookies(existing);
    console.log(`🍪 Loaded existing cookies — trying auto-login...`);
  } catch { /* ignore */ }
}

// Navigate to ChatGPT
await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

console.log('🌐 Browser opened. Waiting for you to log in...\n');

// ── Auto-detect login ──────────────────────────────────────────
// Poll in background while also waiting for manual Enter
let loginDetected = false;

const autoDetect = (async () => {
  for (let i = 0; i < 120; i++) {  // poll for up to 4 minutes
    try {
      const loggedIn = await page.evaluate(() => {
        // Check these indicators of a FULLY logged-in session:
        const hasInput    = !!(document.querySelector('#prompt-textarea') ||
                               document.querySelector('div[contenteditable="true"]'));
        const noLoginBtn  = !document.querySelector('a[href*="login"]');
        const hasAvatar   = !!(document.querySelector('[data-testid="profile-button"]') ||
                                document.querySelector('button[aria-label*="User"]') ||
                                document.querySelector('img[alt*="User"]'));
        // Also check: top-right has account menu NOT "Log in" button
        const topRight    = document.querySelector('header button, nav button');
        const bodyText    = document.body.innerText;
        const notGuest    = !bodyText.includes('Log in') || bodyText.includes('Log out');

        return (hasInput && notGuest) || hasAvatar;
      });

      if (loggedIn) {
        loginDetected = true;
        console.log('\n✅ Login detected automatically!');
        return true;
      }
    } catch { /* page still loading */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
})();

// Also wait for manual Enter
const manualEnter = new Promise(resolve => {
  if (typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (data) => {
    if (data === '\n' || data === '\r' || data === '\r\n' || data === '\x0d') {
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false);
      }
      resolve('manual');
    }
    if (data === '\x03') process.exit(0); // Ctrl+C
  });
  process.stdout.write('Press ENTER when logged in (or wait for auto-detect)... ');
});

// Race: whichever comes first
await Promise.race([autoDetect, manualEnter]);
if (!loginDetected) {
  console.log('\n⌨️  Manual trigger received.');
}

// Wait a moment to ensure all auth cookies are set
console.log('⏳ Waiting 3 seconds for all cookies to settle...');
await page.waitForTimeout(3000);

// Also visit auth.openai.com to capture auth-domain cookies
try {
  console.log('🌐 Visiting auth domain to capture auth cookies...');
  await page.goto('https://auth.openai.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
} catch { /* ignore redirect errors */ }

// Save ALL cookies from ALL domains
const allCookies = await context.cookies([
  'https://chatgpt.com',
  'https://chat.openai.com',
  'https://auth.openai.com',
  'https://openai.com',
  'https://cdn.openai.com',
]);

await fs.writeJson(COOKIES_FILE, allCookies, { spaces: 2 });

// Verify we have the important auth cookies
const cookieNames = allCookies.map(c => c.name);
const hasSessionToken = cookieNames.some(n => n.includes('session') || n.includes('token') || n.includes('auth') || n.includes('__Secure'));
console.log(`\n💾 Saved ${allCookies.length} cookies to: ${path.basename(COOKIES_FILE)}`);
console.log(`   Cookie names: ${cookieNames.join(', ')}`);

if (allCookies.length < 5) {
  console.log('\n⚠️  WARNING: Only ' + allCookies.length + ' cookies saved — this may not be enough.');
  console.log('   Make sure you are FULLY logged in before running this tool.');
  console.log('   Try: closing browser, logging in again, then rerun setup-cookies.\n');
} else {
  console.log('\n✅ Success! You are ready to generate images.');
  console.log('\n   Run:');
  console.log('   • npm run interactive  — interactive image generation');
  console.log('   • npm run generate     — generate from command line\n');
}

await browser.close();
process.exit(0);
