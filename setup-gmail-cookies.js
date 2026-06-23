// ─────────────────────────────────────────────────────────────
//  Gmail Cookie Setup — One-time login helper
//  Run: npm run setup-gmail
// ─────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profileDir = path.join(__dirname, 'gmail-workflows', 'gmail-profile');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║            Gmail Profile Setup — One Time Login              ║
╚══════════════════════════════════════════════════════════════╝

 A Chrome browser will open.
 1. Log into YOUR Gmail / Google account normally.
 2. Once your inbox is visible (or the inbox has finished loading),
    the session will be automatically saved in the profile folder.
 3. Once logged in, you can press ENTER here to close the browser,
    or simply close the browser window.
`);

// Ensure profile dir exists
await fs.ensureDir(profileDir);

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  viewport: null,
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

const page = context.pages()[0] || await context.newPage();
await page.goto('https://mail.google.com/', { waitUntil: 'domcontentloaded' });

console.log('🌐 Browser opened. Log into Gmail...\n');

// Auto-detect login
let loginDetected = false;

const autoDetect = (async () => {
  for (let i = 0; i < 150; i++) {
    try {
      const loggedIn = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        const url  = window.location.href;
        const hasInbox  = url.includes('mail.google.com') && (
          url.includes('/u/') || 
          body.includes('Compose') || 
          !!document.querySelector('div[role="button"][aria-label="Compose"]')
        );
        const notLogin = !url.includes('accounts.google.com/signin');
        return hasInbox && notLogin;
      });
      if (loggedIn) {
        loginDetected = true;
        console.log('\n✅ Gmail login detected and profile saved!');
        return true;
      }
    } catch { /* page loading */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
})();

const manualEnter = new Promise(resolve => {
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on('data', d => {
    if (d === '\n' || d === '\r' || d === '\r\n' || d === '\x0d') {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      resolve('manual');
    }
    if (d === '\x03') process.exit(0);
  });
  process.stdout.write('Press ENTER when logged in (or wait for auto-detect)... ');
});

await Promise.race([autoDetect, manualEnter]);

console.log('\n⏳ Finalizing profile save...');
await page.waitForTimeout(3000);

console.log(`\n✅ Ready! Gmail profile has been saved to: ${profileDir}\n`);

await context.close();
process.exit(0);
