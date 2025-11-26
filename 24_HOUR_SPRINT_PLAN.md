# VettID 24-Hour Testing Sprint Plan
**Date**: 2025-11-26
**Goal**: Maximize test coverage in 24 hours
**Strategy**: Focus on high-value, low-setup tests

## Sprint Objectives

**Target**: 45+ new tests (from 10 → 55+ passing tests)
**Coverage Goal**: 40% → 70% feature coverage
**Focus**: API tests, security tests, quick wins

## Hour-by-Hour Breakdown

### 🏁 Hour 0-2: Rapid Setup (2 hours)
**Goal**: Create minimal infrastructure for testing

#### Task 1.1: Quick Auth Helper (45 min)
**File**: `tests/utils/quick-auth.ts`

```typescript
/**
 * Minimal auth helper - no full fixture, just what we need
 */
export class QuickAuth {
  // Get admin token from environment or cache
  async getAdminToken(): Promise<string>

  // Register + approve user in one call (API only)
  async createApprovedUser(email: string): Promise<UserInfo>

  // Get member token for API testing
  async getMemberToken(email: string): Promise<string>
}
```

**Implementation**:
- Use environment variables for admin credentials
- Direct Cognito API calls (no UI)
- Cache tokens for reuse
- 5-minute user creation flow

#### Task 1.2: API Test Framework (45 min)
**File**: `tests/api/api-client.ts`

```typescript
export class APITestClient {
  // Extend existing APIHelpers
  // Add: batch operations, error assertions, timing

  async withAuth(token: string): this
  async expectSuccess(status: number): void
  async expectError(status: number, message?: string): void
  async measureTime(): Promise<number>
}
```

#### Task 1.3: Test Data Generator (30 min)
**File**: `tests/utils/test-data-generator.ts`

```typescript
export class TestDataGenerator {
  generateEmail(): string           // unique test emails
  generateInviteCode(): string      // valid format
  generateUser(): UserData          // complete user object
  generateMaliciousInput(): string  // for security tests
}
```

**Deliverable**: Foundation for 45 tests

---

### ⚡ Hour 2-6: API Tests Marathon (4 hours)
**Goal**: 15 API tests - no UI, pure speed

#### Test Suite 1: Registration API (30 min - 5 tests)
**File**: `tests/api/registration.api.spec.ts`

```typescript
test('POST /register - valid registration', async () => {
  // Direct API call, verify response
  // Time: 100ms per test
});

test('POST /register - invalid invite code', async () => {
  // Test error handling
});

test('POST /register - duplicate email', async () => {
  // Test duplicate prevention
});

test('POST /register - missing required fields', async () => {
  // Test validation
});

test('POST /register - auto-approve flow', async () => {
  // Test instant approval
});
```

#### Test Suite 2: Admin Registration Endpoints (45 min - 4 tests)
**File**: `tests/api/admin-registrations.api.spec.ts`

```typescript
test('GET /admin/registrations - list all', async () => {
  // Create 5 registrations, verify list
});

test('GET /admin/registrations?status=pending - filter', async () => {
  // Test filtering
});

test('POST /admin/registrations/:id/approve', async () => {
  // Test approval API
});

test('POST /admin/registrations/:id/reject', async () => {
  // Test rejection with reason
});
```

#### Test Suite 3: Admin Invite Endpoints (45 min - 3 tests)
**File**: `tests/api/admin-invites.api.spec.ts`

```typescript
test('POST /admin/invites - create with auto-approve', async () => {
  // Test invite creation
});

test('POST /admin/invites/:code/expire', async () => {
  // Test manual expiry
});

test('DELETE /admin/invites/:code', async () => {
  // Test deletion
});
```

#### Test Suite 4: Member Endpoints (45 min - 3 tests)
**File**: `tests/api/member.api.spec.ts`

```typescript
test('GET /account/membership/status', async () => {
  // Test membership status retrieval
});

test('POST /account/membership/request', async () => {
  // Test membership request
});

test('POST /account/cancel', async () => {
  // Test account cancellation
});
```

**Break**: 15 min

**Deliverable**: 15 API tests, ~2 minute execution time

---

### 🔒 Hour 6-10: Security Tests Blitz (4 hours)
**Goal**: 12 security tests - critical vulnerabilities

#### Test Suite 5: Input Validation (1 hour - 4 tests)
**File**: `tests/api/security/input-validation.spec.ts`

