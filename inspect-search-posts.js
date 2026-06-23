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

  const containerInfo = await page.evaluate(() => {
    // Find leaf elements containing the text "Raahul raj"
    const elements = Array.from(document.querySelectorAll('span, a, h3, h4, div'));
    const leaf = elements.find(el => {
      return el.innerText && el.innerText.trim() === 'Raahul raj';
    });
    if (!leaf) return 'Raahul raj not found';
    
    let result = `Leaf element: ${leaf.tagName} | Class: ${leaf.className}\n`;
    let parent = leaf;
    for (let i = 0; i < 8; i++) {
      parent = parent.parentElement;
      if (!parent) break;
      result += `Parent ${i+1}: ${parent.tagName} | Class: ${parent.className} | ID: ${parent.id}\n`;
    }
    return result;
  });

  console.log('=== Container Inspection ===');
  console.log(containerInfo);

  // Let's print all parent containers on the page that wrap the cards
  const allCardClasses = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('*').forEach(el => {
      const className = el.className;
      if (className && typeof className === 'string' && (
        className.includes('card') || 
        className.includes('search-results') || 
        className.includes('update')
      )) {
        const text = el.innerText?.substring(0, 30).trim().replace(/\n/g, ' ') || '';
        if (text) {
          list.push({ tagName: el.tagName, className, textSnippet: text });
        }
      }
    });
    return list.slice(0, 30);
  });

  console.log('=== Menu / Card Classes on Page ===');
  console.log(JSON.stringify(allCardClasses, null, 2));

  await browser.close();
} catch (err) {
  console.error('Error:', err.message);
}
