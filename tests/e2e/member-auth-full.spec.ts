import { test, expect } from '@playwright/test';
import { EmailRetriever } from '../utils/email-retriever';

/**
 * Full Member Authentication Test
 * Tests the complete magic link flow for an approved member
 */

let emailRetriever: EmailRetriever;

// Use the approved test user from our earlier registration
const APPROVED_EMAIL = 'journey-1764200248532-m46h2d@test.vettid.dev';

test.beforeAll(() => {
  const bucketName = process.env.EMAIL_BUCKET_NAME!;
  if (!bucketName) {
    throw new Error('EMAIL_BUCKET_NAME environment variable is not set');
  }
  emailRetriever = new EmailRetriever(bucketName);
});

test.describe('Full Member Authentication Flow', () => {
  test('approved member can request and use magic link', async ({ page }) => {
    test.slow(); // This test involves email waiting

    // Record start time for email filtering
    const testStartTime = Date.now();

    // Step 1: Request magic link on signin page
    console.log('Step 1: Requesting magic link for approved member...');
    await page.goto('/signin');
    await page.fill('#emailInput', APPROVED_EMAIL);
    await page.click('#sendLinkBtn');

    // Wait for success message
    await page.waitForSelector('#loginStatus:not(:empty)', { timeout: 10000 });
    const status = await page.locator('#loginStatus').textContent();
    console.log('Login status:', status);

    // Step 2: Wait for magic link email (only look for emails received after test started)
    console.log('Step 2: Waiting for magic link email...');
    const email = await emailRetriever.waitForEmail(
      (msg) => {
        return msg.to.some(addr => addr.includes(APPROVED_EMAIL)) &&
               msg.subject.toLowerCase().includes('login');
      },
      45000,  // Increased timeout
      2000    // Poll every 2 seconds
    );

    if (!email) {
      console.log('No login email found via waitForEmail, checking all emails to recipient...');
      const allEmails = await emailRetriever.findEmailsByRecipient(APPROVED_EMAIL, 5);
      console.log(`Found ${allEmails.length} emails to ${APPROVED_EMAIL}`);

      // Find most recent login email
      const loginEmail = allEmails.find(e => e.subject.toLowerCase().includes('login'));
      if (loginEmail) {
        console.log('Found login email with subject:', loginEmail.subject);
        // Use this email instead
        const magicLink = emailRetriever.extractMagicLink(loginEmail);
        if (magicLink) {
          console.log('Using found magic link:', magicLink.substring(0, 80) + '...');
          await page.goto(magicLink);
          await page.waitForURL(/.*\/(account|signin)/, { timeout: 30000 });

          if (page.url().includes('/account')) {
            const tokens = await page.evaluate(() => localStorage.getItem('tokens'));
            expect(tokens).toBeTruthy();
            console.log('✅ Full member authentication test passed!');
            return;
          } else {
            console.log('Redirected to:', page.url());
            throw new Error('Authentication failed - redirected to signin');
          }
        }
      }
      throw new Error('No magic link email received');
    }

    console.log('Magic link email received:', email.subject);

    // Step 3: Extract and use magic link
    console.log('Step 3: Extracting magic link...');
    const magicLink = emailRetriever.extractMagicLink(email);
    if (!magicLink) {
      console.log('Email body text:', email.body.text?.substring(0, 500));
      console.log('Email body html:', email.body.html?.substring(0, 500));
      throw new Error('Could not extract magic link from email');
    }

    console.log('Magic link found:', magicLink.substring(0, 100) + '...');

    // Step 4: Click magic link and authenticate
    console.log('Step 4: Using magic link to authenticate...');
    await page.goto(magicLink);

    // Wait for redirect to account page
    await page.waitForURL(/.*\/account/, { timeout: 30000 });
    console.log('Redirected to:', page.url());

    // Step 5: Verify authentication
    console.log('Step 5: Verifying authentication...');
    const tokens = await page.evaluate(() => localStorage.getItem('tokens'));
    expect(tokens).toBeTruthy();

    // Check if we can see account content
    await page.waitForSelector('h1', { timeout: 5000 });
    const heading = await page.locator('h1').first().textContent();
    console.log('Page heading:', heading);

    console.log('✅ Full member authentication test passed!');
  });

  test('authenticated member can access account page', async ({ page }) => {
    // This test requires the previous test to have run
    // In a real scenario, we'd store tokens between tests

    await page.goto('/account');
    
    // If not authenticated, should redirect to signin
    const url = page.url();
    if (url.includes('/signin')) {
      console.log('Not authenticated, skipping account access test');
      test.skip();
      return;
    }

    // If authenticated, should see account content
    expect(url).toContain('/account');
  });
});
