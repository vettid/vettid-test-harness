import { test, expect } from '@playwright/test';
import { EmailRetriever } from '../utils/email-retriever';
import { AuthHelpers } from '../utils/auth-helpers';
import { INVITE_CODES, TIMEOUTS } from '../fixtures/test-data';

/**
 * End-to-End User Journey Test
 *
 * This test covers the complete user lifecycle:
 * 1. Registration with invite code
 * 2. Admin approval (simulated)
 * 3. Magic link sign-in
 * 4. Membership request
 * 5. Account management
 *
 * NOTE: This test requires admin intervention for approval
 * or an API helper to simulate admin approval
 */

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

test.describe('Complete User Journey', () => {
  test('new user registration to membership request', async ({ page }) => {
    test.slow(); // This is a long test

    const testEmail = AuthHelpers.generateTestEmail('journey');
    const firstName = 'Journey';
    const lastName = 'Test';

    // STEP 1: Register
    console.log('Step 1: Registering new user...');
    await page.goto('/register');
    await page.fill('#first', firstName);
    await page.fill('#last', lastName);
    await page.fill('#email', testEmail);
    await page.fill('#code', INVITE_CODES.valid);
    await page.click('button[type="submit"]');

    // Verify registration success
    const regMsg = await page.locator('#msg').textContent();
    expect(regMsg).toContain('Registration submitted');

    // Verify confirmation email
    const confirmEmail = await emailRetriever.waitForEmail(testEmail, TIMEOUTS.emailDelivery);
    expect(confirmEmail).toBeTruthy();
    console.log('✓ Registration email received');

    // STEP 2: Admin Approval (would happen externally)
    console.log('Step 2: Waiting for admin approval...');
    console.log('⚠️  Manual step: Admin must approve the registration');
    test.skip('Skipping further steps - requires admin approval');

    // STEP 3: Sign in with magic link
    console.log('Step 3: Signing in with magic link...');
    await authHelpers.signInWithMagicLink(testEmail);

    // Verify we're on account page
    expect(page.url()).toContain('/account');
    console.log('✓ Successfully signed in');

    // STEP 4: Verify profile information
    console.log('Step 4: Checking profile...');
    const displayedEmail = await page.locator('#email').textContent();
    expect(displayedEmail).toBe(testEmail);
    console.log('✓ Profile information correct');

    // STEP 5: Request membership
    console.log('Step 5: Requesting membership...');
    await page.click('[data-tab="membership"]');

    // Accept terms
    await page.check('#termsAcceptCheckbox');
    await page.click('#requestMembershipBtn');

    // Verify success
    const memberMsg = await page.locator('#requestMembershipMsg').textContent();
    expect(memberMsg).toContain('submitted');
    console.log('✓ Membership requested');

    // STEP 6: Sign out
    console.log('Step 6: Signing out...');
    await authHelpers.signOut();
    expect(page.url()).toContain('/signin');
    console.log('✓ Successfully signed out');

    console.log('✅ Complete user journey test passed!');
  });
});

test.describe('Error Recovery Journey', () => {
  test('should handle registration errors gracefully', async ({ page }) => {
    const testEmail = AuthHelpers.generateTestEmail('error-recovery');

    // Try with invalid invite
    await page.goto('/register');
    await page.fill('#first', 'Error');
    await page.fill('#last', 'Test');
    await page.fill('#email', testEmail);
    await page.fill('#code', 'INVALID_CODE');
    await page.click('button[type="submit"]');

    // Verify error
    const errorMsg = await page.locator('#msg').textContent();
    expect(errorMsg).toContain('Error');

    // Retry with valid invite
    await page.fill('#code', INVITE_CODES.valid);
    await page.click('button[type="submit"]');

    // Should succeed this time
    const successMsg = await page.locator('#msg').textContent();
    expect(successMsg).toContain('submitted');
  });
});
