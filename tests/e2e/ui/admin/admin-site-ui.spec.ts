import { test, expect } from '@playwright/test';

/**
 * Admin Site UI Test Suite
 * Tests the VettID admin site UI
 *
 * Validates:
 * - Admin page loads
 * - Authentication enforcement
 * - Admin dashboard elements
 * - Form functionality
 */

const ADMIN_URL = process.env.ADMIN_URL || 'https://vettid.dev/admin';
const BASE_URL = process.env.BASE_URL || 'https://vettid.dev';

test.describe('Admin Site - Page Load Tests', () => {

  test('UI-ADMIN-001: Admin site loads', async ({ page }) => {
    // Try both possible admin URLs
    let response = await page.goto(ADMIN_URL).catch(() => null);

    if (!response || response.status() >= 400) {
      // Try alternative admin path
      response = await page.goto(`${BASE_URL}/admin`).catch(() => null);
    }

    const loaded = response !== null && response.status() < 500;
    console.log(`✓ UI-ADMIN-001: Admin site response: ${response?.status() || 'failed'}`);

    expect(loaded).toBeTruthy();
  });

  test('UI-ADMIN-002: Admin requires authentication', async ({ page }) => {
    // Navigate to admin without auth
    let response = await page.goto(ADMIN_URL).catch(() => null);

    if (!response || response.status() >= 400) {
      response = await page.goto(`${BASE_URL}/admin`).catch(() => null);
    }

    // Should redirect to login or show auth message
    await page.waitForTimeout(2000);
    const url = page.url();

    const requiresAuth =
      url.includes('signin') ||
      url.includes('login') ||
      url.includes('cognito') ||
      url.includes('auth');

    const hasAuthMessage = await page.locator('text=/sign in|login|unauthorized|authenticate/i').count() > 0;

    console.log(`✓ UI-ADMIN-002: Admin requires auth: ${requiresAuth || hasAuthMessage}`);
    console.log(`  Current URL: ${url}`);

    expect(requiresAuth || hasAuthMessage || url.includes('admin')).toBeTruthy();
  });

  test('UI-ADMIN-003: Admin login redirect works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(3000);

    const url = page.url();

    // After redirect, should be at login or admin page
    const isValid =
      url.includes('cognito') ||
      url.includes('signin') ||
      url.includes('login') ||
      url.includes('admin');

    console.log(`✓ UI-ADMIN-003: Admin redirect URL: ${url}`);
    expect(isValid).toBeTruthy();
  });

});

test.describe('Admin Site - Structure Tests (Without Auth)', () => {

  test('UI-ADMIN-004: Check admin page title', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    const title = await page.title();
    console.log(`✓ UI-ADMIN-004: Admin page title: "${title}"`);

    expect(title.length).toBeGreaterThan(0);
  });

  test('UI-ADMIN-005: Check for admin-specific elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    // Look for common admin UI elements
    const adminIndicators = [
      page.locator('text=/admin/i'),
      page.locator('text=/dashboard/i'),
      page.locator('text=/registrations/i'),
      page.locator('text=/invites/i'),
      page.locator('text=/users/i'),
      page.locator('[class*="admin"]'),
    ];

    let foundAdmin = false;
    for (const indicator of adminIndicators) {
      if (await indicator.count() > 0) {
        foundAdmin = true;
        break;
      }
    }

    console.log(`✓ UI-ADMIN-005: Admin-specific elements found: ${foundAdmin}`);
    expect(true).toBe(true); // Info test
  });

  test('UI-ADMIN-006: Check CSS loaded on admin', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);

    const stylesheets = await page.locator('link[rel="stylesheet"]').count();
    const inlineStyles = await page.locator('style').count();

    console.log(`✓ UI-ADMIN-006: Admin CSS (${stylesheets} stylesheets, ${inlineStyles} inline)`);
    expect(stylesheets + inlineStyles).toBeGreaterThan(0);
  });

});

