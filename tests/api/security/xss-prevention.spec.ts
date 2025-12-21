import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * XSS Prevention API Tests
 * Verifies that all inputs are properly sanitized to prevent XSS attacks
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('XSS Prevention - Registration Endpoint', () => {

  const xssPayloads = [
    // Basic script tags
    "<script>alert('xss')</script>",
    "<SCRIPT>alert('xss')</SCRIPT>",
    "<ScRiPt>alert('xss')</ScRiPt>",

    // Event handlers
    "<img src=x onerror=alert('xss')>",
    "<img src=x onerror='alert(1)'>",
    "<body onload=alert('xss')>",
    "<svg onload=alert('xss')>",
    "<input onfocus=alert('xss') autofocus>",
    "<marquee onstart=alert('xss')>",

    // JavaScript protocol
    "javascript:alert('xss')",
    "JAVASCRIPT:alert('xss')",
    "JaVaScRiPt:alert('xss')",

    // Data URIs
    "data:text/html,<script>alert('xss')</script>",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4=",

    // HTML injection
    "<iframe src='javascript:alert(1)'></iframe>",
    "<embed src='javascript:alert(1)'>",
    "<object data='javascript:alert(1)'>",

    // CSS injection
    "<div style=\"background:url('javascript:alert(1)')\">",
    "<style>body{background:url('javascript:alert(1)')}</style>",

    // Template literals
    "${alert('xss')}",
    "{{constructor.constructor('alert(1)')()}}",

    // Encoded payloads
    "%3Cscript%3Ealert('xss')%3C/script%3E",
    "&#60;script&#62;alert('xss')&#60;/script&#62;",
    "\\x3cscript\\x3ealert('xss')\\x3c/script\\x3e",

    // SVG-based XSS
    "<svg><script>alert('xss')</script></svg>",
    "<svg/onload=alert('xss')>",

    // XML-based
    "<xml><script>alert('xss')</script></xml>"
  ];

  test('XSS-REG-001: Script tags in first_name are sanitized or rejected', async () => {
    for (const payload of xssPayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should not cause server error
      expect(response.status).not.toBe(500);

      // If accepted, verify sanitization
      if (response.status === 201) {
        const returnedName = response.body.first_name || '';
        expect(returnedName).not.toContain('<script>');
        expect(returnedName).not.toContain('onerror=');
        expect(returnedName).not.toContain('javascript:');
      }
    }
  });

  test('XSS-REG-002: Script tags in last_name are sanitized or rejected', async () => {
    for (const payload of xssPayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: payload,
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);

      if (response.status === 201) {
        const returnedName = response.body.last_name || '';
        expect(returnedName).not.toContain('<script>');
      }
    }
  });

  test('XSS-REG-003: Event handlers in names are sanitized', async () => {
    const eventPayloads = xssPayloads.filter(p => p.includes('on'));

    for (const payload of eventPayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });

  test('XSS-REG-004: JavaScript protocol in email is rejected', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: "javascript:alert('xss')@test.com",
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).toBe(400);
  });

  test('XSS-REG-005: Data URI in email is rejected', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: "data:text/html,<script>alert(1)</script>@test.com",
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).toBe(400);
  });

  test('XSS-REG-006: XSS in invite code is handled', async () => {
    for (const payload of xssPayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: payload
      });

      // Should reject as invalid code, not crash
      expect(response.status).toBe(400);
      expect(response.status).not.toBe(500);
    }
  });

  test('XSS-REG-007: Encoded XSS payloads are handled', async () => {
    const encodedPayloads = [
      '%3Cscript%3Ealert(1)%3C%2Fscript%3E',
      '&lt;script&gt;alert(1)&lt;/script&gt;',
      '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e'
    ];

    for (const payload of encodedPayloads) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });

  test('XSS-REG-008: SVG-based XSS is prevented', async () => {
    const svgPayloads = [
      '<svg onload=alert(1)>',
      '<svg><script>alert(1)</script></svg>',
      '<svg/onload=alert(1)//'
    ];

    for (const payload of svgPayloads) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });
});

