# VettID Comprehensive Testing Plan - 2025
**Version**: 2.0
**Date**: 2025-11-26
**Status**: Pending Approval

## Executive Summary

### Current State
- **Total Tests Written**: 27 tests across 5 test files
- **Tests Passing**: 10 tests (37%) - Registration and basic auth flows
- **Tests Skipped**: 17 tests (63%) - Blocked by authentication setup
- **Code Coverage**: ~40% of application features tested

### Application Features Inventory (From Code Review)
- ✅ Public registration with invite codes (auto-approve supported)
- ✅ Magic link authentication with optional PIN
- ✅ Admin operations (22 endpoints total)
- ✅ Member operations (6 endpoints)
- ✅ Account management (PIN, cancellation)
- ✅ Membership request workflow
- ✅ Invite management system
- ✅ User lifecycle management

### Testing Gaps Identified
1. **No authenticated user test fixtures** - Blocks 13 tests (81% of skipped tests)
2. **No admin approval automation** - Blocks end-to-end flows
3. **No security/penetration tests** - SQL injection, XSS, unauthorized access
4. **No admin panel tests** - 22 admin endpoints untested
5. **Limited error scenario coverage** - Rate limiting, token expiration
6. **No API-level tests** - All tests are UI-based (slower, more fragile)

## Phase 1: Enable Existing Tests (Priority: CRITICAL)
**Goal**: Unblock 17 skipped tests by creating authentication fixtures
**Timeline**: Week 1 (5 days)
**Effort**: High

### 1.1 Create Authentication Test Fixtures

**New File**: `tests/fixtures/auth-fixtures.ts`

```typescript
/**
 * Creates a complete authenticated user session for testing
 * Returns: { email, tokens, userInfo }
 */
export async function createAuthenticatedUser(
  page: Page,
  emailRetriever: EmailRetriever,
  options?: {
    withPin?: boolean,
    pinValue?: string,
    membershipStatus?: 'none' | 'pending' | 'approved'
  }
): Promise<AuthenticatedUser>

/**
 * Admin API helper to auto-approve registrations
 */
export async function autoApproveRegistration(
  registrationId: string,
  adminToken: string
): Promise<void>

/**
 * Pre-seed users in different states for testing
 */
export async function seedTestUsers(): Promise<{
  basicUser: string,
  userWithPin: string,
  memberUser: string,
  adminUser: string
}>
```

**Implementation Steps**:
1. Create test user via registration API
2. Use admin API to auto-approve
3. Complete magic link flow programmatically
4. Store tokens for reuse in tests
5. Optionally enable PIN or request membership
6. Return ready-to-use authenticated session

**Tests Unblocked**: 13 tests
- All 6 account management tests
- All 5 membership tests
- 2 PIN authentication tests

### 1.2 Implement Admin API Token Helper

**File**: `tests/utils/api-helpers.ts` (enhancement)

```typescript
/**
 * Get admin OAuth token for API operations
 */
async getAdminToken(): Promise<string>

/**
 * Approve latest pending registration
 */
async autoApproveLatestRegistration(): Promise<RegistrationInfo>
```

**Implementation**:
- Use admin Cognito credentials from environment
- Implement OAuth client credentials flow
- Cache token for test duration
- Auto-refresh on expiry

**Tests Unblocked**: 1 test
- Full journey test (admin approval step)

### 1.3 Update Existing Tests to Use Fixtures

**Files to Update**:
- `tests/e2e/auth/magic-link.spec.ts` (4 tests)
- `tests/e2e/account/account-management.spec.ts` (6 tests)
- `tests/e2e/membership/membership.spec.ts` (5 tests)
- `tests/e2e/full-journey.spec.ts` (1 test)

**Changes**:
```typescript
// Before
test.skip('should enable PIN authentication', async ({ page }) => {
  // Test skipped - requires authenticated user
});

// After
test('should enable PIN authentication', async ({ page }) => {
  const { email, tokens } = await createAuthenticatedUser(page, emailRetriever);
  // Test implementation continues...
});
```

**Success Criteria**:
- [ ] All 17 skipped tests now run successfully
- [ ] Test execution time < 5 minutes for full suite
- [ ] All tests are idempotent (can run multiple times)
- [ ] Proper cleanup after each test

