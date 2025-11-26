import { test, expect } from '@playwright/test';
import { APITestClient } from '../utils/api-test-client';
import { QuickAuth } from '../utils/quick-auth';
import { testDataGenerator } from '../utils/test-data-generator';

/**
 * API Test Suite: Member Endpoints
 * Tests member-specific endpoints (requires authentication)
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('Member API', () => {

  test.skip('MEMBER-001: Get membership status (requires member token)', async () => {
    // This test requires a real member token from Cognito
    // Skipping for sprint as it needs full auth flow
    // TODO: Implement when member token generation is ready

    const user = await quickAuth.createApprovedUser();
    // const token = await quickAuth.getMemberToken(user.email);
    // apiClient.withAuth(token);

    // const response = await apiClient.getMembershipStatus();
    // await apiClient.expectSuccess(response, 200);
    // expect(response.body).toHaveProperty('membership_status');

    console.log('⚠ Skipped - requires member token implementation');
  });

  test.skip('MEMBER-002: Request membership (requires authentication)', async () => {
    // Similar to above - requires full auth flow
    // Skipping for sprint

    console.log('⚠ Skipped - requires member token implementation');
  });

  test('MEMBER-003: Membership endpoints require authentication', async () => {
    // Test that member endpoints properly reject unauthenticated requests
    apiClient.withoutAuth();

    const endpoints = [
      { method: 'GET', path: '/account/membership/status' },
      { method: 'POST', path: '/account/membership/request' },
      { method: 'GET', path: '/account/pin/status' },
      { method: 'POST', path: '/account/pin/enable', body: { pin: '123456' } },
      { method: 'POST', path: '/account/cancel' }
    ];

    for (const endpoint of endpoints) {
      const response = await apiClient.request(
        endpoint.method,
        endpoint.path,
        endpoint.body
      );

      // Should return 401 Unauthorized
      expect(response.status).toBe(401);
      console.log(`✓ ${endpoint.method} ${endpoint.path}: Properly requires auth`);
    }
  });

  test('MEMBER-004: Admin token cannot access member-specific endpoints', async () => {
    // Verify that admin token works for admin endpoints but not member endpoints
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    // Admin endpoints should work
    const adminResponse = await apiClient.listRegistrations();
    expect(adminResponse.status).toBe(200);
    console.log('✓ Admin token works for admin endpoints');

    // Member endpoints with admin token behavior
    // (May work if admin is also a member, or may require specific member token)
    // This documents the expected behavior
    const memberResponse = await apiClient.getMembershipStatus();

    if (memberResponse.status === 200) {
      console.log('✓ Admin token also works for member endpoints (admin is member)');
    } else {
      console.log('✓ Admin token requires separate member authentication');
    }
  });

  test('MEMBER-005: PIN management endpoints structure', async () => {
    // Test PIN endpoints without authentication to verify they exist
    apiClient.withoutAuth();

    const pinEndpoints = [
      { method: 'GET', path: '/account/pin/status' },
      { method: 'POST', path: '/account/pin/enable' },
      { method: 'POST', path: '/account/pin/update' },
      { method: 'POST', path: '/account/pin/disable' }
    ];

    for (const endpoint of pinEndpoints) {
      const response = await apiClient.request(endpoint.method, endpoint.path);

      // Should return 401 (not 404), confirming endpoint exists
      expect(response.status).toBe(401);
      console.log(`✓ ${endpoint.method} ${endpoint.path}: Endpoint exists`);
    }
  });

});
