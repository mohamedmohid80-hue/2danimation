const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2400, height: 1600 }, deviceScaleFactor: 1 });
  await p.goto('file://' + process.argv[2]);
  await p.evaluate(() => document.fonts.ready);
  for (const id of ['if','bulb','gear','question','spark','bolt']) {
    await p.locator('#' + id).screenshot({ path: `${process.argv[3]}/avatar_${id}.png` });
  }
  await b.close();
})();
