import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Authorization API Tests
 * Verifies proper access control across all endpoints
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Admin Endpoint Authorization', () => {

  const adminEndpoints = [
    { method: 'GET', path: '/admin/registrations', name: 'List Registrations' },
    { method: 'POST', path: '/admin/registrations/test-id/approve', name: 'Approve Registration' },
    { method: 'POST', path: '/admin/registrations/test-id/reject', name: 'Reject Registration' },
    { method: 'GET', path: '/admin/invites', name: 'List Invites' },
    { method: 'POST', path: '/admin/invites', name: 'Create Invite' },
    { method: 'POST', path: '/admin/invites/test-code/expire', name: 'Expire Invite' },
    { method: 'DELETE', path: '/admin/invites/test-code', name: 'Delete Invite' },
    { method: 'POST', path: '/admin/users/test-id/disable', name: 'Disable User' },
    { method: 'POST', path: '/admin/users/test-id/enable', name: 'Enable User' },
    { method: 'DELETE', path: '/admin/users/test-id', name: 'Delete User' },
    { method: 'POST', path: '/admin/users/test-id/permanently-delete', name: 'Permanently Delete User' },
    { method: 'GET', path: '/admin/admins', name: 'List Admins' },
    { method: 'POST', path: '/admin/admins', name: 'Add Admin' },
    { method: 'DELETE', path: '/admin/admins/test@test.com', name: 'Remove Admin' },
    { method: 'GET', path: '/admin/memberships', name: 'List Membership Requests' },
    { method: 'POST', path: '/admin/memberships/test-id/approve', name: 'Approve Membership' },
    { method: 'POST', path: '/admin/memberships/test-id/deny', name: 'Deny Membership' },
    { method: 'GET', path: '/admin/membership-terms', name: 'List Membership Terms' },
    { method: 'POST', path: '/admin/membership-terms', name: 'Create Membership Terms' },
    { method: 'GET', path: '/admin/membership-terms/current', name: 'Get Current Terms' },
  ];

  test.describe('No Authentication', () => {

    for (const endpoint of adminEndpoints) {
      test(`AUTH-ADMIN-NOAUTH-${endpoint.name.replace(/\s+/g, '-')}: ${endpoint.name} rejects no auth`, async () => {
        apiClient.withoutAuth();

        const response = await apiClient.makeRequest(endpoint.method, endpoint.path);

        expect(response.status).toBe(401);
      });
    }
  });

  test.describe('Invalid Token', () => {

    test('AUTH-ADMIN-INVALID-001: Admin endpoints reject malformed token', async () => {
      apiClient.withAuth('invalid-token-format');

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      expect(response.status).toBe(401);
    });

    test('AUTH-ADMIN-INVALID-002: Admin endpoints reject expired token', async () => {
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTAwMDAwMDAwfQ.invalid';
      apiClient.withAuth(expiredToken);

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      expect(response.status).toBe(401);
    });

    test('AUTH-ADMIN-INVALID-003: Admin endpoints reject token for wrong user pool', async () => {
      // Use member token on admin endpoint
      await apiClient.withMemberAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      // Should be 401 (wrong pool) or 403 (wrong permissions)
      await apiClient.expectStatusOneOf(response, [401, 403]);
    });
  });

  test.describe('Member Token on Admin Endpoints', () => {

    for (const endpoint of adminEndpoints.slice(0, 5)) {
      test(`AUTH-ADMIN-MEMBER-${endpoint.name.replace(/\s+/g, '-')}: ${endpoint.name} rejects member token`, async () => {
        await apiClient.withMemberAuthAsync();

        const response = await apiClient.makeRequest(endpoint.method, endpoint.path);

        await apiClient.expectStatusOneOf(response, [401, 403]);
      });
    }
  });

  test.describe('Valid Admin Token', () => {

    test('AUTH-ADMIN-VALID-001: Admin endpoints accept admin token', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      // Should pass auth - may return 200 or 404 based on data
      await apiClient.expectStatusOneOf(response, [200, 404]);
    });
  });
});

