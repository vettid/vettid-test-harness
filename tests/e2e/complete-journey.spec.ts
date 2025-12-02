import { test, expect } from '@playwright/test';
import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SESClient, VerifyEmailIdentityCommand, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';

/**
 * Complete End-to-End Journey Test
 *
 * This test performs the entire user lifecycle:
 * 1. Create a unique test email
 * 2. Verify the email with AWS SES (required for sandbox mode)
 * 3. Register with an invite code
 * 4. Admin approves the registration
 * 5. Request magic link
 * 6. Use magic link to authenticate
 * 7. Verify account access
 * 8. Sign out
 */

const AWS_REGION = 'us-east-1';
const EMAIL_BUCKET = process.env.EMAIL_BUCKET_NAME || 'vettid-test-emails-449757308783';
const API_URL = process.env.API_URL || 'https://cgccjd4djg.execute-api.us-east-1.amazonaws.com';

// Initialize AWS clients
const s3Client = new S3Client({ region: AWS_REGION });
const sesClient = new SESClient({ region: AWS_REGION });

interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  raw: string;
}

/**
 * Helper: Generate unique test email
 */
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `e2e-${timestamp}-${random}@test.vettid.dev`;
}

/**
 * Helper: Clear all emails from test bucket
 */
async function clearEmails(): Promise<void> {
  const listCmd = new ListObjectsV2Command({
    Bucket: EMAIL_BUCKET,
    Prefix: 'emails/',
    MaxKeys: 100,
  });
  const list = await s3Client.send(listCmd);

  if (list.Contents) {
    for (const obj of list.Contents) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: EMAIL_BUCKET,
        Key: obj.Key!
      }));
    }
  }
}

/**
 * Helper: Wait for email matching filter
 */
async function waitForEmail(
  filterFn: (email: ParsedEmail) => boolean,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<ParsedEmail | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const listCmd = new ListObjectsV2Command({
      Bucket: EMAIL_BUCKET,
      Prefix: 'emails/',
      MaxKeys: 20,
    });
    const list = await s3Client.send(listCmd);

    if (list.Contents) {
      // Sort by most recent first
      const sorted = list.Contents.sort((a, b) =>
        new Date(b.LastModified!).getTime() - new Date(a.LastModified!).getTime()
      );

      for (const obj of sorted) {
        const getCmd = new GetObjectCommand({
          Bucket: EMAIL_BUCKET,
          Key: obj.Key!
        });
        const resp = await s3Client.send(getCmd);
        const raw = await resp.Body!.transformToString();

        // Parse email
        const fromMatch = raw.match(/From: ([^\r\n]+)/i);
        const toMatch = raw.match(/To: ([^\r\n]+)/i);
        const subjectMatch = raw.match(/Subject: ([^\r\n]+)/i);

        const email: ParsedEmail = {
          from: fromMatch ? fromMatch[1] : '',
          to: toMatch ? toMatch[1] : '',
          subject: subjectMatch ? subjectMatch[1] : '',
          body: raw.split(/\r?\n\r?\n/).slice(1).join('\n\n'),
          raw: raw
        };

        if (filterFn(email)) {
          return email;
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

/**
 * Helper: Extract link from email
 */
function extractLink(email: ParsedEmail, pattern: RegExp): string | null {
  // Decode quoted-printable
  let content = email.raw
    .replace(/=3D/g, '=')
    .replace(/=\r?\n/g, '');

  const match = content.match(pattern);
  return match ? match[0] : null;
}

/**
 * Helper: Verify email with SES
 */
async function verifySesEmail(email: string): Promise<boolean> {
  console.log(`    Requesting SES verification for: ${email}`);

  // Request verification
  await sesClient.send(new VerifyEmailIdentityCommand({
    EmailAddress: email
  }));

  // Wait for verification email
  const verificationEmail = await waitForEmail(
    (msg) => msg.from.includes('amazon.com') &&
             (msg.subject.toLowerCase().includes('verifica') || msg.raw.toLowerCase().includes('verify')),
    30000
  );

  if (!verificationEmail) {
    console.log('    No verification email received');
    return false;
  }

  console.log('    Verification email received');

  // Extract verification link
  const verificationLink = extractLink(
    verificationEmail,
    /https:\/\/email-verification[^\s<"]+/
  );

  if (!verificationLink) {
    console.log('    Could not extract verification link');
    return false;
  }

  console.log('    Clicking verification link...');

  // Click the verification link (use fetch since it's an API call)
  try {
    const response = await fetch(verificationLink, { redirect: 'follow' });
    console.log(`    Verification response: ${response.status}`);

    // Wait for verification to propagate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check verification status
    const attrs = await sesClient.send(new GetIdentityVerificationAttributesCommand({
      Identities: [email]
    }));

    const status = attrs.VerificationAttributes?.[email]?.VerificationStatus;
    console.log(`    Verification status: ${status}`);

    return status === 'Success';
  } catch (error) {
    console.log(`    Verification error: ${error}`);
    return false;
  }
}

/**
 * Helper: Get fresh admin token
 */
async function getAdminToken(): Promise<string> {
  // Use environment variable if available and not expired
  const envToken = process.env.ADMIN_TOKEN;
  if (envToken) {
    try {
      const payload = JSON.parse(Buffer.from(envToken.split('.')[1], 'base64').toString());
      if (payload.exp * 1000 > Date.now()) {
        return envToken;
      }
    } catch {}
  }

  // Generate new token via Python (boto3)
  const { execSync } = require('child_process');
  const token = execSync(`python3 << 'EOF'
import boto3
client = boto3.client('cognito-idp', region_name='us-east-1')
response = client.initiate_auth(
    AuthFlow='USER_PASSWORD_AUTH',
    AuthParameters={
        'USERNAME': 'testadmin@test.vettid.dev',
        'PASSWORD': 'TestAdmin123!@#',
    },
    ClientId='4cesvt13gboup14elsi90fiete'
)
print(response['AuthenticationResult']['IdToken'])
EOF
  `).toString().trim();

  return token;
}

/**
 * Helper: Create invite code via admin API
 */
async function createInviteCode(adminToken: string): Promise<string> {
  const response = await fetch(`${API_URL}/admin/invites`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      'Origin': 'https://admin.vettid.dev'
    },
    body: JSON.stringify({
      notes: 'E2E test invite',
      max_uses: 1
    })
  });

  const data = await response.json();
  if (!data.code) {
    throw new Error(`Failed to create invite: ${JSON.stringify(data)}`);
  }
  return data.code;
}

/**
 * Helper: Approve registration via admin API
 */
async function approveRegistration(adminToken: string, registrationId: string): Promise<void> {
  const response = await fetch(`${API_URL}/admin/registrations/${registrationId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      'Origin': 'https://admin.vettid.dev'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to approve registration: ${text}`);
  }
}

/**
 * Helper: Get pending registration by email
 */
async function getRegistrationByEmail(adminToken: string, email: string): Promise<string | null> {
  const response = await fetch(`${API_URL}/admin/registrations`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Origin': 'https://admin.vettid.dev'
    }
  });

  const data = await response.json();
  const registration = data.items?.find((r: any) => r.email === email);
  return registration?.registration_id || null;
}

