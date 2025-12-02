import { test, expect } from '@playwright/test';

/**
 * Registration Journey E2E Tests
 * Complete end-to-end registration flows through the UI
 */

test.describe('Registration Form UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('REG-E2E-001: Registration page loads correctly', async ({ page }) => {
    // Verify page title or heading
    await expect(page.locator('h1, h2, .title').first()).toBeVisible();

    // Verify form elements are present
    await expect(page.locator('input[name="first_name"], input[id="first_name"], #firstName')).toBeVisible();
    await expect(page.locator('input[name="last_name"], input[id="last_name"], #lastName')).toBeVisible();
    await expect(page.locator('input[name="email"], input[id="email"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode')).toBeVisible();

    // Verify submit button
    await expect(page.locator('button[type="submit"], input[type="submit"], .submit-btn')).toBeVisible();
  });

  test('REG-E2E-002: Form shows validation errors for empty fields', async ({ page }) => {
    // Submit empty form
    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    // Wait for validation
    await page.waitForTimeout(500);

    // Should show validation errors (either HTML5 or custom)
    const errorVisible = await page.locator('.error, .invalid, [class*="error"]').first().isVisible()
      .catch(() => false);

    // Or check for required attribute validation
    const firstNameInput = page.locator('input[name="first_name"], input[id="first_name"], #firstName');
    const isInvalid = await firstNameInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
      .catch(() => false);

    expect(errorVisible || isInvalid).toBe(true);
  });

  test('REG-E2E-003: Form shows error for invalid email', async ({ page }) => {
    // Fill form with invalid email
    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('Test');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('User');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill('invalid-email');
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill('TEST123');

    // Submit form
    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    await page.waitForTimeout(500);

    // Should show email validation error
    const emailInput = page.locator('input[name="email"], input[id="email"], input[type="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
      .catch(() => false);

    const errorVisible = await page.locator('.error, .invalid, [class*="error"]').first().isVisible()
      .catch(() => false);

    expect(isInvalid || errorVisible).toBe(true);
  });

  test('REG-E2E-004: Form shows error for invalid invite code', async ({ page }) => {
    const timestamp = Date.now();

    // Fill form with invalid invite code
    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('Test');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('User');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill(`test-${timestamp}@test.vettid.dev`);
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill('INVALID-CODE-12345');

    // Submit form
    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    // Wait for API response
    await page.waitForTimeout(2000);

    // Should show error message about invalid invite
    const errorMessage = await page.locator('.error, .error-message, [class*="error"], .alert-danger')
      .first().textContent()
      .catch(() => '');

    expect(errorMessage?.toLowerCase()).toMatch(/invite|invalid|code/i);
  });

  test('REG-E2E-005: Successful registration with valid data', async ({ page }) => {
    const inviteCode = process.env.TEST_INVITE_CODE;
    if (!inviteCode) {
      test.skip();
      return;
    }

    const timestamp = Date.now();

    // Fill form with valid data
    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('Test');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('User');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill(`test-${timestamp}@test.vettid.dev`);
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill(inviteCode);

    // Submit form
    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    // Wait for response
    await page.waitForTimeout(3000);

    // Should show success message or redirect
    const successVisible = await page.locator('.success, .success-message, [class*="success"], .alert-success')
      .first().isVisible()
      .catch(() => false);

    const redirected = page.url() !== `${process.env.BASE_URL}/register`;

    expect(successVisible || redirected).toBe(true);
  });

  test('REG-E2E-006: Duplicate email shows appropriate error', async ({ page }) => {
    const inviteCode = process.env.TEST_INVITE_CODE;
    const existingEmail = process.env.EXISTING_TEST_EMAIL;

    if (!inviteCode || !existingEmail) {
      test.skip();
      return;
    }

    // Fill form with existing email
    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('Test');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('User');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill(existingEmail);
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill(inviteCode);

    // Submit form
    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    // Wait for response
    await page.waitForTimeout(2000);

    // Should show duplicate email error
    const errorMessage = await page.locator('.error, .error-message, [class*="error"], .alert-danger')
      .first().textContent()
      .catch(() => '');

    expect(errorMessage?.toLowerCase()).toMatch(/already|exist|duplicate|registered/i);
  });
});

