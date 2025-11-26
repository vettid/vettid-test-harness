import { test, expect } from '@playwright/test';

/**
 * Environment Check Test
 * Validates that all required environment variables are set
 */

test.describe('Environment Setup Check', () => {

  test('ENV-001: Required environment variables are set', async () => {
    const required = [
      'BASE_URL',
      'API_URL',
      'EMAIL_BUCKET_NAME',
      'USER_POOL_ID',
      'CLIENT_ID'
    ];

    const missing = [];
    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      console.log(`❌ Missing required env vars: ${missing.join(', ')}`);
    } else {
      console.log('✅ All required environment variables are set');
    }

    expect(missing).toHaveLength(0);
  });

  test('ENV-002: Optional environment variables status', async () => {
    const optional = {
      'TEST_INVITE_CODE': process.env.TEST_INVITE_CODE,
      'ADMIN_TOKEN': process.env.ADMIN_TOKEN,
      'AUTO_APPROVE_INVITE_CODE': process.env.AUTO_APPROVE_INVITE_CODE,
      'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
      'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY
    };

    console.log('\n📋 Optional Environment Variables:');
    for (const [key, value] of Object.entries(optional)) {
      if (value && value !== 'VALID_INVITE_CODE_HERE') {
        console.log(`  ✅ ${key}: Set`);
      } else {
        console.log(`  ⚠️  ${key}: Not set (some tests will skip)`);
      }
    }

    // This test always passes - just informational
    expect(true).toBe(true);
  });

  test('ENV-003: API connectivity check', async ({ request }) => {
    const apiUrl = process.env.API_URL;

    // Try to ping a public endpoint (registration)
    const response = await request.post(`${apiUrl}/register`, {
      data: {
        first_name: '',
        last_name: '',
        email: 'test',
        invite_code: 'TEST'
      }
    }).catch(() => ({ status: () => 0 }));

    const status = typeof response.status === 'function' ? response.status() : response.status;

    // Should get 400 (bad request) not 0 (no connection) or 500 (server error)
    if (status === 400) {
      console.log('✅ API is reachable and responding');
    } else if (status === 0) {
      console.log('❌ Cannot connect to API');
    } else {
      console.log(`⚠️  API returned unexpected status: ${status}`);
    }

    expect(status).not.toBe(0);
  });

});
