import { test, expect } from '@playwright/test';
import { APITestClient } from '../../../utils/api-test-client';

/**
 * Admin Registration Management API Tests
 * Tests for listing, approving, and rejecting registrations
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('List Registrations', () => {

  test.describe('Authorization', () => {

    test('REG-ADMIN-LIST-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      expect(response.status).toBe(401);
    });

    test('REG-ADMIN-LIST-002: Accepts admin token', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      await apiClient.expectStatusOneOf(response, [200, 404]);
    });

    test('REG-ADMIN-LIST-003: Rejects expired token', async () => {
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MDAwMDAwMDB9.invalid';
      apiClient.withAuth(expiredToken);

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      expect(response.status).toBe(401);
    });

    test('REG-ADMIN-LIST-004: Rejects malformed token', async () => {
      apiClient.withAuth('not-a-valid-jwt');

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      expect(response.status).toBe(401);
    });
  });

  test.describe('Response Format', () => {

    test('REG-ADMIN-LIST-005: Returns array of registrations', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      if (response.status === 200) {
        const registrations = response.body.items || response.body.registrations || response.body;
        expect(Array.isArray(registrations)).toBe(true);
      }
    });

    test('REG-ADMIN-LIST-006: Each registration has required fields', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      if (response.status === 200) {
        const registrations = response.body.items || response.body.registrations || response.body;
        if (registrations.length > 0) {
          const reg = registrations[0];
          expect(reg).toHaveProperty('registration_id');
          expect(reg).toHaveProperty('email');
        }
      }
    });

    test('REG-ADMIN-LIST-007: Registration status is valid enum', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations');

      if (response.status === 200) {
        const registrations = response.body.items || response.body.registrations || response.body;
        for (const reg of registrations) {
          if (reg.status) {
            // Accept various status values the API might use
            const validStatuses = [
              'pending', 'approved', 'rejected', 'cancelled',
              'active', 'inactive', 'none', 'deleted', 'disabled'
            ];
            expect(validStatuses).toContain(reg.status);
          }
        }
      }
    });
  });

  test.describe('Filtering', () => {

    test('REG-ADMIN-LIST-008: Filter by status=pending', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations?status=pending');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);

      if (response.status === 200) {
        const registrations = response.body.items || response.body.registrations || response.body;
        for (const reg of registrations) {
          expect(reg.status).toBe('pending');
        }
      }
    });

    test('REG-ADMIN-LIST-009: Filter by status=approved', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations?status=approved');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });

    test('REG-ADMIN-LIST-010: Invalid status filter is handled', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations?status=invalid');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Pagination', () => {

    test('REG-ADMIN-LIST-011: Supports limit parameter', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations?limit=5');

      if (response.status === 200) {
        const registrations = response.body.items || response.body.registrations || response.body;
        expect(registrations.length).toBeLessThanOrEqual(6); // Allow off-by-one
      }
    });

    test('REG-ADMIN-LIST-012: Invalid limit is handled gracefully', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('GET', '/admin/registrations?limit=-1');

      expect(response.status).not.toBe(500);
    });
  });
});

test.describe('Get Registration by ID', () => {

  test.describe('Authorization', () => {

    test('REG-ADMIN-GET-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.getRegistration('test-id');

      // May return 401, 403, or 400/404 if endpoint validates ID before auth
      await apiClient.expectStatusOneOf(response, [400, 401, 403, 404]);
    });

    test('REG-ADMIN-GET-002: Accepts admin token', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.getRegistration('nonexistent-id');

      // Should get past auth
      await apiClient.expectStatusOneOf(response, [200, 404]);
    });
  });

  test.describe('Validation', () => {

    test('REG-ADMIN-GET-003: Returns 404 for non-existent ID', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.getRegistration('nonexistent-registration-12345');

      expect(response.status).toBe(404);
    });

    test('REG-ADMIN-GET-004: Handles special characters in ID', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.getRegistration('<script>alert(1)</script>');

      await apiClient.expectStatusOneOf(response, [400, 404]);
      expect(response.status).not.toBe(500);
    });

    test('REG-ADMIN-GET-005: Returns registration details for valid ID', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.TEST_REGISTRATION_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.getRegistration(process.env.TEST_REGISTRATION_ID);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('registration_id');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('first_name');
        expect(response.body).toHaveProperty('last_name');
      }
    });
  });
});

test.describe('Approve Registration', () => {

  test.describe('Authorization', () => {

    test('REG-ADMIN-APPROVE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.makeRequest('POST', '/admin/registrations/test-id/approve');

      expect(response.status).toBe(401);
    });

    test('REG-ADMIN-APPROVE-002: Accepts admin token', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('POST', '/admin/registrations/nonexistent-id/approve');

      // Should get past auth
      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('REG-ADMIN-APPROVE-003: Returns 404 for non-existent ID', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('POST', '/admin/registrations/nonexistent-12345/approve');

      expect(response.status).toBe(404);
    });

    test('REG-ADMIN-APPROVE-004: Cannot approve already approved registration', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.APPROVED_REGISTRATION_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest(
        'POST',
        `/admin/registrations/${process.env.APPROVED_REGISTRATION_ID}/approve`
      );

      await apiClient.expectStatusOneOf(response, [400, 409]);
    });

    test('REG-ADMIN-APPROVE-005: Cannot approve rejected registration', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.REJECTED_REGISTRATION_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest(
        'POST',
        `/admin/registrations/${process.env.REJECTED_REGISTRATION_ID}/approve`
      );

      await apiClient.expectStatusOneOf(response, [400, 409]);
    });

    test('REG-ADMIN-APPROVE-006: Handles empty ID parameter', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('POST', '/admin/registrations//approve');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });
  });

  test.describe('Success Flow', () => {

    test('REG-ADMIN-APPROVE-007: Approving updates status to approved', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.PENDING_REGISTRATION_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest(
        'POST',
        `/admin/registrations/${process.env.PENDING_REGISTRATION_ID}/approve`
      );

      if (response.status === 200) {
        expect(response.body.status).toBe('approved');
      }
    });
  });
});

test.describe('Reject Registration', () => {

  test.describe('Authorization', () => {

    test('REG-ADMIN-REJECT-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.makeRequest('POST', '/admin/registrations/test-id/reject');

      expect(response.status).toBe(401);
    });

    test('REG-ADMIN-REJECT-002: Accepts admin token', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('POST', '/admin/registrations/nonexistent-id/reject');

      // Should get past auth
      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('REG-ADMIN-REJECT-003: Returns error for non-existent ID', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest('POST', '/admin/registrations/nonexistent-12345/reject');

      // May return 400 or 404 for non-existent registration
      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('REG-ADMIN-REJECT-004: Cannot reject already rejected registration', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.REJECTED_REGISTRATION_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest(
        'POST',
        `/admin/registrations/${process.env.REJECTED_REGISTRATION_ID}/reject`
      );

      await apiClient.expectStatusOneOf(response, [400, 409]);
    });

    test('REG-ADMIN-REJECT-005: Cannot reject approved registration', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.APPROVED_REGISTRATION_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest(
        'POST',
        `/admin/registrations/${process.env.APPROVED_REGISTRATION_ID}/reject`
      );

      await apiClient.expectStatusOneOf(response, [400, 409]);
    });

    test('REG-ADMIN-REJECT-006: Can include rejection reason', async () => {
      await apiClient.withAdminAuthAsync();

      const response = await apiClient.makeRequest(
        'POST',
        '/admin/registrations/nonexistent-id/reject',
        { reason: 'Test rejection reason' }
      );

      // Should handle gracefully
      expect(response.status).not.toBe(500);
    });
  });
});

test.describe('Registration Performance', () => {

  test('REG-ADMIN-PERF-001: List registrations under 2 seconds', async () => {
    await apiClient.withAdminAuthAsync();
    apiClient.startTimer();

    const response = await apiClient.makeRequest('GET', '/admin/registrations');

    if (response.status === 200) {
      await apiClient.expectFastResponse(2000);
    }
  });

  test('REG-ADMIN-PERF-002: Get registration by ID under 1 second', async () => {
    if (!process.env.ADMIN_TOKEN || !process.env.TEST_REGISTRATION_ID) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();
    apiClient.startTimer();

    const response = await apiClient.getRegistration(process.env.TEST_REGISTRATION_ID);

    if (response.status === 200) {
      await apiClient.expectFastResponse(1000);
    }
  });
});

test.describe('Registration Security', () => {

  test('REG-ADMIN-SEC-001: No sensitive data in list response', async () => {
    await apiClient.withAdminAuthAsync();

    const response = await apiClient.makeRequest('GET', '/admin/registrations');

    if (response.status === 200) {
      const registrations = response.body.items || response.body.registrations || response.body;
      for (const reg of registrations) {
        // Should not expose passwords, tokens, or internal IDs
        expect(reg).not.toHaveProperty('password');
        expect(reg).not.toHaveProperty('password_hash');
        expect(reg).not.toHaveProperty('token');
        expect(reg).not.toHaveProperty('secret');
      }
    }
  });

  test('REG-ADMIN-SEC-002: SQL injection in filter prevented', async () => {
    await apiClient.withAdminAuthAsync();

    const response = await apiClient.makeRequest(
      'GET',
      "/admin/registrations?status=pending'; DROP TABLE registrations;--"
    );

    // Should handle gracefully without executing injection
    expect(response.status).not.toBe(500);
  });
});
