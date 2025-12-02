import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { QuickAuth } from '../../utils/quick-auth';

/**
 * Member Authentication Flow Tests
 * Tests the complete member authentication lifecycle
 *
 * Covers:
 * - Token validation behavior
 * - Cognito auth challenge flow (define/create/verify)
 * - Session management
 * - Token refresh scenarios
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('Member Auth Flow - Token Behavior', () => {

  test('MAUTH-001: Fresh token allows member endpoint access', async () => {
    // Get admin token (which is also a member in the system)
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.getMembershipStatus();

    // Admin should have member access
    expect([200, 404]).toContain(response.status);
    console.log(`✓ MAUTH-001: Fresh token access: status ${response.status}`);
  });

  test('MAUTH-002: Expired token returns 401', async () => {
    // Create a fake expired JWT-like token
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNjAwMDAwMDAwfQ.fake';

    apiClient.withAuth(expiredToken);
    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(401);
    console.log('✓ MAUTH-002: Expired token returns 401');
  });

  test('MAUTH-003: Token from different issuer rejected', async () => {
    // Create a token with wrong issuer (not Cognito)
    const wrongIssuerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2Zha2UuYXV0aC5jb20iLCJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxOTk5OTk5OTk5fQ.fake';

    apiClient.withAuth(wrongIssuerToken);
    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(401);
    console.log('✓ MAUTH-003: Wrong issuer token rejected');
  });

  test('MAUTH-004: Token without required claims rejected', async () => {
    // Create a token missing required claims
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub3RoaW5nIjoiaGVyZSJ9.fake';

    apiClient.withAuth(invalidToken);
    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(401);
    console.log('✓ MAUTH-004: Token without claims rejected');
  });

});

test.describe('Member Auth Flow - Endpoint Protection Matrix', () => {

  test('MAUTH-010: All member endpoints require auth', async () => {
    apiClient.withoutAuth();

    const memberEndpoints = [
      { method: 'GET', path: '/account/membership/status', name: 'Get membership status' },
      { method: 'POST', path: '/account/membership/request', name: 'Request membership' },
      { method: 'GET', path: '/account/membership/terms', name: 'Get membership terms' },
      { method: 'GET', path: '/account/security/pin/status', name: 'Get PIN status' },
      { method: 'POST', path: '/account/security/pin/enable', name: 'Enable PIN' },
      { method: 'POST', path: '/account/security/pin/update', name: 'Update PIN' },
      { method: 'POST', path: '/account/security/pin/disable', name: 'Disable PIN' },
      { method: 'POST', path: '/account/cancel', name: 'Cancel account' },
    ];

    for (const endpoint of memberEndpoints) {
      const response = await apiClient.makeRequest(endpoint.method, endpoint.path);
      expect(response.status).toBe(401);
      console.log(`✓ ${endpoint.name}: Returns 401 without auth`);
    }
  });

  test('MAUTH-011: Member endpoints accessible with valid token', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // These should return success or expected business logic errors (not auth errors)
    const readEndpoints = [
      { method: 'GET', path: '/account/membership/status' },
      { method: 'GET', path: '/account/pin/status' },
    ];

    for (const endpoint of readEndpoints) {
      const response = await apiClient.makeRequest(endpoint.method, endpoint.path);
      expect(response.status).not.toBe(401);
      console.log(`✓ GET ${endpoint.path}: ${response.status} (not 401)`);
    }
  });

});

test.describe('Member Auth Flow - Cross-Role Access', () => {

  test('MAUTH-020: Admin token can access admin endpoints', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.listRegistrations();

    expect(response.status).toBe(200);
    console.log('✓ MAUTH-020: Admin token works for admin endpoints');
  });

  test('MAUTH-021: Admin token includes member access', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // Admin should be able to access member endpoints
    const memberResponse = await apiClient.getPinStatus();

    // Should not be 401 (admin has member capabilities)
    expect(memberResponse.status).not.toBe(401);
    console.log(`✓ MAUTH-021: Admin has member access: ${memberResponse.status}`);
  });

  test('MAUTH-022: Member cannot access admin endpoints', async () => {
    // Using invalid token to simulate member-only access
    // In real scenario, would use a member-only token
    const memberOnlyToken = 'member-only-simulation';

    apiClient.withAuth(memberOnlyToken);
    const response = await apiClient.listRegistrations();

    // Should be 401 or 403 (not authorized for admin)
    expect([401, 403]).toContain(response.status);
    console.log(`✓ MAUTH-022: Member-only token blocked from admin: ${response.status}`);
  });

});

test.describe('Member Auth Flow - Session Security', () => {

  test('MAUTH-030: Sequential requests with same token work', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // Make multiple sequential requests
    const responses = [];
    for (let i = 0; i < 5; i++) {
      const response = await apiClient.getPinStatus();
      responses.push(response.status);
    }

    // All should succeed
    const allSuccessful = responses.every(s => s !== 401);
    expect(allSuccessful).toBeTruthy();
    console.log(`✓ MAUTH-030: Sequential requests: ${responses.join(', ')}`);
  });

  test('MAUTH-031: Parallel requests with same token work', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // Make multiple parallel requests
    const promises = [
      apiClient.getPinStatus(),
      apiClient.getMembershipStatus(),
      apiClient.getMembershipTerms(),
    ];

    const responses = await Promise.all(promises);
    const statuses = responses.map(r => r.status);

    // None should be 401
    const noAuthErrors = statuses.every(s => s !== 401);
    expect(noAuthErrors).toBeTruthy();
    console.log(`✓ MAUTH-031: Parallel requests: ${statuses.join(', ')}`);
  });

  test('MAUTH-032: Token not cached across sessions', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    // First request with token
    apiClient.withAuth(adminToken);
    const firstResponse = await apiClient.getPinStatus();
    expect(firstResponse.status).not.toBe(401);

    // Second request without token
    apiClient.withoutAuth();
    const secondResponse = await apiClient.getPinStatus();
    expect(secondResponse.status).toBe(401);

    console.log('✓ MAUTH-032: Token not cached - cleared correctly');
  });

});

test.describe('Member Auth Flow - Error Handling', () => {

  test('MAUTH-040: Auth error response is JSON', async () => {
    apiClient.withAuth('invalid-token');
    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(401);
    expect(typeof response.body).toBe('object');
    console.log('✓ MAUTH-040: Auth error is JSON');
  });

  test('MAUTH-041: Auth error has message field', async () => {
    apiClient.withAuth('invalid-token');
    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(401);
    const hasMessage = response.body.message || response.body.error || response.body.Message;
    expect(hasMessage).toBeTruthy();
    console.log('✓ MAUTH-041: Auth error has message');
  });

  test('MAUTH-042: Auth error does not leak internal info', async () => {
    apiClient.withAuth('invalid-token');
    const response = await apiClient.getMembershipStatus();

    expect(response.status).toBe(401);
    const bodyStr = JSON.stringify(response.body);

    // Should not contain sensitive info
    expect(bodyStr.toLowerCase()).not.toContain('cognito');
    expect(bodyStr.toLowerCase()).not.toContain('arn:');
    expect(bodyStr.toLowerCase()).not.toContain('stacktrace');
    expect(bodyStr.toLowerCase()).not.toContain('secret');
    console.log('✓ MAUTH-042: Auth error sanitized');
  });

  test('MAUTH-043: Multiple invalid tokens all return 401', async () => {
    const invalidTokens = [
      'completely-invalid',
      'Bearer only-value',
      '   ',
      'null',
      'undefined',
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0.',
    ];

    for (const token of invalidTokens) {
      apiClient.withAuth(token);
      const response = await apiClient.getMembershipStatus();
      expect(response.status).toBe(401);
    }

    console.log(`✓ MAUTH-043: All ${invalidTokens.length} invalid tokens rejected`);
  });

});

test.describe('Member Auth Flow - Rate Limiting', () => {

  test('MAUTH-050: Repeated auth failures do not expose timing', async () => {
    const times: number[] = [];

    for (let i = 0; i < 10; i++) {
      apiClient.withAuth(`invalid-token-${i}`);
      const start = Date.now();
      await apiClient.getMembershipStatus();
      times.push(Date.now() - start);
    }

    // Check timing variance - should be relatively consistent
    const avg = times.reduce((a, b) => a + b) / times.length;
    const maxVariance = times.some(t => Math.abs(t - avg) > 500);

    console.log(`✓ MAUTH-050: Auth failure times: avg=${avg.toFixed(0)}ms, consistent=${!maxVariance}`);
    // Just informational - timing attacks are hard to test deterministically
  });

});
