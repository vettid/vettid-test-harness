/**
 * Script to get a member token via magic link OAuth flow
 * Run with: npx ts-node scripts/get-member-token.ts
 *
 * This creates a test member, performs the magic link flow, and outputs the token
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const API_URL = process.env.API_URL || 'https://tiqpij5mue.execute-api.us-east-1.amazonaws.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const EMAIL_BUCKET = process.env.EMAIL_BUCKET_NAME || 'vettid-test-emails-449757308783';

const s3Client = new S3Client({ region: 'us-east-1' });

async function getLatestEmail(recipientEmail: string, maxWait = 30000): Promise<string | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: EMAIL_BUCKET,
        MaxKeys: 50
      });

      const listResult = await s3Client.send(listCommand);

      if (listResult.Contents) {
        // Sort by LastModified descending
        const sorted = listResult.Contents.sort((a, b) =>
          (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
        );

        for (const obj of sorted) {
          if (!obj.Key) continue;

          const getCommand = new GetObjectCommand({
            Bucket: EMAIL_BUCKET,
            Key: obj.Key
          });

          const getResult = await s3Client.send(getCommand);
          const body = await getResult.Body?.transformToString();

          if (body && body.includes(recipientEmail)) {
            return body;
          }
        }
      }
    } catch (error) {
      console.error('Error checking email:', error);
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return null;
}

function extractMagicLink(emailBody: string): string | null {
  // Look for the magic link URL - format: https://vettid.dev/auth#token=xxx
  // Email may have quoted-printable encoding with = at line breaks
  const cleanedBody = emailBody.replace(/=\r?\n/g, '').replace(/=3D/g, '=');

  const patterns = [
    /https:\/\/vettid\.dev\/auth#token=[^\s"<>]+/g,
    /https:\/\/vettid-members[^\s"<>]+/g,
    /https:\/\/[^\s"<>]*amazoncognito\.com[^\s"<>]+/g
  ];

  for (const pattern of patterns) {
    const matches = cleanedBody.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up URL
      return matches[0].replace(/&amp;/g, '&');
    }
  }

  return null;
}

async function getMemberToken() {
  if (!ADMIN_TOKEN) {
    console.error('ADMIN_TOKEN not set in .env');
    process.exit(1);
  }

  // Step 1: Create a new invite with auto-approve
  console.log('Creating invite...');
  const inviteResponse = await fetch(`${API_URL}/admin/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://admin.vettid.dev',
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({ max_uses: 1, auto_approve: true })
  });

  if (!inviteResponse.ok) {
    const error = await inviteResponse.text();
    console.error('Failed to create invite:', inviteResponse.status, error);
    process.exit(1);
  }

  const invite = await inviteResponse.json();
  console.log('Created invite:', invite.code);

  // Step 2: Register a test member
  const testEmail = `testmember-${Date.now()}@test.vettid.dev`;
  console.log('Registering member:', testEmail);

  const registerResponse = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://vettid.dev'
    },
    body: JSON.stringify({
      first_name: 'Test',
      last_name: 'Member',
      email: testEmail,
      invite_code: invite.code
    })
  });

  if (!registerResponse.ok) {
    const error = await registerResponse.text();
    console.error('Failed to register:', registerResponse.status, error);
    process.exit(1);
  }

  console.log('Registration complete');

  // Step 3: Use Playwright to complete the OAuth flow
  console.log('Starting browser to complete OAuth flow...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to signin page
    await page.goto('https://vettid.dev/signin/');

    // Enter email and request magic link
    await page.fill('#emailInput', testEmail);
    await page.click('#sendLinkBtn');

    console.log('Magic link requested, waiting for email...');

    // Wait for email to arrive
    const emailBody = await getLatestEmail(testEmail);
    if (!emailBody) {
      console.error('No email received within timeout');
      await browser.close();
      process.exit(1);
    }

    // Extract magic link
    const magicLink = extractMagicLink(emailBody);
    if (!magicLink) {
      console.error('Could not extract magic link from email');
      console.log('Email body preview:', emailBody.substring(0, 500));
      await browser.close();
      process.exit(1);
    }

    console.log('Got magic link, completing OAuth flow...');

    // Navigate to magic link
    await page.goto(magicLink);

    // Wait for auth page to complete and redirect
    await page.waitForTimeout(5000);

    // Check if we're on account page or need to wait more
    const currentUrl = page.url();
    console.log('Current URL after magic link:', currentUrl);

    // Get all localStorage items to find the token
    const allStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          items[key] = localStorage.getItem(key) || '';
        }
      }
      return items;
    });

    console.log('localStorage keys:', Object.keys(allStorage));

    // Look for token in various possible key names
    const tokenKeys = ['id_token', 'idToken', 'token', 'access_token', 'accessToken'];
    let foundToken: string | null = null;

    for (const key of tokenKeys) {
      if (allStorage[key]) {
        foundToken = allStorage[key];
        console.log(`Found token in key: ${key}`);
        break;
      }
    }

    // Also check for Cognito-style keys - prefer idToken
    for (const key of Object.keys(allStorage)) {
      if (key.includes('idToken')) {
        console.log(`Found Cognito idToken key: ${key}`);
        foundToken = allStorage[key];
        break; // Prefer idToken over accessToken
      }
    }

    if (!foundToken) {
      for (const key of Object.keys(allStorage)) {
        if (key.includes('accessToken')) {
          console.log(`Found Cognito accessToken key: ${key}`);
          foundToken = allStorage[key];
        }
      }
    }

    if (foundToken) {
      console.log('\n=== MEMBER TOKEN ===');
      console.log('Add this to your .env file as MEMBER_TOKEN:');
      console.log(foundToken);
      console.log('\n=== END TOKEN ===');
    } else {
      console.log('All localStorage:', JSON.stringify(allStorage, null, 2));
      console.error('No token found in localStorage');
    }

  } finally {
    await browser.close();
  }
}

getMemberToken().catch(console.error);
