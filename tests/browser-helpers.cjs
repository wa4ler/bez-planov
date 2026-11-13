const { expect } = require('@playwright/test');

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

module.exports = { future, expectNoOverflow, expectClickableCenter };
