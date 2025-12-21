import { APIRequestContext, expect } from '@playwright/test';
import { APIHelpers } from './api-helpers';
import { QuickAuth } from './quick-auth';

/**
 * Enhanced API client for testing
 * Extends APIHelpers with test-specific utilities
 */
export class APITestClient extends APIHelpers {
  private currentToken?: string;
  private startTime?: number;
  private quickAuth: QuickAuth;

  constructor(request: APIRequestContext) {
    super(request);
    this.quickAuth = new QuickAuth(request);
  }

  /**
   * Set authentication token for requests
   * Returns this for chaining
   */
  withAuth(token: string): this {
    this.currentToken = token;
    this.setAuthToken(token);
    return this;
  }

  /**
   * Clear authentication token
   * Returns this for chaining
   */
  withoutAuth(): this {
    this.currentToken = undefined;
    this.setAuthToken('');
    return this;
  }

  /**
   * Make authenticated request with admin token (async version)
   * Uses QuickAuth to get token from Cognito
   */
  async withAdminAuthAsync(): Promise<this> {
    const adminToken = await this.quickAuth.getAdminToken();
    return this.withAuth(adminToken);
  }

  /**
   * Make authenticated request with member token (async version)
   * Uses QuickAuth to get token via password auth or magic link
   */
  async withMemberAuthAsync(email?: string): Promise<this> {
    const memberToken = await this.quickAuth.getMemberToken(email);
    return this.withAuth(memberToken);
  }

