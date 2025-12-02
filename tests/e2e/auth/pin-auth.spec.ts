import { test, expect } from '@playwright/test';

/**
 * PIN Authentication E2E Tests
 * Tests PIN enable, disable, update, and verification flows through UI
 */

test.describe('PIN Management UI', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to account page (requires authentication)
    // This assumes the user is already logged in via fixture or setup
    await page.goto('/account');
  });

  test('PIN-E2E-001: Security tab shows PIN settings', async ({ page }) => {
    // Navigate to security tab
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    // Should show PIN status section
    await expect(page.locator('[class*="pin"], #pin-section, .security-section').first()).toBeVisible();
  });

  test('PIN-E2E-002: Enable PIN modal opens', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    // Click enable PIN button
    const enableButton = page.locator('button:has-text("Enable PIN"), button:has-text("Enable"), .enable-pin-btn');

    if (await enableButton.isVisible()) {
      await enableButton.click();

      await page.waitForTimeout(500);

      // Modal should appear
      const modal = page.locator('.modal, [role="dialog"], .pin-modal');
      await expect(modal).toBeVisible();

      // Should have PIN input
      await expect(page.locator('input[type="password"], input[name="pin"], #pin-input')).toBeVisible();
    } else {
      // PIN might already be enabled
      test.skip();
    }
  });

  test('PIN-E2E-003: Enable PIN with valid 4-digit PIN', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const enableButton = page.locator('button:has-text("Enable PIN"), button:has-text("Enable"), .enable-pin-btn');

    if (await enableButton.isVisible()) {
      await enableButton.click();

      await page.waitForTimeout(500);

      // Enter PIN
      await page.locator('input[name="pin"], input[id="pin"], #pin-input').first().fill('1234');

      // Confirm PIN if there's a confirmation field
      const confirmInput = page.locator('input[name="pin_confirm"], input[id="confirm-pin"], #confirm-pin');
      if (await confirmInput.isVisible()) {
        await confirmInput.fill('1234');
      }

      // Submit
      await page.locator('button:has-text("Enable"), button:has-text("Save"), button:has-text("Submit")').last().click();

      await page.waitForTimeout(2000);

      // Should show success or PIN enabled state
      const hasSuccess = await page.locator('.success, [class*="success"]').first().isVisible().catch(() => false);
      const statusText = await page.locator('.pin-status, [class*="pin"]').first().textContent().catch(() => '');

      expect(hasSuccess || statusText?.toLowerCase().includes('enabled')).toBe(true);
    } else {
      test.skip();
    }
  });

  test('PIN-E2E-004: Enable PIN rejects 3-digit PIN', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const enableButton = page.locator('button:has-text("Enable PIN"), .enable-pin-btn');

    if (await enableButton.isVisible()) {
      await enableButton.click();

      await page.waitForTimeout(500);

      // Enter too-short PIN
      await page.locator('input[name="pin"], input[id="pin"], #pin-input').first().fill('123');

      // Submit
      await page.locator('button:has-text("Enable"), button:has-text("Save")').last().click();

      await page.waitForTimeout(1000);

      // Should show error
      const hasError = await page.locator('.error, [class*="error"], .invalid-feedback').first().isVisible()
        .catch(() => false);

      expect(hasError).toBe(true);
    } else {
      test.skip();
    }
  });

  test('PIN-E2E-005: Enable PIN rejects 7-digit PIN', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const enableButton = page.locator('button:has-text("Enable PIN"), .enable-pin-btn');

    if (await enableButton.isVisible()) {
      await enableButton.click();

      await page.waitForTimeout(500);

      // Enter too-long PIN
      await page.locator('input[name="pin"], input[id="pin"], #pin-input').first().fill('1234567');

      // Submit
      await page.locator('button:has-text("Enable"), button:has-text("Save")').last().click();

      await page.waitForTimeout(1000);

      // Should show error
      const hasError = await page.locator('.error, [class*="error"], .invalid-feedback').first().isVisible()
        .catch(() => false);

      expect(hasError).toBe(true);
    } else {
      test.skip();
    }
  });

  test('PIN-E2E-006: Enable PIN rejects non-numeric input', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const enableButton = page.locator('button:has-text("Enable PIN"), .enable-pin-btn');

    if (await enableButton.isVisible()) {
      await enableButton.click();

      await page.waitForTimeout(500);

      // Enter non-numeric PIN
      const pinInput = page.locator('input[name="pin"], input[id="pin"], #pin-input').first();
      await pinInput.fill('abcd');

      // Input might filter to only numbers
      const inputValue = await pinInput.inputValue();

      // Either input is filtered or error is shown on submit
      if (inputValue === 'abcd') {
        await page.locator('button:has-text("Enable"), button:has-text("Save")').last().click();
        await page.waitForTimeout(1000);

        const hasError = await page.locator('.error, [class*="error"]').first().isVisible()
          .catch(() => false);
        expect(hasError).toBe(true);
      } else {
        // Input was filtered - good behavior
        expect(inputValue).not.toContain('a');
      }
    } else {
      test.skip();
    }
  });

  test('PIN-E2E-007: Disable PIN functionality', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const disableButton = page.locator('button:has-text("Disable PIN"), button:has-text("Disable"), .disable-pin-btn');

    if (await disableButton.isVisible()) {
      await disableButton.click();

      await page.waitForTimeout(1000);

      // May require confirmation
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await page.waitForTimeout(2000);

      // Should show success or PIN disabled state
      const hasSuccess = await page.locator('.success, [class*="success"]').first().isVisible().catch(() => false);
      const enableButton = page.locator('button:has-text("Enable PIN"), .enable-pin-btn');
      const canEnable = await enableButton.isVisible().catch(() => false);

      expect(hasSuccess || canEnable).toBe(true);
    } else {
      // PIN might not be enabled
      test.skip();
    }
  });

  test('PIN-E2E-008: Update PIN modal opens', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const updateButton = page.locator('button:has-text("Update PIN"), button:has-text("Change PIN"), .update-pin-btn');

    if (await updateButton.isVisible()) {
      await updateButton.click();

      await page.waitForTimeout(500);

      // Modal should appear
      const modal = page.locator('.modal, [role="dialog"], .pin-modal');
      await expect(modal).toBeVisible();

      // Should have current PIN and new PIN inputs
      await expect(page.locator('input[name="current_pin"], input[name="currentPin"], #current-pin')).toBeVisible();
      await expect(page.locator('input[name="new_pin"], input[name="newPin"], #new-pin')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('PIN-E2E-009: Update PIN with correct current PIN', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const updateButton = page.locator('button:has-text("Update PIN"), .update-pin-btn');

    if (await updateButton.isVisible()) {
      await updateButton.click();

      await page.waitForTimeout(500);

      // Enter current and new PIN
      await page.locator('input[name="current_pin"], #current-pin').fill('1234');
      await page.locator('input[name="new_pin"], #new-pin').fill('5678');

      // Confirm new PIN if field exists
      const confirmInput = page.locator('input[name="confirm_pin"], #confirm-new-pin');
      if (await confirmInput.isVisible()) {
        await confirmInput.fill('5678');
      }

      // Submit
      await page.locator('button:has-text("Update"), button:has-text("Save")').last().click();

      await page.waitForTimeout(2000);

      // Should show success or close modal
      const hasSuccess = await page.locator('.success, [class*="success"]').first().isVisible().catch(() => false);
      const modalClosed = !(await page.locator('.modal.show, [role="dialog"]:visible').isVisible().catch(() => false));

      expect(hasSuccess || modalClosed).toBe(true);
    } else {
      test.skip();
    }
  });

  test('PIN-E2E-010: Update PIN with wrong current PIN shows error', async ({ page }) => {
    await page.locator('[data-tab="security"], a:has-text("Security"), button:has-text("Security")').click();

    await page.waitForTimeout(500);

    const updateButton = page.locator('button:has-text("Update PIN"), .update-pin-btn');

    if (await updateButton.isVisible()) {
      await updateButton.click();

      await page.waitForTimeout(500);

      // Enter wrong current PIN
      await page.locator('input[name="current_pin"], #current-pin').fill('9999');
      await page.locator('input[name="new_pin"], #new-pin').fill('5678');

      // Submit
      await page.locator('button:has-text("Update"), button:has-text("Save")').last().click();

      await page.waitForTimeout(2000);

      // Should show error
      const hasError = await page.locator('.error, [class*="error"]').first().isVisible()
        .catch(() => false);

      expect(hasError).toBe(true);
    } else {
      test.skip();
    }
  });
});

