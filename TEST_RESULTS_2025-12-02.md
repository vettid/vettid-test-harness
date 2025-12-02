# VettID API Test Results - December 2, 2025

## Summary

After reviewing the developer fixes in `FIXES_APPLIED_2025-12-02.md` and updating the test harness accordingly, API tests were run against the VettID backend. This document summarizes the findings.

## Test Harness Updates Made

### 1. API Test Client Updates (`tests/utils/api-test-client.ts`)
- Added `Origin: https://admin.vettid.dev` header to all requests (required for CORS)
- Fixed endpoint paths for membership operations:
  - `approveMembership()`: `/admin/memberships/{id}/approve` → `/admin/membership-requests/{id}/approve`
  - `denyMembership()`: `/admin/memberships/{id}/deny` → `/admin/membership-requests/{id}/deny`
  - `listMembershipRequests()`: `/admin/memberships` → `/admin/membership-requests`
- Added helper methods: `listMembershipTerms()`, `getCurrentMembershipTerms()`, `getErrorMessage()`
- Updated `expectError()` to check `message` field first, then `error`

### 2. API Helpers Updates (`tests/utils/api-helpers.ts`)
- Added `Origin: https://admin.vettid.dev` header to all requests

### 3. Test File Updates
- Changed `response.body.error` to `response.body.message` across all test files
- Updated response format expectations from `{items: [...]}` to `{registrations: [...]}` for membership-requests endpoint

## API Issues Found (For Developer Review)

### Issue 1: 500 Error for Non-Existent Membership Request IDs
**Severity: Medium**

**Endpoints Affected:**
- `POST /admin/membership-requests/{id}/approve`
- `POST /admin/membership-requests/{id}/deny`

**Expected Behavior:** Return 404 (Not Found) when the membership request ID doesn't exist

**Actual Behavior:** Returns 500 (Internal Server Error) with message `{"message":"Failed to approve membership"}`

**Example:**
```bash
curl -X POST "https://tiqpij5mue.execute-api.us-east-1.amazonaws.com/admin/membership-requests/nonexistent-id/approve" \
  -H "Authorization: Bearer {token}" \
  -H "Origin: https://admin.vettid.dev"

# Response: {"message":"Failed to approve membership"}
# Status: 500
```

**Recommendation:** Add validation to check if the registration_id exists before attempting to update. Return 404 with appropriate message like `{"message":"Membership request not found"}`.

### Issue 2: CORS Origin Header Required
**Severity: Low (Documented Behavior)**

API Gateway returns 401 Unauthorized when requests don't include the `Origin` header, even with a valid token. This is due to CORS configuration.

**Affected:** All authenticated endpoints

**Recommendation:** This is expected behavior for browser security. Test harness has been updated to include the Origin header.

## Test Results Summary

### Membership Requests Tests (`list-membership-requests.api.spec.ts`)
- **Passed:** 18 tests
- **Skipped:** 9 tests (require MEMBER_TOKEN or specific test data)
- **Failed:** 6 tests (due to token expiration during test run)

### Note on Token Expiration
Cognito ID tokens expire after 1 hour. The 6 failed tests returned 401 (Unauthorized) because the token expired mid-run. When running with a fresh token, these tests pass. To run the full suite reliably:
1. Generate a fresh admin token immediately before running tests
2. Consider implementing token refresh in the test harness for longer test runs

### Key Observations

1. **Response Format:** The `/admin/membership-requests` endpoint returns `{registrations: [...]}` not `{items: [...]}`. Tests have been updated accordingly.

2. **Invalid Status Filter:** The endpoint returns 404 for invalid status filter values (e.g., `?membership_status=invalid`). This could be 400 (Bad Request) instead, but 404 is acceptable.

3. **Token Expiration:** Cognito ID tokens expire after 1 hour. Tests requiring admin access need fresh tokens if running for extended periods.

## Environment Configuration

The test harness uses the following configuration (from `.env`):
- API URL: `https://tiqpij5mue.execute-api.us-east-1.amazonaws.com`
- Admin User Pool: `us-east-1_jY0wsytIQ`
- Admin Client ID: `9auscmfcskqqj4b3p2nvf874u`
- Test Invite Code: `VET-6B286B2F98294C35`

## Recommendations for Developers

1. **Fix 500 errors for non-existent IDs:** Update the membership approval/denial handlers to return 404 instead of 500 when the registration is not found.

2. **Consider consistent response format:** The `/admin/registrations` endpoint returns `{items: [...]}` while `/admin/membership-requests` returns `{registrations: [...]}`. Consider standardizing on one format.

3. **Add input validation for status filter:** Return 400 Bad Request for invalid `membership_status` values instead of 404.

## Files Modified in Test Harness

1. `/home/al/vettid-test-harness/tests/utils/api-test-client.ts`
2. `/home/al/vettid-test-harness/tests/utils/api-helpers.ts`
3. `/home/al/vettid-test-harness/tests/api/admin/membership/list-membership-requests.api.spec.ts`
4. `/home/al/vettid-test-harness/.env` (token updated)

## Next Steps

1. Developers to review and address Issue 1 (500 errors)
2. Run full test suite after fixes
3. Generate fresh tokens if running tests after token expiration