**Deliverables**:
1. `auth-fixtures.ts` with authentication helpers
2. Enhanced `api-helpers.ts` with admin token support
3. Updated test files (remove .skip() calls)
4. Documentation for fixture usage

---

## Phase 2: Security & Authorization Tests (Priority: HIGH)
**Goal**: Test security boundaries and unauthorized access prevention
**Timeline**: Week 2 (5 days)
**Effort**: Medium

### 2.1 Unauthorized Access Tests

**New File**: `tests/e2e/security/unauthorized-access.spec.ts`

**Test Cases** (10 tests):

1. **Unauthenticated user cannot access member endpoints**
   - Test all 6 member endpoints without token
   - Expect: 401 Unauthorized

2. **Member cannot access admin endpoints**
   - Test all 22 admin endpoints with member token
   - Expect: 403 Forbidden

3. **Disabled user cannot authenticate**
   - Disable user via admin API
   - Attempt magic link authentication
   - Expect: Authentication failure

4. **Deleted user cannot authenticate**
   - Soft-delete user via admin API
   - Attempt magic link authentication
   - Expect: Authentication failure

5. **Rejected registration cannot authenticate**
   - Create registration, reject it
   - Attempt magic link authentication
   - Expect: User not found error

6. **Token manipulation test**
   - Modify JWT payload (change email, groups)
   - Attempt API call
   - Expect: 401 Invalid signature

7. **Expired token handling**
   - Wait for token expiry (or manipulate exp claim)
   - Attempt API call
   - Expect: 401 Token expired

8. **Missing token test**
   - Call protected endpoint without Authorization header
   - Expect: 401 Unauthorized

9. **Malformed token test**
   - Send invalid token format
   - Expect: 401 Bad request

10. **CORS policy test**
    - Make request from unauthorized origin
    - Expect: CORS error or rejection

### 2.2 Input Validation & Injection Tests

**New File**: `tests/e2e/security/input-validation.spec.ts`

**Test Cases** (8 tests):

1. **SQL injection prevention - registration**
   - Submit: `email: "'; DROP TABLE registrations; --"`
   - Expect: Validation error, no database impact

2. **SQL injection prevention - search**
   - Search with: `"1' OR '1'='1"`
   - Expect: No unauthorized data returned

3. **XSS prevention - registration**
   - Submit: `first_name: "<script>alert('xss')</script>"`
   - Expect: Script tags escaped/sanitized

4. **XSS prevention - profile display**
   - Register with malicious name
   - View profile page
   - Expect: No script execution

5. **Command injection prevention**
   - Submit: `invite_code: "; cat /etc/passwd"`
   - Expect: Validation error

6. **Path traversal prevention**
   - Attempt: `GET /admin/../../../etc/passwd`
   - Expect: 404 or 403

7. **Email format validation**
   - Test invalid formats: `test@`, `@domain.com`, `no-at-sign`
   - Expect: Email validation errors

8. **PIN format validation**
   - Test invalid PINs: `abc`, `12`, `1234567`, `12 34`
   - Expect: PIN format errors

### 2.3 Rate Limiting & Abuse Prevention

**New File**: `tests/e2e/security/rate-limiting.spec.ts`

**Test Cases** (5 tests):

1. **Magic link rate limiting**
   - Send 101 magic link requests in 1 hour
   - Expect: Rate limit error after 100 requests
   - Note: Whitelist bypass for test email

2. **Registration rate limiting**
   - Submit 50+ registrations rapidly
   - Expect: Rate limiting or CAPTCHA requirement

3. **Token reuse prevention**
   - Use magic link token once
   - Attempt to reuse same token
   - Expect: Token already used error

4. **Magic link expiration**
   - Generate magic link
   - Wait 16 minutes (TTL is 15 minutes)
   - Attempt authentication
   - Expect: Token expired error

5. **PIN brute force protection**
   - Attempt 20 incorrect PINs rapidly
   - Expect: Account lockout or rate limiting

**Success Criteria**:
- [ ] All security tests passing
- [ ] No unauthorized access possible
- [ ] Input validation prevents injection attacks
- [ ] Rate limiting works as expected
- [ ] Security vulnerabilities documented and fixed

**Deliverables**:
1. Three new security test files (23 tests total)
2. Security test report with findings
3. Recommendations for security improvements
4. Updated SECURITY.md with test coverage

