import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const cookiesFile = path.join(__dirname, 'linkedin-cookies.json');
  const rawCookies = await fs.readJson(cookiesFile);
  const cookies = rawCookies.map(c => ({
    name:     c.name,
    value:    c.value,
    domain:   c.domain   || '.linkedin.com',
    path:     c.path     || '/',
    expires:  c.expirationDate || c.expires || -1,
    httpOnly: c.httpOnly ?? false,
    secure:   c.secure   ?? true,
    sameSite: c.sameSite === 'no_restriction' ? 'None'
             : c.sameSite === 'lax'           ? 'Lax'
             : c.sameSite === 'strict'        ? 'Strict'
             : 'None',
  }));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();
  
  const searchUrl = 'https://www.linkedin.com/search/results/content/?keywords=app%20development&origin=GLOBAL_SEARCH_HEADER';
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const textInfo = await page.evaluate(() => {
    // Find the element containing "unique idea"
    const elements = Array.from(document.querySelectorAll('*'));
    const target = elements.find(el => el.innerText && el.innerText.includes('unique idea') && el.innerText.length < 200);
    if (!target) return 'Text "unique idea" not found';
    
    let result = `Leaf text element: ${target.tagName} | Class: ${target.className} | Text: "${target.innerText.trim()}"\n`;
    let parent = target;
    for (let i = 0; i < 6; i++) {
      parent = parent.parentElement;
      if (!parent) break;
      result += `Parent ${i+1}: ${parent.tagName} | Class: ${parent.className} | ID: ${parent.id}\n`;
    }
    return result;
  });

  console.log('=== Commentary Text Container Inspection ===');
  console.log(textInfo);

  await browser.close();
} catch (err) {
  console.error('Error:', err.message);
}
