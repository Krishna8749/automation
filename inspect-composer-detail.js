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

  console.log('Waiting for modal...');
  await linkedIn.page.waitForSelector('div[contenteditable="true"]', { timeout: 15000 });
  await linkedIn.page.waitForTimeout(2000);

  // Find the dialog container
  const info = await linkedIn.page.evaluate(() => {
    // Find editor dynamically
    const editor = document.querySelector('div[contenteditable="true"], [role="textbox"], textarea, .ql-editor, [placeholder*="thoughts"], [placeholder*="post"]');
    if (!editor) {
      // Return details of all inputs and div textbox roles
      const matches = Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const role = el.getAttribute('role') || '';
          const placeholder = el.getAttribute('placeholder') || '';
          const contentEditable = el.contentEditable;
          return role === 'textbox' || contentEditable === 'true' || el.tagName === 'TEXTAREA' || placeholder.includes('thoughts');
        })
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          role: el.getAttribute('role') || '',
          placeholder: el.getAttribute('placeholder') || '',
          contentEditable: el.contentEditable,
        }));
      return { error: 'Editor not found', matches };
    }

    const ancestors = [];
    let p = editor.parentElement;
    while (p) {
      ancestors.push({
        tagName: p.tagName,
        id: p.id,
        className: p.className,
        role: p.getAttribute('role') || '',
        ariaLabel: p.getAttribute('aria-label') || '',
      });
      p = p.parentElement;
    }

    const buttons = Array.from(document.querySelectorAll('button, [role="button"], label, input')).map(el => {
      const rect = el.getBoundingClientRect();
      const attrs = {};
      for (const attr of el.attributes) {
        attrs[attr.name] = attr.value;
      }
      return {
        tagName: el.tagName,
        text: el.innerText?.trim()?.substring(0, 40) || '',
        visible: rect.width > 0 && rect.height > 0,
        rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
        attrs,
      };
    }).filter(e => e.visible);

    return { ancestors, buttons };
  });

  console.log('--- Info Result ---');
  console.log(JSON.stringify(info, null, 2));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await linkedIn.close();
}
