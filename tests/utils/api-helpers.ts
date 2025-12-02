/**
 * API helper utilities for VettID testing
 */

import { APIRequestContext } from '@playwright/test';

export class APIHelpers {
  protected baseURL: string;
  private authToken?: string;

  constructor(protected request: APIRequestContext) {
    this.baseURL = process.env.API_URL || 'https://cgccjd4djg.execute-api.us-east-1.amazonaws.com';
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get headers with optional auth
   */
  private getHeaders(includeAuth: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://admin.vettid.dev',
    };

    if (includeAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Submit registration
   */
  async submitRegistration(data: {
    first_name: string;
    last_name: string;
    email: string;
    invite_code: string;
  }): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/register`, {
      headers: this.getHeaders(),
      data,
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Admin: List registrations
   */
  async listRegistrations(): Promise<any> {
    const response = await this.request.get(`${this.baseURL}/admin/registrations`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Admin: Approve registration
   */
  async approveRegistration(registrationId: string): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/admin/registrations/${registrationId}/approve`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Admin: Reject registration
   */
  async rejectRegistration(registrationId: string): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/admin/registrations/${registrationId}/reject`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Admin: Create invite
   */
  async createInvite(expirationDate: string): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/admin/invites`, {
      headers: this.getHeaders(true),
      data: { expiration_date: expirationDate },
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Admin: List invites
   */
  async listInvites(): Promise<any> {
    const response = await this.request.get(`${this.baseURL}/admin/invites`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Member: Get membership status
   */
  async getMembershipStatus(): Promise<any> {
    const response = await this.request.get(`${this.baseURL}/account/membership/status`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Member: Request membership
   */
  async requestMembership(): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/account/membership/request`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Member: Get PIN status
   */
  async getPinStatus(): Promise<any> {
    const response = await this.request.get(`${this.baseURL}/account/security/pin/status`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Member: Enable PIN
   */
  async enablePin(pin: string): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/account/security/pin/enable`, {
      headers: this.getHeaders(true),
      data: { pin },
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Member: Disable PIN
   */
  async disablePin(): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/account/security/pin/disable`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Member: Cancel account
   */
  async cancelAccount(): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/account/cancel`, {
      headers: this.getHeaders(true),
    });

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }

  /**
   * Generic request method for any HTTP method and path
   */
  async makeRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseURL}${path}`;
    let response;

    switch (method.toUpperCase()) {
      case 'GET':
        response = await this.request.get(url, { headers: this.getHeaders(true) });
        break;
      case 'POST':
        response = await this.request.post(url, {
          headers: this.getHeaders(true),
          data: body,
        });
        break;
      case 'PUT':
        response = await this.request.put(url, {
          headers: this.getHeaders(true),
          data: body,
        });
        break;
      case 'PATCH':
        response = await this.request.patch(url, {
          headers: this.getHeaders(true),
          data: body,
        });
        break;
      case 'DELETE':
        response = await this.request.delete(url, { headers: this.getHeaders(true) });
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    return {
      status: response.status(),
      body: await response.json().catch(() => ({})),
    };
  }
}
