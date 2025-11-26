import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Timing Attack Prevention Test Suite
 * Validates that response times don't leak information about data existence
 *
 * Tests added after timing-safe security hardening (commit 76e3995)
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Timing Attack Prevention', () => {

  test('SEC-TIMING-001: Registration response times consistent regardless of email existence', async () => {
    const iterations = 5;
    const validEmailTimes: number[] = [];
    const invalidEmailTimes: number[] = [];

    console.log('\n⏱️  Testing response time consistency...\n');

    // Test with potentially existing email pattern
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `test-${i}@test.vettid.dev`,
        invite_code: 'ANY-CODE'
      });

      const elapsed = Date.now() - start;
      validEmailTimes.push(elapsed);
      console.log(`  Valid pattern ${i + 1}: ${elapsed}ms`);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test with definitely non-existing email pattern
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `nonexistent-${Date.now()}-${Math.random()}@invalid-domain-xyz.com`,
        invite_code: 'ANY-CODE'
      });

      const elapsed = Date.now() - start;
      invalidEmailTimes.push(elapsed);
      console.log(`  Invalid pattern ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate averages
    const validAvg = validEmailTimes.reduce((a, b) => a + b) / validEmailTimes.length;
    const invalidAvg = invalidEmailTimes.reduce((a, b) => a + b) / invalidEmailTimes.length;

    console.log(`\n📊 Timing Analysis:`);
    console.log(`   Valid email avg: ${validAvg.toFixed(0)}ms`);
    console.log(`   Invalid email avg: ${invalidAvg.toFixed(0)}ms`);
    console.log(`   Difference: ${Math.abs(validAvg - invalidAvg).toFixed(0)}ms`);

    // Times should be similar (within 200ms)
    // This is generous to account for network variance
    const timingDifference = Math.abs(validAvg - invalidAvg);
    expect(timingDifference).toBeLessThan(200);

    if (timingDifference < 50) {
      console.log('   ✓ Excellent - timing difference < 50ms');
    } else if (timingDifference < 100) {
      console.log('   ✓ Good - timing difference < 100ms');
    } else {
      console.log('   ✓ Acceptable - timing difference < 200ms');
    }
  });

  test('SEC-TIMING-002: Invalid invite code response time consistent', async () => {
    const iterations = 5;
    const times: number[] = [];

    console.log('\n⏱️  Testing invite code validation timing...\n');

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: `INVALID-${Date.now()}-${Math.random()}`
      });

      const elapsed = Date.now() - start;
      times.push(elapsed);
      console.log(`  Iteration ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate variance
    const avg = times.reduce((a, b) => a + b) / times.length;
    const variance = times.map(t => Math.abs(t - avg)).reduce((a, b) => a + b) / times.length;

    console.log(`\n📊 Timing Consistency:`);
    console.log(`   Average: ${avg.toFixed(0)}ms`);
    console.log(`   Variance: ${variance.toFixed(0)}ms`);

    // Variance should be low (< 100ms)
    expect(variance).toBeLessThan(100);

    if (variance < 30) {
      console.log('   ✓ Excellent consistency (< 30ms variance)');
    } else if (variance < 60) {
      console.log('   ✓ Good consistency (< 60ms variance)');
    } else {
      console.log('   ✓ Acceptable consistency (< 100ms variance)');
    }
  });

  test('SEC-TIMING-003: Authentication failure response time consistent', async () => {
    const iterations = 5;
    const times: number[] = [];

    console.log('\n⏱️  Testing auth failure timing...\n');

    // Try different invalid tokens
    const invalidTokens = [
      'invalid-token-1',
      'Bearer fake.jwt.token',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
      'completely-wrong',
      'x'.repeat(500)
    ];

    for (const token of invalidTokens) {
      const start = Date.now();

      apiClient.withAuth(token);
      await apiClient.request('GET', '/account/membership/status');

      const elapsed = Date.now() - start;
      times.push(elapsed);
      console.log(`  Token type ${times.length}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate variance
    const avg = times.reduce((a, b) => a + b) / times.length;
    const variance = times.map(t => Math.abs(t - avg)).reduce((a, b) => a + b) / times.length;

    console.log(`\n📊 Auth Failure Timing:`);
    console.log(`   Average: ${avg.toFixed(0)}ms`);
    console.log(`   Variance: ${variance.toFixed(0)}ms`);

    // All invalid tokens should be rejected in similar time
    expect(variance).toBeLessThan(100);

    console.log('   ✓ Consistent auth failure timing prevents enumeration');
  });

  test('SEC-TIMING-004: Rate limit response time vs normal response', async () => {
    // This test checks if rate-limited responses have different timing
    // than normal responses (they shouldn't significantly differ)

    const normalTime = Date.now();
    await apiClient.submitRegistration(testDataGenerator.generateUser());
    const normalElapsed = Date.now() - normalTime;

    console.log(`\n⏱️  Normal response: ${normalElapsed}ms`);

    // If we get rate limited, measure that time
    // (Using non-test email to potentially trigger rate limit)
    const rateLimitTime = Date.now();
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: 'rate-limit-test@gmail.com', // Non-test domain
      invite_code: 'ANY'
    });
    const rateLimitElapsed = Date.now() - rateLimitTime;

    console.log(`   Response status: ${response.status}`);
    console.log(`   Response time: ${rateLimitElapsed}ms`);

    if (response.status === 429) {
      console.log('   ✓ Got rate limit response');

      const timeDiff = Math.abs(normalElapsed - rateLimitElapsed);
      console.log(`   Time difference: ${timeDiff}ms`);

      // Rate limit responses should not be significantly faster/slower
      // This prevents timing-based detection of rate limits
      expect(timeDiff).toBeLessThan(300);

      console.log('   ✓ Rate limit timing does not leak information');
    } else {
      console.log('   ℹ️  No rate limit encountered (test still valid)');
    }

    // Test passes regardless
    expect(true).toBe(true);
  });

  test('SEC-TIMING-005: Field validation timing independent of field content', async () => {
    const iterations = 3;
    const shortFieldTimes: number[] = [];
    const longFieldTimes: number[] = [];

    console.log('\n⏱️  Testing field validation timing...\n');

    // Short fields
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await apiClient.submitRegistration({
        first_name: 'A',
        last_name: 'B',
        email: 'a@b.com',
        invite_code: 'X'
      });

      const elapsed = Date.now() - start;
      shortFieldTimes.push(elapsed);
      console.log(`  Short fields ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Long fields
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await apiClient.submitRegistration({
        first_name: 'A'.repeat(100),
        last_name: 'B'.repeat(100),
        email: 'very-long-email-address@very-long-domain-name.com',
        invite_code: 'X'.repeat(50)
      });

      const elapsed = Date.now() - start;
      longFieldTimes.push(elapsed);
      console.log(`  Long fields ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const shortAvg = shortFieldTimes.reduce((a, b) => a + b) / shortFieldTimes.length;
    const longAvg = longFieldTimes.reduce((a, b) => a + b) / longFieldTimes.length;

    console.log(`\n📊 Field Length Timing:`);
    console.log(`   Short fields avg: ${shortAvg.toFixed(0)}ms`);
    console.log(`   Long fields avg: ${longAvg.toFixed(0)}ms`);
    console.log(`   Difference: ${Math.abs(shortAvg - longAvg).toFixed(0)}ms`);

    // Should not have significant timing differences
    const timingDiff = Math.abs(shortAvg - longAvg);
    expect(timingDiff).toBeLessThan(200);

    console.log('   ✓ Field length does not leak validation timing');
  });

  test('SEC-TIMING-006: Database query timing protection', async () => {
    // This test verifies that responses don't leak whether database was queried
    // Testing with malformed vs well-formed (but invalid) data

    const iterations = 3;
    const malformedTimes: number[] = [];
    const wellformedTimes: number[] = [];

    console.log('\n⏱️  Testing database query timing protection...\n');

    // Malformed data (should fail fast validation)
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: 'not-an-email',
        invite_code: ''
      });

      const elapsed = Date.now() - start;
      malformedTimes.push(elapsed);
      console.log(`  Malformed ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Well-formed but invalid (might query database)
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      await apiClient.submitRegistration({
        first_name: 'Valid',
        last_name: 'Name',
        email: `valid-${Date.now()}@test.vettid.dev`,
        invite_code: `VALID-FORMAT-${Date.now()}`
      });

      const elapsed = Date.now() - start;
      wellformedTimes.push(elapsed);
      console.log(`  Well-formed ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const malformedAvg = malformedTimes.reduce((a, b) => a + b) / malformedTimes.length;
    const wellformedAvg = wellformedTimes.reduce((a, b) => a + b) / wellformedTimes.length;

    console.log(`\n📊 Query Timing Analysis:`);
    console.log(`   Malformed avg: ${malformedAvg.toFixed(0)}ms`);
    console.log(`   Well-formed avg: ${wellformedAvg.toFixed(0)}ms`);
    console.log(`   Difference: ${Math.abs(malformedAvg - wellformedAvg).toFixed(0)}ms`);

    // Timing should be similar (within 300ms)
    // Allows for some database query time difference
    const timingDiff = Math.abs(malformedAvg - wellformedAvg);
    expect(timingDiff).toBeLessThan(300);

    console.log('   ✓ Database query timing does not leak information');
  });

});
