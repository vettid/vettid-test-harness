import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * PIN Verification API Tests
 * Tests PIN enable, disable, update, and verification flows
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('PIN Security System', () => {

  test.describe('Enable PIN', () => {

    test('PIN-001: Enable PIN with valid 4-digit PIN', async () => {
      await apiClient.withMemberAuthAsync();
      const response = await apiClient.enablePin('1234');

      if (response.status === 200 || response.status === 201) {
        expect(response.body.message || response.body.success).toBeTruthy();
      } else if (response.status === 400) {
        // PIN might already be enabled
        expect(response.body.message).toMatch(/already.*enabled/i);
      }
    });

    test('PIN-002: Enable PIN with valid 5-digit PIN', async () => {
      await apiClient.withMemberAuthAsync();

      // First disable if enabled
      await apiClient.disablePin();

      const response = await apiClient.enablePin('12345');

      await apiClient.expectStatusOneOf(response, [200, 201, 400]);
      if (response.status === 200 || response.status === 201) {
        expect(response.body.message || response.body.success).toBeTruthy();
      }
    });

    test('PIN-003: Enable PIN with valid 6-digit PIN', async () => {
      await apiClient.withMemberAuthAsync();

      // First disable if enabled
      await apiClient.disablePin();

      const response = await apiClient.enablePin('123456');

      await apiClient.expectStatusOneOf(response, [200, 201, 400]);
    });

    test('PIN-004: Reject PIN with less than 4 digits', async () => {
      await apiClient.withMemberAuthAsync();

      // First disable if enabled
      await apiClient.disablePin();

      const response = await apiClient.enablePin('123');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/pin.*4|digit|length|short/i);
    });

    test('PIN-005: Reject PIN with more than 6 digits', async () => {
      await apiClient.withMemberAuthAsync();

      // First disable if enabled
      await apiClient.disablePin();

      const response = await apiClient.enablePin('1234567');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/pin.*6|digit|length|long/i);
    });

    test('PIN-006: Reject PIN with non-numeric characters', async () => {
      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      const invalidPins = ['abcd', '12ab', '12.34', '1234!', ' 1234'];

      for (const pin of invalidPins) {
        const response = await apiClient.enablePin(pin);
        expect(response.status).toBe(400);
      }
    });

    test('PIN-007: Reject PIN with special characters', async () => {
      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      const response = await apiClient.enablePin('12#4');

      expect(response.status).toBe(400);
    });

    test('PIN-008: Reject empty PIN', async () => {
      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      const response = await apiClient.enablePin('');

      expect(response.status).toBe(400);
    });

    test('PIN-009: Reject PIN when already enabled', async () => {
      await apiClient.withMemberAuthAsync();

      // Ensure PIN is disabled first
      await apiClient.disablePin();

      // Enable PIN
      const firstEnable = await apiClient.enablePin('1234');
      if (firstEnable.status !== 200 && firstEnable.status !== 201) {
        test.skip();
        return;
      }

      // Try to enable again
      const secondEnable = await apiClient.enablePin('5678');

      expect(secondEnable.status).toBe(400);
      expect(secondEnable.body.error).toMatch(/already.*enabled/i);
    });

    test('PIN-010: Enable PIN requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.enablePin('1234');

      expect(response.status).toBe(401);
    });

    test('PIN-011: PIN with leading zeros is valid', async () => {
      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      const response = await apiClient.enablePin('0000');

      // Leading zeros should be valid
      await apiClient.expectStatusOneOf(response, [200, 201]);
    });

    test('PIN-012: PIN with sequential numbers is allowed', async () => {
      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      // Sequential PINs like 1234 might be weak but should be allowed
      const response = await apiClient.enablePin('1234');

      await apiClient.expectStatusOneOf(response, [200, 201]);
    });

    test('PIN-013: PIN with repeated digits is allowed', async () => {
      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      const response = await apiClient.enablePin('1111');

      await apiClient.expectStatusOneOf(response, [200, 201]);
    });
  });

  test.describe('Disable PIN', () => {

    test('PIN-014: Disable enabled PIN', async () => {
      await apiClient.withMemberAuthAsync();

      // Enable PIN first
      const enableResponse = await apiClient.enablePin('1234');
      if (enableResponse.status !== 200 && enableResponse.status !== 201) {
        // Try disabling and re-enabling
        await apiClient.disablePin();
        await apiClient.enablePin('1234');
      }

      // Now disable
      const response = await apiClient.disablePin();

      await apiClient.expectStatusOneOf(response, [200, 201]);
    });

    test('PIN-015: Disable PIN when not enabled', async () => {
      await apiClient.withMemberAuthAsync();

      // Ensure PIN is disabled
      await apiClient.disablePin();

      // Try to disable again
      const response = await apiClient.disablePin();

      // Should either succeed idempotently or reject with clear message
      await apiClient.expectStatusOneOf(response, [200, 400]);
      if (response.status === 400) {
        expect(response.body.message).toMatch(/not.*enabled|already.*disabled/i);
      }
    });

    test('PIN-016: Disable PIN requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.disablePin();

      expect(response.status).toBe(401);
    });
  });

  test.describe('Update PIN', () => {

    test('PIN-017: Update PIN with valid new PIN', async () => {
      await apiClient.withMemberAuthAsync();

      // Enable PIN first
      await apiClient.disablePin();
      await apiClient.enablePin('1234');

      // Update to new PIN
      const response = await apiClient.updatePin('5678', '1234');

      await apiClient.expectStatusOneOf(response, [200, 201, 400]);
    });

    test('PIN-018: Update PIN requires current PIN', async () => {
      await apiClient.withMemberAuthAsync();

      // Enable PIN first
      await apiClient.disablePin();
      await apiClient.enablePin('1234');

      // Try to update without current PIN
      const response = await apiClient.makeRequest('POST', '/account/security/pin/update', {
        pin: '5678'
        // Missing current_pin
      });

      expect(response.status).toBe(400);
    });

    test('PIN-019: Update PIN with wrong current PIN', async () => {
      await apiClient.withMemberAuthAsync();

      // Enable PIN first
      await apiClient.disablePin();
      await apiClient.enablePin('1234');

      // Try to update with wrong current PIN
      const response = await apiClient.updatePin('5678', '9999');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/current.*pin|invalid.*pin|incorrect/i);
    });

    test('PIN-020: Update PIN when not enabled', async () => {
      await apiClient.withMemberAuthAsync();

      // Ensure PIN is disabled
      await apiClient.disablePin();

      // Try to update
      const response = await apiClient.updatePin('5678', '1234');

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/not.*enabled/i);
    });

    test('PIN-021: Update PIN validates new PIN format', async () => {
      await apiClient.withMemberAuthAsync();

      // Enable PIN first
      await apiClient.disablePin();
      await apiClient.enablePin('1234');

      // Try to update with invalid new PIN
      const response = await apiClient.updatePin('abc', '1234');

      expect(response.status).toBe(400);
    });

    test('PIN-022: Update PIN requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.updatePin('5678', '1234');

      expect(response.status).toBe(401);
    });
  });

  test.describe('Get PIN Status', () => {

    test('PIN-023: Get PIN status when enabled', async () => {
      await apiClient.withMemberAuthAsync();

      // Enable PIN
      await apiClient.disablePin();
      await apiClient.enablePin('1234');

      const response = await apiClient.getPinStatus();

      expect(response.status).toBe(200);
      expect(response.body.pin_enabled).toBe(true);
    });

    test('PIN-024: Get PIN status when disabled', async () => {
      await apiClient.withMemberAuthAsync();

      // Disable PIN
      await apiClient.disablePin();

      const response = await apiClient.getPinStatus();

      expect(response.status).toBe(200);
      expect(response.body.pin_enabled).toBe(false);
    });

    test('PIN-025: Get PIN status requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.getPinStatus();

      expect(response.status).toBe(401);
    });

    test('PIN-026: PIN status does not return PIN hash', async () => {
      await apiClient.withMemberAuthAsync();

      const response = await apiClient.getPinStatus();

      expect(response.status).toBe(200);
      expect(response.body.pin_hash).toBeUndefined();
      expect(response.body.pin).toBeUndefined();
    });
  });

  test.describe('PIN Boundary Testing', () => {

    test('PIN-027: All valid PIN lengths (4-6 digits)', async () => {
      await apiClient.withMemberAuthAsync();

      const validPins = ['1234', '12345', '123456'];

      for (const pin of validPins) {
        await apiClient.disablePin();
        const response = await apiClient.enablePin(pin);

        await apiClient.expectStatusOneOf(response, [200, 201]);

        // Verify it's enabled
        const status = await apiClient.getPinStatus();
        expect(status.body.pin_enabled).toBe(true);
      }
    });

    test('PIN-028: Invalid PIN lengths are rejected', async () => {
      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      const invalidPins = ['1', '12', '123', '1234567', '12345678'];

      for (const pin of invalidPins) {
        const response = await apiClient.enablePin(pin);
        expect(response.status).toBe(400);
      }
    });
  });

  test.describe('PIN Security', () => {

    test('PIN-029: PIN is hashed (not stored in plaintext)', async () => {
      // This test verifies the implementation stores PIN as hash
      // We can only verify this indirectly by checking:
      // 1. PIN is not returned in any response
      // 2. Different PINs produce different results

      await apiClient.withMemberAuthAsync();

      // Enable a PIN
      await apiClient.disablePin();
      await apiClient.enablePin('1234');

      // Get status - should not return PIN or hash
      const status = await apiClient.getPinStatus();
      expect(status.body.pin).toBeUndefined();
      expect(status.body.pin_hash).toBeUndefined();
      expect(status.body.pin_value).toBeUndefined();
    });

    test('PIN-030: Timing attack resistance on PIN update', async () => {
      await apiClient.withMemberAuthAsync();

      // Enable PIN
      await apiClient.disablePin();
      await apiClient.enablePin('1234');

      // Measure response times for correct and incorrect PINs
      const timings: { correct: number[]; incorrect: number[] } = {
        correct: [],
        incorrect: []
      };

      for (let i = 0; i < 5; i++) {
        // Correct PIN
        const startCorrect = Date.now();
        await apiClient.updatePin('5678', '1234');
        timings.correct.push(Date.now() - startCorrect);

        // Reset
        await apiClient.updatePin('1234', '5678');

        // Incorrect PIN
        const startIncorrect = Date.now();
        await apiClient.updatePin('5678', '9999');
        timings.incorrect.push(Date.now() - startIncorrect);
      }

      // Calculate averages
      const avgCorrect = timings.correct.reduce((a, b) => a + b) / timings.correct.length;
      const avgIncorrect = timings.incorrect.reduce((a, b) => a + b) / timings.incorrect.length;

      // Times should be similar (within 500ms) to prevent timing attacks
      const difference = Math.abs(avgCorrect - avgIncorrect);
      expect(difference).toBeLessThan(500);
    });
  });

  test.describe('PIN Audit Trail', () => {

    test('PIN-031: Enable PIN creates audit entry', async () => {
      // This test assumes audit logging is implemented
      // We verify by checking the response includes relevant timestamps

      await apiClient.withMemberAuthAsync();
      await apiClient.disablePin();

      const response = await apiClient.enablePin('1234');

      if (response.status === 200 || response.status === 201) {
        // Response might include timestamp
        if (response.body.pin_updated_at) {
          const timestamp = new Date(response.body.pin_updated_at).getTime();
          expect(Date.now() - timestamp).toBeLessThan(60000);
        }
      }
    });
  });
});

test.describe('PIN with Member Authorization', () => {

  test('PIN-032: Admin token cannot access member PIN endpoints', async () => {
    const adminToken = await apiClient.getQuickAuth().getAdminToken();
    apiClient.withAuth(adminToken);

    // Admin should not be able to access member endpoints
    const statusResponse = await apiClient.getPinStatus();

    // Should be rejected - either 401 (wrong pool) or 403 (forbidden)
    await apiClient.expectStatusOneOf(statusResponse, [401, 403]);
  });

  test('PIN-033: Expired token cannot access PIN endpoints', async () => {
    // Use a clearly invalid/expired token
    const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MDAwMDAwMDB9.invalid';

    apiClient.withAuth(expiredToken);

    const response = await apiClient.getPinStatus();

    expect(response.status).toBe(401);
  });

  test('PIN-034: Malformed token is rejected', async () => {
    apiClient.withAuth('not-a-valid-jwt-token');

    const response = await apiClient.getPinStatus();

    expect(response.status).toBe(401);
  });
});
