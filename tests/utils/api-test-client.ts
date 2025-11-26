import { APIRequestContext, expect } from '@playwright/test';
import { APIHelpers } from './api-helpers';

/**
 * Enhanced API client for testing
 * Extends APIHelpers with test-specific utilities
 */
export class APITestClient extends APIHelpers {
  private currentToken?: string;
  private startTime?: number;

  constructor(request: APIRequestContext) {
    super(request);
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
   * Make authenticated request with admin token
   * Returns this for chaining
   */
  withAdminAuth(): this {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
      throw new Error('ADMIN_TOKEN environment variable required');
    }
    return this.withAuth(adminToken);
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
      const errorMessage = response.body?.error || response.body?.message || '';
      expect(errorMessage.toLowerCase()).toContain(messageContains.toLowerCase());
    }
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
  async request(
    method: string,
    path: string,
    body?: any
  ): Promise<{ status: number; body: any }> {
    const url = `${this.getApiUrl()}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.currentToken) {
      headers['Authorization'] = `Bearer ${this.currentToken}`;
    }

    try {
      const response = await this.getRequest().fetch(url, {
        method,
        headers,
        data: body
      });

      const responseBody = await response.json().catch(() => ({}));

      return {
        status: response.status(),
        body: responseBody
      };
    } catch (error) {
      return {
        status: 500,
        body: { error: String(error) }
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
      this.request(req.method, req.path, req.body)
    );

    return Promise.all(promises);
  }

  /**
   * Get API URL from environment
   */
  private getApiUrl(): string {
    return process.env.API_URL || 'https://cgccjd4djg.execute-api.us-east-1.amazonaws.com';
  }

  /**
   * Get the underlying request context
   */
  private getRequest(): APIRequestContext {
    // Access the protected request property from parent
    return (this as any).request;
  }

  // Additional admin endpoints for testing

  /**
   * Disable user (admin only)
   */
  async disableUser(userId: string): Promise<{ status: number; body: any }> {
    return this.request('POST', `/admin/users/${userId}/disable`);
  }

  /**
   * Enable user (admin only)
   */
  async enableUser(userId: string): Promise<{ status: number; body: any }> {
    return this.request('POST', `/admin/users/${userId}/enable`);
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string): Promise<{ status: number; body: any }> {
    return this.request('DELETE', `/admin/users/${userId}`);
  }

  /**
   * Permanently delete user (admin only)
   */
  async permanentlyDeleteUser(userId: string): Promise<{ status: number; body: any }> {
    return this.request('POST', `/admin/users/${userId}/permanently-delete`);
  }

  /**
   * Get user details (admin only)
   */
  async getUser(userId: string): Promise<{ status: number; body: any }> {
    return this.request('GET', `/admin/users/${userId}`);
  }

  /**
   * Expire invite (admin only)
   */
  async expireInvite(code: string): Promise<{ status: number; body: any }> {
    return this.request('POST', `/admin/invites/${code}/expire`);
  }

  /**
   * Delete invite (admin only)
   */
  async deleteInvite(code: string): Promise<{ status: number; body: any }> {
    return this.request('DELETE', `/admin/invites/${code}`);
  }

  /**
   * Get registration by ID (admin only)
   */
  async getRegistration(id: string): Promise<{ status: number; body: any }> {
    return this.request('GET', `/admin/registrations/${id}`);
  }

  /**
   * Approve membership (admin only)
   */
  async approveMembership(id: string): Promise<{ status: number; body: any }> {
    return this.request('POST', `/admin/memberships/${id}/approve`);
  }

  /**
   * Deny membership (admin only)
   */
  async denyMembership(id: string, reason?: string): Promise<{ status: number; body: any }> {
    return this.request('POST', `/admin/memberships/${id}/deny`, {
      reason: reason || 'Test denial'
    });
  }

  /**
   * Update PIN (member only)
   */
  async updatePin(newPin: string, currentPin: string): Promise<{ status: number; body: any }> {
    return this.request('POST', '/account/pin/update', {
      pin: newPin,
      current_pin: currentPin
    });
  }

  /**
   * Get membership terms (member only)
   */
  async getMembershipTerms(): Promise<{ status: number; body: any }> {
    return this.request('GET', '/account/membership/terms');
  }

  /**
   * Create membership terms (admin only)
   */
  async createMembershipTerms(termsText: string): Promise<{ status: number; body: any }> {
    return this.request('POST', '/admin/memberships/terms', {
      terms_text: termsText
    });
  }

  /**
   * List all membership requests (admin only)
   */
  async listMembershipRequests(): Promise<{ status: number; body: any }> {
    return this.request('GET', '/admin/memberships');
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
    return this.request('POST', '/admin/invites', options);
  }
}
