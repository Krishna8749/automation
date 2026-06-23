import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE = path.join(__dirname, 'chatgpt-image-automation', 'cookies.json');
const OUTPUT_FILE = path.join(__dirname, 'Time_Machine_Blog_Hindi.md');

async function run() {
  console.log(chalk.bold.cyan('\n📚 ChatGPT Hindi Blog Generator'));
  console.log(chalk.gray(`   Output destination: ${OUTPUT_FILE}\n`));

  if (!fs.existsSync(COOKIES_FILE)) {
    throw new Error(`ChatGPT cookies not found. Please run setup-cookies first.`);
  }

  // 1. Launch Browser
  const spinner = ora('Launching browser...').start();
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
    locale: 'en-US',
  });

  // Load cookies
  const rawCookies = await fs.readJson(COOKIES_FILE);
  const cookies = rawCookies.map(c => ({
    name:     c.name,
    value:    c.value,
    domain:   c.domain || '.chatgpt.com',
    path:     c.path   || '/',
    expires:  c.expirationDate || c.expires || -1,
    httpOnly: c.httpOnly ?? false,
    secure:   c.secure  ?? true,
    sameSite: 'None',
  }));
  await context.addCookies(cookies);
  spinner.succeed('Browser ready and authenticated');

  const page = await context.newPage();
  page.setDefaultTimeout(90000);

  // 2. Navigate to ChatGPT
  spinner.start('Navigating to ChatGPT...');
  await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  spinner.succeed('ChatGPT interface loaded');

  // 3. Focus Chat Input
  spinner.start('Preparing chat input...');
  const inputSelector = '#prompt-textarea';
  await page.waitForSelector(inputSelector, { state: 'visible' });
  const inputEl = await page.$(inputSelector);
  await inputEl.click();
  await page.waitForTimeout(500);

  // 4. Inject Prompt
  const blogPrompt = `कृपया टाइम मशीन (Time Machine) पर एक विस्तृत और आकर्षक ब्लॉग पोस्ट हिंदी में लिखें। इसमें निम्नलिखित बिंदु शामिल होने चाहिए:
1. एक आकर्षक शीर्षक (Catchy Title)
2. प्रस्तावना (Introduction to Time Travel & Time Machine)
3. वैज्ञानिक आधार (Scientific Theories, like Einstein's Theory of Relativity & Wormholes)
4. समय यात्रा से जुड़े विरोधाभास (Time Travel Paradoxes, like Grandfather Paradox)
5. क्या भविष्य में समय यात्रा संभव होगी? (Is Time Travel Possible in Future?)
6. निष्कर्ष (Conclusion)

कृपया इसे एक बेहतरीन और सुगम ब्लॉग पोस्ट के रूप में लिखें।`;

  // Inject text via paste event to bypass ProseMirror issues
  await page.evaluate((text) => {
    const editor = document.getElementById('prompt-textarea');
    if (!editor) return;
    editor.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    editor.dispatchEvent(pasteEvent);
  }, blogPrompt);
  await page.waitForTimeout(800);
  spinner.succeed('Prompt entered');

  // 5. Submit Prompt
  spinner.start('Submitting prompt to ChatGPT...');
  const sendBtnSelector = '[data-testid="send-button"], button[aria-label="Send prompt"]';
  const sendBtn = await page.$(sendBtnSelector);
  if (sendBtn && await sendBtn.isEnabled()) {
    await sendBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }
  spinner.succeed('Prompt submitted successfully');

  // 6. Wait for ChatGPT to finish generating
  spinner.start('ChatGPT is writing your blog...');
  let generating = true;
  const startTime = Date.now();
  const timeout = 180000; // 3 minutes timeout

  while (generating && (Date.now() - startTime < timeout)) {
    await page.waitForTimeout(2000);
    const isBusy = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-testid="stop-button"]') ||
        document.querySelector('button[aria-label*="Stop"]') ||
        document.body?.innerText?.includes('Stop answering')
      );
    }).catch(() => false);
    
    if (!isBusy) {
      generating = false;
    }
  }

  if (generating) {
    spinner.warn('Generation timed out, capturing current content...');
  } else {
    spinner.succeed('Blog generation completed');
  }

  // 7. Extract the Assistant's Response
  spinner.start('Extracting blog text...');
  const blogContent = await page.evaluate(() => {
    const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (msgs.length === 0) return null;
    const last = msgs[msgs.length - 1];
    const markdownDiv = last.querySelector('.markdown') || last.querySelector('.prose') || last;
    return markdownDiv.innerText.trim();
  });

  if (!blogContent) {
    throw new Error('Could not find the generated blog content on the page.');
  }

  // 8. Save to File
  await fs.writeFile(OUTPUT_FILE, blogContent, 'utf-8');
  spinner.succeed(chalk.bold.green('Blog post saved successfully!'));

  console.log(chalk.green(`\n📬 File Location: `) + chalk.cyan(OUTPUT_FILE));
  console.log(chalk.gray(`   Size: ${Buffer.byteLength(blogContent, 'utf8')} bytes`));
  console.log(chalk.gray('----------------------------------------------'));
  console.log(blogContent.slice(0, 300) + '\n...\n');

  await browser.close();
}

run().catch(err => {
  console.error(chalk.red(`\n❌ Error: ${err.message}`));
  process.exit(1);
});