---

## Phase 3: Admin Functionality Tests (Priority: HIGH)
**Goal**: Test all 22 admin endpoints and admin UI
**Timeline**: Week 3 (5 days)
**Effort**: High

### 3.1 Admin Registration Management

**New File**: `tests/e2e/admin/registration-management.spec.ts`

**Test Cases** (8 tests):

1. **List all registrations**
   - Call: `GET /admin/registrations`
   - Verify: All registrations returned with correct fields

2. **Filter registrations by status**
   - Call: `GET /admin/registrations?status=pending`
   - Verify: Only pending registrations returned

3. **Approve registration**
   - Create pending registration
   - Call: `POST /admin/registrations/{id}/approve`
   - Verify: User created in Cognito, status updated, audit log

4. **Reject registration**
   - Create pending registration
   - Call: `POST /admin/registrations/{id}/reject`
   - Verify: Status updated, rejection reason stored

5. **Approve already approved registration (idempotency)**
   - Approve registration twice
   - Verify: Second approval returns success, no duplicate user

6. **Bulk approve registrations**
   - UI test: Select multiple pending registrations
   - Click bulk approve
   - Verify: All approved successfully

7. **Search registrations**
   - UI test: Search by name, email, invite code
   - Verify: Correct results returned

8. **Pagination**
   - UI test: Create 100+ registrations
   - Verify: Pagination works correctly

### 3.2 Admin Invite Management

**New File**: `tests/e2e/admin/invite-management.spec.ts`

**Test Cases** (10 tests):

1. **Create invite with custom code**
   - Call: `POST /admin/invites` with custom code
   - Verify: Invite created with correct settings

2. **Create invite with auto-generated code**
   - Call: `POST /admin/invites` without code
   - Verify: Code generated in VET-XXXX format

3. **Create auto-approve invite**
   - Set `auto_approve: true`
   - Use invite to register
   - Verify: User instantly approved

4. **Invite expiration**
   - Set expiry 1 day in future
   - Wait/manipulate time
   - Attempt registration with expired invite
   - Verify: Invite expired error

5. **Invite max uses**
   - Create invite with `max_uses: 2`
   - Use invite 3 times
   - Verify: Third usage fails (exhausted)

6. **List all invites**
   - Call: `GET /admin/invites`
   - Verify: All invites returned

7. **Filter invites by status**
   - Filter: active, expired, exhausted
   - Verify: Correct filtering

8. **Manually expire invite**
   - Call: `POST /admin/invites/{code}/expire`
   - Verify: Status changed to expired

9. **Delete invite**
   - Call: `DELETE /admin/invites/{code}`
   - Verify: Invite deleted

10. **Bulk expire invites**
    - UI test: Select multiple invites
    - Click bulk expire
    - Verify: All expired

### 3.3 Admin User Management

**New File**: `tests/e2e/admin/user-management.spec.ts`

**Test Cases** (8 tests):

1. **Disable user**
   - Call: `POST /admin/users/{id}/disable`
   - Verify: User disabled in Cognito, cannot log in

2. **Re-enable user**
   - Call: `POST /admin/users/{id}/enable`
   - Verify: User re-enabled, can log in

3. **Soft delete user**
   - Call: `DELETE /admin/users/{id}`
   - Verify: Status = deleted, Cognito disabled

4. **Permanently delete user**
   - Call: `POST /admin/users/{id}/permanently-delete`
   - Verify: All records removed

5. **Restore deleted user within grace period**
   - Delete user
   - Re-enable within 7 days
   - Verify: User restored

6. **Bulk disable users**
   - UI test: Select multiple users
   - Bulk disable
   - Verify: All disabled

7. **View user details**
   - UI test: Click user details
   - Verify: All fields displayed (GUID, groups, timestamps)

8. **Filter users by status**
   - Filter: approved, pending, disabled, deleted
   - Verify: Correct filtering

### 3.4 Admin Membership Management

**New File**: `tests/e2e/admin/membership-management.spec.ts`

**Test Cases** (7 tests):

1. **List membership requests**
   - Call: `GET /admin/memberships`
   - Verify: All membership requests returned

2. **Approve membership**
   - Call: `POST /admin/memberships/{id}/approve`
   - Verify: User added to member group, status updated

