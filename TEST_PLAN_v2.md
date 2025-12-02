# VettID Comprehensive Test Plan v2

## Overview

This updated test plan reflects the current state of the VettID application and identifies tests needed to achieve comprehensive coverage. The current test suite has **516 tests** across 38 test files. This plan proposes expanding to approximately **650-700 tests** to cover all features thoroughly.

---

## Current Test Coverage Summary

| Category | Files | Test Count |
|----------|-------|------------|
| API - Functional | 5 | 139 |
| API - Security | 7 | 59 |
| API - Validation | 4 | 85 |
| API - Core | 5 | 41 |
| API - Other | 6 | 80 |
| E2E | 10 | 85 |
| Setup | 1 | 3 |
| **Total** | **38** | **516** |

---

## API Endpoints Inventory

### Public Endpoints (No Auth)
| Method | Path | Handler | Current Tests | Needed |
|--------|------|---------|---------------|--------|
| POST | /register | submitRegistration | ~15 | 25-30 |

### Admin Endpoints (Admin Authorizer)
| Method | Path | Handler | Current Tests | Needed |
|--------|------|---------|---------------|--------|
| GET | /admin/registrations | listRegistrations | ~10 | 15-20 |
| POST | /admin/registrations/{id}/approve | approveRegistration | ~8 | 12-15 |
| POST | /admin/registrations/{id}/reject | rejectRegistration | ~5 | 10-12 |
| POST | /admin/invites | createInvite | ~8 | 12-15 |
| GET | /admin/invites | listInvites | ~5 | 8-10 |
| POST | /admin/invites/{code}/expire | expireInvite | ~3 | 8-10 |
| DELETE | /admin/invites/{code} | deleteInvite | ~3 | 8-10 |
| POST | /admin/users/{id}/disable | disableUser | ~5 | 10-12 |
| POST | /admin/users/{id}/enable | enableUser | ~5 | 10-12 |
| DELETE | /admin/users/{id} | deleteUser | ~5 | 10-12 |
| POST | /admin/users/{id}/permanently-delete | permanentlyDeleteUser | ~5 | 10-12 |
| GET | /admin/admins | listAdmins | ~5 | 8-10 |
| POST | /admin/admins | addAdmin | ~5 | 10-12 |
| DELETE | /admin/admins/{email} | removeAdmin | ~5 | 10-12 |
| GET | /admin/memberships | listMembershipRequests | ~5 | 10-12 |
| POST | /admin/memberships/{id}/approve | approveMembership | ~5 | 10-12 |
| POST | /admin/memberships/{id}/deny | denyMembership | ~5 | 10-12 |
| POST | /admin/membership-terms | createMembershipTerms | ~3 | 10-12 |
| GET | /admin/membership-terms | listMembershipTerms | ~3 | 6-8 |
| GET | /admin/membership-terms/current | getCurrentMembershipTerms | ~3 | 6-8 |

### Member Endpoints (Member Authorizer)
| Method | Path | Handler | Current Tests | Needed |
|--------|------|---------|---------------|--------|
| POST | /account/cancel | cancelAccount | ~5 | 10-12 |
| POST | /account/security/pin/enable | enablePin | ~10 | 12-15 |
| POST | /account/security/pin/disable | disablePin | ~8 | 10-12 |
| POST | /account/security/pin/update | updatePin | ~8 | 10-12 |
| GET | /account/security/pin/status | getPinStatus | ~5 | 8-10 |
| POST | /account/membership/request | requestMembership | ~5 | 10-12 |
| GET | /account/membership/status | getMembershipStatus | ~5 | 8-10 |
| GET | /account/membership/terms | getMembershipTerms | ~3 | 6-8 |

---

## Test Categories

### 1. Registration System (Target: 80-90 tests)

#### 1.1 Submit Registration API (`/register`)
**Current: ~15 tests | Target: 25-30 tests**

```
tests/api/registration/
├── submit-registration.api.spec.ts (existing - enhance)
├── registration-validation.api.spec.ts (new)
└── registration-edge-cases.api.spec.ts (new)
```

