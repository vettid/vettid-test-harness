/**
 * Authentication helper utilities for VettID testing
 */

import { Page } from '@playwright/test';
import { EmailRetriever } from './email-retriever';

export interface TestUser {
  email: string;
  firstName: string;
  lastName: string;
  inviteCode?: string;
}

export class AuthHelpers {
  constructor(
    private page: Page,
    private emailRetriever: EmailRetriever
  ) {}

  /**
   * Generate a unique test email address
   */
  static generateTestEmail(prefix: string = 'test'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}@test.vettid.dev`;
  }

  /**
   * Register a new user
   */
  async register(user: TestUser): Promise<void> {
    await this.page.goto('/register');
    await this.page.fill('#first', user.firstName);
    await this.page.fill('#last', user.lastName);
    await this.page.fill('#email', user.email);
    await this.page.fill('#code', user.inviteCode || process.env.TEST_INVITE_CODE || '');

    await this.page.click('button[type="submit"]');

    // Wait for success message
    await this.page.waitForSelector('#msg:not(:empty)', { timeout: 10000 });
  }

  /**
   * Request magic link for sign-in
   */
  async requestMagicLink(email: string): Promise<void> {
    await this.page.goto('/signin');
    await this.page.fill('#emailInput', email);
    await this.page.click('#sendLinkBtn');

    // Wait for success message
    await this.page.waitForSelector('#loginStatus.success', { timeout: 10000 });
  }

  /**
   * Get magic link from email
   */
  async getMagicLinkFromEmail(email: string, timeoutMs: number = 30000): Promise<string> {
    // Wait for email to arrive
    const loginEmail = await this.emailRetriever.waitForEmail(
      (emailMsg) => {
        return emailMsg.to.some(addr => addr.includes(email)) &&
               emailMsg.subject.toLowerCase().includes('login');
      },
      timeoutMs
    );

    if (!loginEmail) {
      throw new Error(`No login email received for ${email} within ${timeoutMs}ms`);
    }

    // Extract magic link
    const magicLink = this.emailRetriever.extractMagicLink(loginEmail);
    if (!magicLink) {
      throw new Error('Could not extract magic link from email');
    }

    return magicLink;
  }

  /**
   * Sign in using magic link
   */
  async signInWithMagicLink(email: string, pin?: string): Promise<void> {
    // Request magic link
    await this.requestMagicLink(email);

    // Get link from email
    const magicLink = await this.getMagicLinkFromEmail(email);

    // Click the magic link
    await this.page.goto(magicLink);

    // If PIN is required, enter it
    if (pin) {
      await this.page.waitForSelector('#pinPrompt.show', { timeout: 5000 });
      await this.page.fill('#pinInput', pin);
      await this.page.click('#submitPinBtn');
    }

    // Wait for redirect to account page
    await this.page.waitForURL(/.*\/account/, { timeout: 15000 });
  }

  /**
   * Complete full registration and login flow
   */
  async registerAndLogin(user: TestUser): Promise<void> {
    // Register user
    await this.register(user);

    // Note: After registration, admin must approve before user can sign in
    // This method assumes approval happens externally
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await this.page.goto('/signout');
    await this.page.waitForURL(/.*\/signin/, { timeout: 10000 });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    // Check for tokens in localStorage
    const tokens = await this.page.evaluate(() => {
      return localStorage.getItem('tokens');
    });
    return tokens !== null;
  }

  /**
   * Get current user info from localStorage
   */
  async getCurrentUser(): Promise<any> {
    const tokens = await this.page.evaluate(() => {
      const tokensStr = localStorage.getItem('tokens');
      if (!tokensStr) return null;

      try {
        const tokens = JSON.parse(tokensStr);
        // Decode JWT to get user info
        const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));
        return {
          email: payload.email,
          sub: payload.sub,
          groups: payload['cognito:groups'] || [],
        };
      } catch {
        return null;
      }
    });
    return tokens;
  }

  /**
   * Wait for email confirmation after registration
   */
  async waitForRegistrationConfirmation(email: string, timeoutMs: number = 30000): Promise<any> {
    const confirmEmail = await this.emailRetriever.waitForEmail(
      (emailMsg) => {
        return emailMsg.to.some(addr => addr.includes(email)) &&
               (emailMsg.subject.toLowerCase().includes('registration') ||
                emailMsg.subject.toLowerCase().includes('confirm'));
      },
      timeoutMs
    );

    if (!confirmEmail) {
      throw new Error(`No registration confirmation email received for ${email}`);
    }

    return confirmEmail;
  }
}

/**
 * Create auth helpers for a page
 */
export function createAuthHelpers(page: Page, emailRetriever: EmailRetriever): AuthHelpers {
  return new AuthHelpers(page, emailRetriever);
}