3. **Deny membership**
   - Call: `POST /admin/memberships/{id}/deny`
   - Verify: Status updated, denial reason stored

4. **Create membership terms**
   - Call: `POST /admin/memberships/terms`
   - Verify: Terms created, PDF generated, stored in S3

5. **Get current membership terms**
   - Call: `GET /admin/memberships/terms/current`
   - Verify: Current version returned

6. **List all term versions**
   - Call: `GET /admin/memberships/terms`
   - Verify: Version history returned

7. **UI: Membership terms management**
   - Create new terms via UI
   - Verify: PDF download works, terms displayed correctly

### 3.5 Admin User Administration

**New File**: `tests/e2e/admin/admin-management.spec.ts`

**Test Cases** (5 tests):

1. **List admin users**
   - Call: `GET /admin/admins`
   - Verify: All admins returned

2. **Add new admin**
   - Call: `POST /admin/admins`
   - Verify: User created with admin group

3. **Add admin role to existing user**
   - Create regular user first
   - Call: `POST /admin/admins`
   - Verify: Admin group added

4. **Remove admin privileges**
   - Call: `DELETE /admin/admins/{email}`
   - Verify: Admin group removed

5. **Admin cannot remove self**
   - Attempt to remove own admin privileges
   - Verify: Error or warning

**Success Criteria**:
- [ ] All 38 admin tests passing
- [ ] All admin API endpoints tested
- [ ] Admin UI tested for key workflows
- [ ] Audit logging verified
- [ ] Error handling tested

**Deliverables**:
1. Five new admin test files (38 tests total)
2. Admin functionality test report
3. API endpoint coverage matrix
4. UI test automation for admin panel

---

## Phase 4: API-Level Test Suite (Priority: MEDIUM)
**Goal**: Create fast, reliable API-only tests (no UI)
**Timeline**: Week 4 (5 days)
**Effort**: Medium

### 4.1 API Test Framework Setup

**New Directory**: `tests/api/`

**Benefits**:
- 10x faster than UI tests (~100ms vs 1-2s per test)
- More reliable (no UI flakiness)
- Easier to debug (direct API responses)
- Better for CI/CD
- Parallel execution friendly

**Structure**:
```
tests/api/
├── registration.api.spec.ts
├── authentication.api.spec.ts
├── membership.api.spec.ts
├── admin.api.spec.ts
└── helpers/
    └── api-client.ts
```

### 4.2 API Test Coverage

**Test Count**: ~50 API tests covering:

1. **Registration API** (10 tests)
   - Valid registration
   - Invalid invite codes
   - Duplicate email prevention
   - Auto-approve flow
   - Field validation

2. **Authentication API** (15 tests)
   - Magic link generation
   - Token validation
   - PIN authentication
   - Token expiration
   - Refresh tokens

3. **Member API** (12 tests)
   - Membership status
   - Membership request
   - PIN management (enable/update/disable)
   - Account cancellation
   - Terms retrieval

4. **Admin API** (13 tests)
   - All CRUD operations
   - List endpoints with filters
   - Bulk operations
   - Authorization checks

**Implementation Pattern**:
```typescript
test('POST /register - valid registration', async ({ request }) => {
  const apiClient = new APIClient(request);

  const response = await apiClient.submitRegistration({
    first_name: 'Test',
    last_name: 'User',
    email: 'test@test.vettid.dev',
    invite_code: validInviteCode
  });

  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('registration_id');
  expect(response.body.status).toBe('pending');
});
```

**Success Criteria**:
- [ ] 50+ API tests implemented
- [ ] Test execution time < 30 seconds for full suite
- [ ] 100% API endpoint coverage
- [ ] Integration with existing test utilities
- [ ] Can run independently of UI tests

**Deliverables**:
1. API test framework and helpers
2. 50+ API test cases
3. API test documentation
4. CI/CD integration for API tests

---

## Phase 5: Advanced Scenarios (Priority: MEDIUM)
**Goal**: Test edge cases, error recovery, and complex flows
**Timeline**: Week 5 (5 days)
**Effort**: Medium

### 5.1 Email Integration Tests

**New File**: `tests/e2e/email/email-integration.spec.ts`

**Test Cases** (8 tests):

