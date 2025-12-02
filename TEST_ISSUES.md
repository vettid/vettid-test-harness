# VettID Test Suite - Issues Report

**Generated:** 2025-12-02
**Test Environment:** VettIDStack (AWS API Gateway + Lambda + DynamoDB + Cognito)
**API Endpoint:** https://tiqpij5mue.execute-api.us-east-1.amazonaws.com

---

## Summary

| Category | Passed | Failed | Skipped |
|----------|--------|--------|---------|
| Registration Validation | 43 | 1 | 0 |
| Registration Edge Cases | 22 | 3 | 6 |
| Security Tests | 107 | 30 | 20 |
| Admin API Tests | 53 | 22 | 30 |
| Auth API Tests | 6 | 18 | 0 |
| PIN Tests | 6 | 0 | 28 |
| E2E Tests | 2 | 26 | 84 |

**Estimated Total: ~239 passed, ~100 failed, ~168 skipped**

---

## Critical Issues

### 1. Environment Configuration Outdated

**Issue:** The test harness `.env` file contained a stale API endpoint that no longer exists.

**Root Cause:** VettID was redeployed with a new API Gateway endpoint. The old endpoint `cgccjd4djg.execute-api.us-east-1.amazonaws.com` was replaced with `tiqpij5mue.execute-api.us-east-1.amazonaws.com`.

**Fixed:** Updated `.env` with correct values from CloudFormation outputs.

**Recommendation:** Create a script to automatically sync `.env` values from CloudFormation after deployments.

---

### 2. Invite Code Exhaustion

**Issue:** Multiple tests fail because the test invite code gets exhausted after one use.

**Affected Tests:**
- `REG-EDGE-001: Duplicate email in same session is rejected`
- `REG-EDGE-010: Concurrent registrations with same email`
- `REG-EDGE-020: Same request twice returns consistent results`
- `SEC-AUTH-007: Disabled user cannot access endpoints`
- `SEC-AUTH-008: Deleted user cannot access endpoints`

**Error Message:**
```
Error: Registration failed: {"message":"Invite is invalid, expired, or exhausted."}
```

**Recommendation:**
1. Create a dedicated multi-use invite code for testing with `max_uses: 9999`
2. Or create a test setup script that generates new invite codes before each test run

---

### 3. API Response Format Inconsistencies

**Issue:** Error responses use `message` field instead of `error` field.

**Affected Test:** `REG-VAL-042: Error response includes error message`

**Expected:** `{ "error": "First name is required" }`
**Actual:** `{ "message": "First name is required" }`

**Recommendation:** Standardize error response format across all endpoints to use consistent field names.

---

### 4. Missing Membership Endpoints

**Issue:** Several membership-related endpoints return 404 instead of 401 for unauthenticated requests.

**Affected Tests:**
- `MEMBERSHIP-LIST-001: Requires authentication` - Returns 404 instead of 401
- `MEMBERSHIP-APPROVE-001: Requires authentication` - Returns 404 instead of 401
- `MEMBERSHIP-DENY-001: Requires authentication` - Returns 404 instead of 401

**Recommendation:**
- Verify that `/admin/membership/requests` endpoint exists
- Ensure authentication check happens before route matching

---

### 5. Security Header Missing

**Issue:** API Gateway responses do not include standard security headers.

**Affected Tests:**
- `SEC-HEADERS-001: Registration endpoint includes all security headers`
- `SEC-HEADERS-002: Protected endpoints include security headers`
- `SEC-HEADERS-003: Error responses include security headers`
- `SEC-HEADERS-008: Strict-Transport-Security for HTTPS`
- `SEC-HEADERS-009: Content-Security-Policy for XSS protection`