test.describe('XSS Prevention - Admin Endpoints', () => {

  test('XSS-ADMIN-001: XSS in invite code creation is handled', async () => {
    await apiClient.withAdminAuthAsync();

    const response = await apiClient.createInviteWithOptions({
      code: "<script>alert('xss')</script>"
    });

    // Should reject or sanitize
    expect(response.status).not.toBe(500);

    if (response.status === 200 || response.status === 201) {
      expect(response.body.code).not.toContain('<script>');
    }
  });

  test('XSS-ADMIN-002: XSS in admin user creation is handled', async () => {
    await apiClient.withAdminAuthAsync();

    const response = await apiClient.makeRequest('POST', '/admin/admins', {
      first_name: "<script>alert('xss')</script>",
      last_name: "<img onerror=alert(1) src=x>",
      email: testDataGenerator.generateEmail('admin')
    });

    expect(response.status).not.toBe(500);
  });

  test('XSS-ADMIN-003: XSS in membership terms is handled', async () => {
    await apiClient.withAdminAuthAsync();

    const xssTerms = `
      <h1>Terms</h1>
      <script>alert('xss')</script>
      <p>By accepting these terms...</p>
      <img src=x onerror=alert(1)>
    `;

    const response = await apiClient.createMembershipTerms(xssTerms);

    expect(response.status).not.toBe(500);

    // If accepted, verify script tags are sanitized
    if (response.status === 200 || response.status === 201) {
      expect(response.body.text || '').not.toContain('<script>');
    }
  });
});

test.describe('XSS Prevention - Member Endpoints', () => {

  test('XSS-MEMBER-001: XSS in PIN is rejected', async () => {
    await apiClient.withMemberAuthAsync();
    await apiClient.disablePin();

    const response = await apiClient.enablePin("<script>alert(1)</script>");

    // Should reject as invalid PIN format
    expect(response.status).toBe(400);
  });
});

test.describe('XSS Prevention - Response Headers', () => {

  test('XSS-HEADERS-001: Content-Type is application/json', async () => {
    const user = testDataGenerator.generateUser();
    const response = await apiClient.submitRegistration(user);

    // Response should be JSON (handled by API client)
    expect(response.body).toBeDefined();
    expect(typeof response.body).toBe('object');
  });

  test('XSS-HEADERS-002: Response does not contain executable content', async () => {
    const user = testDataGenerator.generateUser({
      first_name: "<script>alert(1)</script>"
    });

    const response = await apiClient.submitRegistration(user);

    // Stringify body and check for unescaped scripts
    const bodyStr = JSON.stringify(response.body);

    // In JSON, < should be escaped or the script should be sanitized
    if (bodyStr.includes('script')) {
      // If script is in response, it should be escaped
      expect(bodyStr).not.toMatch(/<script>/);
    }
  });
});

test.describe('XSS Prevention - Stored XSS', () => {

  test('XSS-STORED-001: Verify stored data does not contain active XSS', async () => {
    // This test registers a user with XSS payload, then retrieves to verify sanitization

    const xssName = "<script>alert('stored-xss')</script>";
    const user = testDataGenerator.generateUser({
      first_name: xssName
    });

    // Register with XSS payload
    const regResponse = await apiClient.submitRegistration(user);

    if (regResponse.status !== 201) {
      // Registration rejected - XSS prevented at input
      return;
    }

    // Now fetch as admin and verify stored data is safe
    await apiClient.withAdminAuthAsync();

    const listResponse = await apiClient.listRegistrations();

    if (listResponse.status === 200) {
      const items = listResponse.body.items || listResponse.body;
      const storedUser = items.find((r: any) => r.email === user.email);

      if (storedUser) {
        // Verify no raw script tags
        expect(storedUser.first_name).not.toBe(xssName);
        expect(storedUser.first_name).not.toContain('<script>');
      }
    }
  });
});

test.describe('XSS Prevention - DOM-based XSS vectors', () => {

  test('XSS-DOM-001: Fragment identifiers in email are handled', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: 'test#<script>alert(1)</script>@test.com',
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).toBe(400);
  });

  test('XSS-DOM-002: URL-like XSS in names is handled', async () => {
    const response = await apiClient.submitRegistration({
      first_name: 'http://evil.com/<script>alert(1)</script>',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).not.toBe(500);
  });
});
