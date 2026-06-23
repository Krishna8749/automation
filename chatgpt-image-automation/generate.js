// ─────────────────────────────────────────────────────────────
//  Batch Image Generator - generate multiple images from a list
//  Usage: node generate.js "prompt 1" "prompt 2" "prompt 3"
//  Or:    node generate.js --file prompts.txt
// ─────────────────────────────────────────────────────────────

import { ChatGPTImageBot } from './bot.js';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let prompts = [];

// Parse arguments
const fileIdx = args.indexOf('--file');
if (fileIdx !== -1 && args[fileIdx + 1]) {
  const filePath = args[fileIdx + 1];
  const content  = await fs.readFile(filePath, 'utf-8');
  prompts = content.split('\n').map(l => l.trim()).filter(Boolean);
  console.log(chalk.cyan(`📄 Loaded ${prompts.length} prompts from ${filePath}`));
} else {
  prompts = args.filter(a => !a.startsWith('--'));
}

if (prompts.length === 0) {
  console.log(chalk.red('\n❌ No prompts provided!\n'));
  console.log('Usage:');
  console.log('  node generate.js "a cat in space"');
  console.log('  node generate.js "prompt 1" "prompt 2" "prompt 3"');
  console.log('  node generate.js --file prompts.txt\n');
  process.exit(1);
}

const cookiesFile = path.join(__dirname, 'cookies.json');
if (!fs.existsSync(cookiesFile)) {
  console.log(chalk.red('\n❌ No cookies file found!'));
  console.log(chalk.yellow('   Run: npm run setup-cookies first\n'));
  process.exit(1);
}

console.log(chalk.bold.cyan(`\n🎨 ChatGPT Batch Image Generator`));
console.log(chalk.gray(`   Generating ${prompts.length} image(s)...\n`));

const bot = new ChatGPTImageBot({ cookiesFile, headless: true });
const results = [];

try {
  const launchSpinner = ora('Launching browser...').start();
  await bot.launch();
  await bot.navigate();
  launchSpinner.succeed(chalk.green('Authenticated with ChatGPT'));

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(chalk.bold(`\n[${i + 1}/${prompts.length}] ${prompt}`));

    const genSpinner = ora('Generating...').start();

    try {
      // No newChat() — reuse the same tab session to avoid Cloudflare re-challenge
      const result = await bot.generateImage(prompt);

      genSpinner.succeed(chalk.green(`Saved: ${path.basename(result.savedPath)}`));
      results.push({ prompt, ...result, status: 'success' });

    } catch (err) {
      genSpinner.fail(chalk.red(`Failed: ${err.message}`));
      results.push({ prompt, error: err.message, status: 'failed' });
    }

    // Small delay between generations to avoid rate limiting
    if (i < prompts.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

} finally {
  await bot.close();
}

// Print summary
console.log(chalk.bold.cyan('\n═══════════ Summary ═══════════'));
const succeeded = results.filter(r => r.status === 'success').length;
const failed    = results.filter(r => r.status === 'failed').length;

console.log(chalk.green(`  ✅ Succeeded: ${succeeded}`));
if (failed > 0) console.log(chalk.red(`  ❌ Failed:    ${failed}`));

results.forEach((r, i) => {
  const icon = r.status === 'success' ? chalk.green('✅') : chalk.red('❌');
  console.log(`  ${icon} ${i + 1}. ${r.prompt.slice(0, 50)}`);
  if (r.savedPath) console.log(chalk.gray(`      → ${r.savedPath}`));
  if (r.error)     console.log(chalk.red(`      ⚠ ${r.error}`));
});

console.log('');
process.exit(failed > 0 ? 1 : 0);
