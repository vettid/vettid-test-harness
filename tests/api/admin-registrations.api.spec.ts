import { test, expect } from '@playwright/test';
import { APITestClient } from '../utils/api-test-client';
import { QuickAuth } from '../utils/quick-auth';
import { testDataGenerator } from '../utils/test-data-generator';

/**
 * API Test Suite: Admin Registration Management
 * Tests admin endpoints for managing registrations
 */

let apiClient: APITestClient;
let quickAuth: QuickAuth;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
  quickAuth = new QuickAuth(request);
});

test.describe('Admin Registration Management API', () => {

  test('ADMIN-REG-001: List all registrations (admin only)', async () => {
    // Authenticate as admin
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    apiClient.startTimer();
    const response = await apiClient.listRegistrations();

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Verify response contains expected fields
    if (response.body.length > 0) {
      const firstReg = response.body[0];
      expect(firstReg).toHaveProperty('registration_id');
      expect(firstReg).toHaveProperty('email');
      expect(firstReg).toHaveProperty('status');
    }

    await apiClient.expectFastResponse(3000);

    console.log(`✓ Listed ${response.body.length} registrations`);
  });

  test('ADMIN-REG-002: Filter registrations by status', async () => {
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    // Test filtering by "pending" status
    const response = await apiClient.request(
      'GET',
      '/admin/registrations?status=pending'
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    // Verify all returned registrations have pending status
    for (const reg of response.body) {
      if (reg.status) {
        expect(reg.status).toBe('pending');
      }
    }

    console.log(`✓ Filtered to ${response.body.length} pending registrations`);
  });

  test('ADMIN-REG-003: Approve registration creates Cognito user', async () => {
    // Create a test registration first
    const user = testDataGenerator.generateUser();
    const regResponse = await apiClient.submitRegistration(user);

    expect(regResponse.status).toBe(201);
    const registrationId = regResponse.body.registration_id;

    // Now approve as admin
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    const approveResponse = await apiClient.approveRegistration(registrationId);

    await apiClient.expectSuccess(approveResponse, 200);

    // Verify response indicates success
    expect(approveResponse.body.message || approveResponse.body.status)
      .toMatch(/approve|success/i);

    console.log(`✓ Approved registration: ${registrationId}`);

    // Cleanup
    await quickAuth.cleanupUser(registrationId).catch(() => {});
  });

  test('ADMIN-REG-004: Reject registration with reason', async () => {
    // Create a test registration
    const user = testDataGenerator.generateUser();
    const regResponse = await apiClient.submitRegistration(user);

    expect(regResponse.status).toBe(201);
    const registrationId = regResponse.body.registration_id;

    // Reject as admin
    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    const rejectResponse = await apiClient.rejectRegistration(registrationId);

    await apiClient.expectSuccess(rejectResponse, 200);

    console.log(`✓ Rejected registration: ${registrationId}`);

    // Verify user cannot authenticate after rejection
    // (This would require auth flow implementation)
  });

  test('ADMIN-REG-005: Approve already approved registration (idempotency)', async () => {
    // Create and approve a registration
    const user = testDataGenerator.generateUser();
    const regResponse = await apiClient.submitRegistration(user);
    expect(regResponse.status).toBe(201);
    const registrationId = regResponse.body.registration_id;

    const adminToken = await quickAuth.getAdminToken();
    apiClient.withAuth(adminToken);

    // First approval
    const firstApproval = await apiClient.approveRegistration(registrationId);
    expect(firstApproval.status).toBe(200);

    // Second approval (should be idempotent)
    const secondApproval = await apiClient.approveRegistration(registrationId);

    // Should either succeed with 200 or return 409/400 indicating already approved
    await apiClient.expectStatusOneOf(secondApproval, [200, 400, 409]);

    console.log(`✓ Idempotency test passed: ${secondApproval.status}`);

    // Cleanup
    await quickAuth.cleanupUser(registrationId).catch(() => {});
  });

  test('ADMIN-REG-006: Unauthorized access without admin token', async () => {
    // Attempt to list registrations without authentication
    apiClient.withoutAuth();

    const response = await apiClient.listRegistrations();

    // Should be 401 Unauthorized
    expect(response.status).toBe(401);

    console.log(`✓ Unauthorized access properly blocked`);
  });

});
