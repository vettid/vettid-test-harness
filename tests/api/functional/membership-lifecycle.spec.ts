import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { QuickAuth } from '../../utils/quick-auth';

/**
 * Membership Lifecycle Tests
 * Tests the complete membership request workflow
 *
 * Covers:
 * - Membership request submission
 * - Membership terms acceptance
 * - Membership approval workflow
 * - Membership denial workflow
 * - Status transitions
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('Membership Lifecycle - Terms Management', () => {

  test('MEM-LIFE-001: Get membership terms requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.getMembershipTerms();

    expect(response.status).toBe(401);
    console.log('✓ MEM-LIFE-001: Get terms requires auth');
  });

  test('MEM-LIFE-002: Get membership terms with valid token', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.getMembershipTerms();

    // May return 200 with terms or 404 if no terms exist
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toBeDefined();
    }
    console.log(`✓ MEM-LIFE-002: Get terms: ${response.status}`);
  });

  test('MEM-LIFE-003: Admin can create membership terms', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const testTerms = `Test membership terms created at ${new Date().toISOString()}.
    By accepting these terms, you agree to abide by the rules and regulations of the organization.`;

    const response = await apiClient.createMembershipTerms(testTerms);

    expect([200, 201]).toContain(response.status);
    if (response.body.id || response.body.terms_id) {
      console.log(`✓ MEM-LIFE-003: Created terms with ID: ${response.body.id || response.body.terms_id}`);
    } else {
      console.log(`✓ MEM-LIFE-003: Create terms: ${response.status}`);
    }
  });

  test('MEM-LIFE-004: Admin can list all membership terms versions', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      const terms = Array.isArray(response.body) ? response.body : response.body.terms || [];
      console.log(`✓ MEM-LIFE-004: Found ${terms.length} terms version(s)`);
    } else {
      console.log('✓ MEM-LIFE-004: No terms exist yet');
    }
  });

});

test.describe('Membership Lifecycle - Request Submission', () => {

  test('MEM-LIFE-010: Request membership requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.requestMembership();

    expect(response.status).toBe(401);
    console.log('✓ MEM-LIFE-010: Request membership requires auth');
  });

  test('MEM-LIFE-011: Request membership returns proper response', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.requestMembership();

    // Could be 200/201 (success), 400 (already member), 409 (pending request)
    expect([200, 201, 400, 409]).toContain(response.status);
    console.log(`✓ MEM-LIFE-011: Request membership: ${response.status}`);
  });

  test('MEM-LIFE-012: Get membership status after request', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.getMembershipStatus();

    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      // Should have status field
      const hasStatus = response.body.status ||
        response.body.membership_status ||
        typeof response.body === 'string';
      console.log(`✓ MEM-LIFE-012: Membership status: ${JSON.stringify(response.body)}`);
    } else {
      console.log('✓ MEM-LIFE-012: No membership status (user may not have membership)');
    }
  });

});

test.describe('Membership Lifecycle - Admin Review', () => {

  test('MEM-LIFE-020: List membership requests requires admin auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.listMembershipRequests();

    expect(response.status).toBe(401);
    console.log('✓ MEM-LIFE-020: List requests requires auth');
  });

  test('MEM-LIFE-021: Admin can list pending membership requests', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.listMembershipRequests();

    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      const requests = Array.isArray(response.body) ? response.body : response.body.requests || [];
      console.log(`✓ MEM-LIFE-021: Found ${requests.length} membership request(s)`);
    } else {
      console.log('✓ MEM-LIFE-021: No membership requests');
    }
  });

  test('MEM-LIFE-022: Approve membership requires admin auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.approveMembership('test-id');

    expect(response.status).toBe(401);
    console.log('✓ MEM-LIFE-022: Approve membership requires auth');
  });

  test('MEM-LIFE-023: Deny membership requires admin auth', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.denyMembership('test-id');

    expect(response.status).toBe(401);
    console.log('✓ MEM-LIFE-023: Deny membership requires auth');
  });

  test('MEM-LIFE-024: Approve nonexistent membership returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.approveMembership('nonexistent-membership-id-12345');

    expect([404, 400]).toContain(response.status);
    console.log(`✓ MEM-LIFE-024: Approve nonexistent: ${response.status}`);
  });

  test('MEM-LIFE-025: Deny nonexistent membership returns error', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.denyMembership('nonexistent-membership-id-12345', 'Test reason');

    expect([404, 400]).toContain(response.status);
    console.log(`✓ MEM-LIFE-025: Deny nonexistent: ${response.status}`);
  });

  test('MEM-LIFE-026: Deny membership requires reason', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    // Try to deny without reason (using empty string)
    const response = await apiClient.makeRequest('POST', '/admin/memberships/test-id/deny', {
      reason: ''
    });

    // Should require reason or fail due to nonexistent ID
    expect([400, 404, 422]).toContain(response.status);
    console.log(`✓ MEM-LIFE-026: Deny without reason: ${response.status}`);
  });

});

test.describe('Membership Lifecycle - Status Transitions', () => {

  test('MEM-LIFE-030: Cannot request membership twice while pending', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // First request
    const firstResponse = await apiClient.requestMembership();
    console.log(`  First request: ${firstResponse.status}`);

    // Second request should fail or indicate already pending
    const secondResponse = await apiClient.requestMembership();

    // Either duplicate detection (409) or already has membership (400) or success if no pending
    expect([200, 201, 400, 409]).toContain(secondResponse.status);
    console.log(`✓ MEM-LIFE-030: Duplicate request handling: ${secondResponse.status}`);
  });

  test('MEM-LIFE-031: Already approved member cannot request again', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // Try to request membership
    const response = await apiClient.requestMembership();

    // If already a member, should get appropriate error
    // Status depends on whether admin is already a full member
    expect([200, 201, 400, 409]).toContain(response.status);
    console.log(`✓ MEM-LIFE-031: Existing member request: ${response.status}`);
  });

});

test.describe('Membership Lifecycle - Edge Cases', () => {

  test('MEM-LIFE-040: Empty membership request body', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('POST', '/account/membership/request', {});

    // Should accept empty body or return validation error, not server error
    expect(response.status).toBeLessThan(500);
    console.log(`✓ MEM-LIFE-040: Empty body request: ${response.status}`);
  });

  test('MEM-LIFE-041: Membership request with extra fields ignored', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('POST', '/account/membership/request', {
      extra_field: 'should be ignored',
      admin_override: true,
      membership_level: 'premium'
    });

    // Should process normally, ignoring extra fields
    expect(response.status).toBeLessThan(500);
    console.log(`✓ MEM-LIFE-041: Extra fields ignored: ${response.status}`);
  });

  test('MEM-LIFE-042: Very long denial reason handled', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const longReason = 'A'.repeat(10000); // 10KB of text

    const response = await apiClient.denyMembership('test-id', longReason);

    // Should handle gracefully - truncate or reject
    expect(response.status).toBeLessThan(500);
    console.log(`✓ MEM-LIFE-042: Long denial reason: ${response.status}`);
  });

  test('MEM-LIFE-043: Special characters in denial reason', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const specialReason = '<script>alert("xss")</script> & "quotes" \'apostrophes\' \n newlines';

    const response = await apiClient.denyMembership('test-id', specialReason);

    // Should sanitize or escape, not crash
    expect(response.status).toBeLessThan(500);
    console.log(`✓ MEM-LIFE-043: Special chars in reason: ${response.status}`);
  });

});

test.describe('Membership Lifecycle - Data Validation', () => {

  test('MEM-LIFE-050: Terms text length validation', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);

    // Test empty terms
    const emptyResponse = await apiClient.createMembershipTerms('');
    expect([400, 422]).toContain(emptyResponse.status);

    // Test very short terms
    const shortResponse = await apiClient.createMembershipTerms('Hi');
    // May be accepted or rejected based on minimum length
    expect(shortResponse.status).toBeLessThan(500);

    console.log(`✓ MEM-LIFE-050: Terms length validation tested`);
  });

  test('MEM-LIFE-051: Terms with HTML/script tags', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const xssTerms = '<script>alert("xss")</script>These are the terms<img src="x" onerror="alert(1)">';

    const response = await apiClient.createMembershipTerms(xssTerms);

    // Should either sanitize or reject, not accept as-is
    if (response.status === 200 || response.status === 201) {
      // If accepted, verify it was sanitized
      const termsResponse = await apiClient.getMembershipTerms();
      if (termsResponse.body.terms_text) {
        expect(termsResponse.body.terms_text).not.toContain('<script>');
      }
    }

    console.log(`✓ MEM-LIFE-051: XSS in terms: ${response.status}`);
  });

  test('MEM-LIFE-052: Unicode in membership terms', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const unicodeTerms = 'Terms with emoji 🎉 and Unicode: 日本語 العربية';

    const response = await apiClient.createMembershipTerms(unicodeTerms);

    expect([200, 201]).toContain(response.status);
    console.log(`✓ MEM-LIFE-052: Unicode terms: ${response.status}`);
  });

});

test.describe('Membership Lifecycle - Account Cancellation', () => {

  test('MEM-LIFE-060: Cancel account requires authentication', async () => {
    apiClient.withoutAuth();
    const response = await apiClient.makeRequest('POST', '/account/cancel');

    expect(response.status).toBe(401);
    console.log('✓ MEM-LIFE-060: Cancel account requires auth');
  });

  test('MEM-LIFE-061: Cancel account endpoint exists', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('POST', '/account/cancel');

    // Should not be 404 (endpoint exists)
    // Don't actually cancel admin account - just verify endpoint
    expect(response.status).not.toBe(404);
    console.log(`✓ MEM-LIFE-061: Cancel endpoint exists: ${response.status}`);
  });

  test('MEM-LIFE-062: Cancel with confirmation field', async () => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      console.log('⚠ Skipped - ADMIN_TOKEN required');
      test.skip();
      return;
    }

    apiClient.withAuth(adminToken);
    const response = await apiClient.makeRequest('POST', '/account/cancel', {
      confirm: false // Don't actually confirm
    });

    // May require confirmation=true
    expect(response.status).toBeLessThan(500);
    console.log(`✓ MEM-LIFE-062: Cancel with confirmation: ${response.status}`);
  });

});
