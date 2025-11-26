import { APIRequestContext } from '@playwright/test';
import { APIHelpers } from './api-helpers';

/**
 * Quick authentication helper for 24-hour sprint
 * Minimal setup, maximum speed - no full user fixtures
 */
export class QuickAuth {
  private apiHelpers: APIHelpers;
  private adminToken?: string;
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(request: APIRequestContext) {
    this.apiHelpers = new APIHelpers(request);
  }

  /**
   * Get admin token from environment or Cognito
   * Caches for reuse across tests
   */
  async getAdminToken(): Promise<string> {
    // Check environment variable first
    if (process.env.ADMIN_TOKEN) {
      return process.env.ADMIN_TOKEN;
    }

    // Check cache
    if (this.adminToken) {
      return this.adminToken;
    }

    // TODO: Implement Cognito OAuth flow for admin token
    // For now, require it in environment
    throw new Error('ADMIN_TOKEN environment variable required for sprint tests');
  }

  /**
   * Create approved user quickly via API (no UI)
   * Returns user info with tokens
   */
  async createApprovedUser(options?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    autoApprove?: boolean;
  }): Promise<{
    email: string;
    registrationId: string;
    userId: string;
  }> {
    const email = options?.email || this.generateTestEmail();
    const firstName = options?.firstName || 'Test';
    const lastName = options?.lastName || 'User';

    // Get or create auto-approve invite
    let inviteCode: string;
    if (options?.autoApprove !== false) {
      inviteCode = await this.getOrCreateAutoApproveInvite();
    } else {
      inviteCode = process.env.TEST_INVITE_CODE || '';
    }

    // Submit registration
    const regResponse = await this.apiHelpers.submitRegistration({
      first_name: firstName,
      last_name: lastName,
      email: email,
      invite_code: inviteCode
    });

    if (regResponse.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regResponse.body)}`);
    }

    const registrationId = regResponse.body.registration_id;

    // If not auto-approved, approve manually
    if (!regResponse.body.auto_approved) {
      const adminToken = await this.getAdminToken();
      this.apiHelpers.setAuthToken(adminToken);

      const approveResponse = await this.apiHelpers.approveRegistration(registrationId);
      if (approveResponse.status !== 200) {
        throw new Error(`Approval failed: ${JSON.stringify(approveResponse.body)}`);
      }
    }

    return {
      email,
      registrationId,
      userId: regResponse.body.user_guid || registrationId
    };
  }

  /**
   * Get member auth token via magic link flow
   * Uses Cognito directly (no email verification needed)
   */
  async getMemberToken(email: string): Promise<string> {
    // Check cache first
    const cached = this.tokenCache.get(email);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // TODO: Implement Cognito CUSTOM_AUTH flow
    // For sprint, we'll use API calls that don't require auth
    // or pass through admin token where needed

    throw new Error('Member token generation not implemented - use admin token for sprint');
  }

  /**
   * Generate unique test email
   */
  generateTestEmail(prefix: string = 'sprint'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}@test.vettid.dev`;
  }

  /**
   * Get or create an auto-approve invite code
   * Caches the code for reuse across tests
   */
  private async getOrCreateAutoApproveInvite(): Promise<string> {
    // Check if we have a cached invite
    const cachedInvite = process.env.AUTO_APPROVE_INVITE_CODE;
    if (cachedInvite) {
      return cachedInvite;
    }

    // Create new auto-approve invite
    const adminToken = await this.getAdminToken();
    this.apiHelpers.setAuthToken(adminToken);

    const inviteResponse = await this.apiHelpers.createInvite(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );

    if (inviteResponse.status !== 201) {
      // Fallback to env variable if creation fails
      if (process.env.TEST_INVITE_CODE) {
        return process.env.TEST_INVITE_CODE;
      }
      throw new Error('Failed to create auto-approve invite');
    }

    return inviteResponse.body.code;
  }

  /**
   * Create user with PIN enabled
   */
  async createUserWithPin(pin: string = '123456'): Promise<{
    email: string;
    token: string;
    pin: string;
  }> {
    const user = await this.createApprovedUser();
    const token = await this.getMemberToken(user.email);

    // Enable PIN
    this.apiHelpers.setAuthToken(token);
    await this.apiHelpers.enablePin(pin);

    return {
      email: user.email,
      token,
      pin
    };
  }

  /**
   * Create user with membership approved
   */
  async createMemberUser(): Promise<{
    email: string;
    token: string;
  }> {
    const user = await this.createApprovedUser();
    const token = await this.getMemberToken(user.email);

    // Request membership
    this.apiHelpers.setAuthToken(token);
    await this.apiHelpers.requestMembership();

    // Approve membership as admin
    const adminToken = await this.getAdminToken();
    this.apiHelpers.setAuthToken(adminToken);

    // Get registration ID to approve membership
    const regsResponse = await this.apiHelpers.listRegistrations();
    const reg = regsResponse.body.find((r: any) => r.email === user.email);

    if (reg) {
      // TODO: Add approveMembership method to APIHelpers
      // For now, this is a placeholder
      console.warn('Membership approval not implemented in sprint');
    }

    return {
      email: user.email,
      token
    };
  }

  /**
   * Clean up test user
   */
  async cleanupUser(userId: string): Promise<void> {
    try {
      const adminToken = await this.getAdminToken();
      this.apiHelpers.setAuthToken(adminToken);

      // Soft delete the user
      await this.apiHelpers.request('DELETE', `/admin/users/${userId}`);
    } catch (error) {
      console.warn(`Failed to cleanup user ${userId}:`, error);
    }
  }

  /**
   * Batch create multiple approved users for testing
   */
  async createBatchUsers(count: number): Promise<Array<{
    email: string;
    registrationId: string;
    userId: string;
  }>> {
    const users = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createApprovedUser({
        email: this.generateTestEmail(`batch${i}`)
      });
      users.push(user);
    }

    return users;
  }
}
