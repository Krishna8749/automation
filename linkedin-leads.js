import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class LinkedInLeads {
  constructor(options = {}) {
    this.cookiesFile  = options.cookiesFile  || path.join(__dirname, 'linkedin-cookies.json');
    this.headless     = options.headless     ?? true;
    this.slowMo       = options.slowMo       ?? 0;
    this.pageTimeout  = options.pageTimeout  || 60000;
    this.browser      = null;
    this.context      = null;
    this.page         = null;
  }

  async launch() {
    this.browser = await chromium.launch({
      headless: this.headless,
      slowMo:   this.slowMo,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1400, height: 900 },
      locale: 'en-US',
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    if (!fs.existsSync(this.cookiesFile)) {
      throw new Error(`LinkedIn cookies not found: ${this.cookiesFile}`);
    }
    const raw = await fs.readJson(this.cookiesFile);
    await this.context.addCookies(raw);
    
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.pageTimeout);
    return this;
  }

  async searchLeads(keyword) {
    console.log(`🔍 Searching LinkedIn for leads matching: "${keyword}"...`);
    const encodedKeyword = encodeURIComponent(keyword);
    // Search posts/content sorted by date or relevance
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodedKeyword}&origin=GLOBAL_SEARCH_HEADER`;
    
    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(5000); // Wait for results to load

    // Scroll down to load a few posts
    await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await this.page.waitForTimeout(2000);

    // Scrape posts
    const leads = await this.page.evaluate(() => {
      const results = [];
      // Select post containers
      const postElements = document.querySelectorAll('.feed-shared-update-v2');
      
      for (let i = 0; i < Math.min(postElements.length, 5); i++) {
        const el = postElements[i];
        
        // Extract Name
        const nameEl = el.querySelector('.update-components-actor__name, .feed-shared-actor__name');
        const name = nameEl ? nameEl.innerText.trim() : 'Unknown';

        // Extract Headline
        const headlineEl = el.querySelector('.update-components-actor__description, .feed-shared-actor__description');
        const headline = headlineEl ? headlineEl.innerText.trim() : '';

        // Extract URL
        const linkEl = el.querySelector('.update-components-actor__container-link, .app-aware-link');
        const profileUrl = linkEl ? linkEl.href.split('?')[0] : '';

        // Extract Post Text
        const textEl = el.querySelector('.update-components-text, .feed-shared-update-v2__commentary');
        const text = textEl ? textEl.innerText.trim() : '';

        if (name && text) {
          results.push({ name, headline, profileUrl, text: text.substring(0, 150) + '...' });
        }
      }
      return results;
    });

    console.log(`✅ Found ${leads.length} leads.`);
    return leads;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page    = null;
    }
  }
}
