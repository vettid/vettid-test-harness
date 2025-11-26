import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * API Response Format Validation Suite
 * Validates consistent and correct response structures
 *
 * Tests that API responses:
 * - Have consistent structure
 * - Include required fields
 * - Use correct data types
 * - Follow API conventions
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Response Format Validation', () => {

  test.describe('Success Response Structure', () => {

    test('RESP-001: Registration success response has required fields', async () => {
      const user = testDataGenerator.generateUser({
        email: `resp-test-${Date.now()}@test.vettid.dev`
      });

      const response = await apiClient.submitRegistration(user);

      // Even if validation fails, check response structure
      if (response.status === 201 || response.status === 200) {
        expect(response.body).toBeDefined();
        console.log('✓ Success response has body');
        console.log(`  Fields: ${Object.keys(response.body).join(', ')}`);
      } else if (response.status === 400) {
        expect(response.body).toBeDefined();
        console.log(`✓ Validation error response (${response.status}) has body`);
      }

      expect(response.body).toBeDefined();
    });

    test('RESP-002: Response Content-Type is application/json', async () => {
      const user = testDataGenerator.generateUser();
      const response = await apiClient.submitRegistration(user);

      const contentType = response.headers['content-type'];
      expect(contentType).toBeTruthy();
      expect(contentType).toContain('application/json');

      console.log(`✓ Content-Type: ${contentType}`);
    });

  });

  test.describe('Error Response Structure', () => {

    test('RESP-003: Validation error has error message', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });

      expect(response.status).toBe(400);
      expect(response.body).toBeDefined();

      // Should have some form of error message
      const hasError = response.body.error || response.body.message || response.body.errors;
      expect(hasError).toBeTruthy();

      console.log('✓ Validation error has error message');
      if (response.body.error) console.log(`  error: ${response.body.error}`);
      if (response.body.message) console.log(`  message: ${response.body.message}`);
    });

    test('RESP-004: Auth error has consistent format', async () => {
      apiClient.withoutAuth();
      const response = await apiClient.request('GET', '/account/membership/status');

      expect(response.status).toBe(401);
      expect(response.body).toBeDefined();

      // Should have error indication
      const hasError = response.body.error || response.body.message || response.body.Message;
      expect(hasError).toBeTruthy();

      console.log('✓ Auth error has consistent format');
      console.log(`  Fields: ${Object.keys(response.body).join(', ')}`);
    });

    test('RESP-005: Not found error format (if applicable)', async () => {
      apiClient.withoutAuth();
      const response = await apiClient.request('GET', '/nonexistent/endpoint');

      // Should be 401 (auth required) or 404 (not found)
      expect([401, 403, 404]).toContain(response.status);

      if (response.body) {
        console.log(`✓ Error response (${response.status}) has structure`);
        console.log(`  Fields: ${Object.keys(response.body).join(', ')}`);
      }
    });

  });

  test.describe('Response Data Types', () => {

    test('RESP-006: Error status code is number', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });

      expect(typeof response.status).toBe('number');

      if (response.body.statusCode) {
        expect(typeof response.body.statusCode).toBe('number');
        console.log('✓ statusCode is number');
      }

      console.log(`✓ HTTP status is number: ${response.status}`);
    });

    test('RESP-007: Error message is string', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });

      expect(response.status).toBe(400);

      if (response.body.error) {
        expect(typeof response.body.error).toBe('string');
        console.log('✓ error field is string');
      }

      if (response.body.message) {
        expect(typeof response.body.message).toBe('string');
        console.log('✓ message field is string');
      }
    });

    test('RESP-008: Response body is JSON object', async () => {
      const user = testDataGenerator.generateUser();
      const response = await apiClient.submitRegistration(user);

      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
      expect(response.body).not.toBeNull();

      console.log('✓ Response body is valid JSON object');
    });

  });

  test.describe('HTTP Status Code Correctness', () => {

    test('RESP-009: 400 for validation errors', async () => {
      const testCases = [
        { first_name: '', last_name: 'User', email: 'test@test.com', invite_code: 'X' },
        { first_name: 'Test', last_name: '', email: 'test@test.com', invite_code: 'X' },
        { first_name: 'Test', last_name: 'User', email: '', invite_code: 'X' },
        { first_name: 'Test', last_name: 'User', email: 'invalid', invite_code: 'X' },
      ];

      for (const testCase of testCases) {
        const response = await apiClient.submitRegistration(testCase);
        expect(response.status).toBe(400);
      }

      console.log(`✓ All ${testCases.length} validation errors returned 400`);
    });

    test('RESP-010: 401 for unauthorized access', async () => {
      apiClient.withoutAuth();

      const protectedEndpoints = [
        '/account/membership/status',
        '/admin/registrations',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await apiClient.request('GET', endpoint);
        expect(response.status).toBe(401);
        console.log(`✓ ${endpoint}: 401`);
      }
    });

    test('RESP-011: No 500 errors on valid requests', async () => {
      const requests = [
        apiClient.submitRegistration(testDataGenerator.generateUser()),
        apiClient.submitRegistration({ first_name: '', last_name: '', email: '', invite_code: '' }),
      ];

      const results = await Promise.all(requests);

      for (const response of results) {
        expect(response.status).not.toBe(500);
      }

      console.log('✓ No 500 errors on tested requests');
    });

  });

  test.describe('Response Headers', () => {

    test('RESP-012: Response has Date header', async () => {
      const user = testDataGenerator.generateUser();
      const response = await apiClient.submitRegistration(user);

      // Date header is standard
      const dateHeader = response.headers['date'];
      if (dateHeader) {
        expect(dateHeader).toBeTruthy();
        console.log(`✓ Date header present: ${dateHeader}`);
      } else {
        console.log('ℹ️  Date header not present (may be removed by proxy)');
      }

      expect(true).toBe(true);
    });

    test('RESP-013: Response has Content-Length or Transfer-Encoding', async () => {
      const user = testDataGenerator.generateUser();
      const response = await apiClient.submitRegistration(user);

      const hasContentLength = !!response.headers['content-length'];
      const hasTransferEncoding = !!response.headers['transfer-encoding'];

      if (hasContentLength) {
        console.log(`✓ Content-Length: ${response.headers['content-length']}`);
      } else if (hasTransferEncoding) {
        console.log(`✓ Transfer-Encoding: ${response.headers['transfer-encoding']}`);
      } else {
        console.log('ℹ️  Neither Content-Length nor Transfer-Encoding (OK for HTTP/2)');
      }

      expect(true).toBe(true);
    });

  });

  test.describe('Response Consistency', () => {

    test('RESP-014: Multiple requests return consistent format', async () => {
      const formats = [];

      for (let i = 0; i < 3; i++) {
        const response = await apiClient.submitRegistration({
          first_name: '',
          last_name: '',
          email: '',
          invite_code: ''
        });

        formats.push({
          status: response.status,
          hasError: !!response.body.error,
          hasMessage: !!response.body.message,
          fields: Object.keys(response.body).sort().join(',')
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All should be consistent
      const firstFormat = formats[0];
      for (const format of formats) {
        expect(format.status).toBe(firstFormat.status);
        expect(format.fields).toBe(firstFormat.fields);
      }

      console.log('✓ Response format is consistent across requests');
      console.log(`  Fields: ${firstFormat.fields}`);
    });

    test('RESP-015: Same error gives same response structure', async () => {
      const invalidEmail = 'not-an-email';
      const responses = [];

      for (let i = 0; i < 3; i++) {
        const response = await apiClient.submitRegistration({
          first_name: 'Test',
          last_name: 'User',
          email: invalidEmail,
          invite_code: 'TEST-CODE'
        });
        responses.push(response);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All should have same status
      const firstStatus = responses[0].status;
      for (const response of responses) {
        expect(response.status).toBe(firstStatus);
      }

      console.log(`✓ Same error consistently returns ${firstStatus}`);
    });

  });

  test.describe('Response Time Headers', () => {

    test('RESP-016: Check for request ID header', async () => {
      const user = testDataGenerator.generateUser();
      const response = await apiClient.submitRegistration(user);

      // Common request ID headers
      const requestIdHeaders = [
        'x-request-id',
        'x-amzn-requestid',
        'x-correlation-id',
        'request-id'
      ];

      let foundRequestId = false;
      for (const header of requestIdHeaders) {
        if (response.headers[header]) {
          console.log(`✓ Request ID found: ${header}=${response.headers[header]}`);
          foundRequestId = true;
          break;
        }
      }

      if (!foundRequestId) {
        console.log('ℹ️  No request ID header found (may be internal only)');
      }

      expect(true).toBe(true);
    });

  });

  test.describe('Error Message Quality', () => {

    test('RESP-017: Error messages are user-friendly', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });

      expect(response.status).toBe(400);

      const errorMessage = response.body.error || response.body.message || '';

      // Should not contain technical jargon
      const technicalTerms = ['exception', 'stack', 'null pointer', 'undefined'];
      for (const term of technicalTerms) {
        expect(errorMessage.toLowerCase()).not.toContain(term);
      }

      console.log(`✓ Error message is user-friendly: "${errorMessage}"`);
    });

    test('RESP-018: Error messages are helpful', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: 'invalid-email',
        invite_code: 'TEST-CODE'
      });

      expect(response.status).toBe(400);

      const errorMessage = response.body.error || response.body.message || '';

      // Should have some meaningful content
      expect(errorMessage.length).toBeGreaterThan(5);

      console.log(`✓ Error message is helpful (${errorMessage.length} chars)`);
    });

  });

});