**Required Tests:**
- [ ] Submit valid registration with valid invite code
- [ ] Submit registration with auto-approve invite (immediate approval)
- [ ] Submit registration with non-auto-approve invite (pending status)
- [ ] Reject duplicate email (same email already registered)
- [ ] Reject duplicate email in Cognito (user exists)
- [ ] Reject invalid invite code (does not exist)
- [ ] Reject expired invite code
- [ ] Reject exhausted invite code (max uses reached)
- [ ] Verify invite usage counter increments
- [ ] Verify audit log entry created
- [ ] Input validation: missing email
- [ ] Input validation: missing first_name
- [ ] Input validation: missing last_name
- [ ] Input validation: missing invite code
- [ ] Input validation: invalid email format
- [ ] Input validation: email with XSS attempt
- [ ] Input validation: SQL injection in fields
- [ ] Input validation: excessive field length (>500 chars)
- [ ] Input validation: special characters handling
- [ ] Input validation: unicode characters
- [ ] Input validation: null bytes rejection
- [ ] Input validation: control characters rejection
- [ ] Response format validation
- [ ] CORS headers present
- [ ] Content-Type validation

#### 1.2 Admin Registration Management
**Current: ~23 tests | Target: 35-40 tests**

```
tests/api/admin/
├── list-registrations.api.spec.ts (enhance)
├── approve-registration.api.spec.ts (enhance)
└── reject-registration.api.spec.ts (enhance)
```

**List Registrations Tests:**
- [ ] List all registrations
- [ ] Filter by status: pending
- [ ] Filter by status: approved
- [ ] Filter by status: rejected
- [ ] Filter by status: deleted
- [ ] Filter by status: disabled
- [ ] Pagination: first page
- [ ] Pagination: subsequent pages
- [ ] Pagination: custom page size
- [ ] Include Cognito group info in response
- [ ] Unauthorized access (no token)
- [ ] Unauthorized access (member token, not admin)

**Approve Registration Tests:**
- [ ] Approve pending registration
- [ ] Verify Cognito user created
- [ ] Verify user added to 'registered' group
- [ ] Verify DynamoDB status updated to 'approved'
- [ ] Verify audit log entry created
- [ ] Verify approved_at timestamp set
- [ ] Verify approved_by admin email captured
- [ ] Reject approval of non-existent registration
- [ ] Reject approval of already approved registration
- [ ] Reject approval of rejected registration
- [ ] Reject approval of deleted registration

**Reject Registration Tests:**
- [ ] Reject pending registration
- [ ] Verify DynamoDB status updated to 'rejected'
- [ ] Verify audit log entry created
- [ ] Reject rejection of non-existent registration
- [ ] Reject rejection of already rejected registration
- [ ] Reject rejection of approved registration

---

### 2. Invite System (Target: 50-60 tests)

#### 2.1 Create Invite
**Current: ~8 tests | Target: 15-18 tests**

```
tests/api/admin/invites/
├── create-invite.api.spec.ts (enhance)
├── list-invites.api.spec.ts (enhance)
├── expire-invite.api.spec.ts (enhance)
└── delete-invite.api.spec.ts (enhance)
```

**Create Invite Tests:**
- [ ] Create invite with auto-generated code
- [ ] Create invite with custom code
- [ ] Create invite with max_uses limit
- [ ] Create invite with expiration date
- [ ] Create invite with auto_approve=true
- [ ] Create invite with auto_approve=false (default)
- [ ] Verify audit log entry created
- [ ] Verify created_by admin email captured
- [ ] Verify created_at timestamp set
- [ ] Reject duplicate custom code
- [ ] Input validation: invalid expiration date
- [ ] Input validation: negative max_uses
- [ ] Input validation: invalid code format
- [ ] Unauthorized access tests

**List Invites Tests:**
- [ ] List all invites
- [ ] Filter by status: active
- [ ] Filter by status: expired
- [ ] Filter by status: exhausted
- [ ] Include usage statistics
- [ ] Pagination support
- [ ] Unauthorized access tests

