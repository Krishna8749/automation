// Quick diagnostic — loads ChatGPT, sends prompt, reads back what's happening
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
  window.chrome = { runtime: {} };
});

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
await page.screenshot({ path: path.join(__dirname, 'diag1_loaded.png'), fullPage: true });

// Click prompt textarea and inject text
const el = await page.$('#prompt-textarea');
if (el) { await el.click(); await page.waitForTimeout(300); }

// Inject prompt via paste event
const txt = 'Draw a simple red circle';
const injected = await page.evaluate((txt) => {
  const editor = document.getElementById('prompt-textarea');
  if (!editor) return false;
  editor.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', txt);
  const ev = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
  editor.dispatchEvent(ev);
  return (editor.innerText || '').trim().length > 0;
}, txt);

console.log(`Injected: ${injected}`);

// Check send button
const sendBtn = await page.$('[data-testid="send-button"]');
if (sendBtn) {
  const vis = await sendBtn.isVisible();
  const ena = await sendBtn.isEnabled();
  console.log(`Send button: visible=${vis}, enabled=${ena}`);
}

await page.screenshot({ path: path.join(__dirname, 'diag2_typed.png'), fullPage: true });

// Click send
await page.waitForTimeout(800);
const btn = await page.$('[data-testid="send-button"]');
if (btn && await btn.isVisible() && await btn.isEnabled()) {
  await btn.click();
  console.log('Clicked send!');
} else {
  await page.keyboard.press('Enter');
  console.log('Pressed Enter!');
}

await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(__dirname, 'diag3_submitted.png'), fullPage: true });

// Wait 30 seconds and check DOM
console.log('Waiting 30s for response...');
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const stopBtn = document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop"]');
    const stopTxt = document.body.innerText.includes('Stop answering');
    const streamEl = document.querySelector('.result-streaming');
    const assistantMsgs = document.querySelectorAll('[data-message-author-role="assistant"]');
    const lastMsg = assistantMsgs[assistantMsgs.length - 1];
    return {
      hasStopBtn: !!stopBtn,
      stopBtnLabel: stopBtn?.getAttribute('aria-label') || stopBtn?.textContent?.trim() || '',
      hasStopTxt: stopTxt,
      hasStreaming: !!streamEl,
      assistantMsgCount: assistantMsgs.length,
      lastMsgText: lastMsg?.innerText?.trim().substring(0, 200) || '',
      imgs: Array.from(document.querySelectorAll('img')).filter(i => {
        const r = i.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      }).map(i => ({ src: i.src.substring(0, 80), w: Math.round(i.getBoundingClientRect().width) })),
    };
  }).catch(e => ({ error: e.message }));

  console.log(`@${(i+1)*2}s:`, JSON.stringify(info));
}

await page.screenshot({ path: path.join(__dirname, 'diag4_final.png'), fullPage: true });
await browser.close();
console.log('Done!');
