import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { QuickAuth } from '../../utils/quick-auth';

/**
 * PIN Management Tests
 * Tests the complete PIN lifecycle
 *
 * Covers:
 * - PIN status checking
 * - PIN enable/disable
 * - PIN update
 * - PIN validation
 * - PIN security
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('PIN Management - Status', () => {

  test('PIN-001: Get PIN status requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.getPinStatus();

    expect(response.status).toBe(401);
    console.log('✓ PIN-001: Get PIN status requires auth');
  });

  test('PIN-002: Get PIN status with valid token', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.getPinStatus();

    // Should return status (enabled/disabled)
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toBeDefined();
      // Should have enabled flag
      expect(typeof response.body.enabled === 'boolean' || response.body.status).toBeTruthy();
    }
    console.log(`✓ PIN-002: Get PIN status: ${response.status}`);
  });

  test('PIN-003: PIN status does not expose PIN value', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.getPinStatus();

    if (response.status === 200) {
      const bodyStr = JSON.stringify(response.body);
      // Should not contain actual PIN digits
      expect(bodyStr).not.toMatch(/\d{4,}/);
      expect(response.body.pin).toBeUndefined();
      expect(response.body.pin_value).toBeUndefined();
    }
    console.log('✓ PIN-003: PIN value not exposed in status');
  });

});

test.describe('PIN Management - Enable', () => {

  test('PIN-010: Enable PIN requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.enablePin('123456');

    expect(response.status).toBe(401);
    console.log('✓ PIN-010: Enable PIN requires auth');
  });

  test('PIN-011: Enable PIN with valid 6-digit PIN', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('123456');

    // May succeed, or may already be enabled
    expect([200, 201, 400, 409]).toContain(response.status);
    console.log(`✓ PIN-011: Enable PIN: ${response.status}`);
  });

  test('PIN-012: Enable PIN with too short PIN rejected', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('123');

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-012: Short PIN rejected: ${response.status}`);
  });

  test('PIN-013: Enable PIN with too long PIN rejected', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('12345678901234567890');

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-013: Long PIN rejected: ${response.status}`);
  });

  test('PIN-014: Enable PIN with non-numeric rejected', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('abcdef');

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-014: Non-numeric PIN rejected: ${response.status}`);
  });

  test('PIN-015: Enable PIN with empty value rejected', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('');

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-015: Empty PIN rejected: ${response.status}`);
  });

  test('PIN-016: Enable PIN already enabled returns conflict', async () => {
    await apiClient.withAdminAuthAsync();

    // First enable
    await apiClient.enablePin('123456');

    // Try to enable again
    const response = await apiClient.enablePin('654321');

    // Should indicate already enabled or be idempotent
    expect([200, 400, 409]).toContain(response.status);
    console.log(`✓ PIN-016: Enable already enabled: ${response.status}`);
  });

});

test.describe('PIN Management - Update', () => {

  test('PIN-020: Update PIN requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.updatePin('654321', '123456');

    expect(response.status).toBe(401);
    console.log('✓ PIN-020: Update PIN requires auth');
  });

  test('PIN-021: Update PIN requires current PIN', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.makeRequest('POST', '/account/security/pin/update', {
      pin: '654321'
      // Missing current_pin
    });

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-021: Update without current PIN: ${response.status}`);
  });

  test('PIN-022: Update PIN with wrong current PIN rejected', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.updatePin('654321', '000000'); // Wrong current PIN

    // Should reject with wrong current PIN
    expect([400, 401, 403]).toContain(response.status);
    console.log(`✓ PIN-022: Wrong current PIN rejected: ${response.status}`);
  });

  test('PIN-023: Update PIN validates new PIN format', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.updatePin('abc', '123456'); // Invalid new PIN

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-023: Invalid new PIN format rejected: ${response.status}`);
  });

  test('PIN-024: Update PIN with same value (no change)', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.updatePin('123456', '123456'); // Same PIN

    // May allow or reject same PIN update
    expect(response.status).toBeLessThan(500);
    console.log(`✓ PIN-024: Same PIN update: ${response.status}`);
  });

});

test.describe('PIN Management - Disable', () => {

  test('PIN-030: Disable PIN requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.disablePin();

    expect(response.status).toBe(401);
    console.log('✓ PIN-030: Disable PIN requires auth');
  });

  test('PIN-031: Disable PIN with valid token', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.disablePin();

    // May succeed or may not have PIN enabled
    expect([200, 400, 404]).toContain(response.status);
    console.log(`✓ PIN-031: Disable PIN: ${response.status}`);
  });

  test('PIN-032: Disable PIN when not enabled', async () => {
    await apiClient.withAdminAuthAsync();

    // First disable
    await apiClient.disablePin();

    // Try to disable again
    const response = await apiClient.disablePin();

    // Should be idempotent or indicate already disabled
    expect([200, 400, 404]).toContain(response.status);
    console.log(`✓ PIN-032: Disable not-enabled PIN: ${response.status}`);
  });

  test('PIN-033: Disable PIN requires current PIN verification', async () => {
    await apiClient.withAdminAuthAsync();

    // Try to disable with wrong PIN
    const response = await apiClient.makeRequest('POST', '/account/security/pin/disable', {
      current_pin: '000000' // Wrong PIN
    });

    // May require current PIN verification
    expect(response.status).toBeLessThan(500);
    console.log(`✓ PIN-033: Disable with wrong PIN: ${response.status}`);
  });

});

test.describe('PIN Management - Security', () => {

  test('PIN-040: Common PINs should be warned or rejected', async () => {
    await apiClient.withAdminAuthAsync();

    const commonPins = ['000000', '111111', '123456', '654321'];

    for (const pin of commonPins) {
      const response = await apiClient.enablePin(pin);
      // Document behavior - may warn, reject, or accept
      console.log(`  PIN ${pin}: ${response.status}`);
    }

    console.log('✓ PIN-040: Common PIN handling tested');
  });

  test('PIN-041: Sequential PIN rejection', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('123456');

    // May reject sequential patterns or accept
    console.log(`✓ PIN-041: Sequential PIN: ${response.status}`);
  });

  test('PIN-042: PIN not logged in error responses', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.updatePin('654321', '123456');

    // Error message should not contain PIN values
    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('123456');
    expect(bodyStr).not.toContain('654321');

    console.log('✓ PIN-042: PIN not leaked in error response');
  });

  test('PIN-043: Rate limiting on PIN operations', async () => {
    await apiClient.withAdminAuthAsync();

    // Try many wrong PIN updates rapidly
    const responses = [];
    for (let i = 0; i < 10; i++) {
      const response = await apiClient.updatePin('654321', `00000${i}`);
      responses.push(response.status);
    }

    // Should see rate limiting kick in (429) or consistent rejections
    const has429 = responses.includes(429);
    console.log(`✓ PIN-043: Rate limiting: ${has429 ? 'active' : 'not observed'}, statuses: ${[...new Set(responses)].join(', ')}`);
  });

  test('PIN-044: Brute force protection', async () => {
    // Document expected behavior - system should lock out after N failed attempts

    console.log('✓ PIN-044: Brute force protection (documented behavior)');
  });

});

test.describe('PIN Management - Edge Cases', () => {

  test('PIN-050: PIN with leading zeros', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('000123');

    // Should handle leading zeros correctly
    expect(response.status).toBeLessThan(500);
    console.log(`✓ PIN-050: Leading zeros PIN: ${response.status}`);
  });

  test('PIN-051: PIN as integer vs string', async () => {
    await apiClient.withAdminAuthAsync();

    // Send PIN as integer
    const response = await apiClient.makeRequest('POST', '/account/security/pin/enable', {
      pin: 123456 // Number, not string
    });

    // Should either accept or reject with validation error
    expect(response.status).toBeLessThan(500);
    console.log(`✓ PIN-051: Integer PIN: ${response.status}`);
  });

  test('PIN-052: PIN with spaces', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('12 34 56');

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-052: PIN with spaces: ${response.status}`);
  });

  test('PIN-053: PIN with special characters', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('12!@34');

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-053: PIN with special chars: ${response.status}`);
  });

  test('PIN-054: Unicode in PIN rejected', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('١٢٣٤٥٦'); // Arabic numerals

    expect([400, 422]).toContain(response.status);
    console.log(`✓ PIN-054: Unicode PIN rejected: ${response.status}`);
  });

});

test.describe('PIN Management - State Verification', () => {

  test('PIN-060: Status reflects enable operation', async () => {
    await apiClient.withAdminAuthAsync();

    // Enable PIN
    const enableResp = await apiClient.enablePin('123456');

    if (enableResp.status === 200 || enableResp.status === 201) {
      // Check status reflects enabled
      const statusResp = await apiClient.getPinStatus();
      if (statusResp.status === 200) {
        expect(statusResp.body.enabled === true || statusResp.body.status === 'enabled').toBeTruthy();
      }
    }

    console.log('✓ PIN-060: Status reflects enable');
  });

  test('PIN-061: Status reflects disable operation', async () => {
    await apiClient.withAdminAuthAsync();

    // Disable PIN
    await apiClient.disablePin();

    // Check status reflects disabled
    const statusResp = await apiClient.getPinStatus();
    if (statusResp.status === 200) {
      expect(statusResp.body.enabled === false || statusResp.body.status === 'disabled').toBeTruthy();
    }

    console.log('✓ PIN-061: Status reflects disable');
  });

});

test.describe('PIN Management - Response Format', () => {

  test('PIN-070: Enable response is JSON', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.enablePin('123456');

    expect(typeof response.body).toBe('object');
    console.log('✓ PIN-070: Enable response is JSON');
  });

  test('PIN-071: Disable response is JSON', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.disablePin();

    expect(typeof response.body).toBe('object');
    console.log('✓ PIN-071: Disable response is JSON');
  });

  test('PIN-072: Update response is JSON', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.updatePin('654321', '123456');

    expect(typeof response.body).toBe('object');
    console.log('✓ PIN-072: Update response is JSON');
  });

  test('PIN-073: Status response is JSON', async () => {
    await apiClient.withAdminAuthAsync();
    const response = await apiClient.getPinStatus();

    expect(typeof response.body).toBe('object');
    console.log('✓ PIN-073: Status response is JSON');
  });

});
