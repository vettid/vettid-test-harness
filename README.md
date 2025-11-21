# VettID Test Harness

Comprehensive automated testing suite for the VettID application using Playwright and AWS SES email testing infrastructure.

## Overview

This test harness provides end-to-end testing for the VettID platform, including:

- **User Registration** - Invite-based registration flow with email verification
- **Magic Link Authentication** - Passwordless authentication with optional PIN
- **Account Management** - Profile, PIN management, account cancellation
- **Membership System** - Terms acceptance, membership requests, status tracking
- **Email Verification** - Automated email retrieval from AWS SES/S3

## Architecture

```
vettid-test-harness/
├── tests/
│   ├── e2e/                    # End-to-end test suites
│   │   ├── registration/       # Registration flow tests
│   │   ├── auth/               # Authentication tests
│   │   ├── account/            # Account management tests
│   │   ├── membership/         # Membership system tests
│   │   └── full-journey.spec.ts # Complete user lifecycle
│   ├── utils/                  # Test utilities
│   │   ├── email-retriever.ts  # AWS SES/S3 email retrieval
│   │   ├── auth-helpers.ts     # Authentication helpers
│   │   └── api-helpers.ts      # API testing utilities
│   └── fixtures/               # Test data and constants
│       └── test-data.ts
├── playwright.config.ts        # Playwright configuration
├── tsconfig.json              # TypeScript configuration
└── .env                       # Environment configuration
```

## Prerequisites

- Node.js v20+
- Playwright browsers installed
- AWS credentials (for email testing)
- Access to VettID test environment

## Setup

### 1. Install Dependencies

```bash
cd /home/al/vettid-test-harness
npm install
npx playwright install chromium
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Application URLs
BASE_URL=https://account.vettid.dev
API_URL=https://cgccjd4djg.execute-api.us-east-1.amazonaws.com

# AWS Cognito
USER_POOL_ID=us-east-1_vfBJnI9Xu
CLIENT_ID=930kofi3qvr5gjreaumg9b8jf
AWS_REGION=us-east-1

# Email Testing
EMAIL_BUCKET_NAME=vettid-test-emails-449757308783
TEST_EMAIL_DOMAIN=test.vettid.dev

# Test Data
TEST_INVITE_CODE=YOUR_VALID_INVITE_CODE_HERE
```

### 3. Verify Email Testing Infrastructure

Ensure the email testing infrastructure is deployed:

```bash
cd /home/al/vettid-test-infra
npm run deploy
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Registration tests
npm run test:registration

# Authentication tests
npm run test:auth

# Account management tests
npm run test:account

# Membership tests
npm run test:membership

# Full user journey
npm run test:journey
```

### Run with UI Mode (Interactive)

```bash
npm run test:ui
```

### Run in Headed Mode (See Browser)

```bash
npm run test:headed
```

### Debug Tests

```bash
npm run test:debug
```

### View Test Report

```bash
npm run report
```

## Test Coverage

### 1. Registration Tests (`tests/e2e/registration/`)

- ✅ Valid registration with invite code
- ✅ Invalid email format rejection
- ✅ Invalid invite code rejection
- ✅ Missing required fields validation
- ✅ Duplicate email prevention
- ✅ Email confirmation delivery

### 2. Authentication Tests (`tests/e2e/auth/`)

- ✅ Magic link email sending
- ✅ Magic link authentication (no PIN)
- ⏭️ Magic link with PIN authentication
- ⏭️ Invalid PIN rejection
- ⏭️ Expired magic link handling
- ✅ Magic link extraction from email
- ✅ Sign out functionality

### 3. Account Management Tests (`tests/e2e/account/`)

- ⏭️ Profile information display
- ⏭️ Tab navigation
- ⏭️ PIN enable/disable
- ⏭️ PIN mismatch validation
- ⏭️ Account cancellation

### 4. Membership Tests (`tests/e2e/membership/`)

- ⏭️ Membership status display
- ⏭️ Terms download
- ⏭️ Terms acceptance requirement
- ⏭️ Membership request
- ⏭️ Member benefits display

### 5. Full Journey Tests (`tests/e2e/full-journey.spec.ts`)

- ⏭️ Complete user lifecycle (registration → approval → login → membership)
- ✅ Error recovery scenarios

**Legend**: ✅ Implemented | ⏭️ Requires authentication setup

## Email Testing Flow

The test harness integrates with AWS SES email receiving:

1. **Test emails** sent to `*@test.vettid.dev` are captured by SES
2. **Emails stored** in S3 bucket (`vettid-test-emails-449757308783`)
3. **EmailRetriever** utility fetches and parses emails
4. **Magic links** are automatically extracted and used in tests

Example:

