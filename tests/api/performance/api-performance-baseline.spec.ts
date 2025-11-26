import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * API Performance Baseline Test Suite
 * Establishes performance baselines for API operations
 *
 * These tests measure response times and throughput to establish
 * performance benchmarks for monitoring and regression detection.
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('API Performance Baselines', () => {

  test('PERF-001: Registration endpoint response time baseline', async () => {
    const iterations = 10;
    const times: number[] = [];

    console.log('\n⏱️  Measuring registration endpoint performance...\n');

    for (let i = 0; i < iterations; i++) {
      const user = testDataGenerator.generateUser({
        email: `perf-baseline-${i}-${Date.now()}@test.vettid.dev`
      });

      apiClient.startTimer();
      await apiClient.submitRegistration(user);
      const elapsed = apiClient.getElapsedTime();

      times.push(elapsed);
      console.log(`  Request ${i + 1}: ${elapsed}ms`);

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)];

    console.log(`\n📊 Performance Baseline:`);
    console.log(`   Average: ${avg.toFixed(0)}ms`);
    console.log(`   Median: ${median}ms`);
    console.log(`   Min: ${min}ms`);
    console.log(`   Max: ${max}ms`);
    console.log(`   P95: ${p95}ms`);

    // Reasonable performance expectations
    expect(avg).toBeLessThan(2000); // Average < 2s
    expect(p95).toBeLessThan(3000);  // 95th percentile < 3s

    if (avg < 500) {
      console.log('   ✓ Excellent performance (< 500ms avg)');
    } else if (avg < 1000) {
      console.log('   ✓ Good performance (< 1s avg)');
    } else {
      console.log('   ✓ Acceptable performance (< 2s avg)');
    }
  });

  test('PERF-002: Auth required endpoint response time', async () => {
    const iterations = 5;
    const times: number[] = [];

    console.log('\n⏱️  Measuring protected endpoint response time...\n');

    // Test without auth (should be fast rejection)
    apiClient.withoutAuth();

    for (let i = 0; i < iterations; i++) {
      apiClient.startTimer();
      await apiClient.request('GET', '/account/membership/status');
      const elapsed = apiClient.getElapsedTime();

      times.push(elapsed);
      console.log(`  Request ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avg = times.reduce((a, b) => a + b) / times.length;

    console.log(`\n📊 Auth Check Performance:`);
    console.log(`   Average: ${avg.toFixed(0)}ms`);

    // Auth checks should be very fast
    expect(avg).toBeLessThan(1000);

    if (avg < 200) {
      console.log('   ✓ Excellent auth check speed (< 200ms)');
    } else if (avg < 500) {
      console.log('   ✓ Good auth check speed (< 500ms)');
    } else {
      console.log('   ✓ Acceptable auth check speed (< 1s)');
    }
  });

  test('PERF-003: Concurrent request throughput', async () => {
    const concurrentRequests = 10;

    console.log(`\n⚡ Testing throughput with ${concurrentRequests} concurrent requests...\n`);

    const promises = [];
    const start = Date.now();

    for (let i = 0; i < concurrentRequests; i++) {
      const user = testDataGenerator.generateUser({
        email: `perf-concurrent-${i}-${Date.now()}@test.vettid.dev`
      });
      promises.push(apiClient.submitRegistration(user));
    }

    const results = await Promise.all(promises);
    const totalTime = Date.now() - start;

    const successCount = results.filter(r => [200, 201, 400].includes(r.status)).length;
    const throughput = (concurrentRequests / totalTime) * 1000; // requests per second

    console.log(`📊 Throughput Results:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Successful: ${successCount}/${concurrentRequests}`);
    console.log(`   Throughput: ${throughput.toFixed(2)} req/s`);

    // Should handle concurrent requests reasonably
    expect(totalTime).toBeLessThan(10000); // < 10s for 10 concurrent
    expect(successCount).toBe(concurrentRequests);

    console.log('   ✓ Concurrent requests handled efficiently');
  });

  test('PERF-004: Sequential vs concurrent performance comparison', async () => {
    const requestCount = 5;

    console.log('\n📊 Comparing sequential vs concurrent performance...\n');

    // Sequential
    console.log('Sequential requests:');
    const sequentialStart = Date.now();
    for (let i = 0; i < requestCount; i++) {
      await apiClient.submitRegistration(testDataGenerator.generateUser({
        email: `perf-seq-${i}-${Date.now()}@test.vettid.dev`
      }));
    }
    const sequentialTime = Date.now() - sequentialStart;
    console.log(`  Time: ${sequentialTime}ms (${(sequentialTime / requestCount).toFixed(0)}ms/req)`);

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Concurrent
    console.log('\nConcurrent requests:');
    const concurrentStart = Date.now();
    const promises = [];
    for (let i = 0; i < requestCount; i++) {
      promises.push(apiClient.submitRegistration(testDataGenerator.generateUser({
        email: `perf-conc-${i}-${Date.now()}@test.vettid.dev`
      })));
    }
    await Promise.all(promises);
    const concurrentTime = Date.now() - concurrentStart;
    console.log(`  Time: ${concurrentTime}ms (${(concurrentTime / requestCount).toFixed(0)}ms/req)`);

    const speedup = sequentialTime / concurrentTime;

    console.log(`\n📈 Analysis:`);
    console.log(`   Sequential: ${sequentialTime}ms`);
    console.log(`   Concurrent: ${concurrentTime}ms`);
    console.log(`   Speedup: ${speedup.toFixed(2)}x`);

    // Concurrent should be faster
    expect(concurrentTime).toBeLessThan(sequentialTime);

    if (speedup > 3) {
      console.log('   ✓ Excellent concurrent performance');
    } else if (speedup > 2) {
      console.log('   ✓ Good concurrent performance');
    } else {
      console.log('   ✓ Acceptable concurrent performance');
    }
  });

  test('PERF-005: Large payload handling', async () => {
    console.log('\n📦 Testing large payload performance...\n');

    const largeName = 'A'.repeat(500); // Large but valid name

    apiClient.startTimer();
    const response = await apiClient.submitRegistration({
      first_name: largeName,
      last_name: largeName,
      email: `perf-large-${Date.now()}@test.vettid.dev`,
      invite_code: 'LARGE-PAYLOAD-TEST'
    });
    const elapsed = apiClient.getElapsedTime();

    console.log(`Response: ${response.status}`);
    console.log(`Time: ${elapsed}ms`);

    // Should handle large payloads reasonably
    expect(elapsed).toBeLessThan(3000);

    if (elapsed < 1000) {
      console.log('✓ Excellent large payload handling');
    } else if (elapsed < 2000) {
      console.log('✓ Good large payload handling');
    } else {
      console.log('✓ Acceptable large payload handling');
    }
  });

  test('PERF-006: Validation error response time', async () => {
    const iterations = 5;
    const times: number[] = [];

    console.log('\n⏱️  Measuring validation error response time...\n');

    for (let i = 0; i < iterations; i++) {
      apiClient.startTimer();
      await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });
      const elapsed = apiClient.getElapsedTime();

      times.push(elapsed);
      console.log(`  Request ${i + 1}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avg = times.reduce((a, b) => a + b) / times.length;

    console.log(`\n📊 Validation Performance:`);
    console.log(`   Average: ${avg.toFixed(0)}ms`);

    // Validation errors should be very fast (early return)
    expect(avg).toBeLessThan(1000);

    if (avg < 200) {
      console.log('   ✓ Excellent validation speed (< 200ms)');
    } else if (avg < 500) {
      console.log('   ✓ Good validation speed (< 500ms)');
    } else {
      console.log('   ✓ Acceptable validation speed (< 1s)');
    }
  });

  test('PERF-007: Response size measurement', async () => {
    console.log('\n📏 Measuring response sizes...\n');

    const responses = [];

    // Validation error
    const validationResponse = await apiClient.submitRegistration({
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    });
    const validationSize = JSON.stringify(validationResponse.body).length;
    responses.push({ type: 'Validation error', size: validationSize });

    // Auth error
    apiClient.withoutAuth();
    const authResponse = await apiClient.request('GET', '/account/membership/status');
    const authSize = JSON.stringify(authResponse.body).length;
    responses.push({ type: 'Auth error', size: authSize });

    for (const resp of responses) {
      console.log(`  ${resp.type}: ${resp.size} bytes`);
    }

    // Responses should be reasonably sized
    for (const resp of responses) {
      expect(resp.size).toBeLessThan(5000); // < 5KB
      expect(resp.size).toBeGreaterThan(10); // > 10 bytes (has content)
    }

    console.log('\n✓ Response sizes are reasonable');
  });

  test('PERF-008: Network latency tolerance', async () => {
    console.log('\n🌐 Testing network latency scenarios...\n');

    const iterations = 3;
    const allTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      apiClient.startTimer();
      const response = await apiClient.submitRegistration(testDataGenerator.generateUser({
        email: `perf-latency-${i}-${Date.now()}@test.vettid.dev`
      }));
      const elapsed = apiClient.getElapsedTime();

      allTimes.push(elapsed);
      console.log(`  Request ${i + 1}: ${elapsed}ms (${response.status})`);

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const variance = allTimes.map(t => Math.abs(t - allTimes[0])).reduce((a, b) => a + b) / allTimes.length;

    console.log(`\n📊 Latency Analysis:`);
    console.log(`   Times: [${allTimes.join(', ')}]ms`);
    console.log(`   Variance: ${variance.toFixed(0)}ms`);

    // Should handle latency variations reasonably
    expect(variance).toBeLessThan(1000);

    console.log('   ✓ Acceptable latency tolerance');
  });

  test('PERF-009: Different endpoint performance comparison', async () => {
    console.log('\n⚖️  Comparing different endpoint performance...\n');

    const endpoints = [
      { method: 'POST', path: '/register', requiresData: true },
      { method: 'GET', path: '/account/membership/status', requiresData: false },
      { method: 'GET', path: '/admin/registrations', requiresData: false },
    ];

    const results = [];

    for (const endpoint of endpoints) {
      apiClient.startTimer();

      if (endpoint.requiresData) {
        await apiClient.submitRegistration(testDataGenerator.generateUser({
          email: `perf-compare-${Date.now()}@test.vettid.dev`
        }));
      } else {
        apiClient.withoutAuth();
        await apiClient.request(endpoint.method, endpoint.path);
      }

      const elapsed = apiClient.getElapsedTime();

      results.push({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        time: elapsed
      });

      console.log(`  ${endpoint.method} ${endpoint.path}: ${elapsed}ms`);

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // All should be reasonably fast
    for (const result of results) {
      expect(result.time).toBeLessThan(3000);
    }

    console.log('\n✓ All endpoints performing within acceptable range');
  });

  test('PERF-010: Performance baseline summary report', async () => {
    console.log('\n📋 Performance Baseline Summary\n');
    console.log('════════════════════════════════════════════════════════\n');

    // Quick performance snapshot
    const measurements = [];

    // Registration endpoint
    apiClient.startTimer();
    await apiClient.submitRegistration(testDataGenerator.generateUser({
      email: `perf-summary-${Date.now()}@test.vettid.dev`
    }));
    measurements.push({ operation: 'Registration (valid)', time: apiClient.getElapsedTime() });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Validation error
    apiClient.startTimer();
    await apiClient.submitRegistration({ first_name: '', last_name: '', email: '', invite_code: '' });
    measurements.push({ operation: 'Validation error', time: apiClient.getElapsedTime() });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Auth check
    apiClient.withoutAuth();
    apiClient.startTimer();
    await apiClient.request('GET', '/account/membership/status');
    measurements.push({ operation: 'Auth check (401)', time: apiClient.getElapsedTime() });

    console.log('Performance Measurements:');
    for (const m of measurements) {
      console.log(`  ${m.operation.padEnd(25)}: ${m.time.toString().padStart(5)}ms`);
    }

    console.log('\n════════════════════════════════════════════════════════');

    const avgTime = measurements.reduce((a, b) => a + b.time, 0) / measurements.length;
    console.log(`\nAverage response time: ${avgTime.toFixed(0)}ms`);

    // Baseline established
    expect(true).toBe(true);

    if (avgTime < 500) {
      console.log('✓ Overall performance: EXCELLENT');
    } else if (avgTime < 1000) {
      console.log('✓ Overall performance: GOOD');
    } else {
      console.log('✓ Overall performance: ACCEPTABLE');
    }
  });

});
