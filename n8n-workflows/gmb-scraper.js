import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function scrapeGMBLeads(query, limit = 10) {
  console.log(`🔎 Starting GMB scraper for: "${query}" (limit: ${limit})`);
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1200, height: 800 },
    locale: 'en-US',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const results = [];

  try {
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    console.log(`🌐 Navigating to Google Maps: ${mapsUrl}`);
    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Scroll Sidebar to load results
    console.log('📜 Scrolling sidebar to load places...');
    const sidebarSelector = 'div[role="feed"]';
    const hasSidebar = await page.$(sidebarSelector);
    if (hasSidebar) {
      for (let i = 0; i < 4; i++) {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.scrollBy(0, 1000);
        }, sidebarSelector);
        await page.waitForTimeout(1500);
      }
    } else {
      console.log('⚠️ Sidebar div[role="feed"] not found. Proceeding with visible cards.');
    }

    // Find all place cards link elements
    const cardSelector = 'a[href*="/maps/place/"]';
    const placeLinks = await page.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel))
        .map(el => el.href)
        .filter((val, idx, self) => self.indexOf(val) === idx); // deduplicate
    }, cardSelector);

    console.log(`📌 Found ${placeLinks.length} potential business places.`);
    const targetLinks = placeLinks.slice(0, limit);

    for (let i = 0; i < targetLinks.length; i++) {
      const link = targetLinks[i];
      console.log(`\n👉 Inspecting place [${i + 1}/${targetLinks.length}]...`);
      
      try {
        await page.goto(link, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000);

        // Scrape place details
        const placeData = await page.evaluate(() => {
          const nameEl = document.querySelector('h1.DUwDvf, h1');
          const name = nameEl ? nameEl.innerText.trim() : '';

          const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
          const rating = ratingEl ? ratingEl.innerText.trim() : '';

          const websiteEl = document.querySelector('a[data-item-id="authority"]');
          const website = websiteEl ? websiteEl.href : '';

          const phoneEl = document.querySelector('button[data-item-id^="phone:tel:"]');
          const phone = phoneEl ? phoneEl.getAttribute('data-item-id').replace('phone:tel:', '').trim() : '';

          const addressEl = document.querySelector('button[data-item-id^="address"]');
          const address = addressEl ? addressEl.innerText.trim() : '';

          return { name, rating, website, phone, address };
        });

        if (!placeData.name) {
          console.log('⚠️ Could not extract place name, skipping.');
          continue;
        }

        console.log(`💼 Name: ${placeData.name}`);
        if (placeData.website) console.log(`🔗 Website: ${placeData.website}`);
        if (placeData.phone) console.log(`📞 Phone: ${placeData.phone}`);

        // If the place has a website, scrape its home/contact page for emails/content
        let websiteText = '';
        let foundEmails = [];
        let socialLinks = {};

        if (placeData.website) {
          console.log(`🕷️ Scraping website for email/content: ${placeData.website}`);
          try {
            const sitePage = await context.newPage();
            sitePage.setDefaultTimeout(15000);
            
            // Navigate to website homepage
            await sitePage.goto(placeData.website, { waitUntil: 'domcontentloaded' }).catch(() => {});
            await sitePage.waitForTimeout(3000);

            // Get body text and links
            const siteInfo = await sitePage.evaluate(() => {
              const bodyText = document.body ? document.body.innerText.substring(0, 1500) : '';
              const allLinks = Array.from(document.querySelectorAll('a')).map(l => l.href);
              
              // Simple regex for email extraction
              const text = document.body ? document.body.innerHTML : '';
              const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
              const emails = Array.from(new Set(text.match(emailRegex) || []));

              return { bodyText, allLinks, emails };
            }).catch(() => ({ bodyText: '', allLinks: [], emails: [] }));

            websiteText = siteInfo.bodyText;
            foundEmails = siteInfo.emails;

            // Try to find contact/about page to extract emails if homepage didn't have any or to get more context
            let origin = '';
            try {
              origin = new URL(placeData.website).origin;
            } catch (e) {}

            const contactLink = siteInfo.allLinks.find(l => {
              if (!l) return false;
              const urlLower = l.toLowerCase();
              const isInternal = origin ? l.startsWith(origin) : true;
              const isContactOrAbout = urlLower.includes('contact') || urlLower.includes('about') || urlLower.includes('info');
              return isInternal && isContactOrAbout;
            });

            if (contactLink && contactLink !== placeData.website) {
              console.log(`  🔍 Found potential contact/about link: ${contactLink}. Scraping it...`);
              try {
                await sitePage.goto(contactLink, { waitUntil: 'domcontentloaded' }).catch(() => {});
                await sitePage.waitForTimeout(3000);
                
                const contactInfo = await sitePage.evaluate(() => {
                  const bodyText = document.body ? document.body.innerText.substring(0, 1000) : '';
                  const text = document.body ? document.body.innerHTML : '';
                  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                  const emails = Array.from(new Set(text.match(emailRegex) || []));
                  return { bodyText, emails };
                }).catch(() => ({ bodyText: '', emails: [] }));

                foundEmails = Array.from(new Set([...foundEmails, ...contactInfo.emails]));
                if (contactInfo.bodyText) {
                  websiteText += '\n\n[Contact/About Page Content]:\n' + contactInfo.bodyText;
                }
              } catch (contactErr) {
                console.log(`  ⚠️ Failed to scrape contact page: ${contactErr.message}`);
              }
            }

            // Extract social links
            siteInfo.allLinks.forEach(link => {
              if (link && (link.includes('linkedin.com/company/') || link.includes('linkedin.com/in/'))) {
                socialLinks.linkedin = link;
              } else if (link && link.includes('facebook.com/')) {
                socialLinks.facebook = link;
              } else if (link && (link.includes('twitter.com/') || link.includes('x.com/'))) {
                socialLinks.twitter = link;
              } else if (link && link.includes('instagram.com/')) {
                socialLinks.instagram = link;
              }
            });

            await sitePage.close();
          } catch (siteErr) {
            console.log(`⚠️ Website scraping failed: ${siteErr.message}`);
          }
        }

        results.push({
          ...placeData,
          emails: foundEmails,
          socials: socialLinks,
          websiteText: websiteText.trim()
        });

      } catch (err) {
        console.log(`⚠️ Failed to parse place details: ${err.message}`);
      }
    }

  } finally {
    await browser.close();
  }

  return results;
}

// Execute directly if run via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const query = process.argv[2] || 'restaurants New York';
  const limit = parseInt(process.argv[3]) || 5;
  
  scrapeGMBLeads(query, limit)
    .then(leads => {
      console.log('\n================ OUTPUT RESULTS ================');
      console.log(JSON.stringify(leads, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Scraper failed:', err);
      process.exit(1);
    });
}