**Expire Invite Tests:**
- [ ] Expire active invite
- [ ] Verify status changed to 'expired'
- [ ] Verify audit log entry
- [ ] Reject expiring non-existent invite
- [ ] Reject expiring already expired invite
- [ ] Unauthorized access tests

**Delete Invite Tests:**
- [ ] Delete invite
- [ ] Verify invite removed from table
- [ ] Verify audit log entry
- [ ] Reject deleting non-existent invite
- [ ] Unauthorized access tests

---

### 3. User Management (Target: 60-70 tests)

#### 3.1 Disable/Enable User
**Current: ~10 tests | Target: 20-24 tests**

```
tests/api/admin/users/
├── disable-user.api.spec.ts (enhance)
├── enable-user.api.spec.ts (enhance)
├── delete-user.api.spec.ts (enhance)
└── permanently-delete-user.api.spec.ts (enhance)
```

**Disable User Tests:**
- [ ] Disable active user
- [ ] Verify Cognito user disabled
- [ ] Verify DynamoDB status updated to 'disabled'
- [ ] Verify audit log entry
- [ ] Reject disabling non-existent user
- [ ] Reject disabling already disabled user
- [ ] Reject disabling deleted user
- [ ] Unauthorized access tests

**Enable User Tests:**
- [ ] Enable disabled user
- [ ] Verify Cognito user enabled
- [ ] Verify DynamoDB status updated to previous status
- [ ] Verify audit log entry
- [ ] Reject enabling non-existent user
- [ ] Reject enabling non-disabled user
- [ ] Reject enabling deleted user
- [ ] Unauthorized access tests

**Delete User (Soft Delete) Tests:**
- [ ] Soft delete user
- [ ] Verify Cognito user disabled
- [ ] Verify DynamoDB status updated to 'deleted'
- [ ] Verify audit log entry
- [ ] Reject deleting non-existent user
- [ ] Reject deleting already deleted user
- [ ] Unauthorized access tests

**Permanently Delete User Tests:**
- [ ] Permanently delete user
- [ ] Verify Cognito user deleted
- [ ] Verify DynamoDB record removed or marked
- [ ] Verify audit log entry
- [ ] Reject permanently deleting non-existent user
- [ ] Unauthorized access tests

---

### 4. Admin User Management (Target: 35-40 tests)

```
tests/api/admin/admin-users/
├── list-admins.api.spec.ts (enhance)
├── add-admin.api.spec.ts (enhance)
└── remove-admin.api.spec.ts (enhance)
```

**List Admins Tests:**
- [ ] List all admin users
- [ ] Verify response includes admin group members
- [ ] Pagination support
- [ ] Unauthorized access (no token)
- [ ] Unauthorized access (member token)

**Add Admin Tests:**
- [ ] Add new admin user
- [ ] Verify Cognito user created in admin pool
- [ ] Verify user added to 'admin' group
- [ ] Verify audit log entry
- [ ] Input validation: missing email
- [ ] Input validation: missing first_name
- [ ] Input validation: missing last_name
- [ ] Input validation: invalid email format
- [ ] Reject duplicate admin email
- [ ] Unauthorized access tests

**Remove Admin Tests:**
- [ ] Remove admin user
- [ ] Verify user removed from 'admin' group
- [ ] Verify Cognito user deleted
- [ ] Verify audit log entry
- [ ] Reject removing non-existent admin
- [ ] Reject self-removal (prevent locking out)
- [ ] Unauthorized access tests

---

### 5. PIN Security System (Target: 50-60 tests)

```
tests/api/member/security/
├── enable-pin.api.spec.ts (enhance)
├── disable-pin.api.spec.ts (enhance)
├── update-pin.api.spec.ts (enhance)
└── pin-status.api.spec.ts (enhance)
```

