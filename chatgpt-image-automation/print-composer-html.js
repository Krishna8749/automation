import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'daily-banners', 'feed_page.html');
const outputPath = path.join(__dirname, '..', 'daily-banners', 'composer_snippet.txt');

const html = await fs.readFile(htmlPath, 'utf-8');

// Find the composer modal container in the HTML
let index = html.indexOf('share-box-v2__modal');
if (index === -1) {
  index = html.indexOf('artdeco-modal');
}
if (index === -1) {
  index = html.indexOf('role="dialog"');
}

if (index === -1) {
  console.log('Could not find modal markers in HTML');
} else {
  // Grab 35,000 characters around the index
  const start = Math.max(0, index - 2000);
  const end = Math.min(html.length, index + 33000);
  const snippet = html.substring(start, end);
  await fs.writeFile(outputPath, snippet, 'utf-8');
  console.log(`Snippet saved to: ${outputPath} (length: ${snippet.length})`);
}
