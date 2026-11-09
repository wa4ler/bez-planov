const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 10000 },
  use: { baseURL: 'http://127.0.0.1:8765', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name:'iPhone WebKit', use: { ...devices['iPhone 13'] } },
    { name:'Desktop Chrome', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: { command:'python3 -m http.server 8765 --bind 127.0.0.1',
    url:'http://127.0.0.1:8765', reuseExistingServer:!process.env.CI, timeout:30000 },
  reporter: [['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
  outputDir:'test-results'
});
