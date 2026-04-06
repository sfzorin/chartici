import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML.substring(0, 500));
  console.log('ROOT HTML:', rootHtml);
  await browser.close();
})();
