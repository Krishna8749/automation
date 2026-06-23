import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'daily-banners', 'feed_page.html');

const html = await fs.readFile(htmlPath, 'utf-8');

// Find "0/20" in the HTML file
const index = html.indexOf('0/20');
if (index === -1) {
  console.log('Could not find "0/20" in the HTML file.');
  // Let's also check for character counts like "/20"
  const idx2 = html.indexOf('/20');
  if (idx2 !== -1) {
    console.log(`Found "/20" at index ${idx2}`);
    console.log(html.substring(idx2 - 100, idx2 + 1000));
  }
} else {
  console.log(`Found "0/20" at index ${index}`);
  // Print 2000 characters before and after "0/20"
  const start = Math.max(0, index - 500);
  const end = Math.min(html.length, index + 2500);
  console.log(html.substring(start, end));
}