**Enable PIN Tests:**
- [ ] Enable PIN with valid 4-digit PIN
- [ ] Enable PIN with valid 5-digit PIN
- [ ] Enable PIN with valid 6-digit PIN
- [ ] Verify PIN hash stored (SHA-256)
- [ ] Verify pin_enabled set to true
- [ ] Verify pin_updated_at timestamp set
- [ ] Verify audit log entry
- [ ] Reject PIN shorter than 4 digits
- [ ] Reject PIN longer than 6 digits
- [ ] Reject PIN with non-numeric characters
- [ ] Reject PIN with special characters
- [ ] Reject enabling PIN when already enabled
- [ ] Unauthorized access tests

**Disable PIN Tests:**
- [ ] Disable enabled PIN
- [ ] Verify pin_hash cleared
- [ ] Verify pin_enabled set to false
- [ ] Verify audit log entry
- [ ] Reject disabling when PIN not enabled
- [ ] Unauthorized access tests

**Update PIN Tests:**
- [ ] Update PIN when enabled
- [ ] Verify new PIN hash stored
- [ ] Verify pin_updated_at timestamp updated
- [ ] Verify audit log entry
- [ ] Reject update when PIN not enabled
- [ ] Input validation tests (same as enable)
- [ ] Unauthorized access tests

**Get PIN Status Tests:**
- [ ] Get status when PIN enabled
- [ ] Get status when PIN disabled
- [ ] Response format validation
- [ ] Unauthorized access tests

---

### 6. Membership System (Target: 70-80 tests)

#### 6.1 Member Endpoints

```
tests/api/member/membership/
├── request-membership.api.spec.ts (enhance)
├── membership-status.api.spec.ts (enhance)
└── membership-terms.api.spec.ts (enhance)
```

**Request Membership Tests:**
- [ ] Request membership with valid terms acceptance
- [ ] Verify membership_status set to 'pending'
- [ ] Verify terms_version_id recorded
- [ ] Verify terms_accepted_at timestamp set
- [ ] Verify membership_requested_at timestamp set
- [ ] Verify audit log entry
- [ ] Reject request without terms_version_id
- [ ] Reject request with invalid terms_version_id
- [ ] Reject request when already pending
- [ ] Reject request when already approved
- [ ] Reject request when denied (allow re-request?)
- [ ] Unauthorized access tests

**Get Membership Status Tests:**
- [ ] Get status: none (no request made)
- [ ] Get status: pending
- [ ] Get status: approved
- [ ] Get status: denied
- [ ] Response format validation
- [ ] Unauthorized access tests

**Get Membership Terms Tests:**
- [ ] Get current terms
- [ ] Verify text content returned
- [ ] Verify PDF URL returned (presigned S3 URL)
- [ ] Handle case when no terms exist
- [ ] Response format validation
- [ ] Unauthorized access tests

#### 6.2 Admin Membership Endpoints

```
tests/api/admin/membership/
├── list-membership-requests.api.spec.ts (new)
├── approve-membership.api.spec.ts (enhance)
├── deny-membership.api.spec.ts (enhance)
├── create-terms.api.spec.ts (enhance)
├── list-terms.api.spec.ts (new)
└── get-current-terms.api.spec.ts (new)
```

**List Membership Requests Tests:**
- [ ] List all membership requests
- [ ] Filter by status: pending
- [ ] Filter by status: approved
- [ ] Filter by status: denied
- [ ] Pagination support
- [ ] Unauthorized access tests

**Approve Membership Tests:**
- [ ] Approve pending membership request
- [ ] Verify membership_status set to 'approved'
- [ ] Verify user added to 'member' Cognito group
- [ ] Verify audit log entry
- [ ] Reject approving non-existent request
- [ ] Reject approving already approved request
- [ ] Reject approving denied request
- [ ] Unauthorized access tests

**Deny Membership Tests:**
- [ ] Deny pending membership request
- [ ] Verify membership_status set to 'denied'
- [ ] Verify audit log entry
- [ ] Reject denying non-existent request
- [ ] Reject denying already denied request
- [ ] Reject denying approved request
- [ ] Unauthorized access tests

