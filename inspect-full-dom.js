import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    
    console.log('Waiting 5 seconds for modal to fully render...');
    await linkedIn.page.waitForTimeout(5000);
    
    // Search the full DOM
    const elements = await linkedIn.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      
      return all
        .filter(el => {
          const className = el.className || '';
          const id = el.id || '';
          const role = el.getAttribute('role') || '';
          const name = el.tagName.toLowerCase();
          
          if (typeof className !== 'string') return false;
          
          return (
            className.includes('modal') || className.includes('share') || className.includes('editor') || className.includes('composer') ||
            id.includes('modal') || id.includes('share') || id.includes('editor') ||
            role.includes('dialog') || role.includes('textbox')
          );
        })
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            role: el.getAttribute('role') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            visible: rect.width > 0 && rect.height > 0,
            rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
          };
        });
    });
    
    console.log('--- Matching DOM Elements ---');
    console.log(JSON.stringify(elements.filter(e => e.visible), null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await linkedIn.close();
  }
})();
