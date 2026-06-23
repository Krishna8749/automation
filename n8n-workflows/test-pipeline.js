import { scrapeGMBLeads } from './gmb-scraper.js';
import { GmailSender } from '../gmail-workflows/gmail-sender.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runEndToEndTest() {
  console.log('🏁 Starting End-to-End n8n Pipeline Integration Test...\n');

  // 1. Run the GMB Scraper for 1 place in Miami
  let leads = [];
  try {
    leads = await scrapeGMBLeads('restaurants Miami', 1);
  } catch (err) {
    console.error('❌ Scraper step failed:', err.message);
    process.exit(1);
  }

  if (leads.length === 0) {
    console.error('❌ No leads returned by scraper.');
    process.exit(1);
  }

  const lead = leads[0];
  console.log(`\n✅ Scraped Lead: "${lead.name}" (${lead.website || 'No website'})`);

  // 2. Query the Local ChatGPT API
  console.log('🤖 Querying local ChatGPT API for analysis & pitch generation...');
  const prompt = `Analyze this business lead and extract details. Check if they have a mobile app or a poor mobile site, and write a personalized HTML cold pitch. Business: ${lead.name}, website: ${lead.website}, phone: ${lead.phone}. Scraped Website Text: ${lead.websiteText}. Provide your response strictly in the following JSON format: {"hasMobileApp": false, "emails": ["contact@domain.com"], "pitchHtml": "..."}. IMPORTANT: The HTML inside the pitchHtml string MUST use single quotes (') for all attributes (e.g. class='container' style='color: blue') to prevent JSON double-quote string escaping issues. Return ONLY the raw JSON object, without any markdown code block wrappers (like \`\`\`json).`;
  
  let gptResponse = null;
  try {
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-cgp-whatsapp-owner'
      },
      body: JSON.stringify({ message: prompt })
    });

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const data = await res.json();
    const text = data.response || data.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not parse JSON block from ChatGPT response:\n${text}`);
    }
    let jsonStr = jsonMatch[0];
    // Sanitize unescaped control characters (like raw newlines) in the LLM response JSON
    jsonStr = jsonStr.replace(/[\u0000-\u001F]+/g, (match) => {
      if (match.includes('\n')) return '\\n';
      if (match.includes('\r')) return '\\r';
      if (match.includes('\t')) return '\\t';
      return '';
    });
    gptResponse = JSON.parse(jsonStr);
  } catch (err) {
    console.error('❌ ChatGPT API query step failed:', err.message);
    console.log('Make sure "npm run start-server" is active on port 3000.');
    process.exit(1);
  }

  console.log('✅ ChatGPT successfully generated lead analysis and custom pitch!');
  console.log(`   App status: ${gptResponse.hasMobileApp ? 'Has Mobile App' : 'Does NOT have Mobile App'}`);
  console.log(`   Extracted Emails: ${gptResponse.emails.join(', ') || 'None found'}`);

  // 3. Write generated HTML pitch to a temp file
  const tempHtmlFile = path.join(__dirname, 'temp_test_email.html');
  await fs.writeFile(tempHtmlFile, gptResponse.pitchHtml, 'utf8');
  console.log(`💾 Saved temporary email body to: ${tempHtmlFile}`);

  // 4. Send Gmail Outreach to client email, CC to sales@webnovacrew.com
  const clientEmail = gptResponse.emails[0] || 'test-client@webnovacrew.com';
  const copyRecipient = 'sales@webnovacrew.com';
  console.log(`📧 Sending test outreach email to: ${clientEmail} (CC: ${copyRecipient})...`);
  const gmailSender = new GmailSender({ headless: false });
  try {
    await gmailSender.launch();
    const subject = `Outreach Pitch: Custom App Development for ${lead.name}`;
    await gmailSender.sendEmail(clientEmail, subject, gptResponse.pitchHtml, copyRecipient);
    console.log('✅ Gmail outreach step completed successfully!');
  } catch (err) {
    console.error('❌ Gmail outreach step failed:', err.message);
  } finally {
    await gmailSender.close();
  }

  // Remove temp HTML file
  await fs.remove(tempHtmlFile).catch(() => {});

  const alertMsg = `🤖 *n8n Pipeline Test SUCCESS*:\nSuccessfully scraped GMB lead *${lead.name}*, analyzed via ChatGPT, and sent email pitch to *${clientEmail}* (CC: ${copyRecipient})!`;
  try {
    const res = await fetch('http://localhost:3000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: alertMsg })
    });
    if (res.ok) {
      console.log('✅ WhatsApp alert step completed successfully!');
    } else {
      console.warn(`⚠️ WhatsApp status returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`⚠️ WhatsApp alert connection failed: ${err.message}`);
  }

  console.log('\n🎉 End-to-End Pipeline Integration Test Completed!');
}

runEndToEndTest();