**Create Membership Terms Tests:**
- [ ] Create new terms version
- [ ] Verify PDF generated with VettID logo
- [ ] Verify PDF uploaded to S3
- [ ] Verify previous terms marked is_current=false
- [ ] Verify new terms marked is_current=true
- [ ] Verify version_id generated
- [ ] Verify created_at timestamp
- [ ] Verify created_by admin email
- [ ] Input validation: missing text
- [ ] Input validation: empty text
- [ ] Input validation: excessive text length
- [ ] Unauthorized access tests

**List Membership Terms Tests:**
- [ ] List all terms versions
- [ ] Verify sorted by created_at
- [ ] Include is_current flag
- [ ] Pagination support
- [ ] Unauthorized access tests

**Get Current Membership Terms Tests:**
- [ ] Get current (is_current=true) terms
- [ ] Verify text content
- [ ] Verify PDF URL
- [ ] Handle case when no current terms
- [ ] Unauthorized access tests

---

### 7. Account Cancellation (Target: 20-25 tests)

```
tests/api/member/account/
├── cancel-account.api.spec.ts (enhance)
└── account-lifecycle.api.spec.ts (new)
```

**Cancel Account Tests:**
- [ ] Cancel account
- [ ] Verify DynamoDB status set to 'deleted'
- [ ] Verify Cognito user disabled
- [ ] Verify audit log entry
- [ ] Verify 7-day grace period messaging
- [ ] Reject cancellation of already deleted account
- [ ] Unauthorized access tests

**Account Lifecycle Tests (Scheduled Cleanup):**
- [ ] Verify accounts deleted after 7 days
- [ ] Verify Cognito user permanently deleted
- [ ] Verify DynamoDB record handled
- [ ] Verify accounts within 7 days NOT deleted

---

### 8. Authentication Flow (Target: 40-50 tests)

```
tests/api/auth/
├── magic-link-generation.api.spec.ts (enhance)
├── magic-link-verification.api.spec.ts (enhance)
├── pin-verification.api.spec.ts (new)
└── rate-limiting.api.spec.ts (enhance)
```

**Magic Link Generation Tests:**
- [ ] Generate magic link for valid user
- [ ] Verify email sent via SES
- [ ] Verify token stored in MagicLinkTokens table
- [ ] Verify token expiration (15 minutes)
- [ ] Token reuse within 60-second window
- [ ] Reject request for non-existent user
- [ ] Reject request for disabled user
- [ ] Rate limiting: under limit (100/hour)
- [ ] Rate limiting: at limit
- [ ] Rate limiting: over limit blocked
- [ ] Rate limiting: whitelisted email bypass

**Magic Link Verification Tests:**
- [ ] Verify valid token
- [ ] Reject expired token
- [ ] Reject invalid token
- [ ] Reject already-used token
- [ ] Token consumed after verification

**PIN Verification During Auth Tests:**
- [ ] Auth with valid PIN when enabled
- [ ] Auth rejected with invalid PIN
- [ ] Auth rejected with missing PIN when enabled
- [ ] Auth succeeds without PIN when disabled
- [ ] Failed login CloudWatch metric emitted

---

### 9. Security Tests (Target: 80-100 tests)

```
tests/api/security/
├── input-validation.spec.ts (enhance)
├── unauthorized-access.spec.ts (enhance)
├── rate-limiting.spec.ts (enhance)
├── rate-limit-bypass.spec.ts (existing)
├── timing-attacks.spec.ts (existing)
├── security-headers.spec.ts (enhance)
├── enhanced-error-validation.spec.ts (existing)
├── xss-prevention.spec.ts (new)
├── injection-prevention.spec.ts (new)
└── authorization.spec.ts (new)
```

**Input Validation Tests:**
- [ ] Email validation (RFC 5322)
- [ ] Null byte rejection
- [ ] Control character rejection
- [ ] HTML/script character sanitization
- [ ] Field length limits (500 chars)
- [ ] Unicode handling
- [ ] Empty string handling
- [ ] Whitespace-only handling

**XSS Prevention Tests:**
- [ ] Script tags in input fields
- [ ] Event handlers in input
- [ ] JavaScript URLs
- [ ] Data URIs
- [ ] SVG-based XSS

