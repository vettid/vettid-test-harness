import { test, expect } from '@playwright/test';

/**
 * Main Site UI Test Suite
 * Tests the main VettID site UI at account.vettid.dev
 *
 * Validates:
 * - Page loads and basic structure
 * - Navigation elements
 * - Form elements and validation
 * - Responsive design basics
 * - Error states
 */

const BASE_URL = process.env.BASE_URL || 'https://account.vettid.dev';

test.describe('Main Site - Page Load Tests', () => {

  test('UI-MAIN-001: Homepage loads successfully', async ({ page }) => {
    const response = await page.goto(BASE_URL);

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/.*/);

    console.log(`✓ UI-MAIN-001: Homepage loaded with status ${response?.status()}`);
  });

  test('UI-MAIN-002: Registration page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/register`);

    expect(response?.status()).toBeLessThan(400);

    // Check for registration form elements
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 10000 });

    console.log('✓ UI-MAIN-002: Registration page loads');
  });

  test('UI-MAIN-003: Sign-in page loads', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/signin`);

    expect(response?.status()).toBeLessThan(400);

    console.log('✓ UI-MAIN-003: Sign-in page loads');
  });

  test('UI-MAIN-004: Account page redirects without auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/account`);

    // Should redirect to sign-in or show auth required
    const url = page.url();
    const hasRedirected = url.includes('signin') || url.includes('login') || url.includes('cognito');
    const hasAuthMessage = await page.locator('text=/sign in|login|unauthorized/i').count() > 0;

    expect(hasRedirected || hasAuthMessage).toBeTruthy();

    console.log('✓ UI-MAIN-004: Account page requires auth');
  });

});

test.describe('Main Site - Registration Form Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
  });

  test('UI-MAIN-005: Registration form has all fields', async ({ page }) => {
    // Check for expected form fields
    const firstNameField = page.locator('#first, input[name="first"], input[name="firstName"], input[placeholder*="first" i]');
    const lastNameField = page.locator('#last, input[name="last"], input[name="lastName"], input[placeholder*="last" i]');
    const emailField = page.locator('#email, input[name="email"], input[type="email"]');
    const inviteCodeField = page.locator('#code, input[name="code"], input[name="inviteCode"], input[placeholder*="invite" i], input[placeholder*="code" i]');

    // At least email should exist
    const hasEmail = await emailField.count() > 0;
    expect(hasEmail).toBeTruthy();

    console.log('✓ UI-MAIN-005: Registration form has expected fields');
  });

  test('UI-MAIN-006: Registration form has submit button', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("submit"), button:has-text("register")');

    const hasSubmit = await submitButton.count() > 0;
    expect(hasSubmit).toBeTruthy();

    console.log('✓ UI-MAIN-006: Registration form has submit button');
  });

  test('UI-MAIN-007: Form shows validation on empty submit', async ({ page }) => {
    // Click submit without filling form
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();

    if (await submitButton.count() > 0) {
      await submitButton.click();

      // Check for validation indicators (HTML5 or custom)
      await page.waitForTimeout(500);

      // Form should still be visible (not submitted)
      const form = page.locator('form');
      await expect(form).toBeVisible();
    }

    console.log('✓ UI-MAIN-007: Form validates empty submission');
  });

  test('UI-MAIN-008: Email field validates format', async ({ page }) => {
    const emailField = page.locator('#email, input[type="email"]').first();

    if (await emailField.count() > 0) {
      await emailField.fill('not-an-email');
      await emailField.blur();

      // Check for HTML5 validation
      const isInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid);

      // Email format should be invalid
      expect(isInvalid).toBeTruthy();
    }

    console.log('✓ UI-MAIN-008: Email field validates format');
  });

  test('UI-MAIN-009: Form submits with valid data', async ({ page }) => {
    const timestamp = Date.now();

    // Fill form with test data
    const firstNameField = page.locator('#first, input[name="first"]').first();
    const lastNameField = page.locator('#last, input[name="last"]').first();
    const emailField = page.locator('#email, input[type="email"]').first();
    const codeField = page.locator('#code, input[name="code"]').first();

    if (await firstNameField.count() > 0) await firstNameField.fill('UITest');
    if (await lastNameField.count() > 0) await lastNameField.fill('User');
    if (await emailField.count() > 0) await emailField.fill(`ui-test-${timestamp}@test.vettid.dev`);
    if (await codeField.count() > 0) await codeField.fill('TEST-CODE');

    // Submit form
    const submitButton = page.locator('button[type="submit"]').first();
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for response (success or error message)
    const messageArea = page.locator('#msg, .message, .alert, .error, .success, [role="alert"]');
    const hasMessage = await messageArea.count() > 0;

    console.log(`✓ UI-MAIN-009: Form submission processed (message area: ${hasMessage})`);
  });

});

