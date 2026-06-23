// ─────────────────────────────────────────────────────────────
//  Daily Scheduler — runs the LinkedIn post pipeline on a cron
//  Usage: npm run schedule
//  Default: posts every day at 9:00 AM (configurable via .env)
// ─────────────────────────────────────────────────────────────

import cron   from 'node-cron';
import chalk  from 'chalk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────
// Set POST_TIME in .env as "HH:MM" (24h), e.g. POST_TIME=09:00
const POST_TIME = process.env.POST_TIME || '09:00';
const [hour, minute] = POST_TIME.split(':').map(Number);
const CRON_EXPR = `${minute} ${hour} * * *`;  // every day at POST_TIME

console.log(chalk.bold.blue('\n╔══════════════════════════════════════════════════════╗'));
console.log(chalk.bold.blue('║   ⏰  LinkedIn Daily Post Scheduler                  ║'));
console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════╝\n'));
console.log(chalk.gray('  Schedule:   ') + chalk.white(`Daily at ${POST_TIME}`));
console.log(chalk.gray('  Cron:       ') + chalk.white(CRON_EXPR));
console.log(chalk.gray('  Status:     ') + chalk.green('Running — waiting for next post time...'));
console.log(chalk.gray('\n  Tips:'));
console.log(chalk.gray('  • Change time: set POST_TIME=HH:MM in .env'));
console.log(chalk.gray('  • Post now:    npm run post-now'));
console.log(chalk.gray('  • Stop:        Ctrl+C\n'));

// ── Cron job ──────────────────────────────────────────────────
cron.schedule(CRON_EXPR, async () => {
  const now = new Date().toLocaleString();
  console.log(chalk.bold.cyan(`\n[${now}] 🚀 Starting daily post...\n`));

  try {
    // Dynamically import to get fresh module each run
    const { default: run } = await import(`./daily-post.js?t=${Date.now()}`);
    await run();
  } catch {
    // daily-post.js is not a default export — run it as a script
    const { execSync } = await import('child_process');
    try {
      execSync('node daily-post.js', {
        cwd: __dirname,
        stdio: 'inherit',
      });
    } catch (err) {
      console.error(chalk.red(`\n❌ Post failed: ${err.message}`));
    }
  }
}, {
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
});

// ── Next run preview ──────────────────────────────────────────
function showNextRun() {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const diff = next - now;
  const hh = Math.floor(diff / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);

  console.log(chalk.gray(`  Next post in: `) + chalk.yellow(`${hh}h ${mm}m`) + chalk.gray(` (at ${next.toLocaleString()})`));
}

showNextRun();

// Keep process alive
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Scheduler stopped.\n'));
  process.exit(0);
});
