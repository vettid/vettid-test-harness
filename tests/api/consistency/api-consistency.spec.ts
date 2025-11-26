import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * API Consistency Test Suite
 * Tests API behavior consistency across requests
 *
 * Validates:
 * - Response consistency
 * - Behavior reproducibility
 * - State consistency
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Response Consistency', () => {

  test('CON-RESP-001: Same input same output', async () => {
    const input = {
      first_name: '',
      last_name: '',
      email: '',
      invite_code: ''
    };

    const responses = [];
    for (let i = 0; i < 3; i++) {
      const response = await apiClient.submitRegistration(input);
      responses.push({
        status: response.status,
        bodyKeys: Object.keys(response.body).sort().join(',')
      });
    }

    expect(responses[0].status).toBe(responses[1].status);
    expect(responses[1].status).toBe(responses[2].status);
    expect(responses[0].bodyKeys).toBe(responses[1].bodyKeys);
    console.log('CON-RESP-001: Same input gives consistent output');
  });

  test('CON-RESP-002: Error format consistent', async () => {
    const errors = [
      { first_name: '', last_name: '', email: '', invite_code: '' },
      { first_name: '', last_name: 'X', email: 'x', invite_code: 'x' },
      { first_name: 'X', last_name: '', email: 'x', invite_code: 'x' }
    ];

    const formats = [];
    for (const input of errors) {
      const response = await apiClient.submitRegistration(input);
      formats.push({
        status: response.status,
        hasError: !!response.body.error || !!response.body.message
      });
    }

    for (const format of formats) {
      expect(format.status).toBe(400);
      expect(format.hasError).toBe(true);
    }
    console.log('CON-RESP-002: Error format is consistent');
  });

  test('CON-RESP-003: Header consistency', async () => {
    const responses = [];

    for (let i = 0; i < 3; i++) {
      const response = await apiClient.submitRegistration(
        testDataGenerator.generateUser()
      );
      responses.push({
        contentType: response.headers['content-type']
      });
    }

    expect(responses[0].contentType).toBe(responses[1].contentType);
    expect(responses[1].contentType).toBe(responses[2].contentType);
    console.log('CON-RESP-003: Headers are consistent');
  });

});

