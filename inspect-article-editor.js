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
  
  console.log('Navigating to article editor...');
  await linkedIn.page.goto('https://www.linkedin.com/article/new/', { waitUntil: 'domcontentloaded' });
  await linkedIn.page.waitForTimeout(5000);

  // Dump all contenteditables and textareas and inputs
  const info = await linkedIn.page.evaluate(() => {
    const results = [];
    const elements = document.querySelectorAll('div[contenteditable="true"], textarea, input, button');
    
    elements.forEach((el, idx) => {
      results.push({
        index: idx,
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        text: el.innerText?.trim() || '',
        placeholder: el.getAttribute('placeholder') || '',
        dataPlaceholder: el.getAttribute('data-placeholder') || '',
        ariaPlaceholder: el.getAttribute('aria-placeholder') || '',
        contentEditable: el.getAttribute('contenteditable') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
      });
    });
    return results;
  });

  console.log('--- Editor Elements Found ---');
  console.log(JSON.stringify(info, null, 2));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await linkedIn.close();
}
