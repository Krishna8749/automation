// ─────────────────────────────────────────────────────────────
//  Main entry point - simple single-image demo
//  Usage: npm start
// ─────────────────────────────────────────────────────────────

import { ChatGPTImageBot } from './bot.js';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEMO_PROMPT = 'A majestic mountain landscape at golden hour with dramatic clouds and a serene lake reflecting the sky, photorealistic, ultra-detailed';
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

if (!fs.existsSync(COOKIES_FILE)) {
  console.log(chalk.red('\n❌ No cookies file found!'));
  console.log(chalk.yellow('   Run first: npm run setup-cookies\n'));
  process.exit(1);
}

console.log(chalk.bold.cyan('\n🎨 ChatGPT Image Automation - Demo Mode\n'));
console.log(chalk.gray('Prompt: ') + chalk.white(DEMO_PROMPT));
console.log('');

const bot = new ChatGPTImageBot({
  cookiesFile:  COOKIES_FILE,
  outputDir:    path.join(__dirname, 'generated-images'),
  headless:     true,   // no Chrome window
});

try {
  await bot.launch();
  await bot.navigate();

  const result = await bot.generateImage(DEMO_PROMPT);

  console.log(chalk.bold.green('\n✅ Done!\n'));
  console.log(chalk.gray('Image URL:  ') + chalk.blue(result.imageUrl));
  console.log(chalk.gray('Saved to:   ') + chalk.green(result.savedPath));
  console.log('');

} catch (err) {
  console.error(chalk.red('\n❌ Error: ' + err.message));
} finally {
  await bot.close();
}