  /**
   * Make authenticated request with admin token (sync - legacy)
   * Returns this for chaining
   * @deprecated Use withAdminAuthAsync() instead for dynamic token retrieval
   */
  withAdminAuth(): this {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      throw new Error('ADMIN_TOKEN environment variable required - use withAdminAuthAsync() for dynamic token');
    }
    return this.withAuth(adminToken);
  }

  /**
   * Get QuickAuth instance for direct access to auth helpers
   */
  getQuickAuth(): QuickAuth {
    return this.quickAuth;
  }

  /**
   * Approve a registration by ID (convenience method with auto-auth)
   */
  async approveRegistrationWithAuth(registrationId: string): Promise<{ status: number; body: any }> {
    await this.withAdminAuthAsync();
    return this.approveRegistration(registrationId);
  }

  /**
   * Create an approved user end-to-end (register + approve)
   */
  async createApprovedUser(options?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    inviteCode?: string;
  }): Promise<{
    email: string;
    registrationId: string;
    userId: string;
  }> {
    return this.quickAuth.createApprovedUser({
      email: options?.email,
      firstName: options?.firstName,
      lastName: options?.lastName,
    });
  }

  /**
   * Start timing a request
   */
  startTimer(): this {
    this.startTime = Date.now();
    return this;
  }

  /**
   * Get elapsed time since startTimer() was called
   */
  getElapsedTime(): number {
    if (!this.startTime) {
      throw new Error('Timer not started - call startTimer() first');
    }
    return Date.now() - this.startTime;
  }

  /**
   * Assert response is successful (2xx status)
   */
  async expectSuccess(response: any, expectedStatus?: number): Promise<void> {
    if (expectedStatus) {
      expect(response.status).toBe(expectedStatus);
    } else {
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    }
  }

  /**
   * Assert response is an error with specific status and optional message
   */
  async expectError(
    response: any,
    expectedStatus: number,
    messageContains?: string
  ): Promise<void> {
    expect(response.status).toBe(expectedStatus);

    if (messageContains) {
      // API uses 'message' field for errors, fall back to 'error' for compatibility
      const errorMessage = response.body?.message || response.body?.error || '';
      expect(errorMessage.toLowerCase()).toContain(messageContains.toLowerCase());
    }
  }

  /**
   * Get error message from response body (handles both 'message' and 'error' fields)
   */
  getErrorMessage(response: any): string {
    return response.body?.message || response.body?.error || '';
  }

  /**
   * Assert response status is one of the provided values
   */
  async expectStatusOneOf(response: any, statuses: number[]): Promise<void> {
    expect(statuses).toContain(response.status);
  }

  /**
   * Assert response time is under threshold
   */
  async expectFastResponse(thresholdMs: number = 1000): Promise<void> {
    const elapsed = this.getElapsedTime();
    expect(elapsed).toBeLessThan(thresholdMs);
  }

  /**
   * Make a generic HTTP request with method and path
   */
  async makeRequest(
    method: string,
    path: string,
    body?: any
  ): Promise<{ status: number; body: any; headers: Record<string, string> }> {
    const url = `${this.getApiUrl()}${path}`;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://admin.vettid.dev'
    };

    if (this.currentToken) {
      reqHeaders['Authorization'] = `Bearer ${this.currentToken}`;
    }

    try {
      const response = await this.getRequest().fetch(url, {
        method,
        headers: reqHeaders,
        data: body
      });

      const responseBody = await response.json().catch(() => ({}));

      return {
        status: response.status(),
        body: responseBody,
        headers: response.headers()
      };
    } catch (error) {
      return {
        status: 500,
        body: { error: String(error) },
        headers: {}
      };
    }
  }

  /**
   * Batch request helper - executes multiple requests in parallel
   */
  async batchRequest(
    requests: Array<{
      method: string;
      path: string;
      body?: any;
    }>
  ): Promise<Array<{ status: number; body: any }>> {
    const promises = requests.map(req =>
      this.makeRequest(req.method, req.path, req.body)
    );

    return Promise.all(promises);
  }

  /**
   * Get API URL from environment
   */
  private getApiUrl(): string {
    return this.baseURL;
  }

  /**
   * Get the underlying request context
   */
  private getRequest(): APIRequestContext {
    // Access the protected request property from parent
    return this.request;
  }

  // Additional admin endpoints for testing

  /**
   * Disable user (admin only)
   */
  async disableUser(userId: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', `/admin/users/${userId}/disable`);
  }

  /**
   * Enable user (admin only)
   */
  async enableUser(userId: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', `/admin/users/${userId}/enable`);
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('DELETE', `/admin/users/${userId}`);
  }

  /**
   * Permanently delete user (admin only)
   */
  async permanentlyDeleteUser(userId: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', `/admin/users/${userId}/permanently-delete`);
  }

  /**
   * Get user details (admin only)
   */
  async getUser(userId: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('GET', `/admin/users/${userId}`);
  }

  /**
   * Expire invite (admin only)
   */
  async expireInvite(code: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', `/admin/invites/${code}/expire`);
  }

  /**
   * Delete invite (admin only)
   */
  async deleteInvite(code: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('DELETE', `/admin/invites/${code}`);
  }

  /**
   * Get registration by ID (admin only)
   */
  async getRegistration(id: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('GET', `/admin/registrations/${id}`);
  }

  /**
   * Approve membership (admin only)
   */
  async approveMembership(id: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', `/admin/membership-requests/${id}/approve`);
  }

  /**
   * Deny membership (admin only)
   */
  async denyMembership(id: string, reason?: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', `/admin/membership-requests/${id}/deny`, {
      reason: reason || 'Test denial'
    });
  }

  /**
   * Update PIN (member only)
   */
  async updatePin(newPin: string, currentPin: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', '/account/security/pin/update', {
      pin: newPin,
      current_pin: currentPin
    });
  }

  /**
   * Get membership terms (member only)
   */
  async getMembershipTerms(): Promise<{ status: number; body: any }> {
    return this.makeRequest('GET', '/account/membership/terms');
  }

  /**
   * Create membership terms (admin only)
   */
  async createMembershipTerms(termsText: string): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', '/admin/membership-terms', {
      terms_text: termsText
    });
  }

  /**
   * List all membership requests (admin only)
   */
  async listMembershipRequests(params?: { membership_status?: string; limit?: number }): Promise<{ status: number; body: any }> {
    let path = '/admin/membership-requests';
    if (params) {
      const queryParams = new URLSearchParams();
      if (params.membership_status) queryParams.append('membership_status', params.membership_status);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (queryParams.toString()) path += `?${queryParams.toString()}`;
    }
    return this.makeRequest('GET', path);
  }

  /**
   * List all membership terms (admin only)
   */
  async listMembershipTerms(params?: { limit?: number }): Promise<{ status: number; body: any }> {
    let path = '/admin/membership-terms';
    if (params?.limit) path += `?limit=${params.limit}`;
    return this.makeRequest('GET', path);
  }

  /**
   * Get current membership terms (admin only)
   */
  async getCurrentMembershipTerms(): Promise<{ status: number; body: any }> {
    return this.makeRequest('GET', '/admin/membership-terms/current');
  }

  /**
   * Helper to create invite with custom options
   */
  async createInviteWithOptions(options: {
    code?: string;
    max_uses?: number;
    expires_at?: string;
    auto_approve?: boolean;
  }): Promise<{ status: number; body: any }> {
    return this.makeRequest('POST', '/admin/invites', options);
  }
}
