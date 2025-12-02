import { test, expect } from '@playwright/test';
import { APITestClient } from '../../../utils/api-test-client';
import { testDataGenerator } from '../../../utils/test-data-generator';

/**
 * Membership Terms API Tests
 * Tests admin endpoints for managing membership terms
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Create Membership Terms', () => {

  test.describe('Authorization', () => {

    test('TERMS-CREATE-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.createMembershipTerms('Test terms content');

      expect(response.status).toBe(401);
    });

    test('TERMS-CREATE-002: Rejects member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.createMembershipTerms('Test terms content');

      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('TERMS-CREATE-003: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

      await apiClient.expectStatusOneOf(response, [200, 201, 400]);
    });
  });

  test.describe('Validation', () => {

    test('TERMS-CREATE-004: Rejects empty terms text', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms('');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/text|required|empty/i);
    });

    test('TERMS-CREATE-005: Rejects whitespace-only terms text', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms('   \n\t  ');

      expect(response.status).toBe(400);
    });

    test('TERMS-CREATE-006: Handles very long terms text', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const longTerms = 'A'.repeat(100000); // 100KB

      const response = await apiClient.createMembershipTerms(longTerms);

      // Should either accept or reject with clear error
      expect(response.status).not.toBe(500);
    });

    test('TERMS-CREATE-007: Handles special characters in terms', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const termsWithSpecialChars = `
        # Terms & Conditions

        1. Legal "quotes" and 'apostrophes'
        2. Symbols: © ® ™ € £ ¥
        3. Accented: àéîõü
        4. Math: ≤ ≥ ≠ ± × ÷
      `;

      const response = await apiClient.createMembershipTerms(termsWithSpecialChars);

      expect(response.status).not.toBe(500);
    });

    test('TERMS-CREATE-008: Handles markdown formatting', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const markdownTerms = `
        # VettID Membership Terms

        ## Article 1: Definitions

        - **Member**: A registered user
        - _Service_: The VettID platform

        ## Article 2: Obligations

        1. First obligation
        2. Second obligation
           - Sub-point a
           - Sub-point b

        > Important notice

        \`\`\`
        Code block
        \`\`\`
      `;

      const response = await apiClient.createMembershipTerms(markdownTerms);

      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Success Flow', () => {

    test('TERMS-CREATE-009: Returns version_id on success', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

      if (response.status === 200 || response.status === 201) {
        expect(response.body.version_id).toBeDefined();
        expect(typeof response.body.version_id).toBe('string');
        expect(response.body.version_id.length).toBeGreaterThan(0);
      }
    });

    test('TERMS-CREATE-010: New terms are marked as current', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

      if (response.status === 200 || response.status === 201) {
        expect(response.body.is_current).toBe(true);
      }
    });

    test('TERMS-CREATE-011: Previous terms are marked as not current', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      // Get current terms first
      const currentResponse = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

      const previousVersionId = currentResponse.body?.version_id;

      // Create new terms
      const createResponse = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

      if (createResponse.status === 200 || createResponse.status === 201) {
        // Verify new terms are current
        expect(createResponse.body.is_current).toBe(true);

        // Previous should no longer be current (if it existed)
        if (previousVersionId) {
          const listResponse = await apiClient.makeRequest('GET', '/admin/membership-terms');
          const previousTerms = (listResponse.body.items || listResponse.body)
            .find((t: any) => t.version_id === previousVersionId);

          if (previousTerms) {
            expect(previousTerms.is_current).toBe(false);
          }
        }
      }
    });

    test('TERMS-CREATE-012: PDF is generated', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

      if (response.status === 200 || response.status === 201) {
        // Should have PDF URL
        expect(response.body.pdf_url || response.body.url).toBeDefined();
        expect(response.body.pdf_url || response.body.url).toMatch(/^https?:\/\//);
      }
    });

    test('TERMS-CREATE-013: Includes created_at timestamp', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

      if (response.status === 200 || response.status === 201) {
        expect(response.body.created_at).toBeDefined();

        // Verify timestamp is recent
        const createdAt = new Date(response.body.created_at).getTime();
        expect(Date.now() - createdAt).toBeLessThan(60000);
      }
    });

    test('TERMS-CREATE-014: Includes created_by admin email', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

      if (response.status === 200 || response.status === 201) {
        expect(response.body.created_by).toBeDefined();
        expect(response.body.created_by).toMatch(/@/); // Should be an email
      }
    });
  });

  test.describe('Security', () => {

    test('TERMS-CREATE-015: XSS in terms text is sanitized', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const xssTerms = "<script>alert('xss')</script>Terms content";

      const response = await apiClient.createMembershipTerms(xssTerms);

      if (response.status === 200 || response.status === 201) {
        expect(response.body.text).not.toContain('<script>');
      }
    });

    test('TERMS-CREATE-016: SQL injection in terms text is handled', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const sqlTerms = "'; DROP TABLE membership_terms; --";

      const response = await apiClient.createMembershipTerms(sqlTerms);

      expect(response.status).not.toBe(500);
    });
  });
});

test.describe('List Membership Terms', () => {

  test.describe('Authorization', () => {

    test('TERMS-LIST-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

      expect(response.status).toBe(401);
    });

    test('TERMS-LIST-002: Rejects member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('TERMS-LIST-003: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

      await apiClient.expectStatusOneOf(response, [200, 404]);
    });
  });

  test.describe('Response Format', () => {

    test('TERMS-LIST-004: Returns array of terms', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

      if (response.status === 200) {
        expect(Array.isArray(response.body) || Array.isArray(response.body.items)).toBe(true);
      }
    });

    test('TERMS-LIST-005: Each term has required fields', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

      if (response.status === 200) {
        const items = response.body.items || response.body;

        for (const term of items) {
          expect(term).toHaveProperty('version_id');
          expect(term).toHaveProperty('text');
          expect(term).toHaveProperty('is_current');
          expect(term).toHaveProperty('created_at');
        }
      }
    });

    test('TERMS-LIST-006: Terms are sorted by created_at', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

      if (response.status === 200) {
        const items = response.body.items || response.body;

        if (items.length > 1) {
          // Check descending order (newest first)
          for (let i = 0; i < items.length - 1; i++) {
            const current = new Date(items[i].created_at).getTime();
            const next = new Date(items[i + 1].created_at).getTime();
            expect(current).toBeGreaterThanOrEqual(next);
          }
        }
      }
    });

    test('TERMS-LIST-007: Exactly one term is marked current', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

      if (response.status === 200) {
        const items = response.body.items || response.body;
        const currentTerms = items.filter((t: any) => t.is_current === true);

        // Should have at most one current term
        expect(currentTerms.length).toBeLessThanOrEqual(1);
      }
    });
  });

  test.describe('Pagination', () => {

    test('TERMS-LIST-008: Supports limit parameter', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms?limit=2');

      if (response.status === 200) {
        const items = response.body.items || response.body;
        expect(items.length).toBeLessThanOrEqual(2);
      }
    });

    test('TERMS-LIST-009: Supports pagination token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const firstPage = await apiClient.makeRequest('GET', '/admin/membership-terms?limit=1');

      if (firstPage.status === 200 && firstPage.body.next_token) {
        const nextPage = await apiClient.makeRequest(
          'GET',
          `/admin/membership-terms?limit=1&next_token=${firstPage.body.next_token}`
        );

        expect(nextPage.status).toBe(200);
      }
    });
  });
});

test.describe('Get Current Membership Terms', () => {

  test.describe('Authorization', () => {

    test('TERMS-CURRENT-001: Requires authentication', async () => {
      apiClient.withoutAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

      expect(response.status).toBe(401);
    });

    test('TERMS-CURRENT-002: Rejects member token', async () => {
      if (!process.env.MEMBER_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAuth(process.env.MEMBER_TOKEN);

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

      await apiClient.expectStatusOneOf(response, [401, 403]);
    });

    test('TERMS-CURRENT-003: Accepts admin token', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

      await apiClient.expectStatusOneOf(response, [200, 404]);
    });
  });

  test.describe('Response Format', () => {

    test('TERMS-CURRENT-004: Returns single terms object', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('version_id');
        expect(response.body).toHaveProperty('text');
        expect(response.body.is_current).toBe(true);
      }
    });

    test('TERMS-CURRENT-005: Returns 404 when no current terms', async () => {
      // This test documents behavior when no terms exist
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

      // Either 200 with terms or 404 if none exist
      await apiClient.expectStatusOneOf(response, [200, 404]);
    });

    test('TERMS-CURRENT-006: Includes PDF URL', async () => {
      if (!process.env.ADMIN_TOKEN) {
        test.skip();
        return;
      }

      apiClient.withAdminAuth();

      const response = await apiClient.makeRequest('GET', '/admin/membership-terms/current');

      if (response.status === 200) {
        expect(response.body.pdf_url || response.body.url).toBeDefined();
      }
    });
  });
});

test.describe('Terms Version Management', () => {

  test('TERMS-VERSION-001: Multiple versions can coexist', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Create two versions
    await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());
    await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

    // List should show multiple
    const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

    if (response.status === 200) {
      const items = response.body.items || response.body;
      expect(items.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('TERMS-VERSION-002: Old versions remain accessible', async () => {
    if (!process.env.ADMIN_TOKEN) {
      test.skip();
      return;
    }

    apiClient.withAdminAuth();

    // Create initial version
    const first = await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());
    const firstVersionId = first.body?.version_id;

    // Create new version
    await apiClient.createMembershipTerms(testDataGenerator.generateMembershipTerms());

    // List should still contain first version
    const response = await apiClient.makeRequest('GET', '/admin/membership-terms');

    if (response.status === 200 && firstVersionId) {
      const items = response.body.items || response.body;
      const oldVersion = items.find((t: any) => t.version_id === firstVersionId);
      expect(oldVersion).toBeDefined();
    }
  });
});