```typescript
test('SQL injection prevention - registration', async () => {
  const response = await api.submitRegistration({
    email: "test'; DROP TABLE registrations; --@test.com"
  });
  expect(response.status).toBe(400); // Validation error

  // Verify table still exists
  const regs = await api.listRegistrations();
  expect(regs.status).toBe(200);
});

test('XSS prevention - name fields', async () => {
  await api.submitRegistration({
    first_name: "<script>alert('xss')</script>"
  });

  // Verify script tag escaped in response
  const reg = await api.getRegistration(id);
  expect(reg.body.first_name).not.toContain('<script');
});

test('Command injection - invite code', async () => {
  const response = await api.submitRegistration({
    invite_code: "'; cat /etc/passwd; '"
  });
  expect(response.status).toBe(400);
});

test('Path traversal prevention', async () => {
  const response = await api.request('GET', '/admin/../../../etc/passwd');
  expect(response.status).toBeOneOf([403, 404]);
});
```

#### Test Suite 6: Unauthorized Access (1.5 hours - 5 tests)
**File**: `tests/api/security/unauthorized-access.spec.ts`

```typescript
test('Unauthenticated user cannot access member endpoints', async () => {
  // Test all 6 member endpoints without token
  const endpoints = [
    'GET /account/membership/status',
    'POST /account/membership/request',
    'GET /account/pin/status',
    'POST /account/pin/enable',
    'POST /account/cancel'
  ];

  for (const endpoint of endpoints) {
    const response = await api.withoutAuth().request(endpoint);
    expect(response.status).toBe(401);
  }
});

test('Member cannot access admin endpoints', async () => {
  const memberToken = await quickAuth.getMemberToken();

  const endpoints = [
    'GET /admin/registrations',
    'POST /admin/invites',
    'DELETE /admin/users/:id'
  ];

  for (const endpoint of endpoints) {
    const response = await api.withAuth(memberToken).request(endpoint);
    expect(response.status).toBe(403);
  }
});

test('Disabled user cannot authenticate', async () => {
  const user = await quickAuth.createApprovedUser();
  await api.withAdminAuth().disableUser(user.id);

  // Attempt authentication
  const authResponse = await attemptAuth(user.email);
  expect(authResponse.success).toBe(false);
});

test('Deleted user cannot authenticate', async () => {
  const user = await quickAuth.createApprovedUser();
  await api.withAdminAuth().deleteUser(user.id);

  const authResponse = await attemptAuth(user.email);
  expect(authResponse.success).toBe(false);
});

test('Token manipulation rejection', async () => {
  const validToken = await quickAuth.getMemberToken();

  // Decode and modify token
  const [header, payload, signature] = validToken.split('.');
  const decodedPayload = JSON.parse(atob(payload));
  decodedPayload['cognito:groups'] = ['admin']; // Try to escalate
  const modifiedPayload = btoa(JSON.stringify(decodedPayload));
  const modifiedToken = `${header}.${modifiedPayload}.${signature}`;

  // Attempt admin operation
  const response = await api.withAuth(modifiedToken).request('GET', '/admin/registrations');
  expect(response.status).toBe(401); // Invalid signature
});
```

#### Test Suite 7: Rate Limiting (1 hour - 3 tests)
**File**: `tests/api/security/rate-limiting.spec.ts`

```typescript
test('Magic link rate limiting - exceeds limit', async () => {
  const email = 'rate-test@test.vettid.dev';
  await quickAuth.createApprovedUser(email);

  // Send 101 magic link requests
  const results = [];
  for (let i = 0; i < 101; i++) {
    const response = await requestMagicLink(email);
    results.push(response);
  }

  // Verify rate limit kicked in
  const rateLimited = results.filter(r => r.status === 429);
  expect(rateLimited.length).toBeGreaterThan(0);
});

test('Token reuse prevention', async () => {
  const { token, email } = await generateMagicLink();

  // Use token once
  const firstUse = await verifyMagicLink(token, email);
  expect(firstUse.success).toBe(true);

  // Attempt reuse
  const secondUse = await verifyMagicLink(token, email);
  expect(secondUse.success).toBe(false);
  expect(secondUse.error).toContain('already used');
});

test('Token expiration after 15 minutes', async () => {
  const { token, email } = await generateMagicLink();

  // Manipulate DynamoDB to set expiresAt to past
  await setTokenExpired(token);

  // Attempt verification
  const response = await verifyMagicLink(token, email);
  expect(response.success).toBe(false);
  expect(response.error).toContain('expired');
});
```

