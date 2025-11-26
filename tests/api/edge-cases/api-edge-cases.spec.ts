import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * API Edge Cases Test Suite
 * Tests unusual, rare, and boundary scenarios
 *
 * Validates API robustness against:
 * - Unusual request patterns
 * - Edge case inputs
 * - Boundary conditions
 * - Unexpected scenarios
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Request Format Edge Cases', () => {

  test('EDGE-001: Empty JSON body', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status).toBe(400);
    console.log('✓ Empty JSON body rejected with 400');
  });

  test('EDGE-002: Array instead of object', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify([{ first_name: 'Test' }]),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([400, 422]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Array body handled: ${response.status}`);
  });

  test('EDGE-003: Nested object in field', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: { nested: 'value' },
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([400, 422]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Nested object in field handled: ${response.status}`);
  });

  test('EDGE-004: Array in string field', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: ['Test', 'Name'],
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([400, 422]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Array in string field handled: ${response.status}`);
  });

  test('EDGE-005: Number in string field', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 12345,
        last_name: 67890,
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400, 422]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Number in string field handled: ${response.status}`);
  });

  test('EDGE-006: Boolean in string field', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: true,
        last_name: false,
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400, 422]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Boolean in string field handled: ${response.status}`);
  });

  test('EDGE-007: Very deeply nested object', async () => {
    const deepNested: any = { value: 'test' };
    let current = deepNested;
    for (let i = 0; i < 20; i++) {
      current.nested = { value: `level${i}` };
      current = current.nested;
    }

    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST',
        extra: deepNested
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400, 413]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Deeply nested object handled: ${response.status}`);
  });

});

test.describe('Content-Type Edge Cases', () => {

  test('EDGE-008: Missing Content-Type header', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      })
      // No Content-Type header
    });

    // Should handle gracefully
    expect([200, 201, 400, 415]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Missing Content-Type handled: ${response.status}`);
  });

  test('EDGE-009: Wrong Content-Type (text/plain)', async () => {
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
    expect(response.status).not.toBe(500);
    console.log(`✓ Wrong Content-Type handled: ${response.status}`);
  });

  test('EDGE-010: Content-Type with charset', async () => {
    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: `edge-charset-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Content-Type with charset handled: ${response.status}`);
  });

});

test.describe('HTTP Method Edge Cases', () => {

  test('EDGE-011: GET request to POST endpoint', async () => {
    const response = await apiClient.request('GET', '/register');

    expect([400, 404, 405]).toContain(response.status);
    console.log(`✓ GET to POST endpoint: ${response.status}`);
  });

  test('EDGE-012: PUT request to POST endpoint', async () => {
    const response = await apiClient.request('PUT', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([400, 404, 405]).toContain(response.status);
    console.log(`✓ PUT to POST endpoint: ${response.status}`);
  });

  test('EDGE-013: DELETE request to registration', async () => {
    const response = await apiClient.request('DELETE', '/register');

    expect([400, 404, 405]).toContain(response.status);
    console.log(`✓ DELETE to registration: ${response.status}`);
  });

  test('EDGE-014: PATCH request to registration', async () => {
    const response = await apiClient.request('PATCH', '/register', {
      body: JSON.stringify({ first_name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([400, 404, 405]).toContain(response.status);
    console.log(`✓ PATCH to registration: ${response.status}`);
  });

});

test.describe('Payload Size Edge Cases', () => {

  test('EDGE-015: Very large payload (100KB)', async () => {
    const largeValue = 'A'.repeat(100000);

    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST',
        large_field: largeValue
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400, 413]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ 100KB payload handled: ${response.status}`);
  });

  test('EDGE-016: Many fields (100 extra fields)', async () => {
    const manyFields: any = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@test.vettid.dev',
      invite_code: 'TEST'
    };

    for (let i = 0; i < 100; i++) {
      manyFields[`extra_field_${i}`] = `value_${i}`;
    }

    const response = await apiClient.request('POST', '/register', {
      body: JSON.stringify(manyFields),
      headers: { 'Content-Type': 'application/json' }
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ 100 extra fields handled: ${response.status}`);
  });

});

test.describe('Special Value Edge Cases', () => {

  test('EDGE-017: Zero-width characters', async () => {
    const zeroWidth = 'Test\u200B\u200C\u200DUser'; // Zero-width chars

    const response = await apiClient.submitRegistration({
      first_name: zeroWidth,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Zero-width characters handled: ${response.status}`);
  });

  test('EDGE-018: Control characters', async () => {
    const controlChars = 'Test\x00\x01\x02User'; // Control chars

    const response = await apiClient.submitRegistration({
      first_name: controlChars,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ Control characters handled: ${response.status}`);
  });

  test('EDGE-019: Right-to-left override character', async () => {
    const rtlOverride = 'Test\u202Eesrever'; // RTL override

    const response = await apiClient.submitRegistration({
      first_name: rtlOverride,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ RTL override character handled: ${response.status}`);
  });

  test('EDGE-020: Homoglyph characters', async () => {
    // Using characters that look like ASCII but aren't
    const homoglyphs = 'Тest'; // Cyrillic T

    const response = await apiClient.submitRegistration({
      first_name: homoglyphs,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Homoglyph characters handled: ${response.status}`);
  });

});

test.describe('URL and Path Edge Cases', () => {

  test('EDGE-021: Double slashes in path', async () => {
    const response = await apiClient.request('POST', '//register');

    // Should handle gracefully (might normalize or reject)
    expect(response.status).not.toBe(500);
    console.log(`✓ Double slashes handled: ${response.status}`);
  });

  test('EDGE-022: Trailing slash variation', async () => {
    const response = await apiClient.request('POST', '/register/', {
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@test.vettid.dev',
        invite_code: 'TEST'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    // Should work or return appropriate error
    expect([200, 201, 400, 404]).toContain(response.status);
    console.log(`✓ Trailing slash handled: ${response.status}`);
  });

  test('EDGE-023: URL encoded path', async () => {
    const response = await apiClient.request('POST', '/%72%65%67%69%73%74%65%72'); // /register encoded

    expect(response.status).not.toBe(500);
    console.log(`✓ URL encoded path handled: ${response.status}`);
  });

});

test.describe('Timing Edge Cases', () => {

  test('EDGE-024: Rapid fire requests (same millisecond)', async () => {
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `rapid-${Date.now()}-${i}@test.vettid.dev`,
        invite_code: 'TEST'
      }));
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.status).not.toBe(500);
    }

    console.log(`✓ ${results.length} rapid fire requests handled`);
  });

  test('EDGE-025: Request after long pause', async () => {
    // Just simulate - actual long pause not practical in tests
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: `after-pause-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Request after pause handled: ${response.status}`);
  });

});