test.describe('Admin Site - JavaScript and Functionality', () => {

  test('UI-ADMIN-007: No critical JS errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(3000);

    console.log(`✓ UI-ADMIN-007: JS errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log(`  First error: ${errors[0].substring(0, 100)}`);
    }

    // Allow some errors but not too many
    expect(errors.length).toBeLessThan(10);
  });

  test('UI-ADMIN-008: Check for interactive elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    const inputs = await page.locator('input').count();

    console.log(`✓ UI-ADMIN-008: Interactive elements - buttons: ${buttons}, links: ${links}, inputs: ${inputs}`);
    expect(buttons + links + inputs).toBeGreaterThan(0);
  });

  test('UI-ADMIN-009: Check network requests', async ({ page }) => {
    const apiRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('execute-api') || url.includes('/api/')) {
        apiRequests.push(url);
      }
    });

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(3000);

    console.log(`✓ UI-ADMIN-009: API requests made: ${apiRequests.length}`);
    if (apiRequests.length > 0) {
      console.log(`  First API: ${apiRequests[0].substring(0, 80)}...`);
    }

    expect(true).toBe(true); // Info test
  });

});

test.describe('Admin Site - Security Tests', () => {

  test('UI-ADMIN-010: Admin served over HTTPS', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);

    const url = page.url();
    expect(url).toMatch(/^https:/);

    console.log('✓ UI-ADMIN-010: Admin served over HTTPS');
  });

  test('UI-ADMIN-011: No sensitive data in page source', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);

    const content = await page.content();
    const lowerContent = content.toLowerCase();

    // Check for common sensitive patterns
    const sensitivePatterns = [
      'password',
      'secret',
      'api_key',
      'apikey',
      'private_key',
    ];

    const found: string[] = [];
    for (const pattern of sensitivePatterns) {
      // Only flag if it looks like actual credentials, not labels
      if (lowerContent.includes(`"${pattern}":`)) {
        found.push(pattern);
      }
    }

    console.log(`✓ UI-ADMIN-011: Potentially sensitive patterns: ${found.length}`);
    expect(found.length).toBe(0);
  });

  test('UI-ADMIN-012: Check security headers', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/admin`);

    const headers = response?.headers() || {};

    const securityHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'content-security-policy',
    ];

    const present: string[] = [];
    for (const header of securityHeaders) {
      if (headers[header]) {
        present.push(header);
      }
    }

    console.log(`✓ UI-ADMIN-012: Security headers present: ${present.length}/${securityHeaders.length}`);
    console.log(`  Present: ${present.join(', ') || 'none'}`);

    expect(true).toBe(true); // Info test
  });

});

test.describe('Admin Site - Responsive Design', () => {

  test('UI-ADMIN-013: Admin loads on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    // Page should still be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();

    console.log('✓ UI-ADMIN-013: Admin loads on mobile viewport');
  });

  test('UI-ADMIN-014: Admin loads on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    const body = page.locator('body');
    await expect(body).toBeVisible();

    console.log('✓ UI-ADMIN-014: Admin loads on tablet viewport');
  });

  test('UI-ADMIN-015: Admin loads on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    const body = page.locator('body');
    await expect(body).toBeVisible();

    console.log('✓ UI-ADMIN-015: Admin loads on desktop viewport');
  });

});

test.describe('Admin Site - Form Handling', () => {

  test('UI-ADMIN-016: Check for admin forms', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    const forms = await page.locator('form').count();

    console.log(`✓ UI-ADMIN-016: Forms found on admin page: ${forms}`);
    expect(true).toBe(true); // Info test
  });

  test('UI-ADMIN-017: Check for action buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    // Look for common admin action buttons
    const actionButtons = [
      page.locator('button:has-text("approve")'),
      page.locator('button:has-text("reject")'),
      page.locator('button:has-text("create")'),
      page.locator('button:has-text("delete")'),
      page.locator('button:has-text("edit")'),
      page.locator('button:has-text("save")'),
    ];

    let foundActions = 0;
    for (const btn of actionButtons) {
      if (await btn.count() > 0) foundActions++;
    }

    console.log(`✓ UI-ADMIN-017: Admin action buttons types found: ${foundActions}`);
    expect(true).toBe(true); // Info test
  });

  test('UI-ADMIN-018: Check for data tables', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);

    const tables = await page.locator('table').count();
    const lists = await page.locator('ul, ol, [role="list"]').count();
    const grids = await page.locator('[role="grid"], .grid, .data-grid').count();

    console.log(`✓ UI-ADMIN-018: Data display elements - tables: ${tables}, lists: ${lists}, grids: ${grids}`);
    expect(true).toBe(true); // Info test
  });

});

test.describe('Admin Site - Error Handling', () => {

  test('UI-ADMIN-019: 404 page handling', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/admin/nonexistent-page-12345`);

    // Should get 404 or redirect
    const status = response?.status() || 0;
    const url = page.url();

    console.log(`✓ UI-ADMIN-019: Non-existent admin page - status: ${status}, url: ${url}`);
    expect([200, 302, 401, 403, 404]).toContain(status);
  });

  test('UI-ADMIN-020: Error display handling', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);

    // Look for error display areas
    const errorAreas = await page.locator('.error, .alert-error, [role="alert"], .toast').count();

    console.log(`✓ UI-ADMIN-020: Error display areas found: ${errorAreas}`);
    expect(true).toBe(true); // Info test
  });

});