**Break**: 30 min

**Deliverable**: 12 security tests

---

### 🎯 Hour 10-14: Enable Skipped Tests (4 hours)
**Goal**: Enable 8 existing tests with minimal fixtures

#### Strategy: Create Lightweight Session Manager

**File**: `tests/utils/session-manager.ts`

```typescript
export class SessionManager {
  private sessions = new Map<string, Session>();

  // Create session once, reuse for multiple tests
  async getOrCreateSession(type: 'basic' | 'member' | 'withPin'): Promise<Session> {
    if (this.sessions.has(type)) {
      return this.sessions.get(type)!;
    }

    const session = await this.createSession(type);
    this.sessions.set(type, session);
    return session;
  }

  private async createSession(type: string): Promise<Session> {
    // Create user, approve, authenticate
    // Store tokens, cookies, user info
    // Return ready-to-use session
  }
}
```

#### Tests to Enable (8 tests - 30 min each)

1. **auth/magic-link.spec.ts:132** - "Sign out functionality" (30 min)
   ```typescript
   test('successfully sign out', async ({ page }) => {
     const session = await sessionManager.getOrCreateSession('basic');
     await injectSession(page, session);

     await page.goto('/signout');
     expect(await authHelpers.isAuthenticated()).toBe(false);
   });
   ```

2. **membership.spec.ts:19** - "Display membership status" (30 min)
   ```typescript
   test('displays membership status for non-member', async ({ page }) => {
     const session = await sessionManager.getOrCreateSession('basic');
     await injectSession(page, session);

     await page.goto('/account');
     await page.click('text=Membership');
     await expect(page.locator('.membership-status')).toContainText('None');
   });
   ```

3. **membership.spec.ts:29** - "Display and download terms" (30 min)

4. **membership.spec.ts:42** - "Terms acceptance requirement" (30 min)

5. **membership.spec.ts:58** - "Request membership" (45 min)

6. **account-management.spec.ts:20** - "Display user profile" (30 min)

7. **account-management.spec.ts:32** - "Navigate account tabs" (20 min)

8. **account-management.spec.ts:52** - "Enable PIN authentication" (45 min)

**Deliverable**: 8 more tests passing (27 → 35 total)

---

### 🧪 Hour 14-18: Error Handling & Edge Cases (4 hours)
**Goal**: 10 new tests for error scenarios

#### Test Suite 8: Error Recovery (2 hours - 5 tests)
**File**: `tests/api/error-handling.spec.ts`

```typescript
test('Handles network timeout gracefully', async () => {
  // Set low timeout, make slow request
  api.setTimeout(100);
  const response = await api.submitRegistration(validData);
  expect(response.error).toContain('timeout');
});

test('Handles invalid JSON response', async () => {
  // Mock endpoint to return invalid JSON
  // Verify error handling
});

test('Handles concurrent duplicate registrations', async () => {
  // Submit same registration twice simultaneously
  const results = await Promise.all([
    api.submitRegistration(data),
    api.submitRegistration(data)
  ]);

  // Verify one succeeds, one fails
  const statuses = results.map(r => r.status);
  expect(statuses).toContain(201);
  expect(statuses).toContain(409); // Conflict
});

test('Handles expired invite during registration', async () => {
  const invite = await api.createInvite({ expires_at: Date.now() - 1000 });

  const response = await api.submitRegistration({
    ...validData,
    invite_code: invite.code
  });

  expect(response.status).toBe(400);
  expect(response.body.error).toContain('expired');
});

test('Handles exhausted invite during registration', async () => {
  const invite = await api.createInvite({ max_uses: 1 });

  // Use invite once
  await api.submitRegistration({ ...validData, invite_code: invite.code });

  // Attempt second use
  const response = await api.submitRegistration({
    ...validData,
    email: 'different@test.com',
    invite_code: invite.code
  });

  expect(response.status).toBe(400);
  expect(response.body.error).toContain('exhausted');
});
```

#### Test Suite 9: Edge Cases (2 hours - 5 tests)
**File**: `tests/api/edge-cases.spec.ts`

