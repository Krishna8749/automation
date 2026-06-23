import { extractLeadsDetailed } from './leads-extractor-detailed.js';
import { GmailSender } from './gmail-sender.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const RECIPIENT_EMAIL = process.env.LEADS_RECIPIENT_EMAIL || 'sateesh@webnovacrew.com';
const WHATSAPP_NUMBER = process.env.WHATSAPP_RECIPIENT_NUMBER || null; // Will fallback to owner self

export async function runLeadsPipeline() {
  const nowStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  console.log(`\n==================================================`);
  console.log(`🚀 Starting Daily Leads Pipeline: ${nowStr}`);
  console.log(`==================================================\n`);

  let leads = [];
  try {
    leads = await extractLeadsDetailed('app development', 10);
  } catch (err) {
    console.error('❌ Failed to extract leads from LinkedIn:', err.message);
    return;
  }

  if (leads.length === 0) {
    console.log('⚠️ No leads found today. Skipping notifications.');
    return;
  }

  // 1. Format Plain Text Report for WhatsApp
  let textReport = `📊 *DAILY LINKEDIN LEADS REPORT*\n📅 _${nowStr}_\n🔍 *Keyword:* "app development"\n\n`;
  leads.forEach((l, i) => {
    textReport += `${i + 1}. *${l.name}*\n`;
    if (l.headline) textReport += `💼 ${l.headline}\n`;
    textReport += `🔗 ${l.profileUrl}\n`;
    textReport += `🕒 ${l.time || 'N/A'} | 👍 ${l.likes} | 💬 ${l.comments}\n`;
    textReport += `📝 _"${l.text.replace(/\n/g, ' ').substring(0, 150)}..."_\n\n`;
  });
  textReport += `🤖 _Automated by Web Nova Crew Leads Engine_`;

  // 2. Format HTML Report for Email (Premium Styling)
  let htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily LinkedIn Leads Report</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f3f4f6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 650px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%);
      color: #ffffff;
      padding: 30px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 5px 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      margin: 0;
      opacity: 0.85;
      font-size: 14px;
    }
    .meta-tag {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.2);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      margin-top: 10px;
      font-weight: 600;
    }
    .content {
      padding: 24px;
    }
    .lead-card {
      background-color: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
      transition: transform 0.2s ease;
    }
    .lead-header {
      margin-bottom: 10px;
    }
    .lead-name {
      font-size: 16px;
      font-weight: 700;
      color: #4f46e5;
      text-decoration: none;
    }
    .lead-name:hover {
      text-decoration: underline;
    }
    .lead-headline {
      font-size: 13px;
      color: #4b5563;
      margin-top: 2px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    .badge {
      font-size: 11px;
      background-color: #e0e7ff;
      color: #3730a3;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .badge-time {
      background-color: #f3f4f6;
      color: #4b5563;
    }
    .lead-text {
      font-size: 13px;
      line-height: 1.5;
      color: #374151;
      background-color: #ffffff;
      padding: 10px 14px;
      border-left: 3px solid #818cf8;
      border-radius: 0 6px 6px 0;
      margin: 0;
      font-style: italic;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
    }
    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Daily Leads Report</h1>
      <p>${nowStr}</p>
      <div class="meta-tag">Keyword: "app development"</div>
    </div>
    <div class="content">
  `;

  leads.forEach((l) => {
    htmlReport += `
      <div class="lead-card">
        <div class="lead-header">
          <a class="lead-name" href="${l.profileUrl}" target="_blank">${l.name}</a>
          <div class="lead-headline">${l.headline || 'LinkedIn User'}</div>
        </div>
        <div class="badges">
          <span class="badge badge-time">${l.time || 'Recent'}</span>
          <span class="badge">👍 ${l.likes} Likes</span>
          <span class="badge">💬 ${l.comments} Comments</span>
        </div>
        <p class="lead-text">"${l.text.replace(/\n/g, '<br>')}"</p>
      </div>
    `;
  });

  htmlReport += `
    </div>
    <div class="footer">
      This leads report was automatically compiled and sent by <a href="https://webnovacrew.com" target="_blank">Web Nova Crew Automation Engine</a>.
    </div>
  </div>
</body>
</html>
  `;

  // 3. Dispatch WhatsApp Notification via local Server API
  console.log('📱 Sending report via WhatsApp...');
  try {
    const response = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: WHATSAPP_NUMBER,
        message: textReport
      })
    });
    
    if (response.ok) {
      console.log('✅ WhatsApp message sent successfully.');
    } else {
      const errRes = await response.json().catch(() => ({}));
      console.warn(`⚠️ WhatsApp send API returned status ${response.status}:`, errRes.error || 'Unknown error');
    }
  } catch (err) {
    console.warn(`⚠️ Failed to connect to WhatsApp API endpoint: ${err.message}. (Make sure chat-server is running on port 3000)`);
  }

  // 4. Dispatch Email Report via Playwright Gmail Sender
  console.log('📧 Sending report via Gmail...');
  const gmailSender = new GmailSender({ headless: false });
  try {
    await gmailSender.launch();
    const subject = `Daily App Development Leads Report - ${new Date().toLocaleDateString()}`;
    await gmailSender.sendEmail(RECIPIENT_EMAIL, subject, htmlReport);
    console.log('✅ Email report sent successfully.');
  } catch (err) {
    console.error('❌ Failed to send email report:', err.message);
  } finally {
    await gmailSender.close();
  }

  console.log(`\n==================================================`);
  console.log(`🎉 Daily Leads Pipeline Completed!`);
  console.log(`==================================================\n`);
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLeadsPipeline();
}
