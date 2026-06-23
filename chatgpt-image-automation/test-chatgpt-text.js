import { ChatGPTImageBot } from './bot.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cookiesFile = path.join(__dirname, 'cookies.json');

const bot = new ChatGPTImageBot({ cookiesFile, headless: true });
try {
  console.log('Launching bot...');
  await bot.launch();
  console.log('Navigating...');
  await bot.navigate();
  
  console.log('Focusing input...');
  const input = await bot._focusChatInput();
  
  console.log('Sending text prompt: "Hello, tell me a short joke."');
  await bot._typePrompt('Hello, tell me a short joke.');
  await bot._submitPrompt();
  
  console.log('Waiting 15 seconds for response...');
  for (let i = 0; i < 15; i++) {
    process.stdout.write('.');
    await bot.page.waitForTimeout(1000);
  }
  console.log('\nTaking screenshot...');
  const screenshotPath = path.join(__dirname, 'generated-images', `text_test_${Date.now()}.png`);
  await bot.page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);

  // Fetch last assistant message
  const lastMsg = await bot.page.evaluate(() => {
    const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
    return msgs.length > 0 ? msgs[msgs.length - 1].innerText : 'NO ASSISTANT MESSAGE FOUND';
  });
  console.log('ChatGPT Response:\n', lastMsg);

} catch (err) {
  console.error('ERROR:', err);
} finally {
  await bot.close();
}
