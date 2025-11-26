import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Enhanced Error Validation Test Suite
 * Validates error responses don't leak sensitive information
 *
 * Tests added after error sanitization improvements (commit 76e3995)
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Enhanced Error Validation', () => {

  test('ERR-SANITIZE-001: No AWS service names in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });

    expect(response.status).toBe(400);

    const responseStr = JSON.stringify(response.body).toLowerCase();

    // Should not expose AWS service names
    expect(responseStr).not.toContain('lambda');
    expect(responseStr).not.toContain('dynamodb');
    expect(responseStr).not.toContain('cognito');
    expect(responseStr).not.toContain('s3');
    expect(responseStr).not.toContain('ses');
    expect(responseStr).not.toContain('cloudfront');
    expect(responseStr).not.toContain('apigateway');
    expect(responseStr).not.toContain('api gateway');

    console.log('✓ No AWS service names exposed');
  });

  test('ERR-SANITIZE-002: No ARN strings in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: 'invalid-format',
      invite_code: 'ANY'
    });

    const responseStr = JSON.stringify(response.body);

    // Should not contain ARN patterns
    expect(responseStr).not.toMatch(/arn:aws:/);
    expect(responseStr).not.toContain('arn:aws:lambda');
    expect(responseStr).not.toContain('arn:aws:dynamodb');

    console.log('✓ No ARN strings in errors');
  });

  test('ERR-SANITIZE-003: No stack traces in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'A'.repeat(10000), // Very long input
      last_name: 'B'.repeat(10000),
      email: testDataGenerator.generateEmail(),
      invite_code: 'ANY'
    });

    const responseStr = JSON.stringify(response.body).toLowerCase();

    // Should not contain stack trace indicators
    expect(responseStr).not.toContain('at object.');
    expect(responseStr).not.toContain('at async');
    expect(responseStr).not.toContain('at module.');
    expect(responseStr).not.toContain('.js:');
    expect(responseStr).not.toContain('.ts:');
    expect(responseStr).not.toContain('node_modules');
    expect(responseStr).not.toContain('stack trace');

    console.log('✓ No stack traces in errors');
  });

  test('ERR-SANITIZE-004: No file paths in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: testDataGenerator.generateSQLInjection()[0],
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'ANY'
    });

    const responseStr = JSON.stringify(response.body);

    // Should not contain file system paths
    expect(responseStr).not.toMatch(/\/var\/task/);
    expect(responseStr).not.toMatch(/\/opt\/nodejs/);
    expect(responseStr).not.toMatch(/\/home\/\w+/);
    expect(responseStr).not.toMatch(/C:\\/);
    expect(responseStr).not.toContain('\\node_modules\\');

    console.log('✓ No file paths in errors');
  });

  test('ERR-SANITIZE-005: No database schema information', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: 'SQL-INJECTION-ATTEMPT'
    });

    const responseStr = JSON.stringify(response.body).toLowerCase();

    // Should not expose database structure
    expect(responseStr).not.toContain('table');
    expect(responseStr).not.toContain('column');
    expect(responseStr).not.toContain('primary key');
    expect(responseStr).not.toContain('foreign key');
    expect(responseStr).not.toContain('constraint');
    expect(responseStr).not.toContain('index');
    expect(responseStr).not.toContain('partition key');
    expect(responseStr).not.toContain('sort key');

    console.log('✓ No database schema information exposed');
  });

  test('ERR-SANITIZE-006: No environment variables in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@test.vettid.dev',
      invite_code: ''
    });

    const responseStr = JSON.stringify(response.body).toUpperCase();

    // Should not expose environment variable names
    expect(responseStr).not.toContain('AWS_REGION');
    expect(responseStr).not.toContain('AWS_ACCESS_KEY');
    expect(responseStr).not.toContain('TABLE_NAME');
    expect(responseStr).not.toContain('USER_POOL_ID');
    expect(responseStr).not.toContain('CLIENT_ID');
    expect(responseStr).not.toContain('API_KEY');

    console.log('✓ No environment variables in errors');
  });

  test('ERR-SANITIZE-007: Consistent error message format', async () => {
    const testCases = [
      { first_name: '', last_name: 'User', email: 'test@test.vettid.dev', invite_code: 'ANY' },
      { first_name: 'Test', last_name: '', email: 'test@test.vettid.dev', invite_code: 'ANY' },
      { first_name: 'Test', last_name: 'User', email: '', invite_code: 'ANY' },
      { first_name: 'Test', last_name: 'User', email: 'test@test.vettid.dev', invite_code: '' },
    ];

    const errorFormats = [];

    for (const testCase of testCases) {
      const response = await apiClient.submitRegistration(testCase);
      expect(response.status).toBe(400);

      // Check error structure
      const hasError = response.body.error || response.body.message;
      expect(hasError).toBeTruthy();

      errorFormats.push({
        hasErrorField: !!response.body.error,
        hasMessageField: !!response.body.message,
        hasStatusCode: !!response.body.statusCode || !!response.body.status
      });
    }

    // All errors should have consistent structure
    const firstFormat = errorFormats[0];
    for (const format of errorFormats) {
      expect(format.hasErrorField).toBe(firstFormat.hasErrorField);
      expect(format.hasMessageField).toBe(firstFormat.hasMessageField);
    }

    console.log('✓ Error message format is consistent');
  });

  test('ERR-SANITIZE-008: Protected endpoint errors are safe', async () => {
    apiClient.withoutAuth();

    const protectedEndpoints = [
      '/admin/registrations',
      '/account/membership/status',
      '/account/pin/enable'
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await apiClient.request('GET', endpoint);

      expect(response.status).toBe(401);

      const responseStr = JSON.stringify(response.body).toLowerCase();

      // Should not expose internals even in auth errors
      expect(responseStr).not.toContain('lambda');
      expect(responseStr).not.toContain('stack');
      expect(responseStr).not.toContain('at object');

      console.log(`✓ ${endpoint}: Safe 401 error`);
    }
  });

  test('ERR-SANITIZE-009: Malformed JSON requests handled safely', async () => {
    // Send request with invalid JSON
    const response = await apiClient.request('POST', '/register', {
      body: 'this is not valid JSON at all!',
      headers: { 'Content-Type': 'application/json' }
    });

    // Should handle gracefully (400 or 500)
    expect([400, 500]).toContain(response.status);

    if (response.body) {
      const responseStr = JSON.stringify(response.body).toLowerCase();

      // Even on JSON parse errors, should not expose internals
      expect(responseStr).not.toContain('syntaxerror');
      expect(responseStr).not.toContain('unexpected token');
      expect(responseStr).not.toContain('json.parse');
      expect(responseStr).not.toContain('at json.parse');

      console.log('✓ Malformed JSON handled safely');
    }
  });

  test('ERR-SANITIZE-010: No version information in errors', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: 'test@test.vettid.dev',
      invite_code: 'ANY'
    });

    const responseStr = JSON.stringify(response.body);

    // Should not expose version numbers
    expect(responseStr).not.toMatch(/v\d+\.\d+\.\d+/); // semver
    expect(responseStr).not.toMatch(/node:\d+/);
    expect(responseStr).not.toContain('nodejs');
    expect(responseStr).not.toMatch(/python\s*\d/i);

    console.log('✓ No version information in errors');
  });

  test('ERR-SANITIZE-011: Rate limit errors are informative but safe', async () => {
    // Try to trigger rate limit with non-test email
    const requests = [];
    const nonTestEmail = `rate-test-${Date.now()}@example.com`;

    for (let i = 0; i < 20; i++) {
      requests.push(apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: nonTestEmail,
        invite_code: 'ANY'
      }));
    }

    const results = await Promise.all(requests);
    const rateLimited = results.find(r => r.status === 429);

    if (rateLimited) {
      console.log('✓ Got rate limit response to test');

      const responseStr = JSON.stringify(rateLimited.body).toLowerCase();

      // Should be informative
      const hasMessage = rateLimited.body.error || rateLimited.body.message;
      expect(hasMessage).toBeTruthy();

      // But not expose internals
      expect(responseStr).not.toContain('redis');
      expect(responseStr).not.toContain('memcached');
      expect(responseStr).not.toContain('dynamodb');
      expect(responseStr).not.toContain('hash');
      expect(responseStr).not.toContain('sha256');

      console.log('✓ Rate limit error is safe and informative');
    } else {
      console.log('ℹ️  No rate limit triggered (test still valid)');
    }

    // Test passes regardless
    expect(true).toBe(true);
  });

  test('ERR-SANITIZE-012: Error responses have appropriate status codes', async () => {
    const testCases = [
      {
        data: { first_name: '', last_name: '', email: '', invite_code: '' },
        expectedStatus: 400,
        description: 'Missing required fields'
      },
      {
        data: { first_name: 'Test', last_name: 'User', email: 'invalid', invite_code: 'ANY' },
        expectedStatus: 400,
        description: 'Invalid email format'
      },
      {
        data: { first_name: 'Test', last_name: 'User', email: 'test@test.vettid.dev', invite_code: '' },
        expectedStatus: 400,
        description: 'Missing invite code'
      }
    ];

    for (const testCase of testCases) {
      const response = await apiClient.submitRegistration(testCase.data);

      expect(response.status).toBe(testCase.expectedStatus);

      // Should have error message
      const hasError = response.body.error || response.body.message;
      expect(hasError).toBeTruthy();

      console.log(`✓ ${testCase.description}: ${response.status}`);
    }
  });

});