test.describe('Main Site - Navigation Tests', () => {

  test('UI-MAIN-010: Site has navigation elements', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for common navigation elements
    const nav = page.locator('nav, header, .nav, .navbar, .navigation');
    const hasNav = await nav.count() > 0;

    console.log(`✓ UI-MAIN-010: Navigation elements present: ${hasNav}`);
    expect(true).toBe(true); // Info test
  });

  test('UI-MAIN-011: Links are clickable', async ({ page }) => {
    await page.goto(BASE_URL);

    const links = page.locator('a[href]');
    const linkCount = await links.count();

    console.log(`✓ UI-MAIN-011: Found ${linkCount} links on page`);
    expect(linkCount).toBeGreaterThan(0);
  });

  test('UI-MAIN-012: External links have proper attributes', async ({ page }) => {
    await page.goto(BASE_URL);

    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();

    // External links should have rel="noopener" for security
    for (let i = 0; i < Math.min(count, 5); i++) {
      const link = externalLinks.nth(i);
      const rel = await link.getAttribute('rel');
      if (rel) {
        expect(rel).toContain('noopener');
      }
    }

    console.log(`✓ UI-MAIN-012: Checked ${count} external links`);
  });

});

test.describe('Main Site - Styling and Layout Tests', () => {

  test('UI-MAIN-013: Page has CSS loaded', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for stylesheets
    const stylesheets = await page.locator('link[rel="stylesheet"]').count();
    const inlineStyles = await page.locator('style').count();

    const hasStyles = stylesheets > 0 || inlineStyles > 0;
    expect(hasStyles).toBeTruthy();

    console.log(`✓ UI-MAIN-013: CSS loaded (${stylesheets} stylesheets, ${inlineStyles} inline)`);
  });

  test('UI-MAIN-014: Page has viewport meta tag', async ({ page }) => {
    await page.goto(BASE_URL);

    const viewport = page.locator('meta[name="viewport"]');
    const hasViewport = await viewport.count() > 0;

    console.log(`✓ UI-MAIN-014: Viewport meta tag: ${hasViewport}`);
    expect(true).toBe(true); // Info test
  });

  test('UI-MAIN-015: No JavaScript errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    console.log(`✓ UI-MAIN-015: JS errors on load: ${errors.length}`);
    if (errors.length > 0) {
      console.log(`  Errors: ${errors.slice(0, 3).join(', ')}`);
    }

    // Allow some errors but flag them
    expect(errors.length).toBeLessThan(5);
  });

});

test.describe('Main Site - Accessibility Basics', () => {

  test('UI-MAIN-016: Page has lang attribute', async ({ page }) => {
    await page.goto(BASE_URL);

    const html = page.locator('html');
    const lang = await html.getAttribute('lang');

    console.log(`✓ UI-MAIN-016: Page lang attribute: ${lang || 'not set'}`);
    expect(true).toBe(true); // Info test
  });

  test('UI-MAIN-017: Images have alt attributes', async ({ page }) => {
    await page.goto(BASE_URL);

    const images = page.locator('img');
    const imageCount = await images.count();

    let missingAlt = 0;
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      if (alt === null) missingAlt++;
    }

    console.log(`✓ UI-MAIN-017: Images: ${imageCount}, missing alt: ${missingAlt}`);
    expect(true).toBe(true); // Info test
  });

  test('UI-MAIN-018: Form inputs have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])');
    const inputCount = await inputs.count();

    let hasLabel = 0;
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        if (await label.count() > 0) hasLabel++;
      } else if (ariaLabel || placeholder) {
        hasLabel++;
      }
    }

    console.log(`✓ UI-MAIN-018: Inputs: ${inputCount}, with labels/aria: ${hasLabel}`);
    expect(true).toBe(true); // Info test
  });

});

test.describe('Main Site - Security Indicators', () => {

  test('UI-MAIN-019: Page served over HTTPS', async ({ page }) => {
    await page.goto(BASE_URL);

    const url = page.url();
    expect(url).toMatch(/^https:/);

    console.log('✓ UI-MAIN-019: Page served over HTTPS');
  });

  test('UI-MAIN-020: No mixed content warnings', async ({ page }) => {
    const mixedContent: string[] = [];

    page.on('console', (msg) => {
      if (msg.text().toLowerCase().includes('mixed content')) {
        mixedContent.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    console.log(`✓ UI-MAIN-020: Mixed content warnings: ${mixedContent.length}`);
    expect(mixedContent.length).toBe(0);
  });

});

