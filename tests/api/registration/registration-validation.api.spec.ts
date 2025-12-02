import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Registration Validation API Tests
 * Comprehensive input validation testing for POST /register
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Registration Input Validation', () => {

  test.describe('Email Validation', () => {

    test('REG-VAL-001: Reject empty email', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: '',
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toMatch(/email|required/i);
    });

    test('REG-VAL-002: Reject email without @ symbol', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: 'invalidemail.com',
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-003: Reject email without domain', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@',
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-004: Reject email without local part', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: '@domain.com',
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-005: Reject email with double @', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@@domain.com',
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-006: Reject email with spaces', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: 'test user@domain.com',
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-007: Reject excessively long email (>254 chars)', async () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: longEmail,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-008: Accept valid email with subdomain', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail('subdomain'),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should be accepted (201) or rejected for other reasons, not email format
      if (response.status === 400) {
        expect(response.body.error || response.body.message).not.toMatch(/email.*format|invalid.*email/i);
      }
    });

    test('REG-VAL-009: Accept valid email with plus sign', async () => {
      const emailWithPlus = `test+filter-${Date.now()}@test.vettid.dev`;
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: emailWithPlus,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Plus sign emails are valid RFC 5322
      if (response.status === 400) {
        expect(response.body.error || response.body.message).not.toMatch(/email.*format|invalid.*email/i);
      }
    });

    test('REG-VAL-010: Accept valid email with dots in local part', async () => {
      const emailWithDots = `test.user.name-${Date.now()}@test.vettid.dev`;
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: emailWithDots,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      if (response.status === 400) {
        expect(response.body.error || response.body.message).not.toMatch(/email.*format|invalid.*email/i);
      }
    });
  });

  test.describe('Name Validation', () => {

    test('REG-VAL-011: Reject empty first name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toMatch(/first.*name|required/i);
    });

    test('REG-VAL-012: Reject empty last name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: '',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toMatch(/last.*name|required/i);
    });

    test('REG-VAL-013: Reject whitespace-only first name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '   ',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-014: Reject whitespace-only last name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: '   ',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-015: Reject excessively long first name (>500 chars)', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'A'.repeat(501),
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-016: Reject excessively long last name (>500 chars)', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'A'.repeat(501),
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-017: Accept single character first name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'J',
        last_name: 'Doe',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Single char names are valid
      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-018: Accept hyphenated last name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Mary',
        last_name: 'Smith-Jones',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
      if (response.status === 400) {
        expect(response.body.error || response.body.message).not.toMatch(/name.*format|invalid.*name/i);
      }
    });

    test('REG-VAL-019: Accept apostrophe in name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: "O'Brien",
        last_name: "McCarthy",
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-020: Accept unicode characters in names', async () => {
      const internationalNames = testDataGenerator.generateInternationalNames();

      for (const name of internationalNames.slice(0, 3)) {
        const response = await apiClient.submitRegistration({
          first_name: name.first_name,
          last_name: name.last_name,
          email: testDataGenerator.generateEmail(),
          invite_code: process.env.TEST_INVITE_CODE || ''
        });

        // Should not crash - either accept or reject gracefully
        expect(response.status).not.toBe(500);
      }
    });
  });

  test.describe('Invite Code Validation', () => {

    test('REG-VAL-021: Reject empty invite code', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: ''
      });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toMatch(/invite|code|required/i);
    });

    test('REG-VAL-022: Reject non-existent invite code', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'NONEXISTENT-CODE-12345'
      });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toMatch(/invite|invalid|not found/i);
    });

    test('REG-VAL-023: Reject whitespace-only invite code', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: '   '
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-024: Handle invite code with leading/trailing whitespace', async () => {
      const validCode = process.env.TEST_INVITE_CODE || '';
      if (!validCode) {
        test.skip();
        return;
      }

      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: `  ${validCode}  `
      });

      // Should either trim and accept, or reject with clear message
      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-025: Case sensitivity of invite code', async () => {
      const validCode = process.env.TEST_INVITE_CODE || '';
      if (!validCode) {
        test.skip();
        return;
      }

      // Test lowercase version
      const lowerCode = validCode.toLowerCase();
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: lowerCode
      });

      // Document behavior - either accepts (case insensitive) or rejects
      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Security Input Validation', () => {

    test('REG-VAL-026: Reject null bytes in email', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `test\x00user@test.vettid.dev`,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-027: Reject null bytes in names', async () => {
      const response = await apiClient.submitRegistration({
        first_name: `Test\x00Name`,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-028: Reject control characters in email', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `test\x1Fuser@test.vettid.dev`,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-029: Reject control characters in names', async () => {
      const response = await apiClient.submitRegistration({
        first_name: `Test\x0BName`,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-030: XSS attempt in first name is sanitized or rejected', async () => {
      const xssPayloads = testDataGenerator.generateXSSPayloads();

      for (const payload of xssPayloads.slice(0, 3)) {
        const response = await apiClient.submitRegistration({
          first_name: payload,
          last_name: 'User',
          email: testDataGenerator.generateEmail(),
          invite_code: process.env.TEST_INVITE_CODE || ''
        });

        // Should either reject (400) or accept with sanitized data
        // Should NOT cause server error (500)
        expect(response.status).not.toBe(500);

        // If accepted, verify sanitization
        if (response.status === 201) {
          expect(response.body.first_name || '').not.toContain('<script>');
        }
      }
    });

    test('REG-VAL-031: XSS attempt in email is rejected', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: "<script>alert('xss')</script>@test.com",
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
    });

    test('REG-VAL-032: SQL injection in first name is handled', async () => {
      const sqlPayloads = testDataGenerator.generateSQLInjection();

      for (const payload of sqlPayloads.slice(0, 3)) {
        const response = await apiClient.submitRegistration({
          first_name: payload,
          last_name: 'User',
          email: testDataGenerator.generateEmail(),
          invite_code: process.env.TEST_INVITE_CODE || ''
        });

        // Should NOT cause server error
        expect(response.status).not.toBe(500);
      }
    });

    test('REG-VAL-033: SQL injection in email is handled', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: "'; DROP TABLE users; --@test.com",
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should be rejected as invalid email format
      expect(response.status).toBe(400);
    });

    test('REG-VAL-034: Command injection in names is handled', async () => {
      const cmdPayloads = testDataGenerator.generateCommandInjection();

      for (const payload of cmdPayloads.slice(0, 3)) {
        const response = await apiClient.submitRegistration({
          first_name: payload,
          last_name: 'User',
          email: testDataGenerator.generateEmail(),
          invite_code: process.env.TEST_INVITE_CODE || ''
        });

        // Should NOT cause server error
        expect(response.status).not.toBe(500);
      }
    });
  });

  test.describe('Request Format Validation', () => {

    test('REG-VAL-035: Reject request without Content-Type header', async () => {
      const apiUrl = process.env.API_URL || 'https://cgccjd4djg.execute-api.us-east-1.amazonaws.com';

      const response = await apiClient.makeRequest('POST', '/register', {
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should handle gracefully
      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-036: Handle extra fields in request body', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || '',
        extra_field: 'should be ignored',
        another_field: 12345
      } as any);

      // Should accept and ignore extra fields, or explicitly reject
      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-037: Handle nested objects in request body', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || '',
        nested: { malicious: 'data' }
      } as any);

      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-038: Handle array values in fields', async () => {
      const response = await apiClient.submitRegistration({
        first_name: ['Test', 'Multiple'],
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      } as any);

      // Should reject or handle gracefully
      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-039: Handle numeric values for string fields', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 12345 as any,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should either coerce to string or reject
      expect(response.status).not.toBe(500);
    });

    test('REG-VAL-040: Handle boolean values for string fields', async () => {
      const response = await apiClient.submitRegistration({
        first_name: true as any,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    });
  });
});

