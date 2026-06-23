import { LinkedInPoster } from './linkedin-poster.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const linkedIn = new LinkedInPoster({
  cookiesFile: path.join(__dirname, 'linkedin-cookies.json'),
  headless: true
});

try {
  await linkedIn.launch();
  await linkedIn.verifyLogin();
  console.log('🎉 LinkedIn login verified successfully!');
} catch (err) {
  console.error('❌ LinkedIn verification failed:', err.message);
} finally {
  await linkedIn.close();
}
