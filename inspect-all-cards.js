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

  const postsInfo = await page.evaluate(() => {
    // Let's find all name links on the page (bold text links to profile)
    const links = Array.from(document.querySelectorAll('a[href*="/in/"]'));
    const results = [];

    links.forEach((link, idx) => {
      const text = link.innerText?.trim() || '';
      if (text && !text.includes('View profile') && !text.includes('photo') && text.length < 50) {
        // This is a candidate author name link
        const profileUrl = link.href.split('?')[0];
        
        // Find its parent containers up to 10 levels
        const parents = [];
        let p = link;
        for (let i = 0; i < 10; i++) {
          p = p.parentElement;
          if (!p) break;
          parents.push({
            level: i + 1,
            tagName: p.tagName,
            className: p.className,
            id: p.id
          });
        }

        results.push({
          index: idx,
          name: text,
          profileUrl,
          parents
        });
      }
    });

    return results;
  });

  console.log('=== All Author Links & Parent Structures ===');
  console.log(JSON.stringify(postsInfo, null, 2));

  await browser.close();
} catch (err) {
  console.error('Error:', err.message);
}
