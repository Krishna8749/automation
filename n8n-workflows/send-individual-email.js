import { GmailSender } from '../gmail-workflows/gmail-sender.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  
  let to = '';
  let cc = '';
  let subject = '';
  let bodyFilePath = '';

  args.forEach(arg => {
    if (arg.startsWith('--to=')) {
      to = arg.replace('--to=', '').trim();
    } else if (arg.startsWith('--cc=')) {
      cc = arg.replace('--cc=', '').trim();
    } else if (arg.startsWith('--subject=')) {
      subject = arg.replace('--subject=', '').trim();
    } else if (arg.startsWith('--bodyFile=')) {
      bodyFilePath = arg.replace('--bodyFile=', '').trim();
    }
  });

  if (!to || !subject || !bodyFilePath) {
    console.error('❌ Usage: node send-individual-email.js --to="email" [--cc="cc_email"] --subject="Subject" --bodyFile="path/to/body.html"');
    process.exit(1);
  }

  if (!fs.existsSync(bodyFilePath)) {
    console.error(`❌ Body HTML file not found: ${bodyFilePath}`);
    process.exit(1);
  }

  const bodyHtml = await fs.readFile(bodyFilePath, 'utf8');

  console.log(`📧 Launching Gmail sender to: ${to} (CC: ${cc || 'none'})...`);
  // Gmail must run in headful mode (headless: false) on Windows to ensure Google doesn't trigger security sign-out
  const gmailSender = new GmailSender({ headless: false });

  try {
    await gmailSender.launch();
    await gmailSender.sendEmail(to, subject, bodyHtml, cc || null);
    console.log('✅ Email sent successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    process.exit(1);
  } finally {
    await gmailSender.close();
  }
}

main();
