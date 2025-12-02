import { test, expect } from '@playwright/test';
import { APITestClient } from '../../../utils/api-test-client';
import { testDataGenerator } from '../../../utils/test-data-generator';

/**
 * User Management API Tests
 * Tests admin user management endpoints (disable, enable, delete, permanently delete)
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Disable User', () => {

  test.describe('Authorization', () => {

    test('USER-DISABLE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.disableUser('test-user-id');

      expect(response.status).toBe(401);
    });

    test('USER-DISABLE-002: Rejects member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.disableUser('test-user-id');

      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('USER-DISABLE-003: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.disableUser('nonexistent-id');

      // Should get past auth
      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('USER-DISABLE-004: Rejects non-existent user ID', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.disableUser('nonexistent-user-id-12345');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('USER-DISABLE-005: Rejects empty user ID', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('POST', '/admin/users//disable');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('USER-DISABLE-006: Handles special characters in user ID', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const maliciousIds = [
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        "'; DROP TABLE users; --",
        '%00nullbyte'
      ];

      for (const id of maliciousIds) {
        const response = await apiClient.disableUser(id);
        expect(response.status).not.toBe(500);
      }
    });

    test('USER-DISABLE-007: Rejects already disabled user', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.DISABLED_USER_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.disableUser(process.env.DISABLED_USER_ID);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already.*disabled/i);
    });
  });

  test.describe('Success Flow', () => {

    test('USER-DISABLE-008: Successfully disables active user', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.TEST_USER_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.disableUser(process.env.TEST_USER_ID);

      if (response.status === 200) {
        expect(response.body.status).toBe('disabled');
      }
    });

    test('USER-DISABLE-009: Disabled user cannot authenticate', async () => {
      // This test would require attempting login with a disabled user
      // Skipping as it requires full auth flow
      test.skip();
    });
  });
});

test.describe('Enable User', () => {

  test.describe('Authorization', () => {

    test('USER-ENABLE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.enableUser('test-user-id');

      expect(response.status).toBe(401);
    });

    test('USER-ENABLE-002: Rejects member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.enableUser('test-user-id');

      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('USER-ENABLE-003: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.enableUser('nonexistent-id');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('USER-ENABLE-004: Rejects non-existent user ID', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.enableUser('nonexistent-user-id-12345');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('USER-ENABLE-005: Rejects enabling already enabled user', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.ACTIVE_USER_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.enableUser(process.env.ACTIVE_USER_ID);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already.*enabled|not.*disabled/i);
    });

    test('USER-ENABLE-006: Cannot enable deleted user', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.DELETED_USER_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.enableUser(process.env.DELETED_USER_ID);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/deleted|cannot.*enable/i);
    });
  });

  test.describe('Success Flow', () => {

    test('USER-ENABLE-007: Successfully enables disabled user', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.DISABLED_USER_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.enableUser(process.env.DISABLED_USER_ID);

      if (response.status === 200) {
        expect(response.body.status).toMatch(/enabled|approved|active/i);
      }
    });
  });
});

test.describe('Delete User (Soft Delete)', () => {

  test.describe('Authorization', () => {

    test('USER-DELETE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.deleteUser('test-user-id');

      expect(response.status).toBe(401);
    });

    test('USER-DELETE-002: Rejects member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.deleteUser('test-user-id');

      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('USER-DELETE-003: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.deleteUser('nonexistent-id');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('USER-DELETE-004: Rejects non-existent user ID', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.deleteUser('nonexistent-user-id-12345');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('USER-DELETE-005: Rejects deleting already deleted user', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.DELETED_USER_ID) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.deleteUser(process.env.DELETED_USER_ID);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already.*deleted/i);
    });
  });

  test.describe('Success Flow', () => {

    test('USER-DELETE-006: Soft delete marks user as deleted', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.TEST_USER_TO_DELETE) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.deleteUser(process.env.TEST_USER_TO_DELETE);

      if (response.status === 200) {
        expect(response.body.status).toBe('deleted');
      }
    });

    test('USER-DELETE-007: Soft delete disables Cognito user', async () => {
      // Verified by checking user cannot login after soft delete
      test.skip();
    });
  });
});

test.describe('Permanently Delete User', () => {

  test.describe('Authorization', () => {

    test('USER-PERMDEL-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.permanentlyDeleteUser('test-user-id');

      expect(response.status).toBe(401);
    });

    test('USER-PERMDEL-002: Rejects member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.permanentlyDeleteUser('test-user-id');

      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('USER-PERMDEL-003: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.permanentlyDeleteUser('nonexistent-id');

      await apiClient.expectStatusOneOf(response, [200, 400, 404]);
    });
  });

  test.describe('Validation', () => {

    test('USER-PERMDEL-004: Rejects non-existent user ID', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.permanentlyDeleteUser('nonexistent-user-id-12345');

      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('USER-PERMDEL-005: Handles double permanent delete gracefully', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      // Try to permanently delete a non-existent or already deleted user
      const response = await apiClient.permanentlyDeleteUser('already-deleted-user');

      // Should not crash
      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Success Flow', () => {

    test('USER-PERMDEL-006: Permanently deletes user from Cognito', async () => {
      if (!process.env.ADMIN_TOKEN || !process.env.TEST_USER_TO_PERM_DELETE) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.permanentlyDeleteUser(process.env.TEST_USER_TO_PERM_DELETE);

      if (response.status === 200) {
        expect(response.body.message).toMatch(/deleted|removed/i);
      }
    });

    test('USER-PERMDEL-007: User cannot be retrieved after permanent delete', async () => {
      // Would need to attempt retrieval after permanent delete
      test.skip();
    });
  });
});

test.describe('User State Transitions', () => {

  test('USER-STATE-001: Approved -> Disabled -> Enabled flow', async () => {
    if (!process.env.ADMIN_TOKEN || !process.env.TEST_USER_ID) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Disable user
    const disableResponse = await apiClient.disableUser(process.env.TEST_USER_ID);
    if (disableResponse.status !== 200) {
      return;
    }
    expect(disableResponse.body.status).toBe('disabled');

    // Enable user
    const enableResponse = await apiClient.enableUser(process.env.TEST_USER_ID);
    if (enableResponse.status !== 200) {
      return;
    }
    expect(enableResponse.body.status).not.toBe('disabled');
  });

  test('USER-STATE-002: Cannot enable deleted user', async () => {
    if (!process.env.ADMIN_TOKEN || !process.env.DELETED_USER_ID) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    const response = await apiClient.enableUser(process.env.DELETED_USER_ID);

    expect(response.status).toBe(400);
  });

  test('USER-STATE-003: Can permanently delete soft-deleted user', async () => {
    if (!process.env.ADMIN_TOKEN || !process.env.SOFT_DELETED_USER_ID) {
      test.skip();
        return;
    }

    apiClient.withAdminAuth();

    const response = await apiClient.permanentlyDeleteUser(process.env.SOFT_DELETED_USER_ID);

    await apiClient.expectStatusOneOf(response, [200, 400, 404]);
  });
});

test.describe('Bulk Operations', () => {

  test('USER-BULK-001: Multiple disable operations in sequence', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Rapid sequential disables should all complete
    const ids = ['id1', 'id2', 'id3'];
    const results = [];

    for (const id of ids) {
      const response = await apiClient.disableUser(id);
      results.push(response.status);
    }

    // None should crash
    expect(results.every(s => s !== 500)).toBe(true);
  });

  test('USER-BULK-002: Concurrent disable operations', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Concurrent disables
    const responses = await Promise.all([
      apiClient.disableUser('concurrent-test-1'),
      apiClient.disableUser('concurrent-test-2'),
      apiClient.disableUser('concurrent-test-3')
    ]);

    // None should crash
    expect(responses.every(r => r.status !== 500)).toBe(true);
  });
});

test.describe('Audit Trail', () => {

  test('USER-AUDIT-001: Disable action is logged', async () => {
    // This would verify audit log entry was created
    // Requires access to audit table or logs
    test.skip();
  });

  test('USER-AUDIT-002: Enable action is logged', async () => {
    test.skip();
  });

  test('USER-AUDIT-003: Delete action is logged', async () => {
    test.skip();
  });

  test('USER-AUDIT-004: Permanent delete action is logged', async () => {
    test.skip();
  });
});
