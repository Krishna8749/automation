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

  const cardDetails = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div._6eecdcff'));
    const results = [];

    cards.forEach((card, cardIdx) => {
      // Find if there is an author link
      const authorLink = card.querySelector('a[href*="/in/"]');
      if (!authorLink) return; // Skip if not a post card containing an author profile link

      const authorText = authorLink.innerText?.trim() || '';
      
      // Let's grab all links inside the card
      const links = Array.from(card.querySelectorAll('a')).map(l => ({
        text: l.innerText?.trim() || '',
        href: l.href,
        className: l.className
      }));

      // Let's grab all text elements / divs / spans
      const allTexts = [];
      card.querySelectorAll('span, p, div').forEach(el => {
        const text = el.innerText?.trim() || '';
        if (text && text.length > 0 && text.length < 500) {
          // Check if it's a leaf text element
          if (el.children.length === 0) {
            allTexts.push({
              tag: el.tagName,
              className: el.className,
              text
            });
          }
        }
      });

      // Let's inspect structural classes
      results.push({
        cardIndex: cardIdx,
        authorText,
        innerText: card.innerText?.substring(0, 1000),
        links: links.slice(0, 15),
        leafTexts: allTexts.slice(0, 30)
      });
    });

    return results;
  });

  console.log('=== REAL CARD DETAILS ===');
  console.log(JSON.stringify(cardDetails.slice(0, 3), null, 2));

  await browser.close();
} catch (err) {
  console.error('Error:', err.message);
}
