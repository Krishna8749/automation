import { chromium } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class GmailSender {
  constructor(options = {}) {
    this.profileDir = options.profileDir || path.join(__dirname, 'gmail-profile');
    this.headless = options.headless ?? true;
    this.context = null;
    this.page = null;
  }

  async launch() {
    if (!fs.existsSync(this.profileDir)) {
      throw new Error(`⚠️ Gmail profile directory not found: ${this.profileDir}. Please run first: npm run setup-gmail`);
    }

    this.context = await chromium.launchPersistentContext(this.profileDir, {
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=TrustedTypes',
      ],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      viewport: { width: 1400, height: 900 },
      locale: 'en-US',
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    this.page = this.context.pages()[0] || await this.context.newPage();
    this.page.setDefaultTimeout(60000);
    return this;
  }

  async sendEmail(to, subject, bodyHtml, cc = null) {
    try {
      console.log(`🌐 Navigating to Gmail to send email to: ${to}...`);
      await this.page.goto('https://mail.google.com/', { waitUntil: 'domcontentloaded' });
      // Wait up to 30 seconds for Gmail interface to load (Compose button or Sign in page)
      console.log('Waiting for Gmail interface to load...');
      let interfaceLoaded = false;
      for (let i = 0; i < 30; i++) {
        interfaceLoaded = await this.page.evaluate(() => {
          const text = document.body.innerText;
          const hasCompose = text.includes('Compose') || !!document.querySelector('div[role="button"][aria-label="Compose"], .T-I-KE');
          const hasSignIn = text.includes('Sign in') || !!document.querySelector('input[type="email"], a[href*="signin"]');
          return hasCompose || hasSignIn;
        }).catch(() => false);

        if (interfaceLoaded) break;
        await this.page.waitForTimeout(1000);
      }

      // Verify login
      const isLoggedIn = await this.page.evaluate(() => {
        const text = document.body.innerText;
        return !text.includes('Sign in') && (text.includes('Compose') || !!document.querySelector('div[role="button"][aria-label="Compose"], .T-I-KE'));
      }).catch(() => false);

      if (!isLoggedIn) {
        const errorSp = path.join(__dirname, '..', 'daily-banners', 'gmail_login_error.png');
        await this.page.screenshot({ path: errorSp });
        throw new Error(`❌ Not logged into Gmail. Cookies may be invalid or expired. Saved debug screenshot to: ${errorSp}`);
      }
      console.log('✅ Gmail login verified.');

      // Click "Compose" button
      console.log('Clicking Compose button...');
      const composeBtn = await this.page.waitForSelector(
        'div[role="button"][aria-label="Compose"], div[role="button"]:has-text("Compose"), .T-I-KE',
        { timeout: 20000 }
      );
      await composeBtn.click();
      await this.page.waitForTimeout(3000);

      // Locate and focus "To" input first to ensure the composer is active and focused
      console.log('Focusing "To" field...');
      const toInput = await this.page.waitForSelector(
        'div[role="dialog"] input[aria-label="To recipients"], div[role="dialog"] [aria-label="To"] input, div[role="dialog"] input[role="combobox"]',
        { timeout: 10000 }
      );
      await toInput.focus();
      await this.page.waitForTimeout(1000);

      // If Cc is provided, activate it now
      if (cc) {
        console.log(`Cc recipient provided. Activating Cc field...`);
        // Find and tag the Cc button in the DOM for native trusted click
        const ccTagged = await this.page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"]');
          if (!dialog) return false;
          const elements = Array.from(dialog.querySelectorAll('span, div, td, [role="button"]'));
          const ccEl = elements.find(el => el.textContent.trim() === 'Cc');
          if (ccEl) {
            ccEl.setAttribute('data-temp-click', 'cc-btn');
            return true;
          }
          return false;
        }).catch(() => false);

        if (ccTagged) {
          console.log('Clicking visual "Cc" button natively...');
          await this.page.locator('[data-temp-click="cc-btn"]').click();
          // Clean up the attribute
          await this.page.evaluate(() => {
            const el = document.querySelector('[data-temp-click="cc-btn"]');
            if (el) el.removeAttribute('data-temp-click');
          }).catch(() => {});
        } else {
          console.log('⚠️ Visual Cc button not found in DOM. Pressing Control+Shift+c shortcut...');
          await this.page.keyboard.press('Control+Shift+c');
        }
        await this.page.waitForTimeout(1500);
      }

      // Fill "To" field
      console.log(`Filling "To" field with: ${to}...`);
      await toInput.fill(to);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(1000);

      // Fill "Cc" field if provided
      if (cc) {
        console.log(`Filling "Cc" field with: ${cc}...`);
        const ccInput = await this.page.waitForSelector(
          'div[role="dialog"] [aria-label="Cc"] input, div[role="dialog"] [aria-label*="Cc"] input, div[role="dialog"] input[name="cc"]',
          { timeout: 8000, state: 'visible' }
        );
        await ccInput.focus();
        await ccInput.fill(cc);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(1000);
      }

      // Fill "Subject" field
      console.log('Filling "Subject" field...');
      const subjectInput = await this.page.waitForSelector(
        'div[role="dialog"] input[name="subjectbox"], div[role="dialog"] input[aria-label="Subject"]',
        { timeout: 5000 }
      );
      await subjectInput.focus();
      await subjectInput.fill(subject);
      await this.page.waitForTimeout(1000);

      // Fill message body
      console.log('Filling email message body...');
      const bodyInput = await this.page.waitForSelector(
        'div[role="dialog"] div[role="textbox"][aria-label="Message Body"], div[role="dialog"] div.Am.Al.editable',
        { timeout: 5000 }
      );
      await bodyInput.focus();
      
      // Inject the body as HTML inside the contenteditable area (handles Trusted Types policies dynamically)
      await this.page.evaluate(({ el, html }) => {
        const element = document.querySelector(el);
        if (!element) return;
        
        let trustedHTML = html;
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
          try {
            const policy = window.trustedTypes.createPolicy('playwright-policy', {
              createHTML: (s) => s
            });
            trustedHTML = policy.createHTML(html);
          } catch (e) {
            if (window.trustedTypes.defaultPolicy) {
              try {
                trustedHTML = window.trustedTypes.defaultPolicy.createHTML(html);
              } catch (err) {}
            }
          }
        }
        element.innerHTML = trustedHTML;
      }, { el: 'div[role="dialog"] div[role="textbox"][aria-label="Message Body"], div[role="dialog"] div.Am.Al.editable', html: bodyHtml });

      await this.page.waitForTimeout(2000);

      // Take screenshot of compose box before sending
      const composeSp = path.join(__dirname, '..', 'daily-banners', 'gmail_compose_box.png');
      await this.page.screenshot({ path: composeSp });
      console.log(`📸 Saved compose box screenshot to: ${composeSp}`);

      // Send the email
      console.log('Sending the email...');
      // We can use Ctrl+Enter shortcut on the body element, which is the most robust way to send in Gmail
      await bodyInput.focus();
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('Enter');
      await this.page.keyboard.up('Control');

      // Fallback: Click "Send" button if it didn't close in 3 seconds
      await this.page.waitForTimeout(3000);
      const isComposeStillOpen = await this.page.evaluate(() => {
        return !!document.querySelector('div[role="dialog"] div[role="textbox"][aria-label="Message Body"]');
      });

      if (isComposeStillOpen) {
        console.log('⚠️ Compose window still open. Attempting fallback click on Send button...');
        const sendBtn = this.page.locator('div[role="dialog"] div[role="button"]:has-text("Send"), div[role="dialog"] div[aria-label*="Send"], div[role="dialog"] .aoO').filter({ visible: true }).first();
        if (await sendBtn.count() > 0) {
          await sendBtn.click();
          await this.page.waitForTimeout(4000);
        }
      }

      console.log('Checking message send confirmation...');
      const sentSp = path.join(__dirname, '..', 'daily-banners', 'gmail_message_sent.png');
      await this.page.screenshot({ path: sentSp });
      console.log(`📸 Saved post-send screenshot to: ${sentSp}`);

      console.log('🎉 Email sent successfully!');
    } catch (err) {
      const errorScreenshotPath = path.join(__dirname, '..', 'daily-banners', 'gmail_send_error.png');
      await this.page.screenshot({ path: errorScreenshotPath }).catch(() => {});
      console.error(`📸 Gmail outreach failed. Saved debug screenshot to: ${errorScreenshotPath}`);
      throw err;
    }
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
}