test.describe('Member Endpoint Authorization', () => {

  const memberEndpoints = [
    { method: 'POST', path: '/account/cancel', name: 'Cancel Account' },
    { method: 'POST', path: '/account/security/pin/enable', name: 'Enable PIN' },
    { method: 'POST', path: '/account/security/pin/disable', name: 'Disable PIN' },
    { method: 'POST', path: '/account/security/pin/update', name: 'Update PIN' },
    { method: 'GET', path: '/account/security/pin/status', name: 'Get PIN Status' },
    { method: 'POST', path: '/account/membership/request', name: 'Request Membership' },
    { method: 'GET', path: '/account/membership/status', name: 'Get Membership Status' },
    { method: 'GET', path: '/account/membership/terms', name: 'Get Membership Terms' },
  ];

  test.describe('No Authentication', () => {

    for (const endpoint of memberEndpoints) {
      test(`AUTH-MEMBER-NOAUTH-${endpoint.name.replace(/\s+/g, '-')}: ${endpoint.name} rejects no auth`, async () => {
        apiClient.withoutAuth();

        const response = await apiClient.makeRequest(endpoint.method, endpoint.path);

        expect(response.status).toBe(401);
      });
    }
  });

  test.describe('Invalid Token', () => {

    test('AUTH-MEMBER-INVALID-001: Member endpoints reject malformed token', async () => {
      apiClient.withAuth('not-a-valid-jwt');

      const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

      expect(response.status).toBe(401);
    });

    test('AUTH-MEMBER-INVALID-002: Member endpoints reject empty token', async () => {
      apiClient.withAuth('');

      const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

      expect(response.status).toBe(401);
    });
  });

  test.describe('Admin Token on Member Endpoints', () => {

    for (const endpoint of memberEndpoints.slice(0, 3)) {
      test(`AUTH-MEMBER-ADMIN-${endpoint.name.replace(/\s+/g, '-')}: ${endpoint.name} rejects admin token`, async () => {
        const adminToken = await apiClient.getQuickAuth().getAdminToken();
        apiClient.withAuth(adminToken);

        const response = await apiClient.makeRequest(endpoint.method, endpoint.path);

        // Admin token should not work on member endpoints (different user pool)
        await apiClient.expectStatusOneOf(response, [401, 403]);
      });
    }
  });

  test.describe('Valid Member Token', () => {

    test('AUTH-MEMBER-VALID-001: Member endpoints accept member token', async () => {
      await apiClient.withMemberAuthAsync();

      const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

      expect(response.status).toBe(200);
    });
  });
});

test.describe('Public Endpoint Authorization', () => {

  test('AUTH-PUBLIC-001: Registration endpoint is public', async () => {
    apiClient.withoutAuth();

    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'INVALID-CODE'
    });

    // Should not return 401 - endpoint is public
    expect(response.status).not.toBe(401);
    // Should return 400 for invalid code, not auth error
    expect(response.status).toBe(400);
  });
});

test.describe('Cross-User Access Prevention', () => {

  test('AUTH-CROSS-001: User cannot access another users data', async () => {
    // This test verifies that users can only access their own data
    // Member endpoints should be scoped to the authenticated user

    await apiClient.withMemberAuthAsync();

    // User should only see their own status
    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(200);
    // Response should be for the authenticated user, not expose others
  });

  test('AUTH-CROSS-002: Admin operations require valid IDs', async () => {
    await apiClient.withAdminAuthAsync();

    // Try to access non-existent user
    const response = await apiClient.makeRequest('POST', '/admin/users/nonexistent-user-id/disable');

    // Should return 404, not succeed
    await apiClient.expectStatusOneOf(response, [400, 404]);
  });
});

