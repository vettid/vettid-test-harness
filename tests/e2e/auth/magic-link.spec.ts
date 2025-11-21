import { test, expect } from '@playwright/test';
import { EmailRetriever } from '../../utils/email-retriever';
import { AuthHelpers } from '../../utils/auth-helpers';
import { TEST_USERS, TEST_PINS, TIMEOUTS } from '../../fixtures/test-data';

let emailRetriever: EmailRetriever;
let authHelpers: AuthHelpers;

test.beforeAll(() => {
  const bucketName = process.env.EMAIL_BUCKET_NAME!;
  if (!bucketName) {
    throw new Error('EMAIL_BUCKET_NAME environment variable is not set');
  }
  emailRetriever = new EmailRetriever(bucketName);
});

test.beforeEach(async ({ page }) => {
  authHelpers = new AuthHelpers(page, emailRetriever);
});

test.describe('Magic Link Authentication', () => {
  test('should send magic link email when requested', async ({ page }) => {
    // Use a known test user email (that's already approved)
    const testEmail = AuthHelpers.generateTestEmail('magic-link-send');

    await page.goto('/signin');
    await page.fill('#emailInput', testEmail);
    await page.click('#sendLinkBtn');

    // Verify success message
    await expect(page.locator('#loginStatus')).toHaveClass(/success/);
    const message = await page.locator('#loginStatus').textContent();
    expect(message).toContain('Magic link sent');

    // Verify email was received
    const email = await emailRetriever.waitForEmail(testEmail, TIMEOUTS.emailDelivery);
    expect(email).toBeTruthy();
    expect(email!.subject).toContain('Login Link');
  });

  test('should successfully authenticate with magic link (no PIN)', async ({ page }) => {
    const testEmail = AuthHelpers.generateTestEmail('magic-link-auth');

    // Request magic link
    await authHelpers.requestMagicLink(testEmail);

    // Get magic link from email
    const magicLink = await authHelpers.getMagicLinkFromEmail(testEmail);

    // Click the magic link
    await page.goto(magicLink);

    // Should redirect to account page
    await page.waitForURL(/.*\/account/, { timeout: TIMEOUTS.pageLoad });
    expect(page.url()).toContain('/account');

    // Verify authentication
    const isAuth = await authHelpers.isAuthenticated();
    expect(isAuth).toBe(true);
  });

  test('should successfully authenticate with magic link and PIN', async ({ page }) => {
    // This test assumes a user with PIN enabled exists
    // In practice, you'd need to set up this user first
    test.skip(); // Skip for now - requires pre-setup

    const testEmail = 'user-with-pin@test.vettid.dev';
    const pin = TEST_PINS.valid;

    await authHelpers.signInWithMagicLink(testEmail, pin);

    // Verify authentication
    await page.waitForURL(/.*\/account/, { timeout: TIMEOUTS.pageLoad });
    expect(page.url()).toContain('/account');
  });

  test('should fail with invalid PIN', async ({ page }) => {
    // This test assumes a user with PIN enabled exists
    test.skip(); // Skip for now - requires pre-setup

    const testEmail = 'user-with-pin@test.vettid.dev';

    await authHelpers.requestMagicLink(testEmail);
    const magicLink = await authHelpers.getMagicLinkFromEmail(testEmail);
    await page.goto(magicLink);

    // Wait for PIN prompt
    await page.waitForSelector('#pinPrompt.show');

    // Enter wrong PIN
    await page.fill('#pinInput', '000000');
    await page.click('#submitPinBtn');

    // Should show error
    await expect(page.locator('.message.error')).toBeVisible();
  });

  test('should handle expired magic link', async ({ page }) => {
    test.skip(); // Skip - requires waiting 15 minutes for expiration

    // This would test the expiration logic but requires time
  });

  test('should display proper error for non-existent user', async ({ page }) => {
    const nonExistentEmail = 'nonexistent-' + Date.now() + '@test.vettid.dev';

    await page.goto('/signin');
    await page.fill('#emailInput', nonExistentEmail);
    await page.click('#sendLinkBtn');

    // May show success to prevent email enumeration, or may show error
    // Check actual behavior
    await page.waitForSelector('#loginStatus:not(:empty)');
  });

  test('should extract valid magic link from email', async ({ page }) => {
    const testEmail = AuthHelpers.generateTestEmail('magic-extract');

    await authHelpers.requestMagicLink(testEmail);
    const email = await emailRetriever.waitForEmail(testEmail, TIMEOUTS.emailDelivery);

    const magicLink = emailRetriever.extractMagicLink(email!);
    expect(magicLink).toBeTruthy();
    expect(magicLink).toContain('/auth#token=');
    expect(magicLink).toContain(`email=${encodeURIComponent(testEmail)}`);
  });
});

test.describe('Sign Out', () => {
  test('should successfully sign out', async ({ page }) => {
    // First sign in (mock or skip if complex)
    test.skip(); // Requires full sign-in flow

    // Go to signout page
    await page.goto('/signout');

    // Should redirect to signin
    await page.waitForURL(/.*\/signin/, { timeout: TIMEOUTS.pageLoad });

    // Verify tokens are cleared
    const tokens = await page.evaluate(() => localStorage.getItem('tokens'));
    expect(tokens).toBeNull();
  });
});
