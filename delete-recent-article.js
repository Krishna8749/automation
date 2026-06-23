import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const linkedIn = new LinkedInPoster({
  cookiesFile: path.join(__dirname, 'linkedin-cookies.json'),
  headless: true
});

try {
  await linkedIn.launch();
  await linkedIn.verifyLogin();
  
  console.log('Navigating to Pulse Manager...');
  await linkedIn.page.goto('https://www.linkedin.com/pulse/manage', { waitUntil: 'domcontentloaded' });
  await linkedIn.page.waitForTimeout(5000);

  // Take screenshot of the Pulse manager
  const sp1 = path.join(__dirname, 'daily-banners', 'pulse_manager.png');
  await linkedIn.page.screenshot({ path: sp1, fullPage: true });
  console.log(`📸 Saved Pulse Manager screenshot to: ${sp1}`);

  // Also try going to the personal profile's recent activity / articles
  console.log('Navigating to feed to find profile link...');
  await linkedIn.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await linkedIn.page.waitForTimeout(3000);

  // Find profile link by looking at "Me" link or left card profile link
  const profileUrl = await linkedIn.page.evaluate(() => {
    // Left card profile link: usually .feed-identity-module__actor-meta a or similar
    const leftCardLink = document.querySelector('.feed-identity-module__actor-meta a, a[href*="/in/"]');
    return leftCardLink ? leftCardLink.href : null;
  });

  if (profileUrl) {
    const activityUrl = profileUrl.endsWith('/') ? `${profileUrl}recent-activity/articles/` : `${profileUrl}/recent-activity/articles/`;
    console.log(`Navigating to profile activity articles: ${activityUrl}`);
    await linkedIn.page.goto(activityUrl, { waitUntil: 'domcontentloaded' });
    await linkedIn.page.waitForTimeout(5000);

    const sp2 = path.join(__dirname, 'daily-banners', 'articles_activity.png');
    await linkedIn.page.screenshot({ path: sp2, fullPage: true });
    console.log(`📸 Saved Activity Articles screenshot to: ${sp2}`);
  } else {
    console.log('❌ Could not find profile URL from feed page.');
  }

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await linkedIn.close();
}
