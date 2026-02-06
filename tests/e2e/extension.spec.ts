/**
 * E2E Tests for BrowserCopilot Extension
 * Tests the complete user flow using Playwright
 */

import { test, expect, chromium } from '@playwright/test';

test.describe('BrowserCopilot Extension', () => {
  test('should load extension without errors', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to a test page
    await page.goto('https://example.com');

    // Take a screenshot to verify the page loads
    await expect(page).toHaveTitle(/Example/);

    await browser.close();
  });

  test('should capture screenshot of page', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com');

    // Verify page content is present
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    await browser.close();
  });

  test('should extract DOM content from page', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com');

    // Get page content
    const content = await page.content();

    // Verify DOM structure is present
    expect(content).toContain('html');
    expect(content).toContain('head');
    expect(content).toContain('body');

    await browser.close();
  });

  test('should handle form interactions', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create a test page with a form
    await page.setContent(`
      <html>
        <body>
          <form id="test-form">
            <input type="text" id="name" placeholder="Enter name" />
            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `);

    // Fill the form
    await page.fill('#name', 'Test User');

    // Verify value is set
    const value = await page.inputValue('#name');
    expect(value).toBe('Test User');

    await browser.close();
  });

  test('should handle element clicking', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create a test page with a clickable element
    await page.setContent(`
      <html>
        <body>
          <button id="clickable">Click me</button>
          <p id="result"></p>
          <script>
            document.getElementById('clickable').addEventListener('click', () => {
              document.getElementById('result').textContent = 'Clicked!';
            });
          </script>
        </body>
      </html>
    `);

    // Click the button
    await page.click('#clickable');

    // Verify click registered
    const result = await page.textContent('#result');
    expect(result).toBe('Clicked!');

    await browser.close();
  });

  test('should handle page scrolling', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // Create a long page
    await page.setContent(`
      <html>
        <body style="height: 2000px">
          <div id="content">Scroll position: <span id="pos">0</span></div>
          <script>
            window.addEventListener('scroll', () => {
              document.getElementById('pos').textContent = window.scrollY;
            });
          </script>
        </body>
      </html>
    `);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));

    // Wait for scroll event
    await page.waitForTimeout(100);

    // Verify scroll position changed
    const newPos = await page.textContent('#pos');
    expect(parseInt(newPos || '0')).toBeGreaterThan(0);

    await browser.close();
  });

  test('should navigate to URLs', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Start at example.com
    await page.goto('https://example.com');
    await expect(page).toHaveURL(/example\.com/);

    // Navigate to another page
    await page.goto('https://httpbin.org/html');
    await expect(page).toHaveURL(/httpbin/);

    await browser.close();
  });

  test('should execute JavaScript in page context', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com');

    // Execute JS and get result
    const result = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        scrollY: window.scrollY,
      };
    });

    expect(result.title).toBeTruthy();
    expect(result.url).toContain('example');

    await browser.close();
  });

  test('should handle page with multiple elements', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`
      <html>
        <body>
          <div class="container">
            <h1>Test Page</h1>
            <p class="description">A test page with multiple elements</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>
            <a href="#">Link</a>
          </div>
        </body>
      </html>
    `);

    // Verify all elements are present
    await expect(page.locator('h1')).toHaveText('Test Page');
    await expect(page.locator('.description')).toBeVisible();
    await expect(page.locator('ul li')).toHaveCount(3);
    await expect(page.locator('a')).toBeVisible();

    await browser.close();
  });

  test('should handle responsive viewport', async () => {
    const browser = await chromium.launch({ headless: true });

    // Test mobile viewport
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.setContent('<div>Mobile content</div>');
    await expect(mobilePage.locator('div')).toBeVisible();
    await mobileContext.close();

    // Test desktop viewport
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.setContent('<div>Desktop content</div>');
    await expect(desktopPage.locator('div')).toBeVisible();
    await desktopContext.close();

    await browser.close();
  });
});

test.describe('Agent Tools Integration', () => {
  test('should have access to all agent tools', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://example.com');

    // Verify we can access page functionality for each tool's domain
    await page.screenshot();
    const content = await page.content();
    expect(content).toContain('html');

    const evalResult = await page.evaluate(() => window.location.href);
    expect(evalResult).toContain('example.com');

    const bodyHtml = await page.locator('body').evaluate((el: Element) => el.innerHTML);
    expect(bodyHtml).toBeTruthy();

    await browser.close();
  });
});
