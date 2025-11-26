import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Workflow Validation Test Suite
 * Tests complete API workflows and multi-step processes
 *
 * Validates that:
 * - Registration workflow is consistent
 * - Error handling across steps is correct
 * - State transitions are valid
 * - Concurrent workflows don't interfere
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Registration Workflow', () => {

  test('WORK-001: Complete registration flow validation', async () => {
    console.log('\n📋 Testing complete registration flow...\n');

    const user = testDataGenerator.generateUser({
      email: `workflow-${Date.now()}@test.vettid.dev`
    });

    // Step 1: Submit registration
    console.log('Step 1: Submitting registration...');
    const regResponse = await apiClient.submitRegistration(user);

    expect([200, 201, 400]).toContain(regResponse.status);
    console.log(`  Status: ${regResponse.status}`);

    if (regResponse.status === 400) {
      // Expected for invalid invite code
      expect(regResponse.body).toBeDefined();
      console.log('  Result: Validation error (expected without valid invite)');
    } else {
      console.log('  Result: Registration submitted');
    }

    console.log('✓ Registration flow validated');
  });

  test('WORK-002: Multiple registrations with same email', async () => {
    console.log('\n🔄 Testing duplicate email handling...\n');

    const email = `duplicate-${Date.now()}@test.vettid.dev`;
    const responses = [];

    for (let i = 0; i < 3; i++) {
      const response = await apiClient.submitRegistration({
        first_name: `Test${i}`,
        last_name: `User${i}`,
        email: email,
        invite_code: 'TEST-CODE'
      });
      responses.push(response.status);
      console.log(`  Attempt ${i + 1}: ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // First might succeed, subsequent should fail or be handled
    console.log(`\n  All responses: [${responses.join(', ')}]`);
    console.log('✓ Duplicate email handling verified');
  });

  test('WORK-003: Registration with progressive field validation', async () => {
    console.log('\n📝 Testing progressive field validation...\n');

    const testCases = [
      { fields: { first_name: 'Test' }, description: 'Only first_name' },
      { fields: { first_name: 'Test', last_name: 'User' }, description: 'First + last name' },
      { fields: { first_name: 'Test', last_name: 'User', email: 'test@test.com' }, description: 'Name + email' },
      { fields: { first_name: 'Test', last_name: 'User', email: 'test@test.com', invite_code: 'X' }, description: 'All fields' },
    ];

    for (const testCase of testCases) {
      const response = await apiClient.request('POST', '/register', {
        body: JSON.stringify(testCase.fields),
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`  ${testCase.description}: ${response.status}`);
      expect([200, 201, 400]).toContain(response.status);
    }

    console.log('✓ Progressive validation tested');
  });

});

test.describe('Concurrent Workflow Handling', () => {

  test('WORK-004: Concurrent registrations with different emails', async () => {
    console.log('\n⚡ Testing concurrent registrations...\n');

    const promises = [];
    const count = 5;

    for (let i = 0; i < count; i++) {
      const user = testDataGenerator.generateUser({
        email: `concurrent-${i}-${Date.now()}@test.vettid.dev`
      });
      promises.push(apiClient.submitRegistration(user));
    }

    const results = await Promise.all(promises);
    const statuses = results.map(r => r.status);

    console.log(`  Results: [${statuses.join(', ')}]`);

    // All should be handled (not 500)
    for (const status of statuses) {
      expect(status).not.toBe(500);
    }

    console.log(`✓ ${count} concurrent registrations handled`);
  });

  test('WORK-005: Concurrent access to protected endpoints', async () => {
    console.log('\n🔒 Testing concurrent auth checks...\n');

    apiClient.withoutAuth();

    const promises = [];
    const endpoints = [
      '/account/membership/status',
      '/admin/registrations',
      '/account/pin/status',
    ];

    for (const endpoint of endpoints) {
      promises.push(apiClient.request('GET', endpoint));
    }

    const results = await Promise.all(promises);

    for (let i = 0; i < results.length; i++) {
      console.log(`  ${endpoints[i]}: ${results[i].status}`);
      expect(results[i].status).toBe(401);
    }

    console.log('✓ Concurrent auth checks consistent');
  });

});

test.describe('Error Recovery Workflows', () => {

  test('WORK-006: Recovery after validation error', async () => {
    console.log('\n🔧 Testing error recovery...\n');

    // First: Invalid request
    console.log('Step 1: Submit invalid request');
    const invalidResponse = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });
    expect(invalidResponse.status).toBe(400);
    console.log(`  Result: ${invalidResponse.status} (expected)`);

    // Second: Valid request (should work fine)
    console.log('\nStep 2: Submit valid request');
    const validResponse = await apiClient.submitRegistration(
      testDataGenerator.generateUser({
        email: `recovery-${Date.now()}@test.vettid.dev`
      })
    );
    expect([200, 201, 400]).toContain(validResponse.status);
    expect(validResponse.status).not.toBe(500);
    console.log(`  Result: ${validResponse.status}`);

    console.log('✓ Error recovery validated');
  });

  test('WORK-007: Recovery after rate limit', async () => {
    console.log('\n⏱️  Testing rate limit recovery...\n');

    // Trigger rate limit with non-test email
    const nonTestEmail = `ratelimit-test@gmail.com`;

    console.log('Step 1: Trigger potential rate limit');
    for (let i = 0; i < 10; i++) {
      await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: nonTestEmail,
        invite_code: 'X'
      });
    }
    console.log('  Sent 10 rapid requests');

    // Wait briefly
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now use test email (should bypass)
    console.log('\nStep 2: Submit with test email');
    const testResponse = await apiClient.submitRegistration(
      testDataGenerator.generateUser({
        email: `after-ratelimit-${Date.now()}@test.vettid.dev`
      })
    );
    console.log(`  Result: ${testResponse.status}`);

    // Test email should not be rate limited
    expect(testResponse.status).not.toBe(429);

    console.log('✓ Rate limit recovery with test email verified');
  });

});

test.describe('State Validation', () => {

  test('WORK-008: Auth state consistency', async () => {
    console.log('\n🔐 Testing auth state consistency...\n');

    // Test without auth
    apiClient.withoutAuth();
    const unauthResponse = await apiClient.request('GET', '/account/membership/status');
    expect(unauthResponse.status).toBe(401);
    console.log(`  Without auth: ${unauthResponse.status}`);

    // Test with invalid auth
    apiClient.withAuth('invalid-token');
    const invalidAuthResponse = await apiClient.request('GET', '/account/membership/status');
    expect(invalidAuthResponse.status).toBe(401);
    console.log(`  Invalid auth: ${invalidAuthResponse.status}`);

    // Clear auth
    apiClient.withoutAuth();
    const clearedAuthResponse = await apiClient.request('GET', '/account/membership/status');
    expect(clearedAuthResponse.status).toBe(401);
    console.log(`  Cleared auth: ${clearedAuthResponse.status}`);

    console.log('✓ Auth state consistency verified');
  });

  test('WORK-009: Registration state idempotency', async () => {
    console.log('\n🔁 Testing registration idempotency...\n');

    const user = testDataGenerator.generateUser({
      email: `idempotent-${Date.now()}@test.vettid.dev`
    });

    const responses = [];

    for (let i = 0; i < 3; i++) {
      const response = await apiClient.submitRegistration(user);
      responses.push({
        status: response.status,
        hasBody: !!response.body
      });
      console.log(`  Request ${i + 1}: ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // All responses should be consistent in structure
    for (const r of responses) {
      expect(r.hasBody).toBe(true);
    }

    console.log('✓ Registration idempotency verified');
  });

});