test.describe('PIN Sign-in Flow', () => {

  test('PIN-E2E-011: Sign-in with PIN enabled shows PIN prompt', async ({ page }) => {
    // This test requires a user with PIN enabled who has clicked magic link
    // Navigate to auth callback with magic link token
    if (!process.env.MAGIC_LINK_TOKEN_WITH_PIN) {
      test.skip();
      return;
    }

    await page.goto(`/auth?token=${process.env.MAGIC_LINK_TOKEN_WITH_PIN}`);

    await page.waitForTimeout(2000);

    // Should show PIN prompt
    const pinPrompt = page.locator('input[name="pin"], input[type="password"], #pin-input, .pin-prompt');
    await expect(pinPrompt).toBeVisible();
  });

  test('PIN-E2E-012: Correct PIN allows sign-in', async ({ page }) => {
    if (!process.env.MAGIC_LINK_TOKEN_WITH_PIN) {
      test.skip();
      return;
    }

    await page.goto(`/auth?token=${process.env.MAGIC_LINK_TOKEN_WITH_PIN}`);

    await page.waitForTimeout(2000);

    // Enter correct PIN
    await page.locator('input[name="pin"], #pin-input').fill('1234');
    await page.locator('button:has-text("Submit"), button:has-text("Verify")').click();

    await page.waitForTimeout(3000);

    // Should redirect to account
    expect(page.url()).toContain('/account');
  });

  test('PIN-E2E-013: Wrong PIN shows error', async ({ page }) => {
    if (!process.env.MAGIC_LINK_TOKEN_WITH_PIN) {
      test.skip();
      return;
    }

    await page.goto(`/auth?token=${process.env.MAGIC_LINK_TOKEN_WITH_PIN}`);

    await page.waitForTimeout(2000);

    // Enter wrong PIN
    await page.locator('input[name="pin"], #pin-input').fill('9999');
    await page.locator('button:has-text("Submit"), button:has-text("Verify")').click();

    await page.waitForTimeout(2000);

    // Should show error
    const hasError = await page.locator('.error, [class*="error"]').first().isVisible()
      .catch(() => false);

    expect(hasError).toBe(true);
  });
});

test.describe('PIN Status Display', () => {

  test('PIN-E2E-014: PIN status shows "Enabled" when PIN is set', async ({ page }) => {
    // Assuming logged in user with PIN enabled
    await page.goto('/account');

    await page.locator('[data-tab="security"], a:has-text("Security")').click();

    await page.waitForTimeout(500);

    const statusText = await page.locator('.pin-status, [class*="pin"]').first().textContent()
      .catch(() => '');

    expect(statusText?.toLowerCase()).toMatch(/enabled|active|on/i);
  });

  test('PIN-E2E-015: PIN status shows "Disabled" when PIN is not set', async ({ page }) => {
    // Assuming logged in user without PIN
    await page.goto('/account');

    await page.locator('[data-tab="security"], a:has-text("Security")').click();

    await page.waitForTimeout(500);

    const enableButton = page.locator('button:has-text("Enable PIN")');
    const statusText = await page.locator('.pin-status').first().textContent()
      .catch(() => '');

    const pinDisabled = await enableButton.isVisible() ||
                        statusText?.toLowerCase().includes('disabled') ||
                        statusText?.toLowerCase().includes('off') ||
                        statusText?.toLowerCase().includes('not');

    expect(pinDisabled).toBe(true);
  });
});
