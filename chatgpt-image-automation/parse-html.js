import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'daily-banners', 'feed_page.html');

const html = await fs.readFile(htmlPath, 'utf-8');

// Regex to find all buttons, inputs, labels, and role="button" elements
const regex = /<(button|input|label|div)[^>]*>/gi;
let match;
const elements = [];

while ((match = regex.exec(html)) !== null) {
  const tag = match[1];
  const tagHtml = match[0];
  
  // Extract attributes
  const ariaLabelMatch = /aria-label="([^"]*)"/i.exec(tagHtml);
  const classMatch = /class="([^"]*)"/i.exec(tagHtml);
  const typeMatch = /type="([^"]*)"/i.exec(tagHtml);
  const roleMatch = /role="([^"]*)"/i.exec(tagHtml);
  const idMatch = /id="([^"]*)"/i.exec(tagHtml);
  
  const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : '';
  const className = classMatch ? classMatch[1] : '';
  const typeAttr = typeMatch ? typeMatch[1] : '';
  const roleAttr = roleMatch ? roleMatch[1] : '';
  const idAttr = idMatch ? idMatch[1] : '';

  // If it's a file input, or matches media-like class/aria labels, or is part of the share box
  if (
    tag === 'button' || 
    typeAttr === 'file' || 
    ariaLabel.includes('media') || 
    ariaLabel.includes('photo') || 
    ariaLabel.includes('image') ||
    className.includes('share') ||
    className.includes('media') ||
    ariaLabel.includes('post') ||
    roleAttr === 'button'
  ) {
    elements.push({
      tag,
      idAttr,
      className,
      ariaLabel,
      typeAttr,
      roleAttr,
      tagHtml: tagHtml.substring(0, 150)
    });
  }
}

console.log(`Found ${elements.length} matched elements:`);
console.log(JSON.stringify(elements, null, 2));
