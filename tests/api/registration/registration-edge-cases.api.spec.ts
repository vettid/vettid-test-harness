import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Registration Edge Cases API Tests
 * Tests boundary conditions, concurrent operations, and unusual scenarios
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Registration Edge Cases', () => {

  test.describe('Duplicate Detection', () => {

    test('REG-EDGE-001: Duplicate email in same session is rejected', async () => {
      const user = testDataGenerator.generateUser();

      // First registration
      const first = await apiClient.submitRegistration(user);
      expect(first.status).toBe(201);

      // Immediate duplicate
      const duplicate = await apiClient.submitRegistration(user);
      await apiClient.expectStatusOneOf(duplicate, [400, 409]);
      expect(duplicate.body.error || duplicate.body.message).toMatch(/already|exist|duplicate/i);
    });

    test('REG-EDGE-002: Duplicate email with different case', async () => {
      const timestamp = Date.now();
      const email = `test-${timestamp}@test.vettid.dev`;

      // Register with lowercase
      const first = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: email.toLowerCase(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      if (first.status !== 201) {
        test.skip();
        return;
      }

      // Attempt with uppercase
      const duplicate = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: email.toUpperCase(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Emails should be case-insensitive - expect rejection
      await apiClient.expectStatusOneOf(duplicate, [400, 409]);
    });

    test('REG-EDGE-003: Duplicate email with mixed case', async () => {
      const timestamp = Date.now();
      const email = `Test-${timestamp}@Test.VettID.dev`;

      const first = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: email,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      if (first.status !== 201) {
        test.skip();
        return;
      }

      // Try with different case pattern
      const duplicate = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: email.toLowerCase(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      await apiClient.expectStatusOneOf(duplicate, [400, 409]);
    });

    test('REG-EDGE-004: Duplicate email with leading/trailing whitespace', async () => {
      const timestamp = Date.now();
      const email = `test-${timestamp}@test.vettid.dev`;

      const first = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: email,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      if (first.status !== 201) {
        test.skip();
        return;
      }

      // Try with whitespace
      const duplicate = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `  ${email}  `,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should trim and detect duplicate
      await apiClient.expectStatusOneOf(duplicate, [400, 409]);
    });
  });

  test.describe('Invite Code Edge Cases', () => {

    test('REG-EDGE-005: Valid invite with 0 remaining uses is rejected', async () => {
      // This test requires an exhausted invite code
      if (!process.env.EXHAUSTED_INVITE_CODE) {
        test.skip();
        return;
      }

      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.EXHAUSTED_INVITE_CODE
      });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toMatch(/exhausted|max.*uses|no.*uses.*remaining/i);
    });

    test('REG-EDGE-006: Expired invite code is rejected', async () => {
      // This test requires an expired invite code
      if (!process.env.EXPIRED_INVITE_CODE) {
        test.skip();
        return;
      }

      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.EXPIRED_INVITE_CODE
      });

      expect(response.status).toBe(400);
      expect(response.body.error || response.body.message).toMatch(/expired|no longer valid/i);
    });

    test('REG-EDGE-007: Very long invite code is handled', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'A'.repeat(1000)
      });

      expect(response.status).toBe(400);
    });

    test('REG-EDGE-008: Invite code with special characters', async () => {
      const specialCodes = [
        'CODE<>TEST',
        "CODE'TEST",
        'CODE"TEST',
        'CODE&TEST',
        'CODE%TEST'
      ];

      for (const code of specialCodes) {
        const response = await apiClient.submitRegistration({
          first_name: 'Test',
          last_name: 'User',
          email: testDataGenerator.generateEmail(),
          invite_code: code
        });

        // Should reject as invalid (not crash)
        expect(response.status).toBe(400);
        expect(response.status).not.toBe(500);
      }
    });

    test('REG-EDGE-009: Invite code with unicode characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'CODE-测试-123'
      });

      expect(response.status).toBe(400);
    });
  });

  test.describe('Concurrent Operations', () => {

    test('REG-EDGE-010: Concurrent registrations with same email', async () => {
      const user = testDataGenerator.generateUser();

      // Submit multiple registrations concurrently
      const [response1, response2, response3] = await Promise.all([
        apiClient.submitRegistration(user),
        apiClient.submitRegistration(user),
        apiClient.submitRegistration(user)
      ]);

      // Exactly one should succeed
      const successes = [response1, response2, response3].filter(r => r.status === 201);
      const failures = [response1, response2, response3].filter(r => r.status !== 201);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);

      // Failures should be 400/409
      for (const failure of failures) {
        await apiClient.expectStatusOneOf(failure, [400, 409]);
      }
    });

    test('REG-EDGE-011: Concurrent registrations with same invite code', async () => {
      const inviteCode = process.env.TEST_INVITE_CODE || '';
      if (!inviteCode) {
        test.skip();
        return;
      }

      // Create multiple unique users with same invite
      const users = Array.from({ length: 5 }, () => testDataGenerator.generateUser({
        invite_code: inviteCode
      }));

      // Submit concurrently
      const responses = await Promise.all(
        users.map(user => apiClient.submitRegistration(user))
      );

      // All should either succeed (201) or fail gracefully (400/409)
      // None should crash (500)
      for (const response of responses) {
        expect(response.status).not.toBe(500);
      }
    });

    test('REG-EDGE-012: Rapid sequential registrations', async () => {
      const responses = [];

      for (let i = 0; i < 10; i++) {
        const user = testDataGenerator.generateUser();
        const response = await apiClient.submitRegistration(user);
        responses.push(response);
      }

      // None should crash
      for (const response of responses) {
        expect(response.status).not.toBe(500);
      }
    });
  });

  test.describe('Boundary Conditions', () => {

    test('REG-EDGE-013: Minimum valid name lengths', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'A',
        last_name: 'B',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Single character names should be valid
      expect(response.status).not.toBe(500);
    });

    test('REG-EDGE-014: Maximum valid name length (500 chars)', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'A'.repeat(500),
        last_name: 'B'.repeat(500),
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // 500 chars should be at the boundary
      expect(response.status).not.toBe(500);
    });

    test('REG-EDGE-015: Email at maximum length boundary', async () => {
      // RFC 5321 limits email to 254 characters
      const localPart = 'a'.repeat(64); // Max local part
      const domain = 'a'.repeat(180) + '.com'; // Fill to ~254
      const longEmail = `${localPart}@${domain}`;

      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: longEmail,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should handle boundary case
      expect(response.status).not.toBe(500);
    });

    test('REG-EDGE-016: Names with only special characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: "---",
        last_name: "'''",
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // May reject, but should not crash
      expect(response.status).not.toBe(500);
    });

    test('REG-EDGE-017: Names with numbers', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'John3',
        last_name: 'Smith2nd',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Names with numbers should be handled
      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Auto-Approve Flow', () => {

    test('REG-EDGE-018: Auto-approve invite creates approved user', async () => {
      if (!process.env.AUTO_APPROVE_INVITE_CODE) {
        test.skip();
        return;
      }

      const user = testDataGenerator.generateUser({
        invite_code: process.env.AUTO_APPROVE_INVITE_CODE
      });

      const response = await apiClient.submitRegistration(user);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('approved');
      expect(response.body.auto_approved).toBe(true);
    });

    test('REG-EDGE-019: Non-auto-approve invite creates pending user', async () => {
      const user = testDataGenerator.generateUser();
      const response = await apiClient.submitRegistration(user);

      if (response.status === 201) {
        expect(response.body.status).toBe('pending');
        expect(response.body.auto_approved).toBeFalsy();
      }
    });
  });

  test.describe('Idempotency', () => {

    test('REG-EDGE-020: Same request twice returns consistent results', async () => {
      const user = testDataGenerator.generateUser();

      const first = await apiClient.submitRegistration(user);
      const second = await apiClient.submitRegistration(user);

      // First should succeed
      expect(first.status).toBe(201);

      // Second should fail with duplicate
      expect(second.status).not.toBe(201);
      expect(second.status).not.toBe(500);
    });
  });

  test.describe('Malformed Requests', () => {

    test('REG-EDGE-021: Empty request body', async () => {
      const response = await apiClient.makeRequest('POST', '/register', {});

      expect(response.status).toBe(400);
    });

    test('REG-EDGE-022: Null values in required fields', async () => {
      const response = await apiClient.makeRequest('POST', '/register', {
        first_name: null,
        last_name: null,
        email: null,
        invite_code: null
      });

      expect(response.status).toBe(400);
    });

    test('REG-EDGE-023: Undefined values in required fields', async () => {
      const response = await apiClient.makeRequest('POST', '/register', {
        first_name: undefined,
        last_name: undefined,
        email: undefined,
        invite_code: undefined
      });

      expect(response.status).toBe(400);
    });

    test('REG-EDGE-024: Array instead of object body', async () => {
      const response = await apiClient.makeRequest('POST', '/register', [
        'first_name', 'last_name', 'email', 'invite_code'
      ]);

      expect(response.status).toBe(400);
    });

    test('REG-EDGE-025: String instead of object body', async () => {
      // This might be harder to test with the current client
      // The client will serialize to JSON anyway
      const response = await apiClient.makeRequest('POST', '/register',
        'invalid string body' as any
      );

      expect(response.status).not.toBe(500);
    });

    test('REG-EDGE-026: Very large request body', async () => {
      const response = await apiClient.makeRequest('POST', '/register', {
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || '',
        extra_data: 'X'.repeat(100000) // 100KB of extra data
      });

      // Should handle large payload gracefully
      expect(response.status).not.toBe(500);
    });

    test('REG-EDGE-027: Deeply nested objects', async () => {
      let nested: any = { value: 'test' };
      for (let i = 0; i < 100; i++) {
        nested = { nested };
      }

      const response = await apiClient.makeRequest('POST', '/register', {
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || '',
        deep: nested
      });

      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Performance Edge Cases', () => {

    test('REG-EDGE-028: Registration completes within timeout', async () => {
      const user = testDataGenerator.generateUser();

      apiClient.startTimer();
      const response = await apiClient.submitRegistration(user);

      if (response.status === 201) {
        // Should complete within 5 seconds
        await apiClient.expectFastResponse(5000);
      }
    });

    test('REG-EDGE-029: Multiple sequential registrations perform consistently', async () => {
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const user = testDataGenerator.generateUser();
        const start = Date.now();
        await apiClient.submitRegistration(user);
        times.push(Date.now() - start);
      }

      // Calculate average and check consistency
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const maxDeviation = Math.max(...times.map(t => Math.abs(t - avg)));

      // Max deviation should be less than 3x average (allowing for variance)
      expect(maxDeviation).toBeLessThan(avg * 3);
    });
  });
});

test.describe('Registration State Transitions', () => {

  test('REG-EDGE-030: Newly created registration has correct initial state', async () => {
    const user = testDataGenerator.generateUser();
    const response = await apiClient.submitRegistration(user);

    if (response.status === 201) {
      expect(response.body.status).toMatch(/pending|approved/);
      expect(response.body.registration_id).toBeDefined();
      expect(response.body.email).toBe(user.email);

      // Should not have approval metadata yet (unless auto-approved)
      if (response.body.status === 'pending') {
        expect(response.body.approved_at).toBeUndefined();
        expect(response.body.approved_by).toBeUndefined();
      }
    }
  });

  test('REG-EDGE-031: Registration includes created_at timestamp', async () => {
    const user = testDataGenerator.generateUser();
    const response = await apiClient.submitRegistration(user);

    if (response.status === 201) {
      expect(response.body.created_at).toBeDefined();

      // Verify timestamp is recent (within last minute)
      const createdAt = new Date(response.body.created_at).getTime();
      const now = Date.now();
      expect(now - createdAt).toBeLessThan(60000);
    }
  });
});
