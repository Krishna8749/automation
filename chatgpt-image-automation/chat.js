// ─────────────────────────────────────────────────────────────
//  ChatGPT Chat CLI — have a real conversation via browser
//  Usage: node chat.js
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
const cookiesFile = path.join(__dirname, 'cookies.json');

// ── Banner ─────────────────────────────────────────────────────
console.clear();
console.log(boxen(
  chalk.bold.magenta('💬  ChatGPT Chat Mode') + '\n' +
  chalk.gray('   Real conversation via browser — no API key\n') +
  chalk.yellow('   Type a message → get a reply\n') +
  chalk.gray('   /image <prompt>  generate an image\n') +
  chalk.gray('   /new             start fresh chat\n') +
  chalk.gray('   /quit            exit'),
  {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'magenta',
  }
));

if (!fs.existsSync(cookiesFile)) {
  console.log(chalk.red('❌ No cookies! Run: npm run setup-cookies\n'));
  process.exit(1);
}

// ── Launch bot ─────────────────────────────────────────────────
const spinner = ora('Launching browser...').start();
const bot = new ChatGPTImageBot({
  cookiesFile,
  outputDir: path.join(__dirname, 'generated-images'),
  headless: true,
  slowMo: 0,
});

try {
  await bot.launch();
  await bot.navigate();
  spinner.succeed(chalk.green('Connected to ChatGPT! Start chatting below.\n'));
} catch (err) {
  spinner.fail(chalk.red('Failed: ' + err.message));
  await bot.close();
  process.exit(1);
}

// ── Chat history display ───────────────────────────────────────
const history = [];

function printMessage(role, text) {
  if (role === 'user') {
    console.log('\n' + chalk.bold.cyan('You:'));
    console.log(chalk.white('  ' + text.split('\n').join('\n  ')));
  } else {
    console.log('\n' + chalk.bold.green('ChatGPT:'));
    // Word-wrap and colorize the response
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) {
        console.log(chalk.bold.yellow('  ' + line));
      } else if (line.startsWith('```')) {
        console.log(chalk.gray('  ' + line));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        console.log(chalk.white('  ' + line));
      } else if (/^\d+\./.test(line)) {
        console.log(chalk.white('  ' + line));
      } else {
        console.log(chalk.white('  ' + line));
      }
    }
    console.log('');
  }
}

// ── Input loop ─────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });

const prompt = () => {
  rl.question(chalk.bold.cyan('\n💬 You: '), handleInput);
};

async function handleInput(input) {
  input = input.trim();
  if (!input) { prompt(); return; }

  // ── Commands ──────────────────────────────────────────────────
  if (input.startsWith('/')) {
    const [cmd, ...args] = input.slice(1).split(' ');
    const arg = args.join(' ').trim();

    switch (cmd.toLowerCase()) {
      case 'quit':
      case 'exit':
      case 'q':
        console.log(chalk.yellow('\n👋 Bye!\n'));
        rl.close();
        await bot.close();
        process.exit(0);

      case 'new':
        const ns = ora('Starting new chat...').start();
        await bot.newChat();
        history.length = 0;
        ns.succeed(chalk.green('New chat started!'));
        break;

      case 'image':
        if (!arg) {
          console.log(chalk.red('  Usage: /image <your prompt>'));
          break;
        }
        console.log(chalk.gray(`\n  🎨 Generating image: "${arg}"`));
        const imgSpinner = ora({ text: 'Generating...', spinner: 'dots12' }).start();
        try {
          const result = await bot.generateImage(arg);
          imgSpinner.succeed(chalk.green('Image saved!'));
          console.log(chalk.gray('  📁 ' + result.savedPath));
        } catch (err) {
          imgSpinner.fail(chalk.red('Failed: ' + err.message));
        }
        break;

      case 'history':
        if (!history.length) { console.log(chalk.gray('  No history yet.')); break; }
        history.forEach(h => printMessage(h.role, h.text));
        break;

      case 'help':
        console.log(boxen(
          chalk.bold.cyan('Commands:\n\n') +
          chalk.yellow('/new') + chalk.gray('             Start fresh conversation\n') +
          chalk.yellow('/image <prompt>') + chalk.gray('  Generate an image\n') +
          chalk.yellow('/history') + chalk.gray('         Show conversation history\n') +
          chalk.yellow('/quit') + chalk.gray('            Exit\n\n') +
          chalk.bold('Tips:\n') +
          chalk.gray('  Just type normally to chat\n') +
          chalk.gray('  Use /image to switch to image generation'),
          { padding: 1, borderStyle: 'round', borderColor: 'yellow' }
        ));
        break;

      default:
        console.log(chalk.red(`  Unknown command: /${cmd}. Type /help`));
    }

    prompt();
    return;
  }

  // ── Send chat message ─────────────────────────────────────────
  history.push({ role: 'user', text: input });

  const thinkSpinner = ora({
    text: chalk.gray('ChatGPT is thinking...'),
    spinner: 'dots',
    color: 'green',
  }).start();

  try {
    const reply = await bot.chat(input);

    thinkSpinner.stop();

    if (!reply) {
      console.log(chalk.red('  ⚠ No response received. Try /new to reset.'));
    } else {
      history.push({ role: 'assistant', text: reply });
      printMessage('assistant', reply);
    }

  } catch (err) {
    thinkSpinner.stop();
    console.log(chalk.red('  ❌ Error: ' + err.message));
  }

  prompt();
}

prompt();
