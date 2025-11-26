import { test, expect } from '@playwright/test';
import { APITestClient } from '../utils/api-test-client';
import { testDataGenerator } from '../utils/test-data-generator';

/**
 * API Test Suite: Registration Endpoints
 * Tests POST /register endpoint without UI
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Registration API', () => {

  test('REG-API-001: Valid registration with invite code', async () => {
    const user = testDataGenerator.generateUser();

    apiClient.startTimer();
    const response = await apiClient.submitRegistration(user);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('registration_id');
    expect(response.body).toHaveProperty('status');
    expect(response.body.email).toBe(user.email);

    // Verify response time < 2 seconds
    await apiClient.expectFastResponse(2000);

    console.log(`✓ Registration created: ${response.body.registration_id}`);
  });

  test('REG-API-002: Invalid invite code rejection', async () => {
    const user = testDataGenerator.generateUser({
      invite_code: 'INVALID-CODE-12345'
    });

    const response = await apiClient.submitRegistration(user);

    await apiClient.expectError(response, 400, 'invite');

    console.log(`✓ Invalid invite rejected: ${response.body.error}`);
  });

  test('REG-API-003: Duplicate email prevention', async () => {
    const user = testDataGenerator.generateUser();

    // First registration
    const firstResponse = await apiClient.submitRegistration(user);
    expect(firstResponse.status).toBe(201);

    // Attempt duplicate
    const duplicateResponse = await apiClient.submitRegistration(user);

    // Should reject with 409 Conflict or 400 Bad Request
    await apiClient.expectStatusOneOf(duplicateResponse, [400, 409]);
    expect(duplicateResponse.body.error || duplicateResponse.body.message)
      .toMatch(/already|exist|duplicate/i);

    console.log(`✓ Duplicate email prevented: ${duplicateResponse.body.error}`);
  });

  test('REG-API-004: Missing required fields validation', async () => {
    // Test missing email
    const responseNoEmail = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: '',
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(responseNoEmail.status).toBe(400);

    // Test missing first name
    const responseNoFirstName = await apiClient.submitRegistration({
      first_name: '',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(responseNoFirstName.status).toBe(400);

    // Test missing invite code
    const responseNoInvite = await apiClient.submitRegistration({
      first_name: 'Test',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: ''
    });

    expect(responseNoInvite.status).toBe(400);

    console.log(`✓ Required field validation working`);
  });

  test('REG-API-005: Auto-approve flow (if invite has auto_approve)', async () => {
    // This test depends on having an auto-approve invite
    // Skip if not available
    if (!process.env.AUTO_APPROVE_INVITE_CODE) {
      test.skip();
      return;
    }

    const user = testDataGenerator.generateUser({
      invite_code: process.env.AUTO_APPROVE_INVITE_CODE
    });

    const response = await apiClient.submitRegistration(user);

    expect(response.status).toBe(201);
    expect(response.body.registration_id).toBeDefined();

    // Check if auto-approved
    if (response.body.auto_approved) {
      expect(response.body.status).toBe('approved');
      console.log(`✓ Auto-approval successful: ${response.body.registration_id}`);
    } else {
      console.log(`⚠ Auto-approve not triggered (may require setup)`);
    }
  });

  test('REG-API-006: Email format validation', async () => {
    const invalidEmails = testDataGenerator.generateInvalidEmails();

    for (const invalidEmail of invalidEmails.slice(0, 5)) { // Test first 5
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: invalidEmail,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).toBe(400);
      console.log(`✓ Invalid email rejected: "${invalidEmail}"`);
    }
  });

  test('REG-API-007: Special characters in names (international support)', async () => {
    const internationalNames = testDataGenerator.generateInternationalNames();

    for (const { first_name, last_name } of internationalNames.slice(0, 3)) {
      const response = await apiClient.submitRegistration({
        first_name,
        last_name,
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should either accept (201) or reject with validation error (400)
      // But should NOT crash (500)
      expect(response.status).not.toBe(500);

      if (response.status === 201) {
        console.log(`✓ International name accepted: ${first_name} ${last_name}`);
      } else {
        console.log(`⚠ International name rejected: ${first_name} ${last_name}`);
      }
    }
  });

});
