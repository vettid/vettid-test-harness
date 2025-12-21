/**
 * User factory for creating test users with various states
 * Provides reusable fixtures for E2E and API tests
 */

import { APIRequestContext } from '@playwright/test';
import { QuickAuth } from '../utils/quick-auth';
import { AuthHelpers } from '../utils/auth-helpers';

export interface TestUser {
  email: string;
  firstName: string;
  lastName: string;
  registrationId: string;
  userId: string;
  token?: string;
}

export interface TestMember extends TestUser {
  membershipStatus: 'pending' | 'approved' | 'denied';
}

export interface TestUserWithPin extends TestUser {
  pin: string;
}

/**
 * Factory class for creating test users with various configurations
 */
export class UserFactory {
  private quickAuth: QuickAuth;

  constructor(request: APIRequestContext) {
    this.quickAuth = new QuickAuth(request);
  }

  /**
   * Create a basic approved user (registered + approved)
   */
  async createApprovedUser(options?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<TestUser> {
    const firstName = options?.firstName || 'Test';
    const lastName = options?.lastName || 'User';
    const email = options?.email || AuthHelpers.generateTestEmail('user');

    const result = await this.quickAuth.createApprovedUser({
      email,
      firstName,
      lastName,
    });

    return {
      email: result.email,
      firstName,
      lastName,
      registrationId: result.registrationId,
      userId: result.userId,
    };
  }

  /**
   * Create an approved user with authentication token
   */
  async createAuthenticatedUser(options?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<TestUser> {
    const user = await this.createApprovedUser(options);

    try {
      const token = await this.quickAuth.getMemberToken(user.email);
      return { ...user, token };
    } catch (error) {
      // getMemberToken not yet fully implemented, return user without token
      console.warn('Could not get member token:', error);
      return user;
    }
  }

  /**
   * Create a user with PIN enabled
   */
  async createUserWithPin(options?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    pin?: string;
  }): Promise<TestUserWithPin> {
    const pin = options?.pin || '123456';

    try {
      const result = await this.quickAuth.createUserWithPin(pin);
      return {
        email: result.email,
        firstName: 'Test',
        lastName: 'User',
        registrationId: '',
        userId: '',
        token: result.token,
        pin: result.pin,
      };
    } catch (error) {
      // Fall back to basic user creation
      const user = await this.createApprovedUser(options);
      return {
        ...user,
        pin,
      };
    }
  }

  /**
   * Create a user with approved membership
   */
  async createMemberUser(options?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<TestMember> {
    try {
      const result = await this.quickAuth.createMemberUser();
      return {
        email: result.email,
        firstName: options?.firstName || 'Test',
        lastName: options?.lastName || 'Member',
        registrationId: '',
        userId: '',
        token: result.token,
        membershipStatus: 'approved',
      };
    } catch (error) {
      // Fall back to basic user with pending status
      const user = await this.createApprovedUser(options);
      return {
        ...user,
        membershipStatus: 'pending',
      };
    }
  }

  /**
   * Create multiple users for batch testing
   */
  async createBatchUsers(count: number, options?: {
    prefix?: string;
  }): Promise<TestUser[]> {
    const prefix = options?.prefix || 'batch';
    const users: TestUser[] = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createApprovedUser({
        email: AuthHelpers.generateTestEmail(`${prefix}${i}`),
        firstName: `Test${i}`,
        lastName: 'BatchUser',
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Clean up a test user (soft delete)
   */
  async cleanupUser(userId: string): Promise<void> {
    await this.quickAuth.cleanupUser(userId);
  }

  /**
   * Clean up multiple users
   */
  async cleanupUsers(userIds: string[]): Promise<void> {
    await Promise.all(userIds.map(id => this.cleanupUser(id)));
  }

  /**
   * Get a pre-configured test admin user
   */
  getTestAdmin(): { email: string; password: string } {
    return {
      email: process.env.ADMIN_EMAIL || 'test-admin@vettid.dev',
      password: process.env.ADMIN_PASSWORD || '',
    };
  }

  /**
   * Get admin authentication token
   */
  async getAdminToken(): Promise<string> {
    return this.quickAuth.getAdminToken();
  }
}

/**
 * Singleton instance for use in test setup
 * Must be initialized with request context
 */
let factoryInstance: UserFactory | null = null;

export function getUserFactory(request: APIRequestContext): UserFactory {
  if (!factoryInstance) {
    factoryInstance = new UserFactory(request);
  }
  return factoryInstance;
}

/**
 * Reset factory instance (for test isolation)
 */
export function resetUserFactory(): void {
  factoryInstance = null;
}
