import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const imagePath = path.join(__dirname, 'daily-banners', 'daily_banner_2026-06-22_2026-06-22T22-26-31.png');
const topic = 'Agentic AI & App Automation';
const caption = `🚀 Agentic AI & App Automation

In the digital world, staying ahead means continuously learning and adapting. At Web Nova Crew Technologies, we are leveraging the power of Agentic AI and MCP to build next-generation automated web and mobile applications that optimize business operations and drive real outcomes.

What's your take on Agentic AI and automated workflows? Let's discuss in the comments! 👇

#WebDevelopment #AgenticAI #AI #Automation #AppDevelopment #WebNovaCrew #WebNovaCrewTechnologies`;

const linkedIn = new LinkedInPoster({
  cookiesFile: path.join(__dirname, 'linkedin-cookies.json'),
  headless: true,
  slowMo: 0,
});

try {
  console.log('🚀 Launching LinkedIn poster...');
  await linkedIn.launch();
  console.log('🔐 Verifying login...');
  await linkedIn.verifyLogin();
  console.log('📤 Posting banner...');
  await linkedIn.post(imagePath, topic, caption);
  console.log('🎉 LinkedIn post completed successfully!');
} catch (err) {
  console.error('❌ LinkedIn posting failed:', err.message);
} finally {
  await linkedIn.close();
}
