// ─────────────────────────────────────────────────────────────
//  Interactive Image Generation CLI
//  Usage: npm run interactive
// ─────────────────────────────────────────────────────────────

import { createInterface } from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChatGPTImageBot } from './bot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'generated-images');

// ── Banner ──────────────────────────────────────────────────
console.log(boxen(
  chalk.bold.cyan('🎨  ChatGPT Image Generator') + '\n' +
  chalk.gray('   Automated via browser cookies — no API key needed\n') +
  chalk.yellow('   Type a prompt → get an image\n') +
  chalk.gray('   Commands: /new, /save <name>, /quit, /help'),
  {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'cyan',
  }
));

// ── Check cookies ───────────────────────────────────────────
const cookiesFile = path.join(__dirname, 'cookies.json');
if (!fs.existsSync(cookiesFile)) {
  console.log(chalk.red('\n❌ No cookies file found!'));
  console.log(chalk.yellow('   Run: npm run setup-cookies\n'));
  process.exit(1);
}

// ── Launch bot ──────────────────────────────────────────────
const spinner = ora('Launching browser & authenticating...').start();
const bot = new ChatGPTImageBot({
  cookiesFile,
  outputDir: OUTPUT_DIR,
  headless: true,   // runs silently in background — no Chrome window
  slowMo: 0,        // no delay needed in headless mode
});

try {
  await bot.launch();
  await bot.navigate();
  spinner.succeed(chalk.green('Ready! ChatGPT is open and authenticated.'));
} catch (err) {
  spinner.fail(chalk.red('Failed to start: ' + err.message));
  await bot.close();
  process.exit(1);
}

// ── Interactive loop ─────────────────────────────────────────
const rl = createInterface({
  input:  process.stdin,
  output: process.stdout,
});

let pendingSaveName = null;

const prompt = () => {
  rl.question(chalk.cyan('\n🎨 Image prompt (or /help): '), handleInput);
};

async function handleInput(input) {
  input = input.trim();

  if (!input) {
    prompt();
    return;
  }

  // ── Commands ───────────────────────────────────────────────
  if (input.startsWith('/')) {
    const [cmd, ...args] = input.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'quit':
      case 'exit':
      case 'q':
        console.log(chalk.yellow('\n👋 Closing browser and exiting...\n'));
        rl.close();
        await bot.close();
        process.exit(0);
        break;

      case 'new':
        const newSpinner = ora('Starting new chat...').start();
        await bot.newChat();
        newSpinner.succeed(chalk.green('New chat started!'));
        break;

      case 'save':
        pendingSaveName = args.join(' ').trim() || null;
        console.log(chalk.cyan(`📁 Next image will be saved as: ${pendingSaveName || 'auto-named'}`));
        break;

      case 'open':
        console.log(chalk.cyan(`📂 Output folder: ${OUTPUT_DIR}`));
        const { exec } = await import('child_process');
        exec(`explorer "${OUTPUT_DIR}"`);
        break;

      case 'list':
        await listImages();
        break;

      case 'help':
        printHelp();
        break;

      default:
        console.log(chalk.red(`Unknown command: /${cmd}`));
        printHelp();
    }

    prompt();
    return;
  }

  // ── Generate image ─────────────────────────────────────────
  const genSpinner = ora({
    text: chalk.yellow('Sending prompt to ChatGPT...'),
    spinner: 'dots12',
  }).start();

  try {
    const result = await bot.generateImage(input, { saveAs: pendingSaveName });
    pendingSaveName = null;

    genSpinner.succeed(chalk.green('Image generated successfully!'));

    console.log(boxen(
      chalk.bold('📸 Image Details\n\n') +
      chalk.gray('Prompt:  ') + chalk.white(input.slice(0, 60) + (input.length > 60 ? '...' : '')) + '\n' +
      chalk.gray('Saved:   ') + chalk.green(result.savedPath) + '\n' +
      chalk.gray('URL:     ') + chalk.blue(result.imageUrl.slice(0, 70) + '...'),
      {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
      }
    ));

  } catch (err) {
    genSpinner.fail(chalk.red('Generation failed: ' + err.message));
    console.log(chalk.yellow('💡 Try /new to start a fresh chat and retry'));
  }

  prompt();
}

async function listImages() {
  await fs.ensureDir(OUTPUT_DIR);
  const files = (await fs.readdir(OUTPUT_DIR)).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));

  if (files.length === 0) {
    console.log(chalk.gray('  No images generated yet.'));
    return;
  }

  console.log(chalk.bold.cyan(`\n📂 Generated Images (${files.length} total):`));
  files.slice(-10).forEach((f, i) => {
    console.log(chalk.gray(`  ${i + 1}. `) + chalk.white(f));
  });
  if (files.length > 10) {
    console.log(chalk.gray(`  ... and ${files.length - 10} more`));
  }
}

function printHelp() {
  console.log(boxen(
    chalk.bold.cyan('Commands:\n\n') +
    chalk.yellow('/new') +    chalk.gray('           Start a new chat session\n') +
    chalk.yellow('/save <name>') + chalk.gray('    Name the next generated image\n') +
    chalk.yellow('/list') +   chalk.gray('          List generated images\n') +
    chalk.yellow('/open') +   chalk.gray('          Open output folder in Explorer\n') +
    chalk.yellow('/quit') +   chalk.gray('          Exit the program\n\n') +
    chalk.bold('Examples:\n') +
    chalk.gray('  A futuristic city at sunset with neon lights\n') +
    chalk.gray('  Generate a logo for a tech startup called "Nova"\n') +
    chalk.gray('  Watercolor painting of a mountain lake at dawn'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
    }
  ));
}

// ── Start ────────────────────────────────────────────────────
prompt();