1. **Magic link email delivery**
   - Request magic link
   - Verify email received within 30 seconds
   - Verify email content (subject, from, body)

2. **Registration confirmation email** (if implemented)
   - Submit registration
   - Verify confirmation email
   - Extract confirmation link

3. **Approval notification email** (if implemented)
   - Admin approves registration
   - Verify user receives notification
   - Verify email content

4. **Membership approval email** (if implemented)
   - Admin approves membership
   - Verify notification email

5. **Magic link extraction accuracy**
   - Test various email formats
   - Verify regex extracts correct URL

6. **Email rate limiting**
   - Request magic links 5 times in 60 seconds
   - Verify token reuse (same token within 60s)

7. **Email template validation**
   - Verify HTML and text versions
   - Check for broken links
   - Validate branding

8. **Email spam score**
   - Use spam checker tool
   - Verify emails don't trigger spam filters

### 5.2 Error Recovery & Resilience

**New File**: `tests/e2e/resilience/error-recovery.spec.ts`

**Test Cases** (10 tests):

1. **Network interruption during registration**
   - Simulate network failure mid-request
   - Verify graceful error handling
   - Retry successful

2. **Page refresh during authentication**
   - Start auth flow
   - Refresh page
   - Verify state preserved or clear error

3. **Back button during registration**
   - Fill registration form
   - Click back
   - Verify form data preservation

4. **Session expiry during active use**
   - Authenticate
   - Expire session (wait or manipulate)
   - Attempt action
   - Verify redirect to login

5. **Concurrent registration attempts**
   - Submit same registration twice simultaneously
   - Verify one succeeds, one fails (duplicate check)

6. **Token refresh failure**
   - Invalidate refresh token
   - Attempt to refresh
   - Verify redirect to login

7. **S3 upload failure** (membership terms)
   - Simulate S3 error
   - Verify error handling
   - Verify cleanup

8. **DynamoDB write failure**
   - Simulate database error
   - Verify transaction rollback
   - Verify error message

9. **Email delivery failure**
   - Simulate SES error
   - Verify error handled gracefully
   - Verify retry or notification

10. **API timeout handling**
    - Simulate slow API response
    - Verify timeout error
    - Verify user feedback

### 5.3 Boundary & Edge Cases

**New File**: `tests/e2e/edge-cases/boundary-conditions.spec.ts`

**Test Cases** (12 tests):

1. **Maximum field lengths**
   - Test 255-character names
   - Test long email addresses
   - Verify truncation or validation

2. **Minimum field lengths**
   - Test 1-character names
   - Verify minimum length requirements

3. **Special characters in names**
   - Test: `O'Brien`, `José`, `François`, `李明`
   - Verify proper handling

4. **Unicode email addresses**
   - Test internationalized domains
   - Verify support or rejection

5. **PIN boundary values**
   - Test: 4 digits (min), 6 digits (max), 7 digits (invalid)
   - Verify validation

6. **Invite expiry boundary**
   - Test invite expiring in 1 second
   - Test invite expiring in 1 year
   - Verify correct behavior

7. **Max uses boundary**
   - Test invite with max_uses = 1
   - Test invite with max_uses = 999999
   - Verify counter accuracy

8. **Empty optional fields**
   - Submit with null/empty optional fields
   - Verify accepted

9. **Large bulk operations**
   - Bulk approve 100 registrations
   - Bulk expire 1000 invites
   - Verify performance and correctness

10. **Rapid state changes**
    - Approve, then immediately disable user
    - Request membership, then immediately cancel account
    - Verify state consistency

11. **7-day cancellation boundary**
    - Cancel account
    - Restore on day 6
    - Verify successful restoration

12. **Grace period expiry**
    - Cancel account
    - Wait/manipulate to day 8
    - Verify permanent deletion

**Success Criteria**:
- [ ] All 30 advanced scenario tests passing
- [ ] Email integration verified
- [ ] Error recovery tested
- [ ] Edge cases handled gracefully
- [ ] No data inconsistencies

**Deliverables**:
1. Three new test files (30 tests total)
2. Edge case coverage report
3. Error handling recommendations
4. Resilience test documentation

---

## Phase 6: CI/CD Integration (Priority: MEDIUM)
**Goal**: Automate test execution in CI/CD pipeline
**Timeline**: Week 6 (3 days)
**Effort**: Low

