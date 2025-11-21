import { test, expect } from '@playwright/test';
import { EmailRetriever } from '../../utils/email-retriever';
import { AuthHelpers } from '../../utils/auth-helpers';
import { TEST_PINS } from '../../fixtures/test-data';

let emailRetriever: EmailRetriever;
let authHelpers: AuthHelpers;

test.beforeAll(() => {
  const bucketName = process.env.EMAIL_BUCKET_NAME!;
  emailRetriever = new EmailRetriever(bucketName);
});

test.beforeEach(async ({ page }) => {
  authHelpers = new AuthHelpers(page, emailRetriever);
});

test.describe('Account Management', () => {
  test('should display user profile information', async ({ page }) => {
    test.skip(); // Requires authenticated user

    await page.goto('/account');

    // Verify profile fields are displayed
    await expect(page.locator('#firstName')).not.toHaveText('—');
    await expect(page.locator('#lastName')).not.toHaveText('—');
    await expect(page.locator('#email')).not.toHaveText('—');
    await expect(page.locator('#userGuid')).not.toHaveText('—');
  });

  test('should navigate between account tabs', async ({ page }) => {
    test.skip(); // Requires authenticated user

    await page.goto('/account');

    // Click Membership tab
    await page.click('[data-tab="membership"]');
    await expect(page.locator('#membership')).toHaveClass(/active/);

    // Click Security tab
    await page.click('[data-tab="security"]');
    await expect(page.locator('#security')).toHaveClass(/active/);

    // Click back to Account tab
    await page.click('[data-tab="account"]');
    await expect(page.locator('#account')).toHaveClass(/active/);
  });
});

test.describe('PIN Management', () => {
  test('should enable PIN authentication', async ({ page }) => {
    test.skip(); // Requires authenticated user

    await page.goto('/account');

    // Go to Security tab
    await page.click('[data-tab="security"]');

    // Enable PIN
    await page.fill('#pinInput', TEST_PINS.valid);
    await page.fill('#confirmPinInput', TEST_PINS.valid);
    await page.click('#enablePinBtn');

    // Verify success message
    await expect(page.locator('#pinMsg')).toContainText('enabled');
  });

  test('should disable PIN authentication', async ({ page }) => {
    test.skip(); // Requires authenticated user with PIN enabled

    await page.goto('/account');
    await page.click('[data-tab="security"]');

    // Disable PIN
    await page.click('#disablePinBtn');

    // Confirm
    const confirmDialog = page.locator('dialog');
    if (await confirmDialog.isVisible()) {
      await page.click('button:has-text("Confirm")');
    }

    // Verify success message
    await expect(page.locator('#pinMsg')).toContainText('disabled');
  });

  test('should reject mismatched PIN confirmation', async ({ page }) => {
    test.skip(); // Requires authenticated user

    await page.goto('/account');
    await page.click('[data-tab="security"]');

    await page.fill('#pinInput', TEST_PINS.valid);
    await page.fill('#confirmPinInput', '999999'); // Different PIN
    await page.click('#enablePinBtn');

    // Verify error
    await expect(page.locator('#pinMsg')).toContainText('match');
  });
});

test.describe('Account Cancellation', () => {
  test('should cancel account with confirmation', async ({ page }) => {
    test.skip(); // Destructive test - requires special setup

    await page.goto('/account');

    // Click cancel account button
    await page.click('#cancelAccountBtn');

    // Confirm cancellation
    page.on('dialog', dialog => dialog.accept());

    await page.click('#cancelAccountBtn');

    // Verify success and redirection
    await page.waitForURL(/.*\/signin/);
  });
});
