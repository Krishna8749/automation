// ─────────────────────────────────────────────────────────────
//  Daily LinkedIn Banner Post Pipeline
//  1. ChatGPT generates today's banner image (headless)
//  2. LinkedIn posts the image + title (headless)
//  Run: npm run post-now
//  Run: npm run post-now "Custom Topic Here"
// ─────────────────────────────────────────────────────────────

import { ChatGPTImageBot } from './chatgpt-image-automation/bot.js';
import { LinkedInPoster }  from './linkedin-poster.js';
import chalk   from 'chalk';
import ora     from 'ora';
import fs      from 'fs-extra';
import path    from 'path';
import dotenv  from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────
const CONFIG = {
  chatgptCookies:  path.join(__dirname, 'chatgpt-image-automation', 'cookies.json'),
  linkedinCookies: path.join(__dirname, 'linkedin-cookies.json'),
  outputDir:       path.join(__dirname, 'daily-banners'),
  topic:           process.env.DAILY_TOPIC || null,
};

// ── Daily topics pool (auto-rotated by day) ───────────────────
const TOPICS = [
  'Building Scalable Web Apps in 2026: The Tech Stack We Use at Web Nova Crew',
  'How to Publish Your First Android App on the Google Play Store',
  'Flutter vs React Native: Choosing the Right Mobile Framework for Your Startup',
  'Why Custom SaaS Solutions Beat Off-the-Shelf Software for Modern Businesses',
  'The Power of Clean Code: How Technical Debt Destroys Startups',
  'UI/UX Design Secrets that Boost App User Retention by 40%',
  'Integrating AI Agents into Your Existing App Workflow: Where to Start',
  'Why Having a Mobile App is Crucial for E-Commerce Growth in 2026',
  'How Cloud-Native Serverless Architectures Save Hosting Costs for Startups',
  'The Role of API-First Architecture in Modern Software Development',
];

// ── Main Pipeline ─────────────────────────────────────────────
export default async function run(customTopic = null) {
  console.log(chalk.bold.magenta('\n╔══════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║   🚀  Daily LinkedIn Banner Post Pipeline            ║'));
  console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════╝\n'));

  await fs.ensureDir(CONFIG.outputDir);

  // ── Step 1: Pick today's topic ─────────────────────────────
  const topic = customTopic || CONFIG.topic || pickDailyTopic();
  console.log(chalk.bold('📅 Today\'s topic: ') + chalk.cyan(topic));

  const imagePrompt = buildImagePrompt(topic);
  const caption     = buildCaption(topic);

  console.log(chalk.gray(`\n🎨 Image prompt: "${imagePrompt.slice(0, 80)}..."`));

  // ── Step 2: Generate banner with ChatGPT (headless) ────────
  let imagePath;
  const imgSpinner = ora({
    text: 'Generating banner image with ChatGPT (headless)...',
    spinner: 'dots12',
    color: 'cyan',
  }).start();

  const chatgptBot = new ChatGPTImageBot({
    cookiesFile: CONFIG.chatgptCookies,
    outputDir:   CONFIG.outputDir,
    headless:    true,
    slowMo:      0,
  });

  try {
    await chatgptBot.launch();
    await chatgptBot.navigate();

    const result = await chatgptBot.generateImage(imagePrompt, {
      saveAs: `daily_banner_${dateSlug()}`,
    });

    imagePath = result.savedPath;
    imgSpinner.succeed(chalk.green(`Banner generated: ${path.basename(imagePath)}`));

  } catch (err) {
    imgSpinner.fail(chalk.red('Image generation failed: ' + err.message));
    throw err;
  } finally {
    await chatgptBot.close();
  }

  // ── Step 3: Post to LinkedIn (headless) ────────────────────
  const postSpinner = ora({
    text: 'Posting to LinkedIn (headless)...',
    spinner: 'dots12',
    color: 'blue',
  }).start();

  const linkedIn = new LinkedInPoster({
    cookiesFile: CONFIG.linkedinCookies,
    headless:    true,
    slowMo:      0,
  });

  try {
    await linkedIn.launch();
    await linkedIn.verifyLogin();
    await linkedIn.post(imagePath, topic, caption);
    postSpinner.succeed(chalk.green('Posted to LinkedIn! 🎉'));

  } catch (err) {
    postSpinner.fail(chalk.red('LinkedIn post failed: ' + err.message));
    throw err;
  } finally {
    await linkedIn.close();
  }

  // ── Summary ────────────────────────────────────────────────
  console.log(chalk.bold.green('\n✅ Daily Post Complete!\n'));
  console.log(chalk.gray('  Topic:  ') + chalk.white(topic));
  console.log(chalk.gray('  Image:  ') + chalk.white(imagePath));
  console.log(chalk.gray('  Time:   ') + chalk.white(new Date().toLocaleString()));
  console.log('');

  return { topic, imagePath, caption };
}

// ── Helpers ───────────────────────────────────────────────────
function pickDailyTopic() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return TOPICS[dayOfYear % TOPICS.length];
}

function buildImagePrompt(topic) {
  // Keep it simple, natural, and aesthetic so ChatGPT generates high-quality visual banner without text issues
  return (
    `A modern, high-tech professional LinkedIn banner. ` +
    `Theme: "${topic}". ` +
    `Minimalist style, futuristic tech background with clean glowing neon cyan and dark indigo gradients, subtle abstract circuits or digital network nodes. ` +
    `Include the clean professional text "Web Nova Crew Technologies" as a small, elegant brand signature at the bottom or corner. ` +
    `16:9 aspect ratio, premium digital art, cinematic lighting, sleek UI elements.`
  );
}

function buildCaption(topic) {
  const emojis = ['🚀', '💡', '🎯', '⚡', '🔥', '✨', '📈', '💻'];
  const emoji  = emojis[Math.floor(Math.random() * emojis.length)];
  return (
    `${emoji} ${topic}\n\n` +
    `At Web Nova Crew Technologies, we specialize in crafting high-performance web applications, cross-platform mobile apps, and robust SaaS solutions. We bring ideas to life with clean code and cutting-edge tech.\n\n` +
    `What's your perspective on this? Let's discuss in the comments below! 👇\n\n` +
    `#WebNovaCrew #SoftwareDevelopment #TechInnovation #AppDevelopment #WebDevelopment #Coding #StartupGrowth #SaaS`
  );
}

function dateSlug() {
  return new Date().toISOString().slice(0, 10);
}

// ── Run directly ───────────────────────────────────────────────
const nodePath   = path.resolve(process.argv[1]);
const modulePath = path.resolve(fileURLToPath(import.meta.url));

if (nodePath === modulePath) {
  const customTopic = process.argv[2] || null;
  try {
    await run(customTopic);
  } catch (err) {
    console.error(chalk.red('\n❌ Pipeline failed: ' + err.message));
    process.exit(1);
  }
}
