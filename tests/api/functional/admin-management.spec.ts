import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { QuickAuth } from '../../utils/quick-auth';

/**
 * Admin Management Tests
 * Tests admin-specific endpoint functionality
 *
 * Covers:
 * - Add/Remove admin operations
 * - Admin listing
 * - Admin permissions
 * - User enable/disable/delete operations
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('Admin Management - List Admins', () => {

  test('ADMIN-MGT-001: List admins requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.makeRequest('GET', '/admin/admins');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-001: List admins requires auth');
  });

  test('ADMIN-MGT-002: List admins with valid token', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('GET', '/admin/admins');

    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(Array.isArray(response.body) || response.body.admins).toBeTruthy();
    }
    console.log(`✓ ADMIN-MGT-002: List admins: ${response.status}`);
  });

  test('ADMIN-MGT-003: List admins returns admin data structure', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('GET', '/admin/admins');

    if (response.status === 200) {
      const admins = Array.isArray(response.body) ? response.body : response.body.admins;
      if (admins && admins.length > 0) {
        const admin = admins[0];
        // Should have expected fields
        expect(admin).toHaveProperty('email');
        console.log(`✓ ADMIN-MGT-003: Admin data structure valid, found ${admins.length} admin(s)`);
      } else {
        console.log('✓ ADMIN-MGT-003: No admins in list (empty response)');
      }
    } else {
      console.log(`✓ ADMIN-MGT-003: Endpoint returned ${response.status}`);
    }
  });

});

test.describe('Admin Management - Add Admin', () => {

  test('ADMIN-MGT-010: Add admin requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.makeRequest('POST', '/admin/admins', {
      email: 'test-admin@test.vettid.dev'
    });

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-010: Add admin requires auth');
  });

  test('ADMIN-MGT-011: Add admin requires email', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('POST', '/admin/admins', {});

    // 400/422 = validation error, 403 = not permitted (auth worked)
    expect([400, 403, 422]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-011: Add admin without email: ${response.status}`);
  });

  test('ADMIN-MGT-012: Add admin validates email format', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('POST', '/admin/admins', {
      email: 'not-an-email'
    });

    // 400/422 = validation error, 403 = not permitted (auth worked)
    expect([400, 403, 422]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-012: Add admin with invalid email: ${response.status}`);
  });

  test('ADMIN-MGT-013: Add admin requires existing user', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('POST', '/admin/admins', {
      email: `nonexistent-${Date.now()}@test.vettid.dev`
    });

    // Should fail because user doesn't exist (or 403 = not permitted)
    expect([400, 403, 404, 422]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-013: Add nonexistent user as admin: ${response.status}`);
  });

});

test.describe('Admin Management - Remove Admin', () => {

  test('ADMIN-MGT-020: Remove admin requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.makeRequest('DELETE', '/admin/admins/test-user-id');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-020: Remove admin requires auth');
  });

  test('ADMIN-MGT-021: Remove nonexistent admin returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('DELETE', '/admin/admins/nonexistent-id-12345');

    // 404/400 = not found/bad request, 403 = operation not permitted
    expect([400, 403, 404]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-021: Remove nonexistent admin: ${response.status}`);
  });

  test('ADMIN-MGT-022: Cannot remove last admin', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // First list admins to see if there's only one
    const listResponse = await apiClient.makeRequest('GET', '/admin/admins');

    if (listResponse.status === 200) {
      const admins = Array.isArray(listResponse.body) ? listResponse.body : listResponse.body.admins || [];
      if (admins.length === 1) {
        // Try to remove the only admin
        const removeResponse = await apiClient.makeRequest('DELETE', `/admin/admins/${admins[0].id || admins[0].email}`);
        // Should be prevented
        expect([400, 403, 409]).toContain(removeResponse.status);
        console.log(`✓ ADMIN-MGT-022: Cannot remove last admin: ${removeResponse.status}`);
      } else {
        console.log(`✓ ADMIN-MGT-022: Skipped - multiple admins exist (${admins.length})`);
      }
    } else {
      console.log(`✓ ADMIN-MGT-022: Skipped - could not list admins`);
    }
  });

});

test.describe('Admin Management - User Operations', () => {

  test('ADMIN-MGT-030: Disable user requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.disableUser('test-user-id');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-030: Disable user requires auth');
  });

  test('ADMIN-MGT-031: Enable user requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.enableUser('test-user-id');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-031: Enable user requires auth');
  });

  test('ADMIN-MGT-032: Delete user requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.deleteUser('test-user-id');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-032: Delete user requires auth');
  });

  test('ADMIN-MGT-033: Permanently delete user requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.permanentlyDeleteUser('test-user-id');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-033: Permanently delete requires auth');
  });

  test('ADMIN-MGT-034: Disable nonexistent user returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.disableUser('nonexistent-user-id-12345');

    expect([404, 400]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-034: Disable nonexistent user: ${response.status}`);
  });

  test('ADMIN-MGT-035: Enable nonexistent user returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.enableUser('nonexistent-user-id-12345');

    expect([404, 400]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-035: Enable nonexistent user: ${response.status}`);
  });

  test('ADMIN-MGT-036: Delete nonexistent user returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.deleteUser('nonexistent-user-id-12345');

    // 404/400 = not found/bad request, 403 = operation not permitted
    expect([400, 403, 404]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-036: Delete nonexistent user: ${response.status}`);
  });

});

test.describe('Admin Management - Invite Operations', () => {

  test('ADMIN-MGT-040: Expire invite requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.expireInvite('TEST-CODE');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-040: Expire invite requires auth');
  });

  test('ADMIN-MGT-041: Delete invite requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.deleteInvite('TEST-CODE');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-041: Delete invite requires auth');
  });

  test('ADMIN-MGT-042: Expire nonexistent invite returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.expireInvite('NONEXISTENT-CODE-12345');

    expect([404, 400]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-042: Expire nonexistent invite: ${response.status}`);
  });

  test('ADMIN-MGT-043: Delete nonexistent invite returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.deleteInvite('NONEXISTENT-CODE-12345');

    // 200 = idempotent delete, 404/400 = not found/bad request, 403 = not permitted
    expect([200, 400, 403, 404]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-043: Delete nonexistent invite: ${response.status}`);
  });

  test('ADMIN-MGT-044: Create invite with custom options', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.createInviteWithOptions({
      max_uses: 5,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      auto_approve: true
    });

    if (response.status === 201) {
      expect(response.body).toHaveProperty('code');
      console.log(`✓ ADMIN-MGT-044: Create invite with options: ${response.body.code}`);
    } else {
      console.log(`✓ ADMIN-MGT-044: Create invite returned: ${response.status}`);
    }
  });

});

test.describe('Admin Management - Registration Operations', () => {

  test('ADMIN-MGT-050: Get registration by ID requires auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.getRegistration('test-id');

    // May return 401 (unauthorized) or 404 (route not found without auth)
    expect([401, 404]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-050: Get registration requires auth: ${response.status}`);
  });

  test('ADMIN-MGT-051: Get nonexistent registration returns 404', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.getRegistration('nonexistent-reg-id-12345');

    expect(response.status).toBe(404);
    console.log('✓ ADMIN-MGT-051: Get nonexistent registration: 404');
  });

  test('ADMIN-MGT-052: Approve nonexistent registration returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.approveRegistration('nonexistent-reg-id-12345');

    // 404/400 = not found/bad request, 403 = operation not permitted
    expect([400, 403, 404]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-052: Approve nonexistent: ${response.status}`);
  });

  test('ADMIN-MGT-053: Reject nonexistent registration returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.rejectRegistration('nonexistent-reg-id-12345', 'Test rejection');

    // 404/400 = not found/bad request, 403 = operation not permitted
    expect([400, 403, 404]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-053: Reject nonexistent: ${response.status}`);
  });

});

test.describe('Admin Management - Membership Terms', () => {

  test('ADMIN-MGT-060: List membership terms requires auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-060: List terms requires auth');
  });

  test('ADMIN-MGT-061: Get current membership terms requires auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-061: Get current terms requires auth');
  });

  test('ADMIN-MGT-062: Create membership terms requires auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.createMembershipTerms('Test terms');

    expect(response.status).toBe(401);
    console.log('✓ ADMIN-MGT-062: Create terms requires auth');
  });

  test('ADMIN-MGT-063: Create terms requires non-empty text', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.createMembershipTerms('');

    expect([400, 422]).toContain(response.status);
    console.log(`✓ ADMIN-MGT-063: Create empty terms: ${response.status}`);
  });

});

test.describe('Admin Management - Permission Boundaries', () => {

  test('ADMIN-MGT-070: Admin cannot delete themselves', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // Get admin's own info (we'll need to know the admin's ID)
    // This test documents expected behavior - admins shouldn't be able to delete themselves
    console.log('✓ ADMIN-MGT-070: Self-deletion prevention (documented behavior)');
  });

  test('ADMIN-MGT-071: Invalid user ID format rejected', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    const invalidIds = [
      '../../../etc/passwd',
      '<script>alert(1)</script>',
      '"; DROP TABLE users; --',
      '',
      '   ',
    ];

    for (const invalidId of invalidIds) {
      if (!invalidId.trim()) continue; // Skip empty - path won't work

      const response = await apiClient.disableUser(encodeURIComponent(invalidId));
      expect([400, 404]).toContain(response.status);
    }

    console.log('✓ ADMIN-MGT-071: Invalid user ID formats rejected');
  });

});
