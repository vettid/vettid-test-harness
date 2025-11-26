import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { QuickAuth } from '../../utils/quick-auth';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Security Test Suite: Input Validation & Injection Prevention
 * Tests that the application properly validates and sanitizes input
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('Security: Input Validation', () => {

  test('SEC-INJ-001: SQL injection prevention in registration', async () => {
    const sqlPayloads = testDataGenerator.generateSQLInjection();

    for (const payload of sqlPayloads) {
      // Try SQL injection in email field
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: payload + '@test.vettid.dev',
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should reject with validation error, not crash
      expect(response.status).not.toBe(500);
      expect(response.status).toBe(400);

      console.log(`✓ SQL injection blocked in email: "${payload.substring(0, 20)}..."`);
    }

    // Verify registrations table still works (wasn't dropped)
    const adminToken = await quickAuth.getAdminToken();
    const listResponse = await apiClient.withAuth(adminToken).listRegistrations();

    expect(listResponse.status).toBe(200);
    console.log('✓ Database integrity verified after SQL injection attempts');
  });

  test('SEC-INJ-002: SQL injection prevention in search/filter', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    // Try SQL injection in status filter
    const response = await apiClient.request(
      'GET',
      "/admin/registrations?status=' OR '1'='1"
    );

    // Should handle safely - either reject or return only valid results
    expect(response.status).not.toBe(500);

    if (response.status === 200) {
      // If it returns results, they should be valid registrations
      expect(Array.isArray(response.body)).toBe(true);
      console.log('✓ SQL injection in filter handled safely');
    } else {
      console.log('✓ SQL injection in filter rejected');
    }
  });

  test('SEC-INJ-003: XSS prevention in name fields', async () => {
    const xssPayloads = testDataGenerator.generateXSSPayloads();

    for (const payload of xssPayloads.slice(0, 5)) { // Test first 5
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should either sanitize or reject
      expect(response.status).not.toBe(500);

      if (response.status === 201) {
        // If accepted, verify script tags are escaped in response
        expect(response.body.first_name || response.body.name).not.toContain('<script');
        console.log(`✓ XSS payload sanitized: "${payload.substring(0, 20)}..."`);
      } else {
        console.log(`✓ XSS payload rejected: "${payload.substring(0, 20)}..."`);
      }
    }
  });

  test('SEC-INJ-004: XSS prevention persists to database', async () => {
    // Create registration with potential XSS
    const xssName = '<script>alert("xss")</script>';
    const user = testDataGenerator.generateUser({
      first_name: xssName
    });

    const regResponse = await apiClient.submitRegistration(user);

    if (regResponse.status === 201) {
      const regId = regResponse.body.registration_id;

      // Retrieve via admin API
      const adminToken = await quickAuth.getAdminToken();
      const getResponse = await apiClient.withAuth(adminToken).getRegistration(regId);

      if (getResponse.status === 200) {
        // Verify XSS is sanitized in database
        const firstName = getResponse.body.first_name;
        expect(firstName).not.toContain('<script');
        console.log(`✓ XSS not persisted to database: stored as "${firstName}"`);
      }

      // Cleanup
      await quickAuth.cleanupUser(regId).catch(() => {});
    }
  });

  test('SEC-INJ-005: Command injection prevention', async () => {
    const commandPayloads = testDataGenerator.generateCommandInjection();

    for (const payload of commandPayloads) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: payload
      });

      // Should reject or handle safely
      expect(response.status).not.toBe(500);
      expect(response.status).toBe(400);

      console.log(`✓ Command injection blocked: "${payload.substring(0, 20)}..."`);
    }
  });

  test('SEC-INJ-006: Path traversal prevention', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    const pathPayloads = testDataGenerator.generatePathTraversal();

    for (const payload of pathPayloads) {
      const response = await apiClient.request('GET', `/admin/registrations/${payload}`);

      // Should return 404 or 400, not expose file system
      await apiClient.expectStatusOneOf(response, [400, 404]);

      // Response should not contain file contents
      const responseStr = JSON.stringify(response.body).toLowerCase();
      expect(responseStr).not.toContain('root:');
      expect(responseStr).not.toContain('passwd');

      console.log(`✓ Path traversal blocked: "${payload.substring(0, 30)}..."`);
    }
  });

  test('SEC-VAL-001: Email format validation comprehensive', async () => {
    const invalidEmails = testDataGenerator.generateInvalidEmails();

    let blockedCount = 0;
    for (const invalidEmail of invalidEmails) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: invalidEmail,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      if (response.status === 400) {
        blockedCount++;
      }
    }

    // Should block at least 80% of invalid emails
    const blockRate = blockedCount / invalidEmails.length;
    expect(blockRate).toBeGreaterThan(0.8);

    console.log(`✓ Email validation: ${blockedCount}/${invalidEmails.length} invalid emails blocked (${(blockRate * 100).toFixed(1)}%)`);
  });

  test('SEC-VAL-002: Field length limits enforcement', async () => {
    const edges = testDataGenerator.generateEdgeCases();

    // Test very long first name
    const longNameResponse = await apiClient.submitRegistration({
      first_name: edges.max1000,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    // Should either accept with truncation or reject
    if (longNameResponse.status === 201) {
      console.log('✓ Long field accepted (may be truncated)');
    } else {
      expect(longNameResponse.status).toBe(400);
      console.log('✓ Long field rejected with validation error');
    }
  });

  test('SEC-VAL-003: Empty and null value handling', async () => {
    const edges = testDataGenerator.generateEdgeCases();

    // Test empty string
    const emptyResponse = await apiClient.submitRegistration({
      first_name: edges.empty,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(emptyResponse.status).toBe(400);
    console.log('✓ Empty required field rejected');

    // Test whitespace only
    const whitespaceResponse = await apiClient.submitRegistration({
      first_name: edges.whitespace,
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(whitespaceResponse.status).toBe(400);
    console.log('✓ Whitespace-only field rejected');
  });

});