### 6.1 GitHub Actions Workflow

**New File**: `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run E2E tests
        run: npm test
        env:
          BASE_URL: ${{ secrets.BASE_URL }}
          API_URL: ${{ secrets.API_URL }}
          EMAIL_BUCKET_NAME: ${{ secrets.EMAIL_BUCKET_NAME }}
          TEST_INVITE_CODE: ${{ secrets.TEST_INVITE_CODE }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ matrix.browser }}
          path: playwright-report/
          retention-days: 30

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'E2E tests failed on ${{ matrix.browser }}'
```

### 6.2 Test Reporting & Monitoring

**Integrations**:
1. **HTML Report** - Already configured in Playwright
2. **JSON Report** - For programmatic access
3. **JUnit XML** - For CI/CD dashboards
4. **Allure Report** - For detailed test analytics

**Metrics to Track**:
- Test pass rate
- Test execution time
- Flaky test detection
- Test coverage
- Failed test trends

### 6.3 Environment Management

**Environments**:
1. **Development** - `dev.vettid.dev`
2. **Staging** - `staging.vettid.dev`
3. **Production** - `vettid.dev` (smoke tests only)

**Configuration**:
- Separate `.env` files per environment
- GitHub secrets for sensitive data
- Environment-specific test suites

**Success Criteria**:
- [ ] GitHub Actions workflow working
- [ ] Tests run on every PR
- [ ] Test reports published
- [ ] Notifications on failure
- [ ] Multi-browser testing
- [ ] Scheduled daily runs

**Deliverables**:
1. GitHub Actions workflow
2. Multi-environment configuration
3. Test reporting dashboard
4. CI/CD documentation

---

## Phase 7: Performance & Load Testing (Priority: LOW)
**Goal**: Validate performance under load
**Timeline**: Week 7 (3 days)
**Effort**: Low

### 7.1 Performance Baseline Tests

**Tool**: Playwright Performance API + Lighthouse

**Test Cases** (6 tests):

1. **Page load times**
   - Measure /signin, /register, /account pages
   - Target: < 2 seconds

2. **API response times**
   - Measure all endpoints
   - Target: < 500ms for reads, < 1s for writes

3. **Magic link generation time**
   - Measure end-to-end time
   - Target: < 5 seconds including email delivery

4. **Registration flow time**
   - Measure complete registration
   - Target: < 10 seconds

5. **Authentication flow time**
   - Measure complete login
   - Target: < 15 seconds

6. **Admin operations performance**
   - Measure bulk operations
   - Target: < 5 seconds for 100 items

### 7.2 Load Testing

**Tool**: k6 or Artillery

**Scenarios**:
1. **Concurrent registrations** - 100 users/minute
2. **Concurrent logins** - 500 requests/minute
3. **Admin bulk operations** - 50 concurrent admins
4. **API stress test** - 1000 requests/second

**Metrics**:
- Response time (p50, p95, p99)
- Error rate
- Throughput
- Resource utilization

**Success Criteria**:
- [ ] Performance baselines established
- [ ] Load test scenarios created
- [ ] Performance regressions detected
- [ ] Bottlenecks identified

**Deliverables**:
1. Performance test suite
2. Load test scenarios
3. Performance baseline report
4. Optimization recommendations

---

## Summary: Complete Test Coverage Plan

### Test Count by Phase

| Phase | Test Files | Test Cases | Effort | Priority |
|-------|------------|------------|--------|----------|
| 1. Enable Existing Tests | 1 fixture + 4 updated | 17 tests enabled | High | CRITICAL |
| 2. Security Tests | 3 files | 23 tests | Medium | HIGH |
| 3. Admin Tests | 5 files | 38 tests | High | HIGH |
| 4. API Tests | 4 files | 50 tests | Medium | MEDIUM |
| 5. Advanced Scenarios | 3 files | 30 tests | Medium | MEDIUM |
| 6. CI/CD Integration | 1 workflow | N/A | Low | MEDIUM |
| 7. Performance Tests | 2 files | 6 tests | Low | LOW |
| **TOTAL** | **18 files** | **164 tests** | | |

### Current vs. Target State

