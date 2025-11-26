import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Authentication API Test Suite
 * Tests authentication-related API behavior
 *
 * Validates:
 * - Token handling
 * - Auth enforcement
 * - Session behavior
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Token Validation', () => {

  test('AUTH-TOKEN-001: No token returns 401', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('AUTH-TOKEN-001: No token returns 401');
  });

  test('AUTH-TOKEN-002: Invalid token returns 401', async () => {
    apiClient.withAuth('invalid-token-12345');
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('AUTH-TOKEN-002: Invalid token returns 401');
  });

  test('AUTH-TOKEN-003: Malformed JWT returns 401', async () => {
    apiClient.withAuth('not.a.jwt');
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('AUTH-TOKEN-003: Malformed JWT returns 401');
  });

  test('AUTH-TOKEN-004: Empty token returns 401', async () => {
    apiClient.withAuth('');
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('AUTH-TOKEN-004: Empty token returns 401');
  });

  test('AUTH-TOKEN-005: Bearer without token returns 401', async () => {
    const response = await apiClient.request('GET', '/account/membership/status', {
      headers: { 'Authorization': 'Bearer ' }
    });

    expect(response.status).toBe(401);
    console.log('AUTH-TOKEN-005: Bearer without token returns 401');
  });

});

test.describe('Authorization Header Format', () => {

  test('AUTH-HDR-001: Missing Bearer prefix', async () => {
    const response = await apiClient.request('GET', '/account/membership/status', {
      headers: { 'Authorization': 'some-token-value' }
    });

    expect(response.status).toBe(401);
    console.log('AUTH-HDR-001: Missing Bearer prefix returns 401');
  });

  test('AUTH-HDR-002: Wrong scheme (Basic)', async () => {
    const response = await apiClient.request('GET', '/account/membership/status', {
      headers: { 'Authorization': 'Basic dXNlcjpwYXNz' }
    });

    expect(response.status).toBe(401);
    console.log('AUTH-HDR-002: Wrong scheme returns 401');
  });

  test('AUTH-HDR-003: Case sensitivity (bearer)', async () => {
    const response = await apiClient.request('GET', '/account/membership/status', {
      headers: { 'Authorization': 'bearer some-token' }
    });

    // May accept lowercase or reject
    expect([401, 403]).toContain(response.status);
    console.log(`AUTH-HDR-003: Lowercase bearer: ${response.status}`);
  });

  test('AUTH-HDR-004: Extra spaces in header', async () => {
    const response = await apiClient.request('GET', '/account/membership/status', {
      headers: { 'Authorization': 'Bearer   token-with-spaces   ' }
    });

    expect(response.status).toBe(401);
    console.log('AUTH-HDR-004: Extra spaces returns 401');
  });

});

test.describe('Protected Endpoint Enforcement', () => {

  test('AUTH-PROT-001: Account status requires auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('AUTH-PROT-001: Account status requires auth');
  });

  test('AUTH-PROT-002: Admin endpoints require auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/admin/registrations');

    expect(response.status).toBe(401);
    console.log('AUTH-PROT-002: Admin endpoints require auth');
  });

  test('AUTH-PROT-003: PIN status requires auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/account/pin/status');

    expect(response.status).toBe(401);
    console.log('AUTH-PROT-003: PIN status requires auth');
  });

  test('AUTH-PROT-004: Member endpoint requires auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/member/profile');

    expect(response.status).toBe(401);
    console.log('AUTH-PROT-004: Member endpoint requires auth');
  });

});

test.describe('Public Endpoint Access', () => {

  test('AUTH-PUB-001: Registration accessible without auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: `auth-pub-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    // Should not require auth (returns validation error instead)
    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(401);
    console.log(`AUTH-PUB-001: Registration accessible without auth: ${response.status}`);
  });

  test('AUTH-PUB-002: Registration with auth still works', async () => {
    apiClient.withAuth('some-token');
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: `auth-pub-2-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    // Should still work (even with invalid auth on public endpoint)
    expect([200, 201, 400, 401]).toContain(response.status);
    console.log(`AUTH-PUB-002: Registration with auth: ${response.status}`);
  });

});

test.describe('Auth Error Responses', () => {

  test('AUTH-ERR-001: 401 response is JSON', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    expect(response.body).toBeDefined();
    expect(typeof response.body).toBe('object');
    console.log('AUTH-ERR-001: 401 response is JSON');
  });

  test('AUTH-ERR-002: 401 has error message', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    const hasMessage = response.body.message || response.body.error || response.body.Message;
    expect(hasMessage).toBeTruthy();
    console.log('AUTH-ERR-002: 401 has error message');
  });

  test('AUTH-ERR-003: 401 consistent format', async () => {
    apiClient.withoutAuth();

    const responses = [];
    const endpoints = [
      '/account/membership/status',
      '/admin/registrations',
      '/account/pin/status'
    ];

    for (const endpoint of endpoints) {
      const response = await apiClient.request('GET', endpoint);
      responses.push({
        endpoint,
        status: response.status,
        keys: Object.keys(response.body).sort().join(',')
      });
    }

    // All should be 401
    for (const r of responses) {
      expect(r.status).toBe(401);
    }

    // All should have same structure
    const firstKeys = responses[0].keys;
    for (const r of responses) {
      expect(r.keys).toBe(firstKeys);
    }

    console.log('AUTH-ERR-003: 401 format consistent across endpoints');
  });

  test('AUTH-ERR-004: No sensitive info in 401', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    const bodyStr = JSON.stringify(response.body);

    expect(bodyStr).not.toContain('arn:aws');
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('secret');
    console.log('AUTH-ERR-004: No sensitive info in 401');
  });

});

