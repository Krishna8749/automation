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
  
  // Dump information about the share box
  const info = await linkedIn.page.evaluate(() => {
    const results = [];
    // Find all elements containing "Draft" or "Photo" or "Video" in the top section
    const els = document.querySelectorAll('button, div, input');
    for (const el of els) {
      const text = el.innerText?.trim() || '';
      if (text.includes('Draft') || el.className?.includes('share-box') || el.id?.includes('share-box')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) {
          results.push({
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            text: text.substring(0, 50),
            placeholder: el.getAttribute('placeholder') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            role: el.getAttribute('role') || '',
          });
        }
      }
    }
    return results;
  });

  console.log('--- Share Box Elements Found ---');
  console.log(JSON.stringify(info, null, 2));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await linkedIn.close();
}
