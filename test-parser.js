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
  
  // Forward page console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  const searchUrl = 'https://www.linkedin.com/search/results/content/?keywords=app%20development&origin=GLOBAL_SEARCH_HEADER';
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const parsedLeads = await page.evaluate(() => {
    const results = [];
    const sections = Array.from(document.querySelectorAll('section'));
    console.log(`Found ${sections.length} section elements on page.`);
    
    sections.forEach((sec, idx) => {
      // Find all profile links in the section
      const profileLinks = Array.from(sec.querySelectorAll('a[href*="/in/"]'));
      console.log(`Section #${idx} has ${profileLinks.length} profile links.`);
      
      if (profileLinks.length === 0) return;
      
      // Let's find the one that represents the author's name
      // Usually, it's the one with text containing the author name, or the first link that has text
      let nameLink = null;
      let name = '';
      for (const link of profileLinks) {
        const text = link.innerText?.trim() || '';
        if (text && !text.includes('View profile') && !text.includes('photo')) {
          // If the text contains newlines, take the first line (which is usually the name)
          name = text.split('\n')[0].trim();
          if (name) {
            nameLink = link;
            break;
          }
        }
      }

      if (!nameLink) {
        console.log(`Section #${idx}: Could not find a suitable author name link.`);
        return;
      }

      const profileUrl = nameLink.href.split('?')[0];
      console.log(`Section #${idx}: Found author name: "${name}", profile: ${profileUrl}`);

      // Get all text lines inside the section
      const lines = sec.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      console.log(`Section #${idx} text lines count: ${lines.length}`);

      // Locate the name line index (or partial match)
      const nameIndex = lines.findIndex(l => l.includes(name) || name.includes(l));
      if (nameIndex === -1) {
        console.log(`Section #${idx}: Name index not found in lines.`);
        return;
      }

      // Extract headline
      let headline = '';
      for (let i = nameIndex + 1; i < lines.length; i++) {
        if (lines[i].includes('•') || lines[i].includes('h') || lines[i].includes('d') || lines[i].includes('w') || lines[i].includes('ago')) {
          headline = lines[i-1];
          break;
        }
      }
      if (!headline || headline === name) {
        headline = lines[nameIndex + 2] || '';
      }

      // Extract commentary text (the post text)
      let text = '';
      const followIndex = lines.findIndex(l => l === 'Follow' || l === 'Following' || l === 'Connect' || l === 'Message');
      if (followIndex !== -1 && lines[followIndex + 1]) {
        text = lines[followIndex + 1];
        if (text.length < 50 && lines[followIndex + 2]) {
          text += ' ' + lines[followIndex + 2];
        }
      } else {
        // Fallback: get the longest line
        const sortedLines = [...lines].sort((a, b) => b.length - a.length);
        text = sortedLines[0] || '';
      }

      // Extract engagement metrics
      let likes = '0';
      let comments = '0';
      const numbersAtEnd = lines.slice(-4).filter(l => /^\d+$/.test(l));
      if (numbersAtEnd.length >= 1) likes = numbersAtEnd[0];
      if (numbersAtEnd.length >= 2) comments = numbersAtEnd[1];

      // Extract time
      let time = '';
      const timeLine = lines.find(l => (l.includes('h') || l.includes('d') || l.includes('w') || l.includes('m') || l.includes('yr') || l.includes('ago')) && l.includes('•'));
      if (timeLine) {
        time = timeLine.replace('•', '').trim();
      }

      results.push({
        name,
        headline,
        profileUrl,
        text,
        time,
        likes,
        comments
      });
    });

    return results;
  });

  console.log('=== Parsed Leads ===');
  console.log(JSON.stringify(parsedLeads, null, 2));

  await browser.close();
} catch (err) {
  console.error('Error:', err.message);
}
