import { ChatGPTImageBot } from './bot.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cookiesFile = path.join(__dirname, 'cookies.json');

const bot = new ChatGPTImageBot({ cookiesFile, headless: false });
try {
  console.log('Launching bot...');
  await bot.launch();
  
  // Listen to console and page errors
  bot.page.on('console', msg => {
    console.log(`[PAGE LOG - ${msg.type()}]: ${msg.text()}`);
  });
  bot.page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.stack || err.message}`);
  });
  bot.page.on('requestfailed', req => {
    console.log(`[REQ FAILED]: ${req.url()} - ${req.failure()?.errorText || 'Unknown error'}`);
  });

  console.log('Navigating...');
  await bot.navigate();
  
  console.log('Focusing input...');
  const input = await bot._focusChatInput();
  
  console.log('Sending: Hello');
  await bot._typePrompt('Hello');
  await bot._submitPrompt();
  
  console.log('Waiting 10s...');
  await bot.page.waitForTimeout(10000);

} catch (err) {
  console.error('ERROR:', err);
} finally {
  await bot.close();
}