**Missing Headers:**
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Content-Security-Policy`
- `Cache-Control: no-store` (for sensitive data)

**Recommendation:**
Configure API Gateway response headers or add a Lambda@Edge function for CloudFront to include security headers.

---

### 6. Admin Token Validation Issues

**Issue:** Admin token being rejected or returning unexpected status codes on some endpoints.

**Affected Tests:**
- `AUTH-ADMIN-VALID-001: Admin endpoints accept admin token`
- `USER-DISABLE-003: Accepts admin token`
- `USER-ENABLE-003: Accepts admin token`
- `USER-DELETE-003: Accepts admin token`

**Possible Causes:**
1. Token expired (JWT tokens have 1-hour expiry)
2. Token issued for different user pool than endpoint expects
3. Admin endpoint authorization logic issue

**Recommendation:** Verify token validation logic in Lambda authorizer.

---

### 7. Permanently Delete User Endpoint Returns 404

**Issue:** The `/admin/users/{id}/permanent-delete` endpoint returns 404 for unauthenticated requests instead of 401.

**Affected Test:** `AUTH-ADMIN-NOAUTH-Permanently-Delete-User`

**Expected:** 401 Unauthorized
**Actual:** 404 Not Found

**Recommendation:** Ensure authentication middleware runs before route matching.

---

### 8. Invalid Status Filter Not Rejected

**Issue:** Passing invalid status values to membership list endpoint doesn't return an error.

**Affected Test:** `MEMBERSHIP-LIST-012: Invalid status filter is handled`

**Expected:** 400 Bad Request for invalid status values
**Actual:** 200 OK (possibly returning unfiltered results)

**Recommendation:** Add validation for status filter parameter.

---

### 9. Empty/Whitespace Terms Text Accepted

**Issue:** Creating membership terms with empty or whitespace-only text succeeds instead of failing validation.

**Affected Tests:**
- `TERMS-CREATE-004: Rejects empty terms text`
- `TERMS-CREATE-005: Rejects whitespace-only terms text`

**Recommendation:** Add server-side validation to reject empty/whitespace-only terms text.

---

### 10. Get Current Terms Returns 200 When None Exist

**Issue:** The `/admin/membership/terms/current` endpoint returns 200 instead of 404 when no current terms exist.

**Affected Test:** `TERMS-CURRENT-005: Returns 404 when no current terms`

**Recommendation:** Return 404 with appropriate message when no current terms are set.

---

## Medium Priority Issues

### 11. Member Token Tests Skipped

**Issue:** All tests requiring a member token are skipped because `MEMBER_TOKEN` is not configured.

**Affected Tests:** ~30 tests across PIN, membership, and member endpoint categories.

**Recommendation:** Add test setup to create and authenticate a member user, storing the token in environment.

---

### 12. User Management Endpoint Errors

**Issue:** User disable/enable/delete endpoints returning 500 or unexpected errors.

**Affected Tests:**
- `USER-DISABLE-004: Rejects non-existent user ID` - Returns 500 instead of 404
- `USER-ENABLE-004: Rejects non-existent user ID` - Returns 500 instead of 404
- `USER-DELETE-004: Rejects non-existent user ID` - Returns 500 instead of 404

**Recommendation:** Add proper error handling for non-existent user IDs.

---

### 13. API Client Method Missing

**Issue:** Test code references `apiClient.request()` method that doesn't exist.

**Affected Test:** `SEC-AUTH-010: Missing Authorization header rejection`

**Error:**
```
TypeError: apiClient.request is not a function
```

**Recommendation:** Update test to use `apiClient.makeRequest()` method.

---

## Low Priority Issues

### 14. Timing Attack Test Timing Variance

**Issue:** Authentication failure response times show variance exceeding threshold.

**Affected Test:** `SEC-TIMING-003: Authentication failure response time consistent`

**Note:** Network latency may cause natural variance; consider increasing tolerance threshold.

---

### 15. Rate Limiting Tests

**Issue:** Rate limit tests may pass or fail depending on API Gateway WAF configuration.

**Affected Tests:**
- `SEC-RATE-003: Concurrent request handling`
- `SEC-RATE-006: Bulk operation performance`

**Note:** These tests depend on WAF rate limits which may vary by environment.

---

## Test Infrastructure Improvements Needed

### 1. Test Data Management
- Create dedicated test data fixtures
- Implement test isolation (each test should create/cleanup its own data)
- Create multi-use invite codes for testing

### 2. Token Management
- Implement automatic token refresh before expiry
- Create setup scripts to generate member and admin tokens
- Store tokens securely with expiry tracking

### 3. Environment Sync
- Create script to pull latest values from CloudFormation outputs
- Auto-update `.env` after deployments
- Validate environment before running tests

### 4. Test Categories
Consider splitting tests into:
- **Smoke Tests:** Basic functionality (~50 tests, 5 min)
- **Regression Tests:** Full suite (~500 tests, 30 min)
- **Security Tests:** Dedicated security validation (~150 tests, 15 min)

---

## Endpoint Coverage

### Tested Endpoints
- `POST /register` - Registration
- `POST /admin/invites` - Create invite
- `GET /admin/invites` - List invites
- `POST /admin/invites/{code}/expire` - Expire invite
- `DELETE /admin/invites/{code}` - Delete invite
- `GET /admin/registrations` - List registrations
- `POST /admin/registrations/{id}/approve` - Approve registration
- `POST /admin/registrations/{id}/reject` - Reject registration
- `POST /admin/users/{id}/disable` - Disable user
- `POST /admin/users/{id}/enable` - Enable user
- `DELETE /admin/users/{id}` - Delete user (soft)
- `DELETE /admin/users/{id}/permanent` - Permanently delete user
- `GET /admin/membership/requests` - List membership requests
- `POST /admin/membership/requests/{id}/approve` - Approve membership
- `POST /admin/membership/requests/{id}/deny` - Deny membership
- `GET /admin/membership/terms` - List terms
- `POST /admin/membership/terms` - Create terms
- `GET /admin/membership/terms/current` - Get current terms

### Endpoints Needing Tests
- `POST /account/cancel` - Cancel account
- `POST /account/pin/enable` - Enable PIN
- `POST /account/pin/disable` - Disable PIN
- `POST /account/pin/update` - Update PIN
- `GET /account/pin/status` - Get PIN status
- `POST /account/membership/request` - Request membership
- `GET /account/membership/status` - Get membership status

---

## E2E Test Issues

### 16. E2E Tests Require OAuth Authentication

**Issue:** E2E tests that require user authentication fail because they need to complete the OAuth PKCE flow through the Cognito hosted UI.

**Affected Tests:** All PIN management, account management, and membership E2E tests (~84 tests)

**Error:** Tests timeout waiting for authentication to complete.

**Root Cause:** E2E tests navigate to `/account` which requires authentication. Without a logged-in session, the tests cannot proceed.

**Recommendation:**
1. Create a Playwright fixture that pre-authenticates users before tests
2. Use `storageState` to save and restore authenticated sessions
3. Or use API-based authentication to get tokens and inject them into localStorage

---

### 17. Magic Link Email Retrieval Timeout

**Issue:** Tests waiting for magic link emails from SES timeout.

**Affected Tests:**
- `Magic Link Authentication › should send magic link email when requested`
- `Magic Link Authentication › should extract valid magic link from email`
- `Magic Link Authentication › should successfully authenticate with magic link`

**Possible Causes:**
1. SES email delivery delay
2. S3 email retrieval issues
3. Email not being sent due to unverified sender domain

**Recommendation:**
1. Increase email wait timeout to 60+ seconds
2. Verify SES rule set is active: `aws ses describe-active-receipt-rule-set`
3. Check S3 bucket for received emails

---

### 18. Complete Journey Test Setup Failure

**Issue:** The complete journey test fails during invite code creation.

**Error:**
```
Step 3: Creating invite code...
[Test fails here]
```

**Root Cause:** The test tries to create an invite code using admin API but encounters an error.

**Recommendation:** Ensure admin token is valid and has permission to create invites.

---

## Next Steps

1. **Fix Critical Issues 1-5** - Environment, invite codes, response format
2. **Add Missing Endpoints** - Ensure all admin endpoints return proper auth errors
3. **Configure Security Headers** - Add standard security headers to API Gateway
4. **Create Test Fixtures** - Multi-use invite codes, member users, etc.
5. **Implement Token Refresh** - Automated token management for tests

---

## Files Modified

- `/home/al/vettid-test-harness/.env` - Updated with correct API endpoint and Cognito configuration
- Created test admin user in Cognito: `testadmin@test.vettid.dev`
- Enabled `ALLOW_ADMIN_USER_PASSWORD_AUTH` on admin client for test token generation

---

*This report was generated by running the VettID test suite. Issues should be addressed in priority order.*
