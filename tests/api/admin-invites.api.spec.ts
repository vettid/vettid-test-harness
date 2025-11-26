import { test, expect } from '@playwright/test';
import { APITestClient } from '../utils/api-test-client';
import { QuickAuth } from '../utils/quick-auth';
import { testDataGenerator } from '../utils/test-data-generator';

/**
 * API Test Suite: Admin Invite Management
 * Tests admin endpoints for managing invite codes
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('Admin Invite Management API', () => {

  test('ADMIN-INV-001: Create invite with auto-approve flag', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    const inviteOptions = testDataGenerator.generateInviteOptions({
      auto_approve: true,
      max_uses: 5
    });

    apiClient.startTimer();
    const response = await apiClient.createInviteWithOptions(inviteOptions);

    await apiClient.expectSuccess(response, 201);
    expect(response.body).toHaveProperty('code');
    expect(response.body.auto_approve).toBe(true);
    expect(response.body.max_uses).toBe(5);

    await apiClient.expectFastResponse(2000);

    console.log(`✓ Created auto-approve invite: ${response.body.code}`);

    // Cleanup
    await apiClient.deleteInvite(response.body.code).catch(() => {});
  });

  test('ADMIN-INV-002: Create invite with custom code', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    const customCode = testDataGenerator.generateInviteCode();

    const response = await apiClient.createInviteWithOptions({
      code: customCode,
      max_uses: 10,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await apiClient.expectSuccess(response, 201);
    expect(response.body.code).toBe(customCode);

    console.log(`✓ Created custom code invite: ${customCode}`);

    // Cleanup
    await apiClient.deleteInvite(customCode).catch(() => {});
  });

  test('ADMIN-INV-003: List all invites', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    const response = await apiClient.listInvites();

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Verify structure of returned invites
    if (response.body.length > 0) {
      const firstInvite = response.body[0];
      expect(firstInvite).toHaveProperty('code');
      expect(firstInvite).toHaveProperty('status');
      expect(firstInvite).toHaveProperty('max_uses');
    }

    console.log(`✓ Listed ${response.body.length} invites`);
  });

  test('ADMIN-INV-004: Expire invite manually', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    // Create an invite first
    const createResponse = await apiClient.createInviteWithOptions(
      testDataGenerator.generateInviteOptions()
    );
    expect(createResponse.status).toBe(201);
    const inviteCode = createResponse.body.code;

    // Now expire it
    const expireResponse = await apiClient.expireInvite(inviteCode);

    await apiClient.expectSuccess(expireResponse, 200);

    // Verify invite is now expired
    const listResponse = await apiClient.listInvites();
    const expiredInvite = listResponse.body.find((inv: any) => inv.code === inviteCode);

    if (expiredInvite) {
      expect(expiredInvite.status).toBe('expired');
    }

    console.log(`✓ Expired invite: ${inviteCode}`);

    // Cleanup
    await apiClient.deleteInvite(inviteCode).catch(() => {});
  });

  test('ADMIN-INV-005: Delete invite', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    // Create an invite first
    const createResponse = await apiClient.createInviteWithOptions(
      testDataGenerator.generateInviteOptions()
    );
    expect(createResponse.status).toBe(201);
    const inviteCode = createResponse.body.code;

    // Delete it
    const deleteResponse = await apiClient.deleteInvite(inviteCode);

    // Should succeed with 200 or 204
    await apiClient.expectStatusOneOf(deleteResponse, [200, 204]);

    console.log(`✓ Deleted invite: ${inviteCode}`);

    // Verify invite no longer exists
    const listResponse = await apiClient.listInvites();
    const deletedInvite = listResponse.body.find((inv: any) => inv.code === inviteCode);

    expect(deletedInvite).toBeUndefined();
  });

  test('ADMIN-INV-006: Invite usage and exhaustion', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    // Create invite with max_uses = 2
    const createResponse = await apiClient.createInviteWithOptions({
      max_uses: 2,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    expect(createResponse.status).toBe(201);
    const inviteCode = createResponse.body.code;

    // Use it once
    const user1 = testDataGenerator.generateUser({ invite_code: inviteCode });
    const reg1 = await apiClient.withoutAuth().submitRegistration(user1);
    expect(reg1.status).toBe(201);

    // Use it twice
    const user2 = testDataGenerator.generateUser({ invite_code: inviteCode });
    const reg2 = await apiClient.withoutAuth().submitRegistration(user2);
    expect(reg2.status).toBe(201);

    // Third use should fail (exhausted)
    const user3 = testDataGenerator.generateUser({ invite_code: inviteCode });
    const reg3 = await apiClient.withoutAuth().submitRegistration(user3);

    await apiClient.expectError(reg3, 400, 'exhaust');

    console.log(`✓ Invite exhaustion working correctly`);

    // Cleanup
    await apiClient.withAuth(adminToken).deleteInvite(inviteCode).catch(() => {});
  });

});
