import { test, expect } from '@playwright/test';
import { EmailRetriever } from '../../utils/email-retriever';
import { AuthHelpers } from '../../utils/auth-helpers';

let emailRetriever: EmailRetriever;
let authHelpers: AuthHelpers;

test.beforeAll(() => {
  const bucketName = process.env.EMAIL_BUCKET_NAME!;
  emailRetriever = new EmailRetriever(bucketName);
});

test.beforeEach(async ({ page }) => {
  authHelpers = new AuthHelpers(page, emailRetriever);
});

test.describe('Membership Management', () => {
  test('should display membership status for non-member', async ({ page }) => {
    test.skip(); // Requires authenticated non-member user

    await page.goto('/account');
    await page.click('[data-tab="membership"]');

    // Verify status is displayed
    await expect(page.locator('#membershipStatus')).not.toHaveText('Loading...');
  });

  test('should display and allow download of membership terms', async ({ page }) => {
    test.skip(); // Requires authenticated user

    await page.goto('/account');
    await page.click('[data-tab="membership"]');

    // Verify terms are displayed
    await expect(page.locator('#termsTextBox')).toBeVisible();

    // Verify download link
    await expect(page.locator('#termsDownloadLink')).toBeVisible();
  });

  test('should require terms acceptance before membership request', async ({ page }) => {
    test.skip(); // Requires authenticated non-member user

    await page.goto('/account');
    await page.click('[data-tab="membership"]');

    // Request button should be disabled initially
    await expect(page.locator('#requestMembershipBtn')).toBeDisabled();

    // Accept terms
    await page.check('#termsAcceptCheckbox');

    // Button should now be enabled
    await expect(page.locator('#requestMembershipBtn')).toBeEnabled();
  });

  test('should successfully request membership', async ({ page }) => {
    test.skip(); // Requires authenticated non-member user

    await page.goto('/account');
    await page.click('[data-tab="membership"]');

    // Accept terms and request
    await page.check('#termsAcceptCheckbox');
    await page.click('#requestMembershipBtn');

    // Verify success message
    await expect(page.locator('#requestMembershipMsg')).toContainText('submitted');

    // Status should update
    await expect(page.locator('#membershipStatus')).toContainText('Pending');
  });

  test('should display member benefits for approved members', async ({ page }) => {
    test.skip(); // Requires authenticated approved member

    await page.goto('/account');
    await page.click('[data-tab="membership"]');

    // Verify member-only section is visible
    await expect(page.locator('#memberInfoSection')).toBeVisible();

    // Non-member section should be hidden
    await expect(page.locator('#membershipTermsSection')).not.toBeVisible();
  });
});
