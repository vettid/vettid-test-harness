import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Error Response Handling Test Suite
 * Tests API error response behavior and format
 *
 * Validates:
 * - Consistent error format
 * - Appropriate error codes
 * - Helpful error messages
 * - No sensitive data in errors
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('400 Bad Request Errors', () => {

  test('ERR-400-001: Empty body returns 400', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: '',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(400);
    console.log('ERR-400-001: Empty body rejected with 400');
  });

  test('ERR-400-002: Invalid JSON returns 400', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: '{"invalid json',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(400);
    console.log('ERR-400-002: Invalid JSON rejected with 400');
  });

  test('ERR-400-003: Missing required fields returns 400', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);
    console.log('ERR-400-003: Missing fields rejected with 400');
  });

  test('ERR-400-004: Invalid email format returns 400', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: 'not-an-email',
      invite_code: 'TEST'
    });

    expect(response.status).toBe(400);
    console.log('ERR-400-004: Invalid email rejected with 400');
  });

  test('ERR-400-005: 400 response includes error message', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();

    const hasMessage = response.body.message || response.body.error || response.body.errors;
    expect(hasMessage).toBeTruthy();
    console.log('ERR-400-005: 400 response includes error message');
  });

});

test.describe('401 Unauthorized Errors', () => {

  test('ERR-401-001: No auth token returns 401', async () => {
    apiClient.withoutAuth();

    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('ERR-401-001: No auth token returns 401');
  });

  test('ERR-401-002: Invalid auth token returns 401', async () => {
    apiClient.withAuth('invalid-token-12345');

    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('ERR-401-002: Invalid auth token returns 401');
  });

  test('ERR-401-003: Malformed auth header returns 401', async () => {
    const response = await apiClient.request('GET', '/account/membership/status', {
      headers: { 'Authorization': 'NotBearer token123' }
    });

    expect(response.status).toBe(401);
    console.log('ERR-401-003: Malformed auth returns 401');
  });

  test('ERR-401-004: Expired token returns 401', async () => {
    // Simulate expired token (just use an invalid one)
    apiClient.withAuth('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid');

    const response = await apiClient.request('GET', '/account/membership/status');

    expect(response.status).toBe(401);
    console.log('ERR-401-004: Expired/invalid token returns 401');
  });

  test('ERR-401-005: Empty auth header returns 401', async () => {
    const response = await apiClient.request('GET', '/account/membership/status', {
      headers: { 'Authorization': '' }
    });

    expect(response.status).toBe(401);
    console.log('ERR-401-005: Empty auth header returns 401');
  });

});

test.describe('404 Not Found Errors', () => {

  test('ERR-404-001: Nonexistent endpoint returns 404 or 401', async () => {
    const response = await apiClient.request('GET', '/nonexistent/endpoint');

    // May return 401 if auth is required before route matching
    expect([401, 404]).toContain(response.status);
    console.log(`ERR-404-001: Nonexistent endpoint returns ${response.status}`);
  });

  test('ERR-404-002: Unknown API version returns appropriate error', async () => {
    const response = await apiClient.request('GET', '/v99/register');

    expect([400, 401, 404]).toContain(response.status);
    console.log(`ERR-404-002: Unknown version returns ${response.status}`);
  });

  test('ERR-404-003: Misspelled endpoint returns appropriate error', async () => {
    const response = await apiClient.request('POST', '/registr');

    expect([400, 404]).toContain(response.status);
    console.log(`ERR-404-003: Misspelled endpoint returns ${response.status}`);
  });

});

test.describe('405 Method Not Allowed', () => {

  test('ERR-405-001: GET on POST endpoint', async () => {
    const response = await apiClient.request('GET', '/register');

    expect([400, 404, 405]).toContain(response.status);
    console.log(`ERR-405-001: GET on POST endpoint returns ${response.status}`);
  });

  test('ERR-405-002: DELETE on POST endpoint', async () => {
    const response = await apiClient.request('DELETE', '/register');

    expect([400, 404, 405]).toContain(response.status);
    console.log(`ERR-405-002: DELETE on POST endpoint returns ${response.status}`);
  });

  test('ERR-405-003: PUT on POST endpoint', async () => {
    const response = await apiClient.request('PUT', '/register', {
      body: JSON.stringify({ test: 'data' }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([400, 404, 405]).toContain(response.status);
    console.log(`ERR-405-003: PUT on POST endpoint returns ${response.status}`);
  });

});

test.describe('Error Response Format', () => {

  test('ERR-FMT-001: Error response is JSON', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(typeof response.body).toBe('object');
    console.log('ERR-FMT-001: Error response is JSON');
  });

  test('ERR-FMT-002: Error has consistent structure', async () => {
    const responses = [];

    for (let i = 0; i < 3; i++) {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });
      responses.push(Object.keys(response.body).sort().join(','));
    }

    // All should have same keys
    expect(responses[0]).toBe(responses[1]);
    expect(responses[1]).toBe(responses[2]);
    console.log('ERR-FMT-002: Error structure is consistent');
  });

  test('ERR-FMT-003: No stack traces in production', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('at ');
    expect(bodyStr).not.toContain('Error:');
    expect(bodyStr).not.toContain('node_modules');
    console.log('ERR-FMT-003: No stack traces in error');
  });

  test('ERR-FMT-004: No internal paths in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('/var/task');
    expect(bodyStr).not.toContain('/opt/');
    expect(bodyStr).not.toContain('/home/');
    console.log('ERR-FMT-004: No internal paths in error');
  });

  test('ERR-FMT-005: No AWS ARNs in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('arn:aws:');
    console.log('ERR-FMT-005: No AWS ARNs in error');
  });

});

test.describe('Error Recovery', () => {

  test('ERR-REC-001: API recovers after bad request', async () => {
    // Bad request
    const bad = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });
    expect(bad.status).toBe(400);

    // Good request should work
    const good = await apiClient.submitRegistration(
      testDataGenerator.generateUser({
        email: `recovery-${Date.now()}@test.vettid.dev`
      })
    );
    expect([200, 201, 400]).toContain(good.status);
    expect(good.status).not.toBe(500);

    console.log('ERR-REC-001: API recovers after bad request');
  });

  test('ERR-REC-002: Sequential errors handled correctly', async () => {
    const results = [];

    for (let i = 0; i < 5; i++) {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });
      results.push(response.status);
    }

    // All should be 400, no 500s
    for (const status of results) {
      expect(status).toBe(400);
    }

    console.log('ERR-REC-002: Sequential errors handled correctly');
  });

  test('ERR-REC-003: Mixed good/bad requests work', async () => {
    const timestamp = Date.now();

    // Good
    const r1 = await apiClient.submitRegistration(
      testDataGenerator.generateUser({ email: `mixed-1-${timestamp}@test.vettid.dev` })
    );

    // Bad
    const r2 = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    // Good
    const r3 = await apiClient.submitRegistration(
      testDataGenerator.generateUser({ email: `mixed-2-${timestamp}@test.vettid.dev` })
    );

    expect(r2.status).toBe(400);
    expect([200, 201, 400]).toContain(r1.status);
    expect([200, 201, 400]).toContain(r3.status);

    console.log('ERR-REC-003: Mixed requests handled correctly');
  });

});