test.describe('Behavior Consistency', () => {

  test('CON-BEH-001: Auth check consistent', async () => {
    apiClient.withoutAuth();

    const responses = [];
    for (let i = 0; i < 5; i++) {
      const response = await apiClient.request('GET', '/account/membership/status');
      responses.push(response.status);
    }

    for (const status of responses) {
      expect(status).toBe(401);
    }
    console.log('CON-BEH-001: Auth check is consistent');
  });

  test('CON-BEH-002: Validation order consistent', async () => {
    const responses = [];

    for (let i = 0; i < 3; i++) {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: 'invalid',
        invite_code: ''
      });
      responses.push({
        status: response.status,
        message: response.body.error || response.body.message
      });
    }

    // All should return same error
    expect(responses[0].status).toBe(responses[1].status);
    expect(responses[1].status).toBe(responses[2].status);
    console.log('CON-BEH-002: Validation order is consistent');
  });

  test('CON-BEH-003: Rate limit bypass consistent', async () => {
    const responses = [];

    for (let i = 0; i < 10; i++) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `bypass-con-${i}-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST'
      });
      responses.push(response.status);
    }

    // None should be rate limited (test domain bypass)
    const rateLimited = responses.filter(s => s === 429).length;
    expect(rateLimited).toBe(0);
    console.log('CON-BEH-003: Rate limit bypass consistent');
  });

});

test.describe('State Consistency', () => {

  test('CON-STATE-001: No state leakage between requests', async () => {
    // First request with bad data
    await apiClient.submitRegistration({
      first_name: '<script>',
      last_name: '"; DROP TABLE',
      email: 'bad@test.vettid.dev',
      invite_code: 'X'
    });

    // Second request should not be affected
    const response = await apiClient.submitRegistration(
      testDataGenerator.generateUser({
        email: `state-${Date.now()}@test.vettid.dev`
      })
    );

    expect([200, 201, 400]).toContain(response.status);
    expect(response.status).not.toBe(500);
    console.log('CON-STATE-001: No state leakage');
  });

  test('CON-STATE-002: Auth state isolated', async () => {
    // Request without auth
    apiClient.withoutAuth();
    const noAuth = await apiClient.request('GET', '/account/membership/status');
    expect(noAuth.status).toBe(401);

    // Request with bad auth
    apiClient.withAuth('bad-token');
    const badAuth = await apiClient.request('GET', '/account/membership/status');
    expect(badAuth.status).toBe(401);

    // Back to no auth
    apiClient.withoutAuth();
    const noAuth2 = await apiClient.request('GET', '/account/membership/status');
    expect(noAuth2.status).toBe(401);

    console.log('CON-STATE-002: Auth state isolated');
  });

  test('CON-STATE-003: Request independence', async () => {
    const timestamp = Date.now();
    const responses = [];

    // Interleaved good and bad requests
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) {
        const response = await apiClient.submitRegistration(
          testDataGenerator.generateUser({
            email: `indep-good-${i}-${timestamp}@test.vettid.dev`
          })
        );
        responses.push({ type: 'good', status: response.status });
      } else {
        const response = await apiClient.submitRegistration({
          first_name: '',
          last_name: '',
          email: '',
          invite_code: ''
        });
        responses.push({ type: 'bad', status: response.status });
      }
    }

    // Bad requests should all be 400
    for (const r of responses.filter(x => x.type === 'bad')) {
      expect(r.status).toBe(400);
    }

    // Good requests should not be 500
    for (const r of responses.filter(x => x.type === 'good')) {
      expect(r.status).not.toBe(500);
    }

    console.log('CON-STATE-003: Request independence verified');
  });

});

test.describe('Timing Consistency', () => {

  test('CON-TIME-001: Response times reasonable', async () => {
    const times = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await apiClient.submitRegistration(
        testDataGenerator.generateUser({
          email: `timing-${i}-${Date.now()}@test.vettid.dev`
        })
      );
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);

    console.log(`CON-TIME-001: Avg=${avg.toFixed(0)}ms, Max=${max}ms`);

    // Max should be reasonable (< 10s)
    expect(max).toBeLessThan(10000);
  });

  test('CON-TIME-002: Error response times fast', async () => {
    const times = [];

    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      });
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`CON-TIME-002: Error avg=${avg.toFixed(0)}ms`);

    // Errors should be fast (< 2s average)
    expect(avg).toBeLessThan(2000);
  });

  test('CON-TIME-003: No timing variation by input size', async () => {
    const shortInput = { first_name: 'A', last_name: 'B', email: 'x@x.com', invite_code: 'X' };
    const longInput = {
      first_name: 'A'.repeat(100),
      last_name: 'B'.repeat(100),
      email: 'x@x.com',
      invite_code: 'X'.repeat(100)
    };

    const shortTimes = [];
    const longTimes = [];

    for (let i = 0; i < 3; i++) {
      let start = Date.now();
      await apiClient.submitRegistration(shortInput);
      shortTimes.push(Date.now() - start);

      start = Date.now();
      await apiClient.submitRegistration(longInput);
      longTimes.push(Date.now() - start);
    }

    const shortAvg = shortTimes.reduce((a, b) => a + b, 0) / shortTimes.length;
    const longAvg = longTimes.reduce((a, b) => a + b, 0) / longTimes.length;

    console.log(`CON-TIME-003: Short avg=${shortAvg.toFixed(0)}ms, Long avg=${longAvg.toFixed(0)}ms`);

    // Long input shouldn't be dramatically slower (< 5x)
    expect(longAvg).toBeLessThan(shortAvg * 5 + 1000);
  });

});

test.describe('Concurrent Request Consistency', () => {

  test('CON-CONC-001: Concurrent identical requests', async () => {
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(apiClient.submitRegistration({
        first_name: '',
        last_name: '',
        email: '',
        invite_code: ''
      }));
    }

    const results = await Promise.all(promises);
    const statuses = results.map(r => r.status);

    // All should be 400
    for (const status of statuses) {
      expect(status).toBe(400);
    }

    console.log('CON-CONC-001: Concurrent identical requests consistent');
  });

  test('CON-CONC-002: Concurrent different requests', async () => {
    const promises = [];
    const timestamp = Date.now();

    for (let i = 0; i < 5; i++) {
      promises.push(apiClient.submitRegistration(
        testDataGenerator.generateUser({
          email: `conc-diff-${i}-${timestamp}@test.vettid.dev`
        })
      ));
    }

    const results = await Promise.all(promises);

    // None should be 500
    for (const result of results) {
      expect(result.status).not.toBe(500);
    }

    console.log('CON-CONC-002: Concurrent different requests handled');
  });

  test('CON-CONC-003: Concurrent auth checks', async () => {
    apiClient.withoutAuth();

    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(apiClient.request('GET', '/account/membership/status'));
    }

    const results = await Promise.all(promises);

    // All should be 401
    for (const result of results) {
      expect(result.status).toBe(401);
    }

    console.log('CON-CONC-003: Concurrent auth checks consistent');
  });

});

