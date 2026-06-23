import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const linkedIn = new LinkedInPoster({
  cookiesFile: path.join(__dirname, 'linkedin-cookies.json'),
  headless: true
});

const title = "Lucknow Aliganj Fire Incident: A Wake-Up Call for Smart Safety Systems";
const body = `A tragic fire incident in Aliganj, Lucknow has once again highlighted how vulnerable our urban infrastructure still is. Multiple lives were lost in a commercial coaching/library building, raising serious questions about safety compliance and enforcement.

But beyond the tragedy, there is a deeper lesson for the tech community.

💡 What this teaches us:
In 2026, safety cannot depend only on manual inspections. We need:
- AI-based building safety monitoring systems
- Real-time fire alert & evacuation tech
- Digital compliance tracking for public spaces
- Data-driven risk mapping for cities

👨‍💻 Role of Developers & Tech Teams:
As web and app developers, we are no longer just building products—we are building life-impacting systems.
This is where AI + Web + IoT can transform governance:
- Faster detection
- Smarter response
- Better accountability

🚀 Final Thought:
Every such incident is a reminder that “smart cities” must also mean safe cities powered by intelligent systems.
Technology alone won’t prevent disasters—but it can significantly reduce them when used responsibly.`;

try {
  console.log('🚀 Triggering test post for article...');
  await linkedIn.launch();
  await linkedIn.verifyLogin();
  await linkedIn.post({
    imagePath: null,
    title: title,
    caption: body,
    target: 'personal',
    type: 'article'
  });
  console.log('🎉 Article posted successfully!');
} catch (err) {
  console.error('❌ Article post failed:', err.stack || err.message);
} finally {
  await linkedIn.close();
}
