/**
 * Script to create a test member account
 * Run with: npx ts-node scripts/create-test-member.ts
 */

import 'dotenv/config';

const API_URL = process.env.API_URL || 'https://tiqpij5mue.execute-api.us-east-1.amazonaws.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

async function createTestMember() {
  if (!ADMIN_TOKEN) {
    console.error('ADMIN_TOKEN not set in .env');
    process.exit(1);
  }

  // Step 1: Create a new invite
  console.log('Creating invite...');
  const inviteResponse = await fetch(`${API_URL}/admin/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://admin.vettid.dev',
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({ max_uses: 10, auto_approve: true })
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

  const registration = await registerResponse.json();
  console.log('Registration result:', registration);

  console.log('\n=== Test Member Created ===');
  console.log('Email:', testEmail);
  console.log('Invite Code:', invite.code);
  console.log('Registration ID:', registration.registration_id);
  console.log('\nTo get member token, the user needs to:');
  console.log('1. Wait for admin approval (or use auto-approve invite)');
  console.log('2. Request magic link');
  console.log('3. Complete OAuth flow');
}

createTestMember().catch(console.error);
