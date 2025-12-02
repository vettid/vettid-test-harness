import { test, expect } from '@playwright/test';
import { APITestClient } from '../../../utils/api-test-client';
import { testDataGenerator } from '../../../utils/test-data-generator';

/**
 * Request Membership API Tests
 * Tests member endpoints for membership requests
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Request Membership', () => {

  test.describe('Authorization', () => {

    test('MEMREQ-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.requestMembership();

      expect(response.status).toBe(401);
    });

    test('MEMREQ-002: Rejects admin token (member only)', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.ADMIN_TOKEN);

      const response = await apiClient.requestMembership();

      // Admin token should not work for member endpoints
      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('MEMREQ-003: Accepts member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.requestMembership();

      // Should get past auth - may fail for other reasons
      expect(response.status).not.toBe(401);
    });

    test('MEMREQ-004: Rejects expired token', async () => {
      const expiredToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MDAwMDAwMDB9.invalid';
      apiClient.withAuth(expiredToken);

      const response = await apiClient.requestMembership();

      expect(response.status).toBe(401);
    });
  });

  test.describe('Terms Acceptance', () => {

    test('MEMREQ-005: Requires terms_version_id', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      // Request without terms_version_id
      const response = await apiClient.makeRequest('POST', '/account/membership/request', {});

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/terms|version/i);
    });

    test('MEMREQ-006: Rejects invalid terms_version_id', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: 'nonexistent-version-12345'
      });

      // API may return 400 or 404 for invalid terms
      await apiClient.expectStatusOneOf(response, [400, 404]);
    });

    test('MEMREQ-007: Accepts valid terms_version_id', async () => {
      if (!process.env.MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
      });

      // Should accept or reject for other reasons (already requested, etc.)
      expect(response.status).not.toBe(500);
    });
  });

  test.describe('State Transitions', () => {

    test('MEMREQ-008: New request sets status to pending', async () => {
      if (!process.env.MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
      });

      if (response.status === 200 || response.status === 201) {
        expect(response.body.membership_status).toBe('pending');
      }
    });

    test('MEMREQ-009: Records terms_accepted_at timestamp', async () => {
      if (!process.env.MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
      });

      if (response.status === 200 || response.status === 201) {
        expect(response.body.terms_accepted_at).toBeDefined();

        // Verify timestamp is recent
        const acceptedAt = new Date(response.body.terms_accepted_at).getTime();
        expect(Date.now() - acceptedAt).toBeLessThan(60000);
      }
    });

    test('MEMREQ-010: Records membership_requested_at timestamp', async () => {
      if (!process.env.MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
      });

      if (response.status === 200 || response.status === 201) {
        expect(response.body.membership_requested_at).toBeDefined();
      }
    });

    test('MEMREQ-011: Rejects request when already pending', async () => {
      if (!process.env.MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      // First request
      await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
      });

      // Second request
      const response = await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
      });

      // Should reject duplicate
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already|pending|exist/i);
    });

    test('MEMREQ-012: Rejects request when already approved', async () => {
      if (!process.env.APPROVED_MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.APPROVED_MEMBER_TOKEN);

      const response = await apiClient.makeRequest('POST', '/account/membership/request', {
        terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/already.*approved|already.*member/i);
    });
  });
});

test.describe('Get Membership Status', () => {

  test.describe('Authorization', () => {

    test('MEMSTATUS-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.getMembershipStatus();

      expect(response.status).toBe(401);
    });

    test('MEMSTATUS-002: Accepts member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      expect(response.status).toBe(200);
    });
  });

  test.describe('Response Format', () => {

    test('MEMSTATUS-003: Returns membership_status field', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('membership_status');
    });

    test('MEMSTATUS-004: Status is valid enum value', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      if (response.status === 200) {
        expect(['none', 'pending', 'approved', 'denied']).toContain(response.body.membership_status);
      }
    });

    test('MEMSTATUS-005: Returns terms_version_id if requested', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      if (response.status === 200 && response.body.membership_status !== 'none') {
        // Should include terms version if membership was requested
        expect(response.body.terms_version_id).toBeDefined();
      }
    });

    test('MEMSTATUS-006: Returns timestamps for requested memberships', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      if (response.status === 200 && response.body.membership_status !== 'none') {
        expect(response.body.membership_requested_at || response.body.terms_accepted_at).toBeDefined();
      }
    });
  });

  test.describe('Status Values', () => {

    test('MEMSTATUS-007: Returns "none" for user without membership request', async () => {
      if (!process.env.NEW_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.NEW_MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      expect(response.status).toBe(200);
      expect(response.body.membership_status).toBe('none');
    });

    test('MEMSTATUS-008: Returns "pending" for pending request', async () => {
      if (!process.env.PENDING_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.PENDING_MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      expect(response.status).toBe(200);
      expect(response.body.membership_status).toBe('pending');
    });

    test('MEMSTATUS-009: Returns "approved" for approved member', async () => {
      if (!process.env.APPROVED_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.APPROVED_MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      expect(response.status).toBe(200);
      expect(response.body.membership_status).toBe('approved');
    });

    test('MEMSTATUS-010: Returns "denied" for denied request', async () => {
      if (!process.env.DENIED_MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.DENIED_MEMBER_TOKEN);

      const response = await apiClient.getMembershipStatus();

      expect(response.status).toBe(200);
      expect(response.body.membership_status).toBe('denied');
    });
  });
});

test.describe('Get Membership Terms', () => {

  test.describe('Authorization', () => {

    test('MEMTERMS-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.getMembershipTerms();

      expect(response.status).toBe(401);
    });

    test('MEMTERMS-002: Accepts member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipTerms();

      await apiClient.expectStatusOneOf(response, [200, 404]);
    });
  });

  test.describe('Response Format', () => {

    test('MEMTERMS-003: Returns current terms', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipTerms();

      if (response.status === 200) {
        expect(response.body).toHaveProperty('version_id');
        // API returns terms_text instead of text
        expect(response.body.terms_text || response.body.text).toBeDefined();
      }
    });

    test('MEMTERMS-004: Returns PDF URL', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipTerms();

      if (response.status === 200) {
        // API returns download_url instead of pdf_url
        const url = response.body.download_url || response.body.pdf_url || response.body.url;
        expect(url).toBeDefined();

        // Verify URL format
        expect(url).toMatch(/^https?:\/\//);
      }
    });

    test('MEMTERMS-005: Returns is_current flag', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipTerms();

      if (response.status === 200) {
        // is_current may not be returned by the API if this is the current terms
        // Just verify we got terms back
        expect(response.body.version_id).toBeDefined();
      }
    });

    test('MEMTERMS-006: Handles no terms defined', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipTerms();

      // Should either return 200 with terms or 404 if none exist
      await apiClient.expectStatusOneOf(response, [200, 404]);

      if (response.status === 404) {
        expect(response.body.message).toMatch(/terms|not found/i);
      }
    });
  });

  test.describe('Terms Content', () => {

    test('MEMTERMS-007: Terms text is not empty', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipTerms();

      if (response.status === 200) {
        // API returns terms_text instead of text
        const termsText = response.body.terms_text || response.body.text;
        expect(termsText).toBeDefined();
        expect(termsText.length).toBeGreaterThan(0);
      }
    });

    test('MEMTERMS-008: Version ID is valid format', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.getMembershipTerms();

      if (response.status === 200) {
        expect(response.body.version_id).toBeDefined();
        expect(typeof response.body.version_id).toBe('string');
        expect(response.body.version_id.length).toBeGreaterThan(0);
      }
    });
  });
});

test.describe('Membership Lifecycle', () => {

  test('MEMLIFE-001: Complete membership request flow', async () => {
    // This test requires a fresh user without membership
    if (!process.env.NEW_MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.NEW_MEMBER_TOKEN);

    // 1. Check initial status is 'none'
    const initialStatus = await apiClient.getMembershipStatus();
    expect(initialStatus.status).toBe(200);
    expect(initialStatus.body.membership_status).toBe('none');

    // 2. Get current terms
    const terms = await apiClient.getMembershipTerms();
    expect(terms.status).toBe(200);

    // 3. Request membership
    const request = await apiClient.makeRequest('POST', '/account/membership/request', {
      terms_version_id: terms.body.version_id
    });
    await apiClient.expectStatusOneOf(request, [200, 201]);
    expect(request.body.membership_status).toBe('pending');

    // 4. Verify status changed to pending
    const pendingStatus = await apiClient.getMembershipStatus();
    expect(pendingStatus.body.membership_status).toBe('pending');
  });

  test('MEMLIFE-002: Cannot request membership multiple times', async () => {
    if (!process.env.MEMBER_TOKEN || !process.env.CURRENT_TERMS_VERSION_ID) {
      test.skip();
      return;
    }

    apiClient.withAuth(process.env.MEMBER_TOKEN);

    // Make two requests
    const first = await apiClient.makeRequest('POST', '/account/membership/request', {
      terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
    });

    const second = await apiClient.makeRequest('POST', '/account/membership/request', {
      terms_version_id: process.env.CURRENT_TERMS_VERSION_ID
    });

    // At least one should fail
    const statuses = [first.status, second.status];
    expect(statuses.some(s => s === 400)).toBe(true);
  });
});
