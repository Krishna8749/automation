import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagePath = path.join(__dirname, 'daily-banners', 'daily_banner_2026-06-22_2026-06-22T22-26-31.png');

const linkedIn = new LinkedInPoster({
  cookiesFile: path.join(__dirname, 'linkedin-cookies.json'),
  headless: true,
});

(async () => {
  try {
    await linkedIn.launch();
    await linkedIn.verifyLogin();
    
    console.log('Opening post dialog...');
    await linkedIn._clickStartPost();
    
    console.log('Waiting for editor...');
    const editorSelector = '.editor-content, [data-placeholder], [placeholder*="thoughts"], .ql-editor';
    await linkedIn.page.waitForSelector(editorSelector, { timeout: 15000 });
    await linkedIn.page.waitForTimeout(2000);
    
    // Selectors to try
    const selectors = [
      'button[aria-label="Add media"]',
      'button.share-promoted-detour-button[aria-label="Add media"]',
      'button.share-promoted-detour-button',
      'button[aria-label*="media"]',
    ];
    
    let uploaded = false;
    for (const sel of selectors) {
      console.log(`Trying media selector: ${sel}`);
      try {
        const btn = await linkedIn.page.$(sel);
        if (!btn) {
          console.log(`  ↳ Element not found in DOM`);
          continue;
        }
        const visible = await btn.isVisible();
        console.log(`  ↳ Element found. Visible: ${visible}`);
        
        if (visible) {
          console.log('  ↳ Clicking and waiting for file chooser...');
          const [fileChooser] = await Promise.all([
            linkedIn.page.waitForFileChooser({ timeout: 6000 }),
            btn.click(),
          ]);
          console.log('  ↳ File chooser triggered! Setting files...');
          await fileChooser.setFiles(imagePath);
          uploaded = true;
          console.log('  ↳ Files set successfully!');
          break;
        }
      } catch (err) {
        console.log(`  ↳ Failed with error: ${err.message}`);
      }
    }
    
    if (uploaded) {
      console.log('Waiting 5 seconds to verify upload...');
      await linkedIn.page.waitForTimeout(5000);
      await linkedIn.page.screenshot({ path: path.join(__dirname, 'daily-banners', 'composer_upload_test.png') });
      console.log('📸 Screenshot saved to daily-banners/composer_upload_test.png');
    } else {
      console.log('❌ Failed to upload image with all selectors.');
    }
    
  } catch (err) {
    console.error('Outer Error:', err);
  } finally {
    await linkedIn.close();
  }
})();
