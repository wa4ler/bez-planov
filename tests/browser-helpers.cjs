const { expect } = require('@playwright/test');
const { randomBytes } = require('node:crypto');

// Each isolated local browser represents a different client. Apply the address at
// context level so the complete simulated-provider redirect chain inherits it.
// A route override only sees the initial navigation and misses later redirects.
async function isolateLocalClient(context, baseURL) {
  const origin = new URL(baseURL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) return;
  const groups = randomBytes(12).toString('hex').match(/.{4}/g);
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': '2001:db8:' + groups.join(':') });
  // Do not send the synthetic local-test address to public font/CDN requests.
  await context.route(url => ['http:', 'https:'].includes(url.protocol) && url.origin !== origin.origin, route => {
    const headers = route.request().headers(); delete headers['cf-connecting-ip'];
    return route.continue({ headers });
  });
}

function future(days = 10) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function expectNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document, 'Page must fit the viewport').toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function expectClickableCenter(locator) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const actual = document.elementFromPoint(x, y);
    return {
      target: element.id || element.textContent.trim().slice(0, 60),
      actual: actual?.id || actual?.closest('button,a')?.textContent.trim().slice(0, 60) || actual?.tagName,
      insideViewport: x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight,
      hit: actual === element || element.contains(actual)
    };
  });
  expect(hit, 'Visible action must receive the tap instead of a header/footer overlay').toMatchObject({ insideViewport: true, hit: true });
}

module.exports = { future, expectNoOverflow, expectClickableCenter, isolateLocalClient };
