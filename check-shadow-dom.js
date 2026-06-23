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
    await linkedIn.page.waitForSelector(editorSelector, { timeout: 30000 });
    
    const mediaSelector = 'button[aria-label="Add media"], button.share-promoted-detour-button';
    const mediaBtn = await linkedIn.page.waitForSelector(mediaSelector, { timeout: 10000 });
    
    // Set file chooser
    const [fileChooser] = await Promise.all([
      linkedIn.page.waitForEvent('filechooser', { timeout: 10000 }),
      mediaBtn.evaluate(el => el.click()),
    ]);
    
    console.log('Uploading image...');
    await fileChooser.setFiles(imagePath);
    console.log('Waiting for cropper...');
    await linkedIn.page.waitForTimeout(5000);
    
    // Recursive search for Next button, including shadow roots
    const nextButtons = await linkedIn.page.evaluate(() => {
      const results = [];
      
      const search = (node) => {
        if (!node) return;
        
        // If it's an element, check it
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = node.innerText?.trim() || '';
          const ariaLabel = node.getAttribute?.('aria-label') || '';
          
          if (text === 'Next' || text === 'Done' || text === 'Save' || ariaLabel === 'Next') {
            const attrs = {};
            for (const attr of node.attributes) {
              attrs[attr.name] = attr.value;
            }
            results.push({
              tagName: node.tagName,
              text,
              className: node.className,
              attrs,
            });
          }
          
          // Check shadow root
          if (node.shadowRoot) {
            search(node.shadowRoot);
          }
        }
        
        // Search child nodes
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          search(children[i]);
        }
      };
      
      search(document.body);
      return results;
    });
    
    console.log('--- Shadow DOM / Recursive Button Search ---');
    console.log(JSON.stringify(nextButtons, null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await linkedIn.close();
  }
})();
