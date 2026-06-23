import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cookiesFile = path.join(__dirname, 'cookies.json');

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  viewport: { width: 1400, height: 900 },
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
await page.waitForTimeout(6000);

console.log('--- Inspecting page elements ---');
const info = await page.evaluate(() => {
  const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
  const msgsInfo = [];
  msgs.forEach((msg, idx) => {
    const html = msg.innerHTML;
    const imgs = Array.from(msg.querySelectorAll('img')).map(i => {
      const rect = i.getBoundingClientRect();
      return {
        src: i.src.substring(0, 150),
        alt: i.alt || '',
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0,
        complete: i.complete,
        naturalW: i.naturalWidth,
        naturalH: i.naturalHeight,
        className: i.className || '',
        parentTag: i.parentElement?.tagName || '',
        parentClass: i.parentElement?.className || '',
        grandparentClass: i.parentElement?.parentElement?.className || '',
      };
    });

    // Let's also check for canvas or SVG or other elements that might render the image
    const canvases = Array.from(msg.querySelectorAll('canvas')).map(c => ({
      w: c.width,
      h: c.height,
      className: c.className || '',
    }));

    const svgs = Array.from(msg.querySelectorAll('svg')).map(s => ({
      className: s.className || '',
      w: s.getBoundingClientRect().width,
    }));

    msgsInfo.push({
      index: idx,
      text: msg.innerText.substring(0, 100),
      imgs,
      canvases,
      svgs: svgs.slice(0, 5),
    });
  });

  return msgsInfo;
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