**Injection Prevention Tests:**
- [ ] SQL injection attempts
- [ ] NoSQL injection attempts
- [ ] Command injection attempts
- [ ] LDAP injection attempts

**Authorization Tests:**
- [ ] Admin endpoints reject member tokens
- [ ] Member endpoints reject admin tokens
- [ ] All protected endpoints reject no token
- [ ] All protected endpoints reject invalid token
- [ ] All protected endpoints reject expired token
- [ ] Cross-user access prevention

**Security Headers Tests:**
- [ ] Content-Security-Policy header
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy header
- [ ] X-XSS-Protection header
- [ ] Strict-Transport-Security (HSTS)

**Rate Limiting Tests:**
- [ ] WAF rate limit (100 req/5min per IP)
- [ ] API Gateway throttling (200 burst, 100 RPS)
- [ ] Magic link rate limit (100/hour per email)

---

### 10. Error Handling & Edge Cases (Target: 50-60 tests)

```
tests/api/error-handling/
├── error-responses.spec.ts (enhance)
├── edge-cases.spec.ts (enhance)
└── boundary-conditions.spec.ts (enhance)
```

**Error Response Tests:**
- [ ] 400 Bad Request format consistency
- [ ] 401 Unauthorized format consistency
- [ ] 403 Forbidden format consistency
- [ ] 404 Not Found format consistency
- [ ] 500 Internal Server Error handling
- [ ] Error messages don't leak sensitive info
- [ ] Generic messages for security-sensitive errors

**Edge Cases:**
- [ ] Empty request body
- [ ] Malformed JSON
- [ ] Wrong Content-Type
- [ ] Missing required headers
- [ ] Invalid path parameters
- [ ] Non-existent endpoints return 404
- [ ] OPTIONS preflight requests work

---

### 11. E2E Tests (Target: 100-120 tests)

```
tests/e2e/
├── registration/
│   ├── registration.spec.ts (enhance)
│   └── registration-journey.spec.ts (new)
├── auth/
│   ├── magic-link.spec.ts (enhance)
│   └── pin-auth.spec.ts (new)
├── account/
│   ├── account-management.spec.ts (enhance)
│   └── account-cancellation.spec.ts (new)
├── membership/
│   ├── membership.spec.ts (enhance)
│   └── membership-terms.spec.ts (new)
├── admin/
│   └── admin-site-ui.spec.ts (enhance)
├── ui/
│   ├── main/
│   │   ├── main-site-ui.spec.ts (enhance)
│   │   └── signin-ui.spec.ts (enhance)
│   └── responsive/
│       └── responsive-design.spec.ts (new)
├── full-journey.spec.ts (enhance)
├── complete-journey.spec.ts (existing)
└── member-auth-full.spec.ts (existing)
```

**Registration E2E Tests:**
- [ ] Complete registration form submission
- [ ] Form validation errors displayed
- [ ] Success message shown
- [ ] Invalid invite code error
- [ ] Duplicate email error
- [ ] UI responsiveness

**Magic Link E2E Tests:**
- [ ] Request magic link
- [ ] Email received (via EmailRetriever)
- [ ] Magic link authentication flow
- [ ] Token expiration handling
- [ ] Invalid token handling

**PIN Authentication E2E Tests:**
- [ ] Enable PIN via UI
- [ ] Sign in with PIN
- [ ] Invalid PIN error
- [ ] Disable PIN via UI
- [ ] Update PIN via UI

**Account E2E Tests:**
- [ ] View account details
- [ ] View membership status
- [ ] Request membership (accept terms)
- [ ] Cancel account with confirmation
- [ ] Tab navigation

**Admin Dashboard E2E Tests:**
- [ ] Login to admin portal
- [ ] View pending registrations
- [ ] Approve/reject registration
- [ ] Bulk operations
- [ ] Create invite
- [ ] Manage membership requests
- [ ] Create membership terms
- [ ] Add/remove admin

---

### 12. Performance Tests (Target: 15-20 tests)

