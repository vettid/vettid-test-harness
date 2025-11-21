import { test, expect } from '@playwright/test';
import { EmailRetriever } from '../../utils/email-retriever';
import { AuthHelpers } from '../../utils/auth-helpers';
import { TEST_USERS, INVITE_CODES, ERROR_MESSAGES } from '../../fixtures/test-data';

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

test.describe('User Registration', () => {
  test('should successfully register with valid invite code', async ({ page }) => {
    const testEmail = AuthHelpers.generateTestEmail('reg-valid');
    const user = {
      ...TEST_USERS.valid,
      email: testEmail,
      inviteCode: INVITE_CODES.valid,
    };

    // Navigate to registration page
    await page.goto('/register');

    // Fill registration form
    await page.fill('#first', user.firstName);
    await page.fill('#last', user.lastName);
    await page.fill('#email', user.email);
    await page.fill('#code', user.inviteCode!);

    // Submit form
    await page.click('button[type="submit"]');

    // Verify success message
    const message = await page.locator('#msg').textContent();
    expect(message).toContain('Registration submitted');

    // Verify confirmation email was sent
    const confirmEmail = await authHelpers.waitForRegistrationConfirmation(testEmail, 30000);
    expect(confirmEmail).toBeTruthy();
    expect(confirmEmail.subject).toContain('Registration');
  });

  test('should reject registration with invalid email format', async ({ page }) => {
    const user = {
      ...TEST_USERS.invalidEmail,
      inviteCode: INVITE_CODES.valid,
    };

    await page.goto('/register');

    await page.fill('#first', user.firstName);
    await page.fill('#last', user.lastName);
    await page.fill('#email', user.email);
    await page.fill('#code', user.inviteCode!);

    await page.click('button[type="submit"]');

    // Verify error message
    const errorMsg = await page.locator('#msg').textContent();
    expect(errorMsg).toContain('Error');
  });

  test('should reject registration with invalid invite code', async ({ page }) => {
    const testEmail = AuthHelpers.generateTestEmail('reg-invalid-code');
    const user = {
      ...TEST_USERS.valid,
      email: testEmail,
      inviteCode: INVITE_CODES.invalid,
    };

    await page.goto('/register');

    await page.fill('#first', user.firstName);
    await page.fill('#last', user.lastName);
    await page.fill('#email', user.email);
    await page.fill('#code', user.inviteCode!);

    await page.click('button[type="submit"]');

    // Verify error message
    const errorMsg = await page.locator('#msg').textContent();
    expect(errorMsg).toContain('Error');
    expect(errorMsg.toLowerCase()).toContain('invite');
  });

  test('should reject registration with missing required fields', async ({ page }) => {
    await page.goto('/register');

    // Try to submit without filling any fields
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    const firstNameInput = page.locator('#first');
    const isInvalid = await firstNameInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should reject duplicate email registration', async ({ page }) => {
    const testEmail = AuthHelpers.generateTestEmail('reg-duplicate');
    const user = {
      ...TEST_USERS.valid,
      email: testEmail,
      inviteCode: INVITE_CODES.valid,
    };

    // First registration
    await authHelpers.register(user);

    // Try to register again with same email
    await page.goto('/register');
    await page.fill('#first', user.firstName);
    await page.fill('#last', user.lastName);
    await page.fill('#email', user.email);
    await page.fill('#code', user.inviteCode!);
    await page.click('button[type="submit"]');

    // Verify error message
    const errorMsg = await page.locator('#msg').textContent();
    expect(errorMsg).toContain('Error');
    expect(errorMsg.toLowerCase()).toContain('already registered');
  });

  test('should display form validation errors for empty fields', async ({ page }) => {
    await page.goto('/register');

    // Check required attributes
    await expect(page.locator('#first')).toHaveAttribute('required', '');
    await expect(page.locator('#last')).toHaveAttribute('required', '');
    await expect(page.locator('#email')).toHaveAttribute('required', '');
    await expect(page.locator('#code')).toHaveAttribute('required', '');
  });
});
