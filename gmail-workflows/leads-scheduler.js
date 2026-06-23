import cron from 'node-cron';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runLeadsPipeline } from './daily-leads-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Config: Default to 8:00 AM daily
const RUN_TIME = process.env.LEADS_RUN_TIME || '08:00';
const [hour, minute] = RUN_TIME.split(':').map(Number);
const CRON_EXPR = `${minute} ${hour} * * *`;

console.log(chalk.bold.magenta('\n╔══════════════════════════════════════════════════════╗'));
console.log(chalk.bold.magenta('║   ⏰  Daily Leads Extraction & Dispatch Scheduler    ║'));
console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════╝\n'));
console.log(chalk.gray('  Schedule:   ') + chalk.white(`Daily at ${RUN_TIME}`));
console.log(chalk.gray('  Cron:       ') + chalk.white(CRON_EXPR));
console.log(chalk.gray('  Status:     ') + chalk.green('Running — waiting for next trigger...'));
console.log(chalk.gray('\n  Tips:'));
console.log(chalk.gray('  • Change time: set LEADS_RUN_TIME=HH:MM in .env'));
console.log(chalk.gray('  • Run manually: npm run leads-now\n'));

cron.schedule(CRON_EXPR, async () => {
  const now = new Date().toLocaleString();
  console.log(chalk.bold.magenta(`\n[${now}] ⚡ Triggering scheduled daily leads run...\n`));
  try {
    await runLeadsPipeline();
  } catch (err) {
    console.error(chalk.red(`❌ Daily leads runner failed: ${err.message}`));
  }
}, {
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
});

// Calculate next run time
function showNextRun() {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const diff = next - now;
  const hh = Math.floor(diff / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);

  console.log(chalk.gray(`  Next leads run in: `) + chalk.magenta(`${hh}h ${mm}m`) + chalk.gray(` (at ${next.toLocaleString()})`));
}

showNextRun();

// Keep alive
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Leads scheduler stopped.\n'));
  process.exit(0);
});