```typescript
test('Handles maximum field lengths', async () => {
  const response = await api.submitRegistration({
    first_name: 'A'.repeat(255),
    last_name: 'B'.repeat(255),
    email: 'a'.repeat(240) + '@test.vettid.dev'
  });

  // Should either accept or reject with validation error
  expect([200, 201, 400]).toContain(response.status);
});

test('Handles special characters in names', async () => {
  const specialNames = [
    "O'Brien",
    "José García",
    "François Müller",
    "李明",
    "مُحَمَّد"
  ];

  for (const name of specialNames) {
    const response = await api.submitRegistration({
      ...validData,
      first_name: name
    });

    expect(response.status).toBeOneOf([201, 400]);
  }
});

test('Handles PIN boundary values', async () => {
  const session = await sessionManager.getOrCreateSession('basic');

  // Test 4-digit (min)
  let response = await api.withAuth(session.token).enablePin('1234');
  expect(response.status).toBe(200);

  // Test 6-digit (max)
  response = await api.withAuth(session.token).updatePin('123456');
  expect(response.status).toBe(200);

  // Test 3-digit (too short)
  response = await api.withAuth(session.token).updatePin('123');
  expect(response.status).toBe(400);

  // Test 7-digit (too long)
  response = await api.withAuth(session.token).updatePin('1234567');
  expect(response.status).toBe(400);
});

test('Handles rapid state changes', async () => {
  const user = await quickAuth.createApprovedUser();

  // Approve, then immediately disable
  await api.withAdminAuth().disableUser(user.id);

  // Verify final state is disabled
  const userInfo = await api.withAdminAuth().getUser(user.id);
  expect(userInfo.status).toBe('disabled');
});

test('Handles empty optional fields', async () => {
  const response = await api.submitRegistration({
    first_name: 'Test',
    last_name: 'User',
    email: 'test@test.vettid.dev',
    invite_code: validInvite
    // No optional fields
  });

  expect(response.status).toBe(201);
});
```

**Deliverable**: 10 error/edge case tests

---

### 🏃 Hour 18-22: Test Execution & Fixes (4 hours)

#### Hour 18-19: Full Test Suite Run
```bash
# Run all tests
npm test

# Expected results:
# - API tests: ~15 passing
# - Security tests: ~10-12 passing (some may need fixes)
# - Enabled tests: ~6-8 passing
# - Error tests: ~8-10 passing
# - Total: 45-50 passing tests
```

#### Hour 19-21: Fix Failing Tests (2 hours)
- Debug failures
- Fix flaky tests
- Adjust timeouts
- Fix assertions
- Document known issues

#### Hour 21-22: Performance Optimization
- Optimize slow tests
- Add test parallelization
- Cache auth tokens
- Reduce API calls

**Deliverable**: Stable test suite

---

### 📊 Hour 22-24: Reporting & Documentation (2 hours)

#### Hour 22-23: Generate Test Report

**File**: `TEST_SPRINT_REPORT.md`

```markdown
# 24-Hour Testing Sprint Report

## Summary
- Tests before: 10
- Tests after: 55+
- New tests added: 45+
- Test execution time: <5 minutes
- Coverage increase: 40% → 70%

## Tests by Category
- ✅ API Tests: 15
- ✅ Security Tests: 12
- ✅ UI Tests (enabled): 8
- ✅ Error Handling: 10
- ✅ Total: 55

## Key Findings
### Security Issues Found
1. [Issue description]
2. [Issue description]

### Performance Issues
1. [Issue description]

### Bugs Discovered
1. [Bug description]

## Test Coverage Map
- Registration: 90%
- Authentication: 70%
- Admin Operations: 60%
- Member Operations: 80%
- Security: 75%

## Known Issues
1. [Issue and workaround]

## Next Steps
1. Fix identified bugs
2. Add remaining admin tests
3. Implement CI/CD
```

#### Hour 23-24: Documentation & Handoff

1. **Update README.md** (15 min)
   - New test count
   - How to run new tests
   - New utilities documentation

2. **Create Quick Start Guide** (15 min)
   ```markdown
   # Running the Test Suite

   ## Quick Commands
   npm test                    # All tests
   npm run test:api           # API tests only (fast)
   npm run test:security      # Security tests
   npm run test:ui            # UI tests

   ## Setup
   1. Copy .env.example to .env
   2. Set ADMIN_TOKEN=...
   3. Run: npm test
   ```