| Metric | Current | Phase 1 | Phase 3 | Final Target |
|--------|---------|---------|---------|--------------|
| Tests Passing | 10 | 27 | 65 | 164 |
| Feature Coverage | 40% | 60% | 85% | 95% |
| Endpoint Coverage | 20% | 40% | 90% | 100% |
| Security Coverage | 0% | 0% | 100% | 100% |
| CI/CD Integration | No | No | No | Yes |

### Timeline

**7-Week Plan** (assuming 1 developer):

- **Week 1**: Phase 1 - Enable existing tests
- **Week 2**: Phase 2 - Security tests
- **Week 3**: Phase 3 - Admin tests
- **Week 4**: Phase 4 - API tests
- **Week 5**: Phase 5 - Advanced scenarios
- **Week 6**: Phase 6 - CI/CD integration
- **Week 7**: Phase 7 - Performance testing

**Accelerated 4-Week Plan** (for critical paths only):

- **Week 1**: Phase 1 + Phase 2 (Security)
- **Week 2**: Phase 3 (Admin tests)
- **Week 3**: Phase 4 (API tests)
- **Week 4**: Phase 6 (CI/CD)

### Risk Assessment

**High Risk Items**:
1. Admin approval automation may require additional AWS permissions
2. Rate limiting tests may be flaky without proper cleanup
3. Email delivery timing may vary (SES delays)
4. Token expiration tests require time manipulation

**Mitigation Strategies**:
1. Request AWS permissions early
2. Implement proper test isolation and cleanup
3. Add timeout buffers for email tests
4. Use system clock mocking for time-based tests

### Resource Requirements

**Infrastructure**:
- AWS test environment (existing: vettid-test-infra)
- GitHub Actions runners (free tier sufficient)
- Test data storage (S3 bucket - existing)

**Credentials Needed**:
- Admin Cognito user credentials
- AWS API credentials (S3, SES access)
- Test invite codes
- API Gateway endpoints

**Development Tools**:
- Playwright (existing)
- k6 or Artillery (for load testing)
- Allure (for reporting)

---

## Recommendations

### Immediate Actions (This Week)
1. ✅ Review and approve this test plan
2. Create authentication fixtures (Phase 1.1)
3. Implement admin API helper (Phase 1.2)
4. Unblock 17 skipped tests

### Quick Wins (Next 2 Weeks)
1. Enable all existing tests (Phase 1)
2. Add security tests (Phase 2)
3. Start admin API tests (Phase 3)

### Long-Term Improvements
1. Migrate to API-first testing strategy
2. Implement visual regression testing
3. Add accessibility testing (WCAG 2.1)
4. Create test data seeding scripts
5. Implement synthetic monitoring in production

### Testing Best Practices
1. **Test Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data after tests
3. **Idempotency**: Tests should be runnable multiple times
4. **Fast Feedback**: Prioritize fast tests in CI
5. **Clear Assertions**: Use descriptive expect messages
6. **Documentation**: Document test scenarios and purposes

---

## Appendix: Test Utilities Enhancement Plan

### Proposed New Utilities

1. **TestDataFactory** - Generate realistic test data
2. **DatabaseSeeder** - Seed test data directly to DynamoDB
3. **CognitoManager** - Manage test users in Cognito
4. **S3Manager** - Clean up test files in S3
5. **TimeManager** - Mock system time for expiration tests
6. **MetricsCollector** - Collect performance metrics

### Documentation Updates Needed

1. Update README.md with new test coverage
2. Create TESTING_GUIDE.md for developers
3. Document CI/CD setup process
4. Create troubleshooting guide
5. Add test writing guidelines

---

## Approval Checklist

Please review and approve the following:

- [ ] Overall testing strategy and phased approach
- [ ] Test coverage targets (164 total tests, 95% feature coverage)
- [ ] Timeline (7 weeks full plan or 4 weeks accelerated)
- [ ] Priority ordering (Critical → High → Medium → Low)
- [ ] Resource requirements (AWS permissions, credentials)
- [ ] Phase 1 immediate focus (enable 17 skipped tests)
- [ ] Security testing scope (Phase 2)
- [ ] Admin testing scope (Phase 3)
- [ ] API testing strategy (Phase 4)
- [ ] CI/CD integration plan (Phase 6)

**Approval**: _________________________
**Date**: _________________________
**Notes/Modifications**:
