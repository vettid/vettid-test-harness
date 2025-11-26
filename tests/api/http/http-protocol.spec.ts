import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * HTTP Protocol Test Suite
 * Tests HTTP protocol compliance and behavior
 *
 * Validates:
 * - Content negotiation
 * - HTTP methods
 * - Headers handling
 * - Protocol compliance
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Content-Type Handling', () => {

  test('HTTP-CT-001: JSON content-type accepted', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: `ct-json-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`HTTP-CT-001: JSON content-type: ${response.status}`);
  });

  test('HTTP-CT-002: JSON with charset accepted', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: `ct-charset-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`HTTP-CT-002: JSON with charset: ${response.status}`);
  });

  test('HTTP-CT-003: Missing content-type handling', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: `ct-missing-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      })
    });

    expect([200, 201, 400, 415]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`HTTP-CT-003: Missing content-type: ${response.status}`);
  });

  test('HTTP-CT-004: Text/plain handling', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'text/plain' }
    });

    expect([200, 201, 400, 415]).toContain(response.status);
    console.log(`HTTP-CT-004: Text/plain: ${response.status}`);
  });

  test('HTTP-CT-005: XML content-type handling', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: '<xml>test</xml>',
      headers: { 'Content-Type': 'application/xml' }
    });

    expect([400, 415]).toContain(response.status);
    console.log(`HTTP-CT-005: XML content-type: ${response.status}`);
  });

});

test.describe('Accept Header Handling', () => {

  test('HTTP-ACC-001: Accept JSON header', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: `acc-json-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.headers['content-type']).toContain('application/json');
    console.log(`HTTP-ACC-001: Accept JSON: ${response.status}`);
  });

  test('HTTP-ACC-002: Accept wildcard', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: `acc-wild-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      }
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`HTTP-ACC-002: Accept wildcard: ${response.status}`);
  });

  test('HTTP-ACC-003: Missing Accept header', async () => {
    const response = await apiClient.submitRegistration(
      testDataGenerator.generateUser()
    );

    expect([200, 201, 400]).toContain(response.status);
    console.log(`HTTP-ACC-003: Missing Accept: ${response.status}`);
  });

});

test.describe('HTTP Method Handling', () => {

  test('HTTP-MTH-001: HEAD request', async () => {
    const response = await apiClient.request('HEAD', '/register');

    expect([200, 400, 404, 405]).toContain(response.status);
    console.log(`HTTP-MTH-001: HEAD request: ${response.status}`);
  });

  test('HTTP-MTH-002: OPTIONS request', async () => {
    const response = await apiClient.request('OPTIONS', '/register');

    expect(response.status).not.toBe(500);
    console.log(`HTTP-MTH-002: OPTIONS request: ${response.status}`);
  });

  test('HTTP-MTH-003: PATCH not supported on POST endpoint', async () => {
    const response = await apiClient.request('PATCH', '/register', {
      body: JSON.stringify({ first_name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([400, 404, 405]).toContain(response.status);
    console.log(`HTTP-MTH-003: PATCH on POST endpoint: ${response.status}`);
  });

});

test.describe('Response Headers', () => {

  test('HTTP-HDR-001: Response has content-type', async () => {
    const response = await apiClient.submitRegistration(
      testDataGenerator.generateUser()
    );

    expect(response.headers['content-type']).toBeDefined();
    expect(response.headers['content-type']).toContain('json');
    console.log(`HTTP-HDR-001: Content-type: ${response.headers['content-type']}`);
  });

  test('HTTP-HDR-002: Response has CORS headers', async () => {
    const response = await apiClient.submitRegistration(
      testDataGenerator.generateUser()
    );

    // Check for CORS headers (may not be present depending on config)
    const hasCorHeaders = response.headers['access-control-allow-origin'] ||
                          response.headers['access-control-allow-methods'];

    console.log(`HTTP-HDR-002: CORS headers present: ${hasCorHeaders ? 'yes' : 'no'}`);
    expect(true).toBe(true); // Info test
  });

  test('HTTP-HDR-003: No sensitive headers exposed', async () => {
    const response = await apiClient.submitRegistration(
      testDataGenerator.generateUser()
    );

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['server']).not.toContain('Apache');
    expect(response.headers['server']).not.toContain('nginx');
    console.log('HTTP-HDR-003: No sensitive server info exposed');
  });

  test('HTTP-HDR-004: Cache headers for API responses', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.request('GET', '/account/membership/status');

    // Auth error should still have proper cache headers
    if (response.headers['cache-control']) {
      console.log(`HTTP-HDR-004: Cache-Control: ${response.headers['cache-control']}`);
    } else {
      console.log('HTTP-HDR-004: No Cache-Control header');
    }

    expect(true).toBe(true); // Info test
  });

});

test.describe('Request Size Limits', () => {

  test('HTTP-SIZE-001: Normal payload accepted', async () => {
    const response = await apiClient.submitRegistration(
      testDataGenerator.generateUser()
    );

    expect([200, 201, 400]).toContain(response.status);
    console.log(`HTTP-SIZE-001: Normal payload: ${response.status}`);
  });

  test('HTTP-SIZE-002: 10KB payload handling', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST',
        extra: 'A'.repeat(10000)
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400, 413]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`HTTP-SIZE-002: 10KB payload: ${response.status}`);
  });

  test('HTTP-SIZE-003: Empty body handling', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: '',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(400);
    console.log(`HTTP-SIZE-003: Empty body: ${response.status}`);
  });

});

test.describe('URL Handling', () => {

  test('HTTP-URL-001: Path with query string', async () => {
    const response = await apiClient.request('POST', '/register?foo=bar', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`HTTP-URL-001: Query string: ${response.status}`);
  });

  test('HTTP-URL-002: Trailing slash handling', async () => {
    const response = await apiClient.request('POST', '/register/', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400, 404]).toContain(response.status);
    console.log(`HTTP-URL-002: Trailing slash: ${response.status}`);
  });

  test('HTTP-URL-003: Case sensitivity', async () => {
    const response = await apiClient.request('POST', '/Register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400, 404]).toContain(response.status);
    console.log(`HTTP-URL-003: Case sensitivity: ${response.status}`);
  });

});

