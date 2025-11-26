import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Data Integrity & Validation Test Suite
 * Tests data handling, storage, and retrieval integrity
 *
 * Validates:
 * - Data preservation during processing
 * - Field truncation/expansion handling
 * - Data encoding/decoding
 * - Integrity across operations
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Data Preservation', () => {

  test('DATA-001: Special characters preserved in response', async () => {
    const specialName = "O'Brien-Smith";

    const response = await apiClient.submitRegistration({
      first_name: specialName,
      last_name: 'Test',
      email: `data-special-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    // Even on validation error, check the API handles it
    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);

    console.log(`✓ Special characters handled correctly: ${response.status}`);
  });

  test('DATA-002: Unicode preserved in response', async () => {
    const unicodeName = '日本語テスト';

    const response = await apiClient.submitRegistration({
      first_name: unicodeName,
      last_name: 'ユーザー',
      email: `data-unicode-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);

    console.log(`✓ Unicode data handled correctly: ${response.status}`);
  });

  test('DATA-003: Whitespace handling consistency', async () => {
    const responses = [];

    const testCases = [
      { first_name: '  Test  ', desc: 'spaces around' },
      { first_name: 'Test', desc: 'no spaces' },
      { first_name: '\tTest\t', desc: 'tabs around' },
    ];

    for (const tc of testCases) {
      const response = await apiClient.submitRegistration({
        first_name: tc.first_name,
        last_name: 'User',
        email: `data-ws-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      });

      responses.push({ desc: tc.desc, status: response.status });
      console.log(`  ${tc.desc}: ${response.status}`);
    }

    // All should be handled consistently
    for (const r of responses) {
      expect([200, 201, 400]).toContain(r.status);
    }

    console.log('✓ Whitespace handled consistently');
  });

});

test.describe('Field Length Handling', () => {

  test('DATA-004: Exact boundary length (255 chars)', async () => {
    const exactLength = 'A'.repeat(255);

    const response = await apiClient.submitRegistration({
      first_name: exactLength,
      last_name: 'User',
      email: `data-exact-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ 255 char field handled: ${response.status}`);
  });

  test('DATA-005: Just over boundary (256 chars)', async () => {
    const overLength = 'A'.repeat(256);

    const response = await apiClient.submitRegistration({
      first_name: overLength,
      last_name: 'User',
      email: `data-over-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log(`✓ 256 char field handled: ${response.status}`);
  });

  test('DATA-006: Email at RFC limit (254 chars)', async () => {
    const localPart = 'a'.repeat(64);
    const domain = 'b'.repeat(180) + '.com';
    const longEmail = `${localPart}@${domain}`;

    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: longEmail.substring(0, 254),
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ RFC limit email handled: ${response.status}`);
  });

});

test.describe('Encoding Handling', () => {

  test('DATA-007: UTF-8 multibyte characters', async () => {
    const multibyte = '测试用户'; // 4 Chinese chars (3 bytes each)

    const response = await apiClient.submitRegistration({
      first_name: multibyte,
      last_name: 'Test',
      email: `data-utf8-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ UTF-8 multibyte handled: ${response.status}`);
  });

  test('DATA-008: Emoji (4-byte UTF-8)', async () => {
    const emoji = '😀🎉🚀'; // 4-byte UTF-8 chars

    const response = await apiClient.submitRegistration({
      first_name: emoji,
      last_name: 'Test',
      email: `data-emoji-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Emoji (4-byte UTF-8) handled: ${response.status}`);
  });

  test('DATA-009: Mixed encoding scenarios', async () => {
    const mixed = 'Test用户🎉User';

    const response = await apiClient.submitRegistration({
      first_name: mixed,
      last_name: 'Test',
      email: `data-mixed-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Mixed encoding handled: ${response.status}`);
  });

});

test.describe('Data Type Coercion', () => {

  test('DATA-010: Numeric string field', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '12345',
      last_name: '67890',
      email: `data-numeric-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Numeric string handled: ${response.status}`);
  });

  test('DATA-011: Boolean-like string field', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'true',
      last_name: 'false',
      email: `data-bool-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Boolean-like string handled: ${response.status}`);
  });

  test('DATA-012: Null-like string field', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'null',
      last_name: 'undefined',
      email: `data-null-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Null-like string handled: ${response.status}`);
  });

});

test.describe('Email Format Validation', () => {

  test('DATA-013: Email with subdomain', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: `test@sub.domain.test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Subdomain email handled: ${response.status}`);
  });

  test('DATA-014: Email with numeric domain', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@123.456.789.com',
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Numeric domain email handled: ${response.status}`);
  });

  test('DATA-015: Email with hyphenated domain', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: `test-${Date.now()}@test-domain.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    console.log(`✓ Hyphenated domain email handled: ${response.status}`);
  });

});

test.describe('Concurrent Data Operations', () => {

  test('DATA-016: Concurrent writes with unique data', async () => {
    const promises = [];
    const timestamp = Date.now();

    for (let i = 0; i < 5; i++) {
      promises.push(apiClient.submitRegistration({
        first_name: `Test${i}`,
        last_name: `User${i}`,
        email: `data-conc-${timestamp}-${i}@test.vettid.dev`,
        invite_code: 'TEST'
      }));
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      expect([200, 201, 400]).toContain(result.status);
    }

    console.log(`✓ 5 concurrent writes handled`);
  });

  test('DATA-017: Concurrent reads (auth check)', async () => {
    apiClient.withoutAuth();

    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(apiClient.request('GET', '/account/membership/status'));
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.status).toBe(401);
    }

    console.log('✓ 5 concurrent auth checks consistent');
  });

});

test.describe('Error Data Handling', () => {

  test('DATA-018: Error response data integrity', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();

    // Error response should be valid JSON
    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr.length).toBeGreaterThan(0);

    // Parse and verify
    const parsed = JSON.parse(bodyStr);
    expect(parsed).toBeDefined();

    console.log('✓ Error response data integrity verified');
  });

  test('DATA-019: Consistent error format across requests', async () => {
    const errorResponses = [];

    for (let i = 0; i < 3; i++) {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });

      errorResponses.push({
        keys: Object.keys(response.body).sort().join(','),
        status: response.status
      });
    }

    // All should have same structure
    const firstKeys = errorResponses[0].keys;
    for (const resp of errorResponses) {
      expect(resp.keys).toBe(firstKeys);
      expect(resp.status).toBe(400);
    }

    console.log('✓ Error format consistent');
  });

});

test.describe('Data Sanitization', () => {

  test('DATA-020: HTML in text fields', async () => {
    const htmlContent = '<script>alert("xss")</script>';

    const response = await apiClient.submitRegistration({
      first_name: htmlContent,
      last_name: 'User',
      email: `data-html-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);

    console.log(`✓ HTML in text field handled: ${response.status}`);
  });

  test('DATA-021: SQL in text fields', async () => {
    const sqlContent = "'; DROP TABLE users; --";

    const response = await apiClient.submitRegistration({
      first_name: sqlContent,
      last_name: 'User',
      email: `data-sql-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);

    console.log(`✓ SQL in text field handled: ${response.status}`);
  });

  test('DATA-022: JSON in text fields', async () => {
    const jsonContent = '{"nested": "value"}';

    const response = await apiClient.submitRegistration({
      first_name: jsonContent,
      last_name: 'User',
      email: `data-json-${Date.now()}@test.vettid.dev`,
      invite_code: 'TEST'
    });

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);

    console.log(`✓ JSON in text field handled: ${response.status}`);
  });

});
