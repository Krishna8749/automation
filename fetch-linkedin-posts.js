// ─────────────────────────────────────────────────────────────
//  LinkedIn Post Fetcher
//  Uses saved LinkedIn cookies to fetch your recent posts
//  Run: node fetch-linkedin-posts.js
// ─────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import fs   from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE  = path.join(__dirname, 'linkedin-cookies.json');
const SCREENSHOTS   = path.join(__dirname, 'linkedin-screenshots');
const OUTPUT_FILE   = path.join(__dirname, 'linkedin-posts.json');

await fs.ensureDir(SCREENSHOTS);

// ── Load & normalize cookies ───────────────────────────────────
const rawCookies = await fs.readJson(COOKIES_FILE);
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

console.log(`🍪 Loaded ${cookies.length} LinkedIn cookies`);

// ── Launch browser ─────────────────────────────────────────────
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  viewport:  { width: 1400, height: 900 },
  locale:    'en-US',
});

await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

await context.addCookies(cookies);

const page = await context.newPage();
page.setDefaultTimeout(60000);

// ── Step 1: Go to feed and verify login ──────────────────────
console.log('\n🌐 Navigating to LinkedIn feed...');
await page.goto('https://www.linkedin.com/feed/', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(SCREENSHOTS, '1_feed.png'), fullPage: false });

const loggedIn = await page.evaluate(() => {
  const body = document.body.innerText;
  return !body.includes('Sign in') || !!document.querySelector('.share-box-feed-entry__trigger, [data-control-name="create_post"]');
}).catch(() => false);

if (!loggedIn) {
  console.error('❌ Not logged in to LinkedIn. Cookies may be expired.');
  await page.screenshot({ path: path.join(SCREENSHOTS, 'not_logged_in.png') });
  await browser.close();
  process.exit(1);
}
console.log('✅ LinkedIn: Logged in');

// ── Step 2: Get your profile URL ─────────────────────────────
console.log('\n👤 Getting your profile URL...');
const profileUrl = await page.evaluate(() => {
  // Try the profile link in nav
  const link = document.querySelector('a[href*="/in/"][aria-label*="profile"]') ||
               document.querySelector('a[data-control-name="identity_profile_photo"]') ||
               document.querySelector('.global-nav__me-photo')?.closest('a') ||
               document.querySelector('[data-control-name="nav.settings"]')?.closest('a');
  return link?.href || null;
}).catch(() => null);

console.log(`  Profile URL: ${profileUrl || 'Could not detect — using /me/recent-activity'}`);
await page.screenshot({ path: path.join(SCREENSHOTS, '2_profile_found.png'), fullPage: false });

// ── Step 3: Go to your posts activity page ───────────────────
const activityUrl = profileUrl
  ? profileUrl.replace(/\?.*$/, '') + '/recent-activity/all/'
  : 'https://www.linkedin.com/in/me/recent-activity/all/';

console.log(`\n📰 Loading activity page: ${activityUrl}`);
await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: path.join(SCREENSHOTS, '3_activity_page.png'), fullPage: false });

// ── Scroll to load more posts ─────────────────────────────────
console.log('📜 Scrolling to load posts...');
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => window.scrollBy(0, 1200));
  await page.waitForTimeout(2000);
}
await page.screenshot({ path: path.join(SCREENSHOTS, '4_after_scroll.png'), fullPage: true });

