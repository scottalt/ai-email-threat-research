import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function capture() {
  const browser = await chromium.launch();

  // 512px icon
  const page512 = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page512.goto(`file://${resolve(__dirname, 'icon-template.html')}`, { waitUntil: 'networkidle' });
  await page512.waitForTimeout(2000);
  await page512.screenshot({
    path: resolve(__dirname, '..', 'public', 'icons', 'icon-512.png'),
    type: 'png',
    omitBackground: true,
  });
  console.log('Saved icon-512.png');
  await page512.close();

  // 192px icon — dedicated template sized for 192
  const page192 = await browser.newPage({ viewport: { width: 192, height: 192 } });
  await page192.goto(`file://${resolve(__dirname, 'icon-192-template.html')}`, { waitUntil: 'networkidle' });
  await page192.waitForTimeout(2000);
  await page192.screenshot({
    path: resolve(__dirname, '..', 'public', 'icons', 'icon-192.png'),
    type: 'png',
    omitBackground: true,
  });
  console.log('Saved icon-192.png');
  await page192.close();

  await browser.close();
  console.log('Done!');
}

capture().catch(console.error);
