# Fixes Applied - December 2, 2025

Based on the test findings in `TEST_ISSUES.md` and `TEST_RESULTS_2025-12-02.md`, the following fixes have been deployed to the VettID API.

## Latest Fix (Round 3)

### ✅ Pagination Off-by-One Issue - FIXED

**Issue:** `/admin/membership-requests?limit=5` could return more items than requested.

**Root Cause:** The endpoint had no pagination implementation at all.

**Fix:** Added proper pagination support with `limit` and `offset` query parameters:
- `limit`: Number of items to return (1-100, default 100)
- `offset`: Number of items to skip (default 0)
- Response now includes: `{ registrations, total, limit, offset }`

**Commit:** `197e5aa`

---

## Latest Fix (Round 2)

### ✅ 500 Error for Non-Existent Membership Request IDs - FIXED

**Issue:** `POST /admin/membership-requests/{id}/approve` and `POST /admin/membership-requests/{id}/deny` returned 500 instead of 404 for non-existent IDs.

**Root Cause:** The `instanceof NotFoundError` check was failing due to how JavaScript classes work across esbuild module boundaries.

**Fix:** Added fallback error name check: `error instanceof NotFoundError || error?.name === 'NotFoundError'`

**Commit:** `355991e`

**Tests that should now pass:**
- Approve/deny membership with non-existent ID should return 404

---

## Fixes Applied

### 1. ✅ Security Headers Added
All API responses now include:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'`
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`

**Tests that should now pass:**
- SEC-HEADERS-008: Strict-Transport-Security for HTTPS
- SEC-HEADERS-009: Content-Security-Policy for XSS protection
- Partial: SEC-HEADERS-001/002/003 (check for these specific headers)

### 2. ✅ Membership Status Filter Validation
The `/admin/membership-requests` endpoint now validates the `membership_status` query parameter.

- Valid values: `none`, `pending`, `approved`, `denied`
- Invalid values return 400 Bad Request

**Test that should now pass:**
- MEMBERSHIP-LIST-012: Invalid status filter is handled

### 3. ✅ Terms Text Validation
Creating membership terms now properly validates the `terms_text` field:
- Empty string: Returns 400 "terms_text is required"
- Whitespace-only: Returns 400 "terms_text cannot be empty or whitespace-only"
- Too short (<10 chars): Returns 400 "terms_text must be at least 10 characters"

**Tests that should now pass:**
- TERMS-CREATE-004: Rejects empty terms text
- TERMS-CREATE-005: Rejects whitespace-only terms text

### 4. ✅ User Management 404 Error Handling
User management endpoints now return 404 (not 400 or 500) for non-existent users:
- `POST /admin/users/{id}/disable` - Returns 404 "User not found"
- `POST /admin/users/{id}/enable` - Returns 404 "User not found"
- `DELETE /admin/users/{id}/permanent` - Returns 404 "User not found"

**Tests that should now pass:**
- USER-DISABLE-004: Rejects non-existent user ID
- USER-ENABLE-004: Rejects non-existent user ID
- USER-DELETE-004: Rejects non-existent user ID

### 5. ✅ Get Current Terms Already Returns 404
Verified that `/admin/membership-terms/current` already returns 404 when no current terms exist.

**Test status:**
- TERMS-CURRENT-005: Should already pass (was already implemented)

## Issues NOT Fixed (Test Harness Issues)

### Endpoint Path Mismatch
The test harness is calling incorrect endpoint paths:

| Test Client Calls | Correct API Path |
|-------------------|------------------|
| `/admin/memberships` | `/admin/membership-requests` |
| `/admin/memberships/terms` | `/admin/membership-terms` |
| `/admin/membership/requests` | `/admin/membership-requests` |

**Action Required:** Update `tests/utils/api-test-client.ts`:
- Line 283: Change `/admin/memberships` to `/admin/membership-requests`
- Line 274: Change `/admin/memberships/terms` to `/admin/membership-terms`

### Error Response Format
The API uses `{ "message": "..." }` format for errors, not `{ "error": "..." }`.
This is consistent across all endpoints and is intentional.

**Action Required:** Update tests to expect `message` field instead of `error` field.

## Commit Reference

All fixes were deployed in commit: `95cf0b7`
- Repository: mesmerverse/vettid-dev
- Commit message: "Fix test findings: security headers, validation, and error handling"

## Next Steps for Testers

1. Update the test harness to use correct endpoint paths (see above)
2. Update error response assertions to check `message` field
3. Re-run the test suite to verify fixes
4. Create a multi-use invite code for testing: `max_uses: 9999`

## SES Email Verification

New admin users now automatically receive SES verification emails when added via the portal.
This was deployed separately in commit `6941d4b`.
