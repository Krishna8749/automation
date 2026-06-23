import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function extractLeadsDetailed(keyword, limit = 10) {
  const cookiesFile = path.join(__dirname, '..', 'linkedin-cookies.json');
  console.log(`🍪 Loading LinkedIn cookies from: ${cookiesFile}`);
  
  if (!fs.existsSync(cookiesFile)) {
    throw new Error(`LinkedIn cookies not found: ${cookiesFile}`);
  }

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

  console.log('🚀 Launching browser for LinkedIn search...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
    locale: 'en-US',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await context.addCookies(cookies);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  try {
    console.log(`🌐 Navigating to LinkedIn Feed to verify login...`);
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    const loggedIn = await page.evaluate(() => {
      const body = document.body.innerText;
      return !body.includes('Sign in') || !!document.querySelector('.share-box-feed-entry__trigger, [data-control-name="create_post"]');
    }).catch(() => false);

    if (!loggedIn) {
      const loginErrSp = path.join(__dirname, '..', 'daily-banners', 'leads_login_error.png');
      await page.screenshot({ path: loginErrSp });
      throw new Error(`❌ Not logged into LinkedIn. Cookies may be expired. Screenshot saved to: ${loginErrSp}`);
    }
    console.log('✅ LinkedIn: Logged in');

    const encodedKeyword = encodeURIComponent(keyword);
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodedKeyword}&origin=GLOBAL_SEARCH_HEADER`;
    console.log(`🔍 Navigating to search URL: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    // Scroll multiple times to load more leads for a detailed list
    console.log('📜 Scrolling page to load more leads...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
    }

    // Save screenshot of search results
    const resultsSp = path.join(__dirname, '..', 'daily-banners', 'leads_search_results.png');
    await page.screenshot({ path: resultsSp });
    console.log(`📸 Saved search results screenshot to: ${resultsSp}`);

    // Scrape detailed leads
    console.log('🔍 Parsing lead elements...');
    // Scrape detailed leads
    console.log('🔍 Parsing lead elements...');
    const leads = await page.evaluate(({ limit }) => {
      const results = [];
      // Combine all potential post wrapper selectors, including the dynamic '_6eecdcff' wrapper
      const postElements = Array.from(document.querySelectorAll('div._6eecdcff, div[class*="_6eecdcff"], .feed-shared-update-v2, [data-urn*="activity"]'));

      for (const el of postElements) {
        if (results.length >= limit) break;

        try {
          // Verify it's a real post card by looking for a profile link inside
          const authorLink = el.querySelector('a[href*="/in/"]');
          if (!authorLink) continue;

          // Extract Name
          let name = '';
          const authorLinkText = authorLink.innerText.split('\n')[0].trim();
          if (authorLinkText && !authorLinkText.includes('View profile') && !authorLinkText.includes('photo') && authorLinkText.length < 50) {
            name = authorLinkText;
          }

          // Fallback parsing from innerText lines
          const lines = el.innerText.split('\n').map(l => l.trim()).filter(Boolean);
          let nameIdx = lines.findIndex(l => name ? l.includes(name) : false);
          if (nameIdx === -1) {
            nameIdx = (lines[0] === 'Feed post' || lines[0] === 'Suggested') ? 1 : 0;
            name = name || lines[nameIdx] || '';
          }

          // Extract URL
          const profileUrl = authorLink.href.split('?')[0];

          // Extract Headline
          let headline = '';
          let relIdx = nameIdx + 1;
          let relationship = '';
          if (lines[relIdx] && (lines[relIdx].includes('•') || lines[relIdx].includes('1st') || lines[relIdx].includes('2nd') || lines[relIdx].includes('3rd'))) {
            relationship = lines[relIdx];
          } else {
            relIdx = nameIdx;
          }

          let headlineIdx = relIdx + 1;
          if (lines[headlineIdx] && lines[headlineIdx] !== 'Follow' && !lines[headlineIdx].includes('•') && !/^\d+[hdmwy]\s*•/.test(lines[headlineIdx])) {
            headline = lines[headlineIdx];
          }

          // Extract Post Text
          let text = '';
          // Try known text classes first
          const textEl = el.querySelector('span._46b5219e, div._46b5219e, .update-components-text, .feed-shared-update-v2__commentary, .feed-shared-text');
          if (textEl) {
            text = textEl.innerText.trim();
          } else {
            // Fallback: search lines after "Follow"
            const followIdx = lines.findIndex(l => l === 'Follow' || l === 'Following');
            if (followIdx !== -1 && lines[followIdx + 1]) {
              text = lines[followIdx + 1];
            } else {
              // Longest line after name
              let candidates = lines.slice(nameIdx + 1).filter(l => l !== 'Follow' && l !== 'Following' && l !== relationship && l !== headline);
              if (candidates.length > 0) {
                candidates.sort((a, b) => b.length - a.length);
                text = candidates[0];
              }
            }
          }

          // Extract Time
          let time = '';
          const timeEl = el.querySelector('time, .feed-shared-actor__sub-description, .update-components-actor__sub-description');
          if (timeEl) {
            time = timeEl.innerText.trim();
          } else {
            // Find bullet line that resembles a relative time
            let timeIdx = headlineIdx + 1;
            while (timeIdx < lines.length && timeIdx < headlineIdx + 4) {
              if (lines[timeIdx].includes('•') || /^\d+[hdmwy]/.test(lines[timeIdx]) || lines[timeIdx].includes('ago') || lines[timeIdx].includes('edited')) {
                time = lines[timeIdx];
                break;
              }
              timeIdx++;
            }
          }

          // Extract Likes
          let likes = '0';
          const likesEl = el.querySelector('[class*="reactions-count"], .social-counts-reactions__social-counts-count, .social-details-social-counts__reactions-count');
          if (likesEl) {
            likes = likesEl.innerText.trim();
          } else {
            const reactionEl = Array.from(el.querySelectorAll('span, div')).find(e => e.innerText && e.innerText.toLowerCase().includes('reaction'));
            if (reactionEl) {
              likes = reactionEl.innerText.trim().replace(/\D/g, '') || '0';
            }
          }

          // Extract Comments
          let comments = '0';
          const commentsEl = el.querySelector('[class*="comments-count"], .social-details-social-counts__comments, [class*="comments"]');
          if (commentsEl) {
            comments = commentsEl.innerText.trim();
          } else {
            const commentEl = Array.from(el.querySelectorAll('span, div')).find(e => e.innerText && e.innerText.toLowerCase().includes('comment'));
            if (commentEl) {
              comments = commentEl.innerText.trim().replace(/\D/g, '') || '0';
            }
          }

          // Skip duplicate profiles or empty/invalid leads
          if (name && text && !results.some(r => r.profileUrl === profileUrl)) {
            results.push({
              name,
              headline: headline === '--' ? '' : headline,
              profileUrl,
              text: text.substring(0, 500),
              time: time.replace(/•\s*/g, '').trim(),
              likes,
              comments
            });
          }
        } catch (e) {
          // Skip errors for individual card parsing
        }
      }
      return results;
    }, { limit });

    console.log(`✅ Extracted ${leads.length} detailed leads.`);
    return leads;

  } finally {
    await browser.close();
  }
}

// Allow direct execution of this script for debugging/testing
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const keyword = process.argv[2] || 'app development';
  console.log(`--- Running Leads Extractor Test for: "${keyword}" ---`);
  try {
    const leads = await extractLeadsDetailed(keyword, 10);
    console.log(JSON.stringify(leads, null, 2));
    console.log('\n✅ Extractor Test Completed Successfully!');
  } catch (err) {
    console.error('❌ Extractor Test Failed:', err.message);
  }
}