```typescript
// Generate unique test email
const testEmail = AuthHelpers.generateTestEmail('reg');

// Register user (triggers email)
await authHelpers.register({ email: testEmail, ... });

// Wait for and retrieve email
const email = await emailRetriever.waitForEmail(testEmail, 30000);

// Extract magic link from email
const magicLink = emailRetriever.extractMagicLink(email);

// Use magic link to authenticate
await page.goto(magicLink);
```

## Test Utilities

### AuthHelpers

```typescript
const authHelpers = new AuthHelpers(page, emailRetriever);

// Register new user
await authHelpers.register(userData);

// Request magic link
await authHelpers.requestMagicLink(email);

// Get magic link from email
const link = await authHelpers.getMagicLinkFromEmail(email);

// Sign in with magic link (with optional PIN)
await authHelpers.signInWithMagicLink(email, pin);

// Sign out
await authHelpers.signOut();

// Check authentication status
const isAuth = await authHelpers.isAuthenticated();
```

### EmailRetriever

```typescript
const emailRetriever = new EmailRetriever(bucketName);

// List all emails
const emails = await emailRetriever.listEmails();

// Get most recent
const recent = await emailRetriever.getMostRecentEmail();

// Find by recipient
const userEmails = await emailRetriever.findEmailsByRecipient('user@test.vettid.dev');

// Wait for email (with timeout)
const email = await emailRetriever.waitForEmail(
  email => email.subject.includes('Login'),
  30000
);

// Extract magic link
const magicLink = emailRetriever.extractMagicLink(email);
```

### APIHelpers

```typescript
const apiHelpers = new APIHelpers(request);
apiHelpers.setAuthToken(token);

// Submit registration
await apiHelpers.submitRegistration(data);

// Admin operations
await apiHelpers.approveRegistration(id);
await apiHelpers.createInvite(expirationDate);
await apiHelpers.listRegistrations();

// Member operations
await apiHelpers.requestMembership();
await apiHelpers.enablePin(pin);
await apiHelpers.getMembershipStatus();
```

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { EmailRetriever } from '../../utils/email-retriever';
import { AuthHelpers } from '../../utils/auth-helpers';

let emailRetriever: EmailRetriever;
let authHelpers: AuthHelpers;

test.beforeAll(() => {
  emailRetriever = new EmailRetriever(process.env.EMAIL_BUCKET_NAME!);
});

test.beforeEach(async ({ page }) => {
  authHelpers = new AuthHelpers(page, emailRetriever);
});

test('my test case', async ({ page }) => {
  // Test implementation
});
```

### Best Practices

1. **Use unique test emails**: Always generate unique emails to avoid conflicts
2. **Clean up after tests**: Clear test emails when done
3. **Use test.skip() for pending tests**: Mark tests requiring setup
4. **Add timeouts**: Email delivery can take time, use appropriate timeouts
5. **Assert meaningfully**: Check both UI state and backend state

## Continuous Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run tests
        run: npm test
        env:
          BASE_URL: ${{ secrets.BASE_URL }}
          EMAIL_BUCKET_NAME: ${{ secrets.EMAIL_BUCKET_NAME }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Tests Failing to Find Emails

1. Check EMAIL_BUCKET_NAME is correct
2. Verify AWS credentials are set
3. Check SES rule set is active: `aws ses describe-active-receipt-rule-set --region us-east-1`
4. Verify MX records: `dig MX test.vettid.dev`

### Authentication Tests Failing

1. Ensure USER_POOL_ID and CLIENT_ID are correct
2. Check if user exists and is approved
3. Verify magic links are being generated

### Timeouts

1. Increase timeout for email delivery (default 30s)
2. Check network connectivity to AWS
3. Verify S3 bucket permissions

## Test Data Management

Test data is isolated using:
- Unique timestamps in email addresses
- `@test.vettid.dev` domain (separate from production)
- Auto-cleanup of emails after 30 days (S3 lifecycle policy)

## Security Notes

- ⚠️ **Never commit `.env` file** - contains sensitive credentials
- Use `@test.vettid.dev` emails only - never production emails
- Test invite codes should be separate from production codes
- Rotate AWS credentials regularly

## Maintenance

### Update Playwright

```bash
npm update @playwright/test
npx playwright install chromium
```

### Clear Test Data

```bash
# Clear all test emails from S3
aws s3 rm s3://vettid-test-emails-449757308783/emails/ --recursive
```

### Generate New Test Code

```bash
# Use Playwright codegen to record interactions
npm run codegen https://account.vettid.dev
```

## Contributing

When adding new tests:

1. Follow existing test structure
2. Add tests to appropriate directory
3. Update this README with new test coverage
4. Ensure tests are idempotent and don't depend on test order

## Support

- **Project Location**: `/home/al/vettid-test-harness/`
- **Email Infrastructure**: `/home/al/vettid-test-infra/`
- **Application Code**: `/home/al/vettid-dev/`

## License

MIT