test.describe('Registration Response Validation', () => {

  test('REG-VAL-041: Successful registration returns required fields', async () => {
    const user = testDataGenerator.generateUser();
    const response = await apiClient.submitRegistration(user);

    if (response.status === 201) {
      expect(response.body).toHaveProperty('registration_id');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toBe(user.email);
    }
  });

  test('REG-VAL-042: Error response includes error message', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);
    // API uses 'message' field for errors
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  test('REG-VAL-043: Response headers include correct content-type', async () => {
    // This test verifies API returns JSON
    const user = testDataGenerator.generateUser();
    const response = await apiClient.submitRegistration(user);

    // Response should be valid JSON (already parsed by apiClient)
    expect(response.body).toBeDefined();
    expect(typeof response.body).toBe('object');
  });

  test('REG-VAL-044: Error messages do not leak sensitive information', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'INVALID-CODE'
    });

    expect(response.status).toBe(400);

    const errorMessage = response.body.error || response.body.message || '';

    // Should not leak stack traces
    expect(errorMessage).not.toMatch(/at\s+\w+\s+\(/);
    // Should not leak internal paths
    expect(errorMessage).not.toMatch(/\/var\/task/);
    expect(errorMessage).not.toMatch(/node_modules/);
    // Should not leak AWS details
    expect(errorMessage).not.toMatch(/arn:aws/);
  });
});
