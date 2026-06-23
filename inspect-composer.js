import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // Wait for post modal
  console.log('Waiting for modal to load...');
  await linkedIn.page.waitForSelector('.share-creation-state__content, .editor-content, [data-placeholder]', { timeout: 15000 });
  await linkedIn.page.waitForTimeout(2000);

  // Take a screenshot of the open composer modal!
  await linkedIn.page.screenshot({ path: path.join(__dirname, 'daily-banners', 'composer_modal.png') });
  console.log('📸 Screenshot saved: daily-banners/composer_modal.png');

  // Dump all buttons and inputs in the modal
  const info = await linkedIn.page.evaluate(() => {
    const results = [];
    const elements = document.querySelectorAll('.share-creation-state__content button, .share-creation-state__content input, button, input');
    
    elements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        results.push({
          index: idx,
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          text: el.innerText?.trim() || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          type: el.getAttribute('type') || '',
          placeholder: el.getAttribute('placeholder') || '',
        });
      }
    });
    return results;
  });

  console.log('--- Composer Elements Found ---');
  console.log(JSON.stringify(info, null, 2));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await linkedIn.close();
}