// ============================================================================
// TESTS
// ============================================================================

test.describe('Complete User Journey', () => {
  test.setTimeout(180000); // 3 minutes for full flow

  test('full registration to authentication flow', async ({ page }) => {
    const testEmail = generateTestEmail();
    console.log(`\n🚀 Starting complete journey test with: ${testEmail}\n`);

    // Step 1: Clear old emails
    console.log('Step 1: Clearing old test emails...');
    await clearEmails();
    console.log('    ✓ Emails cleared\n');

    // Step 2: Verify email with SES
    console.log('Step 2: Verifying email with AWS SES...');
    const verified = await verifySesEmail(testEmail);
    expect(verified).toBe(true);
    console.log('    ✓ Email verified with SES\n');

    // Clear emails again after SES verification
    await clearEmails();

    // Step 3: Get admin token and create invite
    console.log('Step 3: Creating invite code...');
    const adminToken = await getAdminToken();
    const inviteCode = await createInviteCode(adminToken);
    console.log(`    ✓ Invite code created: ${inviteCode}\n`);

    // Step 4: Register user
    console.log('Step 4: Registering user...');
    await page.goto('/register');
    await page.fill('#first', 'Test');
    await page.fill('#last', 'User');
    await page.fill('#email', testEmail);
    await page.fill('#code', inviteCode);
    await page.check('#emailConsent');
    await page.click('button[type="submit"]');

    // Wait for response (success or error)
    await page.waitForFunction(() => {
      const msg = document.querySelector('#msg');
      return msg && msg.textContent && msg.textContent.length > 0 &&
             !msg.textContent.toLowerCase().includes('submitting');
    }, { timeout: 30000 });

    const regMsg = await page.locator('#msg').textContent();
    console.log(`    Registration result: ${regMsg}`);

    // Check for errors
    if (regMsg?.toLowerCase().includes('error')) {
      throw new Error(`Registration failed: ${regMsg}`);
    }

    expect(regMsg?.toLowerCase()).toMatch(/submitted|success|received/);
    console.log('    ✓ Registration submitted\n');

    // Step 5: Wait for registration confirmation email (optional - system may not send one)
    console.log('Step 5: Checking for registration confirmation email...');
    const confirmEmail = await waitForEmail(
      (msg) => msg.to.toLowerCase().includes(testEmail.toLowerCase()),
      10000  // Short timeout - this is optional
    );
    if (confirmEmail) {
      console.log(`    ✓ Confirmation email received: ${confirmEmail?.subject}\n`);
    } else {
      console.log('    ℹ No confirmation email (system may send to admin instead)\n');
    }

    // Step 6: Admin approves registration
    console.log('Step 6: Admin approving registration...');
    // Wait a moment for registration to be saved
    await new Promise(resolve => setTimeout(resolve, 2000));

    const registrationId = await getRegistrationByEmail(adminToken, testEmail);
    expect(registrationId).toBeTruthy();
    console.log(`    Found registration ID: ${registrationId}`);

    await approveRegistration(adminToken, registrationId!);
    console.log('    ✓ Registration approved\n');

    // Clear emails before magic link
    await clearEmails();

    // Step 7: Request magic link
    console.log('Step 7: Requesting magic link...');
    await page.goto('/signin');
    await page.fill('#emailInput', testEmail);
    await page.click('#sendLinkBtn');

    // Wait for status update
    await page.waitForFunction(() => {
      const status = document.querySelector('#loginStatus');
      return status && status.textContent &&
             !status.textContent.includes('Sending');
    }, { timeout: 15000 });

    const loginStatus = await page.locator('#loginStatus').textContent();
    console.log(`    Login status: ${loginStatus}`);

    if (loginStatus?.toLowerCase().includes('error')) {
      console.log('    ⚠️ Magic link request returned error - user may not be fully provisioned');
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.click('#sendLinkBtn');
      await page.waitForFunction(() => {
        const status = document.querySelector('#loginStatus');
        return status && status.textContent &&
               !status.textContent.includes('Sending');
      }, { timeout: 15000 });
    }
    console.log('    ✓ Magic link requested\n');

    // Step 8: Wait for magic link email
    console.log('Step 8: Waiting for magic link email...');
    const magicLinkEmail = await waitForEmail(
      (msg) => msg.to.toLowerCase().includes(testEmail.toLowerCase()) &&
               (msg.subject.toLowerCase().includes('login') ||
                msg.raw.toLowerCase().includes('auth#token')),
      45000
    );

    expect(magicLinkEmail).toBeTruthy();
    console.log(`    ✓ Magic link email received: ${magicLinkEmail?.subject}\n`);

    // Step 9: Extract and use magic link
    console.log('Step 9: Using magic link to authenticate...');
    const magicLink = extractLink(magicLinkEmail!, /https:\/\/[^\s<"]+\/auth#token=[^\s<"]+/);
    expect(magicLink).toBeTruthy();
    console.log(`    Magic link: ${magicLink?.substring(0, 80)}...`);

    await page.goto(magicLink!);

    // Wait for redirect
    await page.waitForURL(/.*\/(account|signin)/, { timeout: 30000 });
    const finalUrl = page.url();
    console.log(`    Redirected to: ${finalUrl}`);

    // Step 10: Verify authentication
    console.log('\nStep 10: Verifying authentication...');
    if (finalUrl.includes('/account')) {
      const tokens = await page.evaluate(() => localStorage.getItem('tokens'));
      expect(tokens).toBeTruthy();
      console.log('    ✓ Tokens stored in localStorage');

      // Check we can see account content
      await page.waitForSelector('h1', { timeout: 5000 });
      console.log('    ✓ Account page loaded');

      // Step 11: Sign out
      console.log('\nStep 11: Signing out...');
      await page.goto('/signout');
      await page.waitForURL(/.*\/signin/, { timeout: 10000 });

      const tokensAfter = await page.evaluate(() => localStorage.getItem('tokens'));
      expect(tokensAfter).toBeFalsy();
      console.log('    ✓ Signed out, tokens cleared');

      console.log('\n✅ COMPLETE USER JOURNEY TEST PASSED!\n');
    } else {
      // Authentication failed
      console.log('    ❌ Authentication failed - redirected to signin');

      // Get more info
      const errorContext = await page.locator('#loginStatus').textContent().catch(() => '');
      console.log(`    Error context: ${errorContext}`);

      throw new Error('Authentication failed - did not reach account page');
    }
  });
});