test.describe('Registration Flow Variations', () => {

  test('REG-E2E-007: Registration with auto-approve invite', async ({ page }) => {
    const autoApproveCode = process.env.AUTO_APPROVE_INVITE_CODE;
    if (!autoApproveCode) {
      test.skip();
      return;
    }

    await page.goto('/register');

    const timestamp = Date.now();

    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('Auto');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('Approved');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill(`auto-${timestamp}@test.vettid.dev`);
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill(autoApproveCode);

    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    await page.waitForTimeout(3000);

    // Should show auto-approved message or redirect to account
    const pageContent = await page.content();
    const hasAutoApproved = pageContent.toLowerCase().includes('approved') ||
                           pageContent.toLowerCase().includes('account') ||
                           page.url().includes('/account');

    expect(hasAutoApproved).toBe(true);
  });

  test('REG-E2E-008: International characters in names', async ({ page }) => {
    const inviteCode = process.env.TEST_INVITE_CODE;
    if (!inviteCode) {
      test.skip();
      return;
    }

    await page.goto('/register');

    const timestamp = Date.now();

    // Use international characters
    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('José');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('García');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill(`intl-${timestamp}@test.vettid.dev`);
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill(inviteCode);

    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    await page.waitForTimeout(3000);

    // Should either accept or show clear validation error
    const hasError = await page.locator('.error, [class*="error"]').first().isVisible().catch(() => false);
    const hasSuccess = await page.locator('.success, [class*="success"]').first().isVisible().catch(() => false);
    const redirected = !page.url().includes('/register');

    expect(hasError || hasSuccess || redirected).toBe(true);
  });
});

test.describe('Registration Page Accessibility', () => {

  test('REG-E2E-009: Form has proper labels', async ({ page }) => {
    await page.goto('/register');

    // Check for labels associated with inputs
    const inputs = ['first_name', 'last_name', 'email', 'invite_code'];

    for (const inputName of inputs) {
      const input = page.locator(`input[name="${inputName}"], input[id="${inputName}"]`);

      if (await input.count() > 0) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const hasLabel = id ? await page.locator(`label[for="${id}"]`).count() > 0 : false;

        expect(hasLabel || ariaLabel).toBeTruthy();
      }
    }
  });

  test('REG-E2E-010: Submit button is keyboard accessible', async ({ page }) => {
    await page.goto('/register');

    const submitButton = page.locator('button[type="submit"], input[type="submit"], .submit-btn');

    // Tab to submit button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Button should be focusable
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);

    expect(['BUTTON', 'INPUT']).toContain(focusedElement);
  });
});

test.describe('Registration Error Handling', () => {

  test('REG-E2E-011: Network error shows user-friendly message', async ({ page }) => {
    await page.goto('/register');

    // Intercept API calls and simulate failure
    await page.route('**/register', (route) => {
      route.abort('failed');
    });

    const timestamp = Date.now();

    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('Test');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('User');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill(`test-${timestamp}@test.vettid.dev`);
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill('TEST123');

    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    await page.waitForTimeout(2000);

    // Should show error message (not crash)
    const pageContent = await page.content();
    const hasError = pageContent.toLowerCase().includes('error') ||
                    pageContent.toLowerCase().includes('failed') ||
                    pageContent.toLowerCase().includes('try again');

    expect(hasError).toBe(true);
  });

  test('REG-E2E-012: Server error (500) shows user-friendly message', async ({ page }) => {
    await page.goto('/register');

    // Intercept and return 500
    await page.route('**/register', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    const timestamp = Date.now();

    await page.locator('input[name="first_name"], input[id="first_name"], #firstName').fill('Test');
    await page.locator('input[name="last_name"], input[id="last_name"], #lastName').fill('User');
    await page.locator('input[name="email"], input[id="email"], input[type="email"]').fill(`test-${timestamp}@test.vettid.dev`);
    await page.locator('input[name="invite_code"], input[id="invite_code"], #inviteCode').fill('TEST123');

    await page.locator('button[type="submit"], input[type="submit"], .submit-btn').click();

    await page.waitForTimeout(2000);

    // Should show error, not crash
    const hasError = await page.locator('.error, [class*="error"], .alert-danger').first().isVisible()
      .catch(() => false);

    expect(hasError).toBe(true);
  });
});
