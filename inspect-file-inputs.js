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

  console.log('Waiting for composer...');
  await linkedIn.page.waitForTimeout(4000);

  // Find all file inputs
  const inputs = await linkedIn.page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('input[type="file"]'));
    return els.map(el => {
      const attrs = {};
      for (const attr of el.attributes) {
        attrs[attr.name] = attr.value;
      }
      return {
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        attrs,
      };
    });
  });

  console.log('--- File Inputs Found ---');
  console.log(JSON.stringify(inputs, null, 2));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await linkedIn.close();
}
