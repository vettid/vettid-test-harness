# Quick Start Guide - VettID Test Harness

Get up and running with VettID testing in 5 minutes.

## Prerequisites Check

```bash
# Check Node.js version (need v20+)
node --version

# Check if in correct directory
pwd
# Should show: /home/al/vettid-test-harness
```

## 1. Install Dependencies (1 min)

```bash
npm install
npx playwright install chromium
```

## 2. Configure Environment (2 min)

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your favorite editor and set:

```env
# Required
EMAIL_BUCKET_NAME=vettid-test-emails-449757308783
TEST_INVITE_CODE=YOUR_VALID_INVITE_CODE

# Already configured (verify these are correct)
BASE_URL=https://account.vettid.dev
API_URL=https://cgccjd4djg.execute-api.us-east-1.amazonaws.com
USER_POOL_ID=us-east-1_vfBJnI9Xu
CLIENT_ID=930kofi3qvr5gjreaumg9b8jf
AWS_REGION=us-east-1
TEST_EMAIL_DOMAIN=test.vettid.dev
```

## 3. Get a Valid Invite Code (30 sec)

You need a valid invite code to test registration. Options:

**Option A: Use existing code**
- If you have one, add it to `.env`

**Option B: Generate via admin panel**
- Go to https://account.vettid.dev/admin
- Login as admin
- Create new invite
- Copy code to `.env`

**Option C: Use API** (if you have admin access)
```bash
# This will be added later
```

## 4. Run Your First Test (1 min)

```bash
# Run registration tests
npm run test:registration
```

Expected output:
```
Running 6 tests using 1 worker
✓ should successfully register with valid invite code (15s)
✓ should reject registration with invalid email format (2s)
...
6 passed (25s)
```

## 5. View Test Report (30 sec)

```bash
npm run report
```

This opens an interactive HTML report in your browser showing:
- Test results
- Screenshots of failures
- Trace viewer for debugging

## What Just Happened?

1. ✅ Playwright launched Chromium browser
2. ✅ Test navigated to https://account.vettid.dev/register
3. ✅ Generated unique test email: `test-1234567890-abc@test.vettid.dev`
4. ✅ Filled registration form
5. ✅ Submitted form
6. ✅ Email sent to SES → stored in S3
7. ✅ Test retrieved email from S3
8. ✅ Verified email content
9. ✅ All assertions passed ✨

## Next Steps

### Run More Tests

```bash
# Authentication tests
npm run test:auth

# All tests
npm test

# With visible browser (headed mode)
npm run test:headed

# Interactive UI mode
npm run test:ui
```

### Write Your First Test

Create `tests/e2e/my-test.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('my first test', async ({ page }) => {
  await page.goto('https://account.vettid.dev');
  await expect(page).toHaveTitle(/VettID/);
});
```

Run it:
```bash
npx playwright test tests/e2e/my-test.spec.ts
```

### Use Test Utilities

```typescript
import { EmailRetriever } from '../utils/email-retriever';
import { AuthHelpers } from '../utils/auth-helpers';

test('test with email', async ({ page }) => {
  const emailRetriever = new EmailRetriever(process.env.EMAIL_BUCKET_NAME!);
  const authHelpers = new AuthHelpers(page, emailRetriever);

  // Generate unique test email
  const email = AuthHelpers.generateTestEmail('mytest');

  // Register user
  await authHelpers.register({
    firstName: 'Test',
    lastName: 'User',
    email: email,
    inviteCode: process.env.TEST_INVITE_CODE!,
  });

  // Wait for confirmation email
  const confirmEmail = await authHelpers.waitForRegistrationConfirmation(email);
  expect(confirmEmail).toBeTruthy();
});
```

## Common Issues

### ❌ "EMAIL_BUCKET_NAME is not set"
**Fix**: Add `EMAIL_BUCKET_NAME=vettid-test-emails-449757308783` to `.env`

### ❌ "Invalid or expired invite code"
**Fix**: Get a valid invite code and update `TEST_INVITE_CODE` in `.env`

### ❌ "No email received within 30000ms"
**Fix**:
1. Check SES rule set is active: `aws ses describe-active-receipt-rule-set --region us-east-1`
2. Verify MX records: `dig MX test.vettid.dev`
3. Check S3 bucket: `aws s3 ls s3://vettid-test-emails-449757308783/emails/`

### ❌ Tests timing out
**Fix**: Increase timeout in playwright.config.ts or specific test

### ❌ Browser not launching
**Fix**: Reinstall Playwright browsers
```bash
npx playwright install --with-deps chromium
```

## Pro Tips

### 1. Run Specific Test File

```bash
npx playwright test tests/e2e/registration/registration.spec.ts
```

### 2. Run Single Test Case

```bash
npx playwright test -g "should successfully register"
```

### 3. Debug Mode

```bash
npm run test:debug
```
Then click on the test to debug step-by-step.

### 4. Generate Tests

```bash
npm run codegen
```
This opens a browser where you can record interactions and Playwright generates test code!

### 5. Check Email in S3

```bash
aws s3 ls s3://vettid-test-emails-449757308783/emails/ --region us-east-1
```

## Project Structure Quick Reference

```
tests/
├── e2e/
│   ├── registration/registration.spec.ts  ← Registration tests
│   ├── auth/magic-link.spec.ts            ← Auth tests
│   ├── account/account-management.spec.ts ← Account tests
│   ├── membership/membership.spec.ts      ← Membership tests
│   └── full-journey.spec.ts               ← E2E journey
├── utils/
│   ├── email-retriever.ts                 ← Email utilities
│   ├── auth-helpers.ts                    ← Auth utilities
│   └── api-helpers.ts                     ← API utilities
└── fixtures/
    └── test-data.ts                       ← Test data
```

## Getting Help

- **README**: Comprehensive documentation
- **TEST_PLAN.md**: Full test coverage plan
- **Playwright Docs**: https://playwright.dev

## You're Ready! 🚀

Now you can:
- ✅ Run existing tests
- ✅ Write new tests
- ✅ Debug test failures
- ✅ Integrate with CI/CD

Happy testing!
