// ─────────────────────────────────────────────────────────────
//  Banner Image Generator — uses Pollinations.AI (FREE, no API key)
//  Generates professional LinkedIn banners without ChatGPT
// ─────────────────────────────────────────────────────────────

import https from 'https';
import http  from 'http';
import fs    from 'fs-extra';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Models available on Pollinations.AI ───────────────────────
// flux        → best quality, photorealistic
// turbo       → fast generation
// flux-realism → very photorealistic
const MODEL = 'flux';

export class BannerGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(__dirname, 'daily-banners');
    this.width     = options.width     || 1536;   // LinkedIn banner: wide
    this.height    = options.height    || 864;    // 16:9
    this.model     = options.model     || MODEL;
  }

  /**
   * Generate a banner image from a text prompt.
   * Returns the path to the saved PNG file.
   */
  async generate(prompt, saveAs = null) {
    await fs.ensureDir(this.outputDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const slug      = (saveAs || prompt.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')).toLowerCase();
    const filename  = `${slug}_${timestamp}.png`;
    const filePath  = path.join(this.outputDir, filename);

    console.log(`\n🎨 Generating banner via Pollinations.AI...`);
    console.log(`   Prompt: "${prompt.slice(0, 80)}..."`);

    // Build the Pollinations URL
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${this.width}&height=${this.height}&model=${this.model}&nologo=true&enhance=true&seed=${Date.now()}`;

    console.log(`   URL: ${url.slice(0, 100)}...`);

    await this._download(url, filePath);

    console.log(`✅ Banner saved: ${filePath}`);
    return filePath;
  }

  /**
   * Download an image from URL to disk.
   * Follows redirects (Pollinations returns 302 → actual CDN image).
   */
  _download(url, dest, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));

      const client = url.startsWith('https') ? https : http;

      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/png,image/webp,image/*',
        },
        timeout: 120000,   // 2 min timeout — generation can take time
      }, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          req.destroy();
          return resolve(this._download(res.headers.location, dest, redirectCount + 1));
        }

        if (res.statusCode !== 200) {
          req.destroy();
          return reject(new Error(`HTTP ${res.statusCode} from image API`));
        }

        const contentType = res.headers['content-type'] || '';
        if (!contentType.includes('image')) {
          req.destroy();
          return reject(new Error(`Expected image, got: ${contentType}`));
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
        file.on('error', (err) => {
          fs.unlink(dest).catch(() => {});
          reject(err);
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out waiting for image'));
      });
    });
  }
}

// ── CLI usage: node banner-generator.js "your prompt here" ────
const isMain = path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const prompt = process.argv[2];
  if (!prompt) {
    console.error('Usage: node banner-generator.js "your prompt here"');
    process.exit(1);
  }

  const gen = new BannerGenerator();
  try {
    const p = await gen.generate(prompt);
    console.log('Done:', p);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}
