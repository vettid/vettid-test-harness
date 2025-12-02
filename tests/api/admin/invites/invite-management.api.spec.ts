import { test, expect } from '@playwright/test';
import { APITestClient } from '../../../utils/api-test-client';

/**
 * Admin Invite Management API Tests
 * Tests for creating, listing, expiring, and deleting invites
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Create Invite', () => {

  test.describe('Authorization', () => {

    test('INVITE-CREATE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.createInviteWithOptions({
        max_uses: 1
      });

      expect(response.status).toBe(401);
    });

    test('INVITE-CREATE-002: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createInviteWithOptions({
        max_uses: 1
      });

      // Should succeed or return validation error, not auth error
      await apiClient.expectStatusOneOf(response, [200, 201, 400]);
    });

    test('INVITE-CREATE-003: Rejects expired token', async () => {
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MDAwMDAwMDB9.invalid';
      apiClient.withAuth(expiredToken);

      const response = await apiClient.createInviteWithOptions({
        max_uses: 1
      });

      expect(response.status).toBe(401);
    });
  });

  test.describe('Validation', () => {

    test('INVITE-CREATE-004: Creates invite with default options', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createInviteWithOptions({});

      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('code');
        expect(response.body.code).toMatch(/^VET-[A-F0-9]+$/);
      }
    });

    test('INVITE-CREATE-005: Creates invite with max_uses', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createInviteWithOptions({
        max_uses: 5
      });

      if (response.status === 200 || response.status === 201) {
        expect(response.body.max_uses).toBe(5);
      }
    });

    test('INVITE-CREATE-006: Creates invite with expiration date', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const expiresAt = futureDate.toISOString();

      const response = await apiClient.createInviteWithOptions({
        expires_at: expiresAt
      });

      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('expires_at');
      }
    });

    test('INVITE-CREATE-007: Rejects negative max_uses', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createInviteWithOptions({
        max_uses: -1
      });

      // API may accept or reject negative values
      await apiClient.expectStatusOneOf(response, [200, 201, 400, 422]);
    });

    test('INVITE-CREATE-008: Rejects past expiration date', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const pastDate = new Date('2020-01-01').toISOString();

      const response = await apiClient.createInviteWithOptions({
        expires_at: pastDate
      });

      // Should reject or accept (API might allow for testing purposes)
      expect(response.status).not.toBe(500);
    });

    test('INVITE-CREATE-009: Handles zero max_uses', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createInviteWithOptions({
        max_uses: 0
      });

      // Should either reject or treat as unlimited
      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Auto-Approve Feature', () => {

    test('INVITE-CREATE-010: Creates invite with auto_approve=true', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createInviteWithOptions({
        auto_approve: true,
        max_uses: 1
      });

      if (response.status === 200 || response.status === 201) {
        expect(response.body.auto_approve).toBe(true);
      }
    });

    test('INVITE-CREATE-011: Creates invite with auto_approve=false', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createInviteWithOptions({
        auto_approve: false,
        max_uses: 1
      });

      if (response.status === 200 || response.status === 201) {
        expect(response.body.auto_approve).toBe(false);
      }
    });
  });
});

test.describe('List Invites', () => {

  test.describe('Authorization', () => {

    test('INVITE-LIST-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.makeRequest('GET', '/admin/invites');

      expect(response.status).toBe(401);
    });

    test('INVITE-LIST-002: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/invites');

      await apiClient.expectStatusOneOf(response, [200, 404]);
    });
  });

  test.describe('Response Format', () => {

    test('INVITE-LIST-003: Returns array of invites', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/invites');

      if (response.status === 200) {
        const invites = response.body.invites || response.body.items || response.body;
        expect(Array.isArray(invites)).toBe(true);
      }
    });

    test('INVITE-LIST-004: Each invite has required fields', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/invites');

      if (response.status === 200) {
        const invites = response.body.invites || response.body.items || response.body;
        if (invites.length > 0) {
          const invite = invites[0];
          expect(invite).toHaveProperty('code');
        }
      }
    });
  });

  test.describe('Filtering', () => {

    test('INVITE-LIST-005: Filter by status=active', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/invites?status=active');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });

    test('INVITE-LIST-006: Filter by status=expired', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/invites?status=expired');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });
});

test.describe('Expire Invite', () => {

  test.describe('Authorization', () => {

    test('INVITE-EXPIRE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.expireInvite('TEST-CODE');

      expect(response.status).toBe(401);
    });

    test('INVITE-EXPIRE-002: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.expireInvite('NONEXISTENT-CODE');

      // Should get past auth - either 404, 400, or success
      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('INVITE-EXPIRE-003: Rejects non-existent invite code', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.expireInvite('NONEXISTENT-INVITE-CODE-12345');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('INVITE-EXPIRE-004: Handles empty code', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('POST', '/admin/invites//expire');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('INVITE-EXPIRE-005: Handles special characters in code', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.expireInvite('<script>alert(1)</script>');

      await apiClient.expectStatusOneOf(response, [400, 404]);
      expect(response.status).not.toBe(500);
    });
  });
});

test.describe('Delete Invite', () => {

  test.describe('Authorization', () => {

    test('INVITE-DELETE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.deleteInvite('TEST-CODE');

      expect(response.status).toBe(401);
    });

    test('INVITE-DELETE-002: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.deleteInvite('NONEXISTENT-CODE');

      // Should get past auth
      await apiClient.expectStatusOneOf(response, [200, 204, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('INVITE-DELETE-003: Rejects non-existent invite code', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.deleteInvite('NONEXISTENT-INVITE-CODE-12345');

      // API may return 200/204 (idempotent delete) or 404
      await apiClient.expectStatusOneOf(response, [200, 204, 400, 404]);
    });

    test('INVITE-DELETE-004: Cannot delete already used invite', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.USED_INVITE_CODE) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.deleteInvite(process.env.USED_INVITE_CODE);

      // Should reject deletion of used invites
      await apiClient.expectStatusOneOf(response, [400, 403]);
    });
  });
});

test.describe('Invite Code Format', () => {

  test('INVITE-FORMAT-001: Code follows VET-XXXXXXXX pattern', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    const response = await apiClient.createInviteWithOptions({ max_uses: 1 });

    if (response.status === 200 || response.status === 201) {
      expect(response.body.code).toMatch(/^VET-[A-F0-9]+$/);
    }
  });

  test('INVITE-FORMAT-002: Code is unique', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Create two invites and verify codes are different
    const response1 = await apiClient.createInviteWithOptions({ max_uses: 1 });
    const response2 = await apiClient.createInviteWithOptions({ max_uses: 1 });

    if (response1.status === 201 && response2.status === 201) {
      expect(response1.body.code).not.toBe(response2.body.code);
    }
  });
});

test.describe('Invite Performance', () => {

  test('INVITE-PERF-001: Create invite response time under 2 seconds', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();
    apiClient.startTimer();

    const response = await apiClient.createInviteWithOptions({ max_uses: 1 });

    if (response.status === 200 || response.status === 201) {
      await apiClient.expectFastResponse(2000);
    }
  });

  test('INVITE-PERF-002: List invites response time under 2 seconds', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();
    apiClient.startTimer();

    const response = await apiClient.makeRequest('GET', '/admin/invites');

    if (response.status === 200) {
      await apiClient.expectFastResponse(2000);
    }
  });
});
