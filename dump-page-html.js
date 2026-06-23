import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const linkedIn = new LinkedInPoster({
  cookiesFile: path.join(__dirname, 'linkedin-cookies.json'),
  headless: true,
});

try {
  await linkedIn.launch();
  await linkedIn.verifyLogin();
  
  console.log('Opening post dialog...');
  await linkedIn._clickStartPost();

  console.log('Waiting 5s for composer modal to load...');
  await linkedIn.page.waitForTimeout(5000);

  // Take a fresh screenshot
  const screenshotPath = path.join(__dirname, 'daily-banners', 'composer_check.png');
  await linkedIn.page.screenshot({ path: screenshotPath });
  console.log('📸 Screenshot saved to:', screenshotPath);

  // Dump outer HTML
  const html = await linkedIn.page.content();
  const htmlPath = path.join(__dirname, 'daily-banners', 'feed_page.html');
  await fs.writeFile(htmlPath, html, 'utf-8');
  console.log('💾 HTML page dumped to:', htmlPath);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await linkedIn.close();
}
