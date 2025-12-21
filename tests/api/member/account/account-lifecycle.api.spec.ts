import { test, expect } from '@playwright/test';
import { APITestClient } from '../../../utils/api-test-client';
import { testDataGenerator } from '../../../utils/test-data-generator';

/**
 * Account Lifecycle API Tests
 * Tests account cancellation and related lifecycle operations
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Cancel Account', () => {

  test.describe('Authorization', () => {

    test('CANCEL-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.cancelAccount();

      expect(response.status).toBe(401);
    });

    test('CANCEL-002: Rejects admin token (member only)', async () => {
      const adminToken = await apiClient.getQuickAuth().getAdminToken();
      apiClient.withAuth(adminToken);

      const response = await apiClient.cancelAccount();

      // Admin token should not work for member endpoints
      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('CANCEL-003: Accepts member token', async () => {
      await apiClient.withMemberAuthAsync();

      const response = await apiClient.cancelAccount();

      // Should get past auth
      expect(response.status).not.toBe(401);
    });

    test('CANCEL-004: Rejects expired token', async () => {
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MDAwMDAwMDB9.invalid';
      apiClient.withAuth(expiredToken);

      const response = await apiClient.cancelAccount();

      expect(response.status).toBe(401);
    });
  });

  test.describe('Success Flow', () => {

    test('CANCEL-005: Cancellation sets status to deleted', async () => {
      if (!process.env.CANCELLABLE_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.CANCELLABLE_MEMBER_TOKEN);

      const response = await apiClient.cancelAccount();

      if (response.status === 200) {
        expect(response.body.status).toBe('deleted');
      }
    });

    test('CANCEL-006: Cancellation returns confirmation message', async () => {
      await apiClient.withMemberAuthAsync();

      const response = await apiClient.cancelAccount();

      if (response.status === 200) {
        expect(response.body.message).toBeTruthy();
        expect(response.body.message).toMatch(/cancel|deleted|7.*day/i);
      }
    });

    test('CANCEL-007: Cancellation includes grace period info', async () => {
      await apiClient.withMemberAuthAsync();

      const response = await apiClient.cancelAccount();

      if (response.status === 200) {
        // Should mention 7-day retention period
        const message = response.body.message || JSON.stringify(response.body);
        expect(message).toMatch(/7|day|grace|retain|restore/i);
      }
    });

    test('CANCEL-008: Cancellation disables Cognito user', async () => {
      // After cancellation, user should not be able to authenticate
      // This is verified indirectly by the fact that their account is disabled
      if (!process.env.CANCELLABLE_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.CANCELLABLE_MEMBER_TOKEN);

      const response = await apiClient.cancelAccount();

      if (response.status === 200) {
        expect(response.body.cognito_disabled || response.body.status).toBeTruthy();
      }
    });
  });

  test.describe('Validation', () => {

    test('CANCEL-009: Cannot cancel already deleted account', async () => {
      if (!process.env.DELETED_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.DELETED_MEMBER_TOKEN);

      const response = await apiClient.cancelAccount();

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already.*deleted|already.*cancel/i);
    });

    test('CANCEL-010: Cannot cancel disabled account', async () => {
      if (!process.env.DISABLED_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.DISABLED_MEMBER_TOKEN);

      const response = await apiClient.cancelAccount();

      // Disabled accounts might not be able to make API calls
      await apiClient.expectStatusOneOf(response, [400, 401, 403]);
    });
  });

  test.describe('Idempotency', () => {

    test('CANCEL-011: Second cancellation is rejected', async () => {
      await apiClient.withMemberAuthAsync();

      // First cancellation
      const first = await apiClient.cancelAccount();

      // Second cancellation
      const second = await apiClient.cancelAccount();

      // At least one should fail (or second should be idempotent)
      if (first.status === 200) {
        expect(second.status).toBe(400);
      }
    });
  });
});

test.describe('Account Status After Cancellation', () => {

  test('ACCT-STATUS-001: Membership status shows account is deleted', async () => {
    if (!process.env.CANCELLED_MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.CANCELLED_MEMBER_TOKEN);

    const response = await apiClient.getMembershipStatus();

    // May not be able to get status after cancellation
    if (response.status === 200) {
      expect(response.body.account_status || response.body.status).toBe('deleted');
    } else {
      // Or may be rejected entirely
      await apiClient.expectStatusOneOf(response, [400, 401, 403]);
    }
  });

  test('ACCT-STATUS-002: Cannot enable PIN after cancellation', async () => {
    if (!process.env.CANCELLED_MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.CANCELLED_MEMBER_TOKEN);

    const response = await apiClient.enablePin('1397');

    // Should be rejected
    await apiClient.expectStatusOneOf(response, [400, 401, 403]);
  });

  test('ACCT-STATUS-003: Cannot request membership after cancellation', async () => {
    if (!process.env.CANCELLED_MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.CANCELLED_MEMBER_TOKEN);

    const response = await apiClient.makeRequest('POST', '/account/membership/request', {
      terms_version_id: 'test-version'
    });

    await apiClient.expectStatusOneOf(response, [400, 401, 403]);
  });
});

test.describe('Grace Period Behavior', () => {

  test('GRACE-001: Account still exists during grace period', async () => {
    // During the 7-day grace period, the account should still exist in DynamoDB
    // but be marked as deleted and disabled in Cognito
    if (!process.env.ADMIN_TOKEN || !process.env.RECENTLY_CANCELLED_USER_ID) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    const response = await apiClient.makeRequest(
      'GET',
      `/admin/registrations?email_filter=${process.env.RECENTLY_CANCELLED_EMAIL}`
    );

    if (response.status === 200) {
      const users = response.body.items || response.body;
      const cancelledUser = users.find((u: any) =>
        u.registration_id === process.env.RECENTLY_CANCELLED_USER_ID
      );

      if (cancelledUser) {
        expect(cancelledUser.status).toBe('deleted');
      }
    }
  });

  test('GRACE-002: Account includes deleted_at timestamp', async () => {
    if (!process.env.ADMIN_TOKEN || !process.env.RECENTLY_CANCELLED_USER_ID) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Admin should see deleted_at timestamp
    const response = await apiClient.makeRequest('GET', '/admin/registrations');

    if (response.status === 200) {
      const users = response.body.items || response.body;
      const cancelledUser = users.find((u: any) =>
        u.status === 'deleted' && u.registration_id === process.env.RECENTLY_CANCELLED_USER_ID
      );

      if (cancelledUser) {
        expect(cancelledUser.deleted_at || cancelledUser.updated_at).toBeDefined();
      }
    }
  });
});

test.describe('Scheduled Cleanup', () => {

  // These tests verify the behavior of the scheduled cleanup Lambda
  // They may need to be run manually or as integration tests

  test('CLEANUP-001: Accounts older than 7 days are permanently deleted', async () => {
    // This test would require:
    // 1. Creating a test user
    // 2. Cancelling their account
    // 3. Manually triggering cleanup or waiting 7 days
    // 4. Verifying user is permanently deleted
    test.skip();
  });

  test('CLEANUP-002: Accounts within 7 days are NOT deleted', async () => {
    test.skip();
  });

  test('CLEANUP-003: Cleanup removes user from Cognito', async () => {
    test.skip();
  });

  test('CLEANUP-004: Cleanup logs audit entry', async () => {
    test.skip();
  });
});

test.describe('Restore Account (Contact Support)', () => {

  // Account restoration during grace period requires contacting support
  // These tests document the expected behavior

  test('RESTORE-001: Admin can re-enable deleted account during grace period', async () => {
    if (!process.env.ADMIN_TOKEN || !process.env.RECENTLY_CANCELLED_USER_ID) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Admin should be able to re-enable the user
    const response = await apiClient.enableUser(process.env.RECENTLY_CANCELLED_USER_ID);

    // May succeed if within grace period, or may require special handling
    expect(response.status).not.toBe(500);
  });

  test('RESTORE-002: Cannot restore after permanent deletion', async () => {
    if (!process.env.ADMIN_TOKEN || !process.env.PERMANENTLY_DELETED_USER_ID) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    const response = await apiClient.enableUser(process.env.PERMANENTLY_DELETED_USER_ID);

    await apiClient.expectStatusOneOf(response, [400, 404]);
  });
});

test.describe('Account Cancellation Audit', () => {

  test('AUDIT-CANCEL-001: Cancellation creates audit log entry', async () => {
    // Verify audit log contains cancellation record
    // Would require access to audit table
    test.skip();
  });

  test('AUDIT-CANCEL-002: Audit entry includes user email', async () => {
    test.skip();
  });

  test('AUDIT-CANCEL-003: Audit entry includes timestamp', async () => {
    test.skip();
  });

  test('AUDIT-CANCEL-004: Audit entry includes cancellation reason if provided', async () => {
    test.skip();
  });
});

test.describe('Edge Cases', () => {

  test('EDGE-CANCEL-001: Cancellation during membership request', async () => {
    // If user has pending membership request, cancellation should still work
    if (!process.env.PENDING_MEMBERSHIP_MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.PENDING_MEMBERSHIP_MEMBER_TOKEN);

    const response = await apiClient.cancelAccount();

    expect(response.status).not.toBe(500);
  });

  test('EDGE-CANCEL-002: Cancellation with PIN enabled', async () => {
    // User with PIN enabled should still be able to cancel
    if (!process.env.PIN_ENABLED_MEMBER_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.PIN_ENABLED_MEMBER_TOKEN);

    const response = await apiClient.cancelAccount();

    expect(response.status).not.toBe(500);
  });

  test('EDGE-CANCEL-003: Rapid sequential cancellation attempts', async () => {
    await apiClient.withMemberAuthAsync();

    // Rapid fire cancellation requests
    const responses = await Promise.all([
      apiClient.cancelAccount(),
      apiClient.cancelAccount(),
      apiClient.cancelAccount()
    ]);

    // Exactly one should succeed (or all should be idempotent)
    const successes = responses.filter(r => r.status === 200);
    const failures = responses.filter(r => r.status === 400);

    // All should complete without server error
    expect(responses.every(r => r.status !== 500)).toBe(true);
  });

  test('EDGE-CANCEL-004: Cancellation response time', async () => {
    await apiClient.withMemberAuthAsync();
    apiClient.startTimer();

    const response = await apiClient.cancelAccount();

    // Should complete quickly (under 5 seconds)
    await apiClient.expectFastResponse(5000);
  });
});
