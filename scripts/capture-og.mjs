import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function capture() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport to exact OG image size
  await page.setViewportSize({ width: 1200, height: 630 });

  // Load the template
  const templatePath = resolve(__dirname, 'og-template.html');
  await page.goto(`file://${templatePath}`, { waitUntil: 'networkidle' });

  // Wait for fonts to load
  await page.waitForTimeout(2000);

  // Capture OG image
  const ogPath = resolve(__dirname, '..', 'public', 'og-image.png');
  await page.screenshot({ path: ogPath, type: 'png' });
  console.log(`OG image saved: ${ogPath}`);

  await browser.close();
  console.log('Done!');
}

capture().catch(console.error);
