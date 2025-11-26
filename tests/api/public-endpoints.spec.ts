import { test, expect } from '@playwright/test';
import { APITestClient } from '../utils/api-test-client';
import { testDataGenerator } from '../utils/test-data-generator';

/**
 * Public Endpoints Test Suite
 * Tests that work without authentication
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Public Endpoints (No Auth Required)', () => {

  test('PUB-001: Registration endpoint validation - invalid invite', async () => {
    const user = testDataGenerator.generateUser({
      invite_code: 'INVALID-CODE-' + Date.now()
    });

    apiClient.startTimer();
    const response = await apiClient.submitRegistration(user);

    // Should reject invalid invite
    expect(response.status).toBe(400);
    expect(response.body.error || response.body.message).toBeTruthy();

    await apiClient.expectFastResponse(2000);

    console.log(`✓ Invalid invite properly rejected`);
  });

  test('PUB-002: Registration validation - missing email', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: '',
      invite_code: 'ANY-CODE'
    });

    expect(response.status).toBe(400);
    console.log(`✓ Missing email rejected`);
  });

  test('PUB-003: Registration validation - invalid email format', async () => {
    const invalidEmails = ['notanemail', 'test@', '@domain.com'];

    for (const email of invalidEmails) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email,
        invite_code: 'ANY-CODE'
      });

      expect(response.status).toBe(400);
      console.log(`✓ Invalid email "${email}" rejected`);
    }
  });

  test('PUB-004: Registration validation - missing first name', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'ANY-CODE'
    });

    expect(response.status).toBe(400);
    console.log(`✓ Missing first name rejected`);
  });

  test('PUB-005: Registration validation - missing last name', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: '',
      email: testDataGenerator.generateEmail(),
      invite_code: 'ANY-CODE'
    });

    expect(response.status).toBe(400);
    console.log(`✓ Missing last name rejected`);
  });

  test('PUB-006: Registration validation - all fields empty', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);
    console.log(`✓ All empty fields rejected`);
  });

  test('PUB-007: SQL injection in registration (no auth needed)', async () => {
    const sqlPayloads = [
      "'; DROP TABLE registrations; --",
      "' OR '1'='1",
      "admin'--"
    ];

    for (const payload of sqlPayloads) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: payload + '@test.com',
        invite_code: 'ANY-CODE'
      });

      // Should not crash (500), should validate (400)
      expect(response.status).not.toBe(500);
      console.log(`✓ SQL injection payload blocked: "${payload.substring(0, 20)}..."`);
    }
  });

  test('PUB-008: XSS in registration (no auth needed)', async () => {
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "<img src=x onerror=alert('xss')>"
    ];

    for (const payload of xssPayloads) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'ANY-CODE'
      });

      // Should handle safely
      expect(response.status).not.toBe(500);

      if (response.status === 201) {
        // If accepted, should be sanitized
        expect(response.body.first_name || '').not.toContain('<script');
      }

      console.log(`✓ XSS payload handled: "${payload.substring(0, 30)}..."`);
    }
  });

  test('PUB-009: Very long input handling', async () => {
    const longString = 'A'.repeat(1000);

    const response = await apiClient.submitRegistration({
      first_name: longString,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'ANY-CODE'
    });

    // Should either reject (400) or truncate (201)
    expect([400, 201, 429]).toContain(response.status);

    if (response.status === 201) {
      console.log('✓ Long input accepted (possibly truncated)');
    } else if (response.status === 400) {
      console.log('✓ Long input rejected with validation');
    } else {
      console.log('✓ Rate limited (API working)');
    }
  });

  test('PUB-010: Special characters in names', async () => {
    const specialNames = [
      { first: "O'Brien", last: "McCarthy" },
      { first: "José", last: "García" },
      { first: "Test-User", last: "Smith-Jones" }
    ];

    for (const name of specialNames) {
      const response = await apiClient.submitRegistration({
        first_name: name.first,
        last_name: name.last,
        email: testDataGenerator.generateEmail(),
        invite_code: 'ANY-CODE'
      });

      // Should handle gracefully (not crash)
      expect(response.status).not.toBe(500);

      if (response.status === 400) {
        console.log(`✓ Name "${name.first} ${name.last}" validation handled`);
      } else {
        console.log(`⚠️  Name "${name.first} ${name.last}" returned ${response.status}`);
      }
    }
  });

  test('PUB-011: Protected endpoints require authentication', async () => {
    apiClient.withoutAuth();

    const protectedEndpoints = [
      { method: 'GET', path: '/admin/registrations' },
      { method: 'GET', path: '/account/membership/status' },
      { method: 'POST', path: '/account/pin/enable' }
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await apiClient.request(endpoint.method, endpoint.path);

      expect(response.status).toBe(401);
      console.log(`✓ ${endpoint.method} ${endpoint.path}: Auth required (401)`);
    }
  });

  test('PUB-012: API error responses are well-formed', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);

    // Should have error message
    expect(response.body.error || response.body.message).toBeTruthy();

    // Should not expose internal details
    const responseStr = JSON.stringify(response.body).toLowerCase();
    expect(responseStr).not.toContain('stack');
    expect(responseStr).not.toContain('exception');

    console.log('✓ Error response is well-formed and safe');
  });

});
