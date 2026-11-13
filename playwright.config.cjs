const { defineConfig, devices } = require('@playwright/test');
const localChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const inheritedProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxy = inheritedProxy ? { server: inheritedProxy, bypass: 'localhost,127.0.0.1,[::1]' } : undefined;
const chromium = {
  browserName: 'chromium',
  launchOptions: { ...(localChromium ? { executablePath: localChromium, args: ['--no-sandbox'] } : {}), ...(proxy ? { proxy } : {}) }
};
module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.cjs',
  timeout: 45000,
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10000 },
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:8765', locale: 'ru-RU', timezoneId: 'Europe/Moscow', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name:'iPhone WebKit', use: { ...devices['iPhone 13'], locale: 'ru-RU', timezoneId: 'Europe/Moscow', launchOptions: proxy ? { proxy } : {} } },
    { name:'Mobile Chrome 320', use: { ...chromium, viewport:{width:320,height:740}, isMobile:true, hasTouch:true } },
    { name:'Mobile Chrome 390', use: { ...chromium, viewport:{width:390,height:844}, isMobile:true, hasTouch:true } },
    { name:'Mobile Chrome 430', use: { ...chromium, viewport:{width:430,height:932}, isMobile:true, hasTouch:true } },
    { name:'Desktop Chrome', use: { ...devices['Desktop Chrome'], ...chromium, viewport:{width:1440,height:960} } }
  ],
  webServer: process.env.BASE_URL ? undefined : { command:'node scripts/dev-server.mjs', env:{PORT:'8765',BIND_HOST:'127.0.0.1',NODE_ENV:'test',DEV_OAUTH:'1'},
    url:'http://127.0.0.1:8765', reuseExistingServer:!process.env.CI, timeout:30000 },
  reporter: [['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
  outputDir:'test-results'
});