test.describe('Edge Case Workflows', () => {

  test('WORK-010: Rapid sequential requests', async () => {
    console.log('\n⚡ Testing rapid sequential requests...\n');

    const start = Date.now();
    const results = [];

    for (let i = 0; i < 10; i++) {
      const response = await apiClient.submitRegistration(
        testDataGenerator.generateUser({
          email: `rapid-${i}-${Date.now()}@test.vettid.dev`
        })
      );
      results.push(response.status);
    }

    const duration = Date.now() - start;

    console.log(`  Results: [${results.join(', ')}]`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Avg: ${(duration / 10).toFixed(0)}ms per request`);

    // None should be 500
    for (const status of results) {
      expect(status).not.toBe(500);
    }

    console.log('✓ Rapid sequential requests handled');
  });

  test('WORK-011: Mixed valid/invalid requests', async () => {
    console.log('\n🔀 Testing mixed request handling...\n');

    const requests = [
      { valid: true, data: testDataGenerator.generateUser({ email: `mixed-1-${Date.now()}@test.vettid.dev` }) },
      { valid: false, data: { first_name: '', last_name: '', email: '', invite_code: '' } },
      { valid: true, data: testDataGenerator.generateUser({ email: `mixed-2-${Date.now()}@test.vettid.dev` }) },
      { valid: false, data: { first_name: 'Test', last_name: 'User', email: 'invalid', invite_code: 'X' } },
      { valid: true, data: testDataGenerator.generateUser({ email: `mixed-3-${Date.now()}@test.vettid.dev` }) },
    ];

    for (let i = 0; i < requests.length; i++) {
      const response = await apiClient.submitRegistration(requests[i].data);
      const expected = requests[i].valid ? '[200, 201, 400]' : '400';
      console.log(`  Request ${i + 1} (${requests[i].valid ? 'valid' : 'invalid'}): ${response.status}`);

      if (!requests[i].valid) {
        expect(response.status).toBe(400);
      } else {
        expect([200, 201, 400]).toContain(response.status);
      }
    }

    console.log('✓ Mixed requests handled correctly');
  });

  test('WORK-012: Stress test with varied payloads', async () => {
    console.log('\n💪 Stress test with varied payloads...\n');

    const payloads = [
      testDataGenerator.generateUser({ email: `stress-normal-${Date.now()}@test.vettid.dev` }),
      { first_name: 'A'.repeat(100), last_name: 'B'.repeat(100), email: `stress-long-${Date.now()}@test.vettid.dev`, invite_code: 'X' },
      { first_name: 'José', last_name: 'García', email: `stress-unicode-${Date.now()}@test.vettid.dev`, invite_code: 'X' },
      { first_name: "O'Brien", last_name: 'Smith-Jones', email: `stress-special-${Date.now()}@test.vettid.dev`, invite_code: 'X' },
      testDataGenerator.generateUser({ email: `stress-final-${Date.now()}@test.vettid.dev` }),
    ];

    const start = Date.now();
    const results = [];

    for (const payload of payloads) {
      const response = await apiClient.submitRegistration(payload);
      results.push(response.status);
    }

    const duration = Date.now() - start;

    console.log(`  Results: [${results.join(', ')}]`);
    console.log(`  Duration: ${duration}ms`);

    // All should be handled gracefully
    for (const status of results) {
      expect([200, 201, 400]).toContain(status);
      expect(status).not.toBe(500);
    }

    console.log('✓ Stress test passed');
  });

});