// ── Step 4: Extract posts ─────────────────────────────────────
console.log('\n🔍 Extracting posts from page...');
const posts = await page.evaluate(() => {
  const results = [];

  // Multiple selectors for LinkedIn post containers
  const selectors = [
    '.feed-shared-update-v2',
    '[data-urn*="activity"]',
    '.occludable-update',
    '.ember-view.occludable-update',
    'article',
  ];

  let postEls = [];
  for (const sel of selectors) {
    postEls = Array.from(document.querySelectorAll(sel));
    if (postEls.length > 0) {
      console.log(`Found ${postEls.length} posts via: ${sel}`);
      break;
    }
  }

  for (const el of postEls.slice(0, 20)) {
    try {
      // Text content
      const textEl = el.querySelector(
        '.feed-shared-update-v2__description, ' +
        '.feed-shared-text, ' +
        '.update-components-text, ' +
        '[data-test-id="main-feed-activity-card__commentary"] span, ' +
        '.attributed-text-segment-list__content'
      );
      const text = textEl?.innerText?.trim() || '';

      // Timestamp
      const timeEl = el.querySelector('time, .feed-shared-actor__sub-description, .update-components-actor__sub-description');
      const time   = timeEl?.innerText?.trim() || timeEl?.getAttribute('datetime') || '';

      // Likes count
      const likesEl = el.querySelector(
        '.social-counts-reactions__social-counts-count, ' +
        '.social-details-social-counts__reactions-count, ' +
        '[aria-label*="reaction"]'
      );
      const likes = likesEl?.innerText?.trim() || '0';

      // Comments count
      const commentsEl = el.querySelector(
        '.social-details-social-counts__comments, ' +
        '[aria-label*="comment"]'
      );
      const comments = commentsEl?.innerText?.trim() || '0';

      // Post URL
      const linkEl = el.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
      const url    = linkEl?.href || '';

      // Image
      const imgEl  = el.querySelector('img.ivm-view-attr__img--centered, img[data-delayed-url]');
      const imgUrl = imgEl?.src || imgEl?.getAttribute('data-delayed-url') || '';

      if (text || url) {
        results.push({ text: text.slice(0, 500), time, likes, comments, url, imgUrl });
      }
    } catch { /* skip */ }
  }

  return { posts: results, total: postEls.length, selector: 'detected' };
});

console.log(`\n📊 Found ${posts.total} post elements, extracted ${posts.posts.length} posts`);

// ── Step 5: Display results ───────────────────────────────────
if (posts.posts.length === 0) {
  console.log('\n⚠️  No posts found. Checking page content...');
  const pageText = await page.textContent('body').catch(() => '');
  console.log('Page snippet:', pageText.slice(0, 500));

  // Try alternative: Go to profile directly
  console.log('\n🔄 Trying LinkedIn profile search...');
  await page.goto('https://www.linkedin.com/in/me/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(SCREENSHOTS, '5_profile_direct.png'), fullPage: false });

  const profileUrlDirect = page.url();
  console.log(`  Redirected to: ${profileUrlDirect}`);

  if (profileUrlDirect.includes('/in/')) {
    const actUrl = profileUrlDirect.replace(/\/$/, '') + '/recent-activity/all/';
    console.log(`  Going to: ${actUrl}`);
    await page.goto(actUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '6_activity_retry.png'), fullPage: true });
  }
} else {
  // Print posts to console
  console.log('\n═══════════════════════════════════════');
  console.log('         YOUR LINKEDIN POSTS');
  console.log('═══════════════════════════════════════\n');

  posts.posts.forEach((p, i) => {
    console.log(`📝 Post #${i + 1}`);
    console.log(`   Time:     ${p.time || 'N/A'}`);
    console.log(`   Likes:    ${p.likes}`);
    console.log(`   Comments: ${p.comments}`);
    console.log(`   URL:      ${p.url || 'N/A'}`);
    if (p.imgUrl) console.log(`   Image:    ${p.imgUrl.slice(0, 80)}...`);
    console.log(`   Text:     ${p.text.slice(0, 200) || '(no text)'}...`);
    console.log('');
  });

  // Save to JSON file
  await fs.writeJson(OUTPUT_FILE, {
    fetchedAt: new Date().toISOString(),
    count:     posts.posts.length,
    posts:     posts.posts,
  }, { spaces: 2 });

  console.log(`💾 Saved to: ${OUTPUT_FILE}`);
}

// ── Final screenshots saved ───────────────────────────────────
console.log(`\n📸 Screenshots saved in: ${SCREENSHOTS}`);
await browser.close();
console.log('\n✅ Done!');