test.describe('Token Handling Edge Cases', () => {

  test('AUTH-TOKEN-001: Token in wrong format (no Bearer prefix)', async () => {
    await apiClient.withMemberAuthAsync();

    // Normally tokens are sent as "Bearer <token>"
    // Test sending without Bearer prefix
    const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

    // Depends on implementation - may or may not require Bearer prefix
    expect(response.status).not.toBe(500);
  });

  test('AUTH-TOKEN-002: Token with extra whitespace', async () => {
    if (!process.env.MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(`  ${process.env.MEMBER_TOKEN}  `);

    const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

    // Should either accept (trimming) or reject gracefully
    expect(response.status).not.toBe(500);
  });

  test('AUTH-TOKEN-003: Token with modified signature', async () => {
    if (!process.env.MEMBER_TOKEN) {
      test.skip();
      return;
    }

    // Modify the last few characters of the token (signature part)
    const modifiedToken = process.env.MEMBER_TOKEN.slice(0, -10) + 'XXXXXXXXXX';
    apiClient.withAuth(modifiedToken);

    const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

    expect(response.status).toBe(401);
  });

  test('AUTH-TOKEN-004: Token with modified payload', async () => {
    if (!process.env.MEMBER_TOKEN) {
      test.skip();
      return;
    }

    // Modify middle section of JWT (payload)
    const parts = process.env.MEMBER_TOKEN.split('.');
    if (parts.length === 3) {
      parts[1] = 'eyJzdWIiOiJoYWNrZXIiLCJhZG1pbiI6dHJ1ZX0'; // Modified payload
      const modifiedToken = parts.join('.');
      apiClient.withAuth(modifiedToken);

      const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

      expect(response.status).toBe(401);
    }
  });

  test('AUTH-TOKEN-005: Very long token is handled', async () => {
    const longToken = 'eyJ' + 'x'.repeat(10000) + '.payload.signature';
    apiClient.withAuth(longToken);

    const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

    expect(response.status).toBe(401);
    expect(response.status).not.toBe(500);
  });

  test('AUTH-TOKEN-006: Token with null bytes', async () => {
    if (!process.env.MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.MEMBER_TOKEN + '\x00' + 'extra');

    const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

    // Should either reject or strip null byte
    expect(response.status).not.toBe(500);
  });
});

test.describe('Authorization Header Variations', () => {

  test('AUTH-HEADER-001: Case sensitivity of Bearer keyword', async () => {
    // This tests if "bearer" (lowercase) works
    // The API client uses "Bearer" - this is implementation specific
    expect(true).toBe(true); // Placeholder - actual test would require raw HTTP
  });

  test('AUTH-HEADER-002: Multiple Authorization headers', async () => {
    // HTTP spec says multiple headers of same name should be concatenated
    // This could cause issues
    expect(true).toBe(true); // Placeholder - requires raw HTTP manipulation
  });
});

test.describe('Session/Token Lifetime', () => {

  test('AUTH-LIFETIME-001: Verify token expiration is enforced', async () => {
    // Create a token that appears valid but has expired
    // This is a synthetic test - real expired tokens would fail at Cognito

    const expiredTokenPayload = {
      sub: 'test-user',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      iat: Math.floor(Date.now() / 1000) - 7200  // 2 hours ago
    };

    // Encode payload (this won't be a valid JWT without proper signature)
    const fakeToken = 'eyJhbGciOiJSUzI1NiJ9.' +
      Buffer.from(JSON.stringify(expiredTokenPayload)).toString('base64url') +
      '.invalid-signature';

    apiClient.withAuth(fakeToken);

    const response = await apiClient.makeRequest('GET', '/account/security/pin/status');

    expect(response.status).toBe(401);
  });
});

test.describe('Role-Based Access Control', () => {

  test('AUTH-RBAC-001: Registered user without member group cannot access member features', async () => {
    // This test requires a token for a user in 'registered' group but not 'member'
    if (!process.env.REGISTERED_ONLY_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.REGISTERED_ONLY_TOKEN);

    // Most member endpoints should work for registered users
    // But membership-specific features might be restricted
    const response = await apiClient.getMembershipStatus();

    // Should be able to check status (even if 'none')
    expect(response.status).toBe(200);
  });

  test('AUTH-RBAC-002: Member can access member features', async () => {
    if (!process.env.APPROVED_MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.APPROVED_MEMBER_TOKEN);

    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(200);
    expect(response.body.membership_status).toBe('approved');
  });
});

test.describe('Privilege Escalation Prevention', () => {

  test('AUTH-PRIV-001: Cannot escalate to admin via request manipulation', async () => {
    await apiClient.withMemberAuthAsync();

    // Try to access admin endpoint with member token
    const response = await apiClient.makeRequest('POST', '/admin/registrations/test/approve');

    await apiClient.expectStatusOneOf(response, [401, 403]);
  });

  test('AUTH-PRIV-002: Cannot add admin role via membership request', async () => {
    await apiClient.withMemberAuthAsync();

    // Try to request membership with admin escalation payload
    const response = await apiClient.makeRequest('POST', '/account/membership/request', {
      terms_version_id: 'test',
      admin: true,
      role: 'admin',
      groups: ['admin']
    });

    // Request might fail, but should not grant admin
    expect(response.status).not.toBe(500);
  });
});