3. **Document Test Utilities** (15 min)
   - QuickAuth usage
   - SessionManager usage
   - APITestClient usage

4. **Create Next Steps Document** (15 min)
   ```markdown
   # Post-Sprint Next Steps

   ## Immediate (This Week)
   1. Fix bugs found during sprint
   2. Stabilize flaky tests
   3. Add missing admin tests

   ## Short-term (Next 2 Weeks)
   1. Complete Phase 3 (admin tests)
   2. Add CI/CD integration
   3. Implement test data seeding
   ```

**Deliverable**: Complete documentation package

---

## Success Metrics

### Quantitative Goals
- [x] 45+ new tests written
- [x] 55+ total tests passing
- [x] <5 minute test execution time
- [x] 70%+ feature coverage
- [x] 0 security vulnerabilities undetected

### Qualitative Goals
- [x] All critical paths tested
- [x] Security baseline established
- [x] Test infrastructure scalable
- [x] Documentation complete
- [x] Team can add tests easily

---

## Risk Mitigation

### High-Risk Items
1. **Admin token acquisition fails**
   - Mitigation: Use environment variable fallback
   - Backup: Manual token generation script

2. **Email delivery timing issues**
   - Mitigation: Increase timeouts to 60 seconds
   - Backup: Skip email tests, focus on API

3. **AWS rate limiting**
   - Mitigation: Use test-specific whitelist
   - Backup: Implement exponential backoff

4. **Test data pollution**
   - Mitigation: Use unique prefixes for all test emails
   - Backup: Implement cleanup script

---

## Resource Checklist

### Prerequisites
- [x] AWS credentials in environment
- [x] Admin Cognito credentials
- [x] Valid test invite code
- [x] Email bucket access
- [x] API Gateway endpoint

### Tools Required
- [x] Node.js 20+
- [x] Playwright installed
- [x] AWS SDK configured
- [x] Git for version control

---

## Execution Checklist

### Hour 0-2: Setup
- [ ] Create quick-auth.ts
- [ ] Create api-client.ts
- [ ] Create test-data-generator.ts
- [ ] Verify all utilities working

### Hour 2-6: API Tests
- [ ] Registration API tests (5)
- [ ] Admin registration tests (4)
- [ ] Admin invite tests (3)
- [ ] Member API tests (3)

### Hour 6-10: Security Tests
- [ ] Input validation tests (4)
- [ ] Unauthorized access tests (5)
- [ ] Rate limiting tests (3)

### Hour 10-14: Enable Tests
- [ ] Create session-manager.ts
- [ ] Enable 8 skipped tests
- [ ] Verify all passing

### Hour 14-18: Error Tests
- [ ] Error recovery tests (5)
- [ ] Edge case tests (5)

### Hour 18-22: Execution
- [ ] Run full test suite
- [ ] Fix failing tests
- [ ] Optimize performance

### Hour 22-24: Reporting
- [ ] Generate test report
- [ ] Update documentation
- [ ] Create next steps guide

---

## Timeline Visualization

```
Hour  0  2  4  6  8  10 12 14 16 18 20 22 24
      |-----|-----|-----|-----|-----|-----|
      Setup | API Tests  | Security  | Enable | Error | Run & Fix | Report
            | (15 tests) | (12 tests)| (8)    | (10)  | (55 total)|

Tests: 10 → 25 → 37 → 45 → 55 → 55 (stable) → 55 (documented)
```

---

## Quick Reference Commands

```bash
# Setup
npm install
cp .env.example .env
# Edit .env with credentials

# Run specific test suites (fast feedback)
npm run test:api              # 2 min
npm run test:security         # 3 min
npm run test:ui               # 5 min

# Run all tests
npm test                      # 5 min

# Debug specific test
npm run test:debug tests/api/registration.api.spec.ts

# Generate report
npm run report

# Watch mode (during development)
npm run test:watch
```

---

## Contact & Support

**Questions?** Check:
1. README.md - Setup instructions
2. UPDATED_TEST_PLAN.md - Long-term strategy
3. This document - 24-hour execution plan

**Issues?** Document in TEST_SPRINT_REPORT.md

---

**Sprint Start Time**: _______________
**Sprint End Time**: _______________
**Tests Completed**: _____ / 45
**Status**: ⬜ In Progress | ⬜ Complete
