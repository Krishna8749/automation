import { ChatGPTImageBot } from './bot.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cookiesFile = path.join(__dirname, 'cookies.json');

const bot = new ChatGPTImageBot({ cookiesFile, headless: true });
try {
  await bot.launch();
  await bot.navigate();
  const result = await bot.generateImage("a small red circle");
  console.log('FINAL RESULT:', result);
} catch (err) {
  console.error('ERROR:', err.message);
} finally {
  await bot.close();
}