```
tests/api/performance/
├── api-performance-baseline.spec.ts (enhance)
├── pagination-performance.spec.ts (new)
└── concurrent-requests.spec.ts (new)
```

**Performance Tests:**
- [ ] API response time < 1s baseline
- [ ] List endpoints with pagination handle large datasets
- [ ] Concurrent request handling
- [ ] No memory leaks in extended operations

---

## New Test Files Required

Based on analysis, the following new test files should be created:

### API Tests (New Files)
1. `tests/api/registration/registration-validation.api.spec.ts`
2. `tests/api/registration/registration-edge-cases.api.spec.ts`
3. `tests/api/admin/membership/list-membership-requests.api.spec.ts`
4. `tests/api/admin/membership/list-terms.api.spec.ts`
5. `tests/api/admin/membership/get-current-terms.api.spec.ts`
6. `tests/api/member/account/account-lifecycle.api.spec.ts`
7. `tests/api/auth/pin-verification.api.spec.ts`
8. `tests/api/security/xss-prevention.spec.ts`
9. `tests/api/security/injection-prevention.spec.ts`
10. `tests/api/security/authorization.spec.ts`
11. `tests/api/performance/pagination-performance.spec.ts`
12. `tests/api/performance/concurrent-requests.spec.ts`

### E2E Tests (New Files)
1. `tests/e2e/registration/registration-journey.spec.ts`
2. `tests/e2e/auth/pin-auth.spec.ts`
3. `tests/e2e/account/account-cancellation.spec.ts`
4. `tests/e2e/membership/membership-terms.spec.ts`
5. `tests/e2e/ui/responsive/responsive-design.spec.ts`

---

## Test Utilities Required

Ensure the following utilities are available/enhanced:

1. **APITestClient** - HTTP client with auth, timing, assertions
2. **AuthHelpers** - Auth flow utilities (magic link, PIN)
3. **EmailRetriever** - S3 email retrieval for magic links
4. **TestDataGenerator** - Factories for test data
5. **AdminTestClient** - Admin-specific API operations
6. **MemberTestClient** - Member-specific API operations
7. **CleanupHelpers** - Test data cleanup utilities

---

## Priority Order for Implementation

### Phase 1: Critical Path (High Priority)
1. Registration system complete coverage
2. Authentication flow with PIN
3. Membership system
4. Security tests (authorization, input validation)

### Phase 2: Admin Operations (Medium Priority)
1. User management (disable/enable/delete)
2. Invite management
3. Admin user management
4. Membership terms management

### Phase 3: E2E & Quality (Standard Priority)
1. Complete E2E journeys
2. Error handling consistency
3. Performance baseline
4. UI/UX tests

---

## Test Execution Configuration

```javascript
// playwright.config.ts recommendations
{
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results.json' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://vettid.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testMatch: /tests\/api\/.*.spec.ts/,
    },
    {
      name: 'e2e',
      testMatch: /tests\/e2e\/.*.spec.ts/,
    },
    {
      name: 'security',
      testMatch: /tests\/api\/security\/.*.spec.ts/,
    }
  ]
}
```

---

## Summary

| Category | Current | Target | Delta |
|----------|---------|--------|-------|
| Registration | 15 | 65 | +50 |
| Invites | 16 | 50 | +34 |
| User Management | 29 | 60 | +31 |
| Admin Users | 32 | 40 | +8 |
| PIN Security | 35 | 55 | +20 |
| Membership | 31 | 75 | +44 |
| Account | 11 | 25 | +14 |
| Authentication | 19 | 45 | +26 |
| Security | 59 | 90 | +31 |
| Error/Edge | 71 | 60 | -11 |
| E2E | 85 | 110 | +25 |
| Performance | 10 | 20 | +10 |
| **Total** | **516** | **695** | **+179** |

---

## Approval Checklist

Please review and approve:

- [ ] Overall test plan structure
- [ ] Test categories and priorities
- [ ] Target test counts per category
- [ ] New test files to create
- [ ] Phased implementation approach
- [ ] Test utility requirements

Once approved, I will begin implementing the tests in the specified order.
