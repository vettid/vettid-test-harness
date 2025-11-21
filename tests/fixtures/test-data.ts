/**
 * Test data fixtures
 */

export const TEST_USERS = {
  valid: {
    firstName: 'John',
    lastName: 'Doe',
    email: '', // Will be generated dynamically
  },
  invalidEmail: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'invalid-email',
  },
  admin: {
    firstName: 'Admin',
    lastName: 'User',
    email: process.env.ADMIN_EMAIL || 'admin@test.vettid.dev',
  },
};

export const TEST_PINS = {
  valid: '123456',
  invalid: '000000',
  weak: '111111',
};

export const INVITE_CODES = {
  valid: process.env.TEST_INVITE_CODE || '',
  invalid: 'INVALID_CODE_123',
  expired: 'EXPIRED_CODE_456',
};

export const MEMBERSHIP_TERMS = {
  sampleText: `
# VettID Membership Terms of Service

## 1. Acceptance of Terms
By requesting membership to VettID, you agree to be bound by these Terms of Service.

## 2. Membership Benefits
- Access to member-only features
- Voting rights on organizational decisions
- Priority support

## 3. Member Responsibilities
- Maintain accurate account information
- Respect community guidelines
- Pay applicable fees on time

## 4. Termination
Membership may be terminated by either party with notice.
  `.trim(),
};

export const ERROR_MESSAGES = {
  invalidEmail: 'Invalid email address format',
  invalidInvite: 'Invalid or expired invite code',
  duplicateEmail: 'This email address is already registered',
  unauthorized: 'Unauthorized',
  notFound: 'Not found',
  serverError: 'Internal server error',
};

export const TIMEOUTS = {
  emailDelivery: 30000, // 30 seconds
  pageLoad: 15000,
  apiRequest: 10000,
  shortWait: 3000,
};

/**
 * Generate a future date for invite expiration
 */
export function generateFutureDate(daysFromNow: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

/**
 * Generate a past date for expired invites
 */
export function generatePastDate(daysAgo: number = 1): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}
