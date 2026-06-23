// ─────────────────────────────────────────────────────────────
//  DOM Inspector - finds the correct input selectors on ChatGPT
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import fs   from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cookiesFile = path.join(__dirname, 'chatgpt-image-automation', 'cookies.json');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  viewport: { width: 1400, height: 900 },
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

// Load cookies
const raw = await fs.readJson(cookiesFile);
const cookies = raw.map(c => ({
  name: c.name, value: c.value,
  domain: c.domain || '.chatgpt.com',
  path: c.path || '/',
  expires: c.expirationDate || c.expires || -1,
  httpOnly: c.httpOnly ?? false,
  secure: c.secure ?? true,
  sameSite: c.sameSite === 'no_restriction' ? 'None' : c.sameSite === 'lax' ? 'Lax' : 'None',
}));
await context.addCookies(cookies);

const page = await context.newPage();
await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

// Take screenshot
await page.screenshot({ path: path.join(__dirname, 'dom-inspect.png'), fullPage: true });
console.log('📸 Screenshot saved: dom-inspect.png');

// Inspect the DOM for input elements
const info = await page.evaluate(() => {
  const results = [];
  
  // All input/textarea/contenteditable elements
  const els = document.querySelectorAll('input, textarea, div[contenteditable], [role="textbox"]');
  for (const el of els) {
    const rect = el.getBoundingClientRect();
    results.push({
      tag: el.tagName,
      id: el.id || '',
      class: (el.className || '').substring(0, 60),
      contenteditable: el.contentEditable,
      role: el.getAttribute('role') || '',
      placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '',
      visible: rect.width > 0 && rect.height > 0,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }

  // Also check for buttons
  const btns = document.querySelectorAll('button');
  const btnInfo = [];
  for (const btn of btns) {
    const rect = btn.getBoundingClientRect();
    if (rect.width > 0) {
      btnInfo.push({
        text: btn.innerText.trim().substring(0, 30),
        ariaLabel: btn.getAttribute('aria-label') || '',
        dataTestId: btn.getAttribute('data-testid') || '',
        type: btn.type,
      });
    }
  }

  return { inputs: results, buttons: btnInfo.slice(0, 20) };
});

console.log('\n📋 INPUT ELEMENTS:');
for (const el of info.inputs) {
  console.log(JSON.stringify(el));
}

console.log('\n📋 BUTTONS:');
for (const btn of info.buttons) {
  console.log(JSON.stringify(btn));
}

await browser.close();
