const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  await p.goto('file://' + process.argv[2]);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.locator('#banner').screenshot({ path: process.argv[3] });
  await b.close();
})();
