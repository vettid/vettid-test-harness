# VettID Test Plan

## Executive Summary

This document outlines the comprehensive testing strategy for the VettID application, covering all major features introduced in the recent update including user management, membership system, and enhanced authentication.

## Test Scope

### In Scope
- User registration and approval workflow
- Magic link authentication (with and without PIN)
- Account management (profile, security settings)
- Membership request and management
- Admin user management
- Email delivery and verification
- Security controls (PIN, authentication)

### Out of Scope
- Load/performance testing
- Security penetration testing
- Mobile app testing (web only)
- Browser compatibility (Chromium only initially)

## Test Environment

### Application Under Test
- **URL**: https://account.vettid.dev
- **API**: https://cgccjd4djg.execute-api.us-east-1.amazonaws.com
- **Email Domain**: test.vettid.dev (test emails only)

### Test Infrastructure
- **Framework**: Playwright v1.56+
- **Language**: TypeScript
- **Email Testing**: AWS SES + S3 (vettid-test-emails-449757308783)
- **CI/CD**: GitHub Actions (planned)

## Test Categories

### 1. Functional Testing

#### 1.1 User Registration (P0 - Critical)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| REG-001 | Valid registration with invite code | P0 | ✅ |
| REG-002 | Invalid email format rejection | P0 | ✅ |
| REG-003 | Invalid invite code rejection | P0 | ✅ |
| REG-004 | Duplicate email prevention | P0 | ✅ |
| REG-005 | Required field validation | P1 | ✅ |
| REG-006 | Email confirmation delivery | P0 | ✅ |
| REG-007 | SQL injection in name fields | P0 | 🔲 |
| REG-008 | XSS in name fields | P0 | 🔲 |

#### 1.2 Magic Link Authentication (P0 - Critical)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| AUTH-001 | Request magic link email | P0 | ✅ |
| AUTH-002 | Sign in with valid magic link | P0 | ✅ |
| AUTH-003 | Sign in with magic link + PIN | P0 | ⏭️ |
| AUTH-004 | Reject invalid PIN | P0 | ⏭️ |
| AUTH-005 | Reject expired magic link (15min) | P1 | ⏭️ |
| AUTH-006 | Prevent magic link reuse | P0 | 🔲 |
| AUTH-007 | Rate limiting on magic link requests | P1 | 🔲 |
| AUTH-008 | Magic link for non-existent user | P1 | ✅ |
| AUTH-009 | Sign out functionality | P0 | ⏭️ |

#### 1.3 Account Management (P1 - Important)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| ACC-001 | Display user profile information | P1 | ⏭️ |
| ACC-002 | Navigate between account tabs | P1 | ⏭️ |
| ACC-003 | Enable PIN authentication | P1 | ⏭️ |
| ACC-004 | Disable PIN authentication | P1 | ⏭️ |
| ACC-005 | PIN confirmation mismatch | P1 | ⏭️ |
| ACC-006 | Cancel account | P0 | ⏭️ |
| ACC-007 | Account restoration after cancellation | P2 | 🔲 |

#### 1.4 Membership Management (P1 - Important)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| MEM-001 | Display membership status | P1 | ⏭️ |
| MEM-002 | Download membership terms PDF | P1 | ⏭️ |
| MEM-003 | Require terms acceptance | P0 | ⏭️ |
| MEM-004 | Request membership | P0 | ⏭️ |
| MEM-005 | Admin approve membership | P0 | 🔲 |
| MEM-006 | Admin deny membership | P1 | 🔲 |
| MEM-007 | Display member benefits | P1 | ⏭️ |

#### 1.5 Admin Functionality (P1 - Important)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| ADM-001 | List pending registrations | P0 | 🔲 |
| ADM-002 | Approve registration | P0 | 🔲 |
| ADM-003 | Reject registration | P1 | 🔲 |
| ADM-004 | Create invite code | P0 | 🔲 |
| ADM-005 | Expire invite code | P1 | 🔲 |
| ADM-006 | List all invites | P1 | 🔲 |
| ADM-007 | Add admin user | P0 | 🔲 |
| ADM-008 | Remove admin user | P0 | 🔲 |
| ADM-009 | List membership requests | P1 | 🔲 |
| ADM-010 | Approve/deny membership | P0 | 🔲 |

### 2. Integration Testing

#### 2.1 Email Integration (P0 - Critical)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| EMAIL-001 | Registration confirmation email | P0 | ✅ |
| EMAIL-002 | Magic link email delivery | P0 | ✅ |
| EMAIL-003 | Magic link extraction | P0 | ✅ |
| EMAIL-004 | Registration approval email | P1 | 🔲 |
| EMAIL-005 | Membership request notification | P1 | 🔲 |
| EMAIL-006 | PIN enabled confirmation | P2 | 🔲 |

#### 2.2 AWS Cognito Integration (P0 - Critical)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| COG-001 | User creation in Cognito | P0 | 🔲 |
| COG-002 | Custom auth challenge | P0 | 🔲 |
| COG-003 | Token generation | P0 | 🔲 |
| COG-004 | Token validation | P0 | 🔲 |
| COG-005 | User groups assignment | P0 | 🔲 |

### 3. End-to-End Testing

#### 3.1 User Journeys (P0 - Critical)

| Journey | Description | Priority | Status |
|---------|-------------|----------|--------|
| E2E-001 | New user: Register → Approve → Login → Request Membership | P0 | ⏭️ |
| E2E-002 | Existing user: Login → Enable PIN → Logout → Login with PIN | P1 | 🔲 |
| E2E-003 | Admin: Create Invite → Approve Registration → Grant Membership | P0 | 🔲 |
| E2E-004 | Error recovery: Failed registration → Retry → Success | P1 | ✅ |

### 4. Security Testing

#### 4.1 Authentication & Authorization (P0 - Critical)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| SEC-001 | Unauthorized access to /account | P0 | 🔲 |
| SEC-002 | Unauthorized API calls | P0 | 🔲 |
| SEC-003 | Admin-only endpoints protection | P0 | 🔲 |
| SEC-004 | Token expiration handling | P0 | 🔲 |
| SEC-005 | CSRF protection | P1 | 🔲 |

#### 4.2 Input Validation (P0 - Critical)

| Test Case | Description | Priority | Status |
|-----------|-------------|----------|--------|
| VAL-001 | SQL injection prevention | P0 | 🔲 |
| VAL-002 | XSS prevention | P0 | 🔲 |
| VAL-003 | Email validation | P0 | ✅ |
| VAL-004 | PIN format validation (6 digits) | P0 | 🔲 |

## Test Execution Strategy

### Phase 1: Smoke Tests (Week 1)
- Registration flow (REG-001 to REG-006)
- Magic link authentication (AUTH-001, AUTH-002)
- Email integration (EMAIL-001 to EMAIL-003)

**Goal**: Verify core functionality works

### Phase 2: Feature Tests (Week 2)
- Complete authentication tests
- Account management tests
- Membership tests
- Admin tests (requires admin access setup)

**Goal**: Cover all major features

### Phase 3: Security & Edge Cases (Week 3)
- Security testing
- Error handling
- Edge cases and boundary conditions

**Goal**: Harden the application

### Phase 4: Automation & CI/CD (Week 4)
- Set up GitHub Actions
- Create test data fixtures
- Implement test reporting

**Goal**: Automate testing pipeline

## Test Data Requirements

### Invites
- ✅ Valid invite code (not expired)
- 🔲 Expired invite code
- 🔲 Already-used invite code

### Users
- ✅ New user registrations (auto-generated)
- 🔲 Admin user with credentials
- 🔲 Approved member user
- 🔲 User with PIN enabled

### Emails
- ✅ Automated via `@test.vettid.dev` domain
- ✅ S3 bucket storage and retrieval

## Success Criteria

### Exit Criteria
- ✅ All P0 tests passing
- ✅ 80%+ P1 tests passing
- ✅ Email integration working
- ✅ Test report generated
- ✅ CI/CD pipeline configured

### Metrics
- **Test Coverage**: Target 80% of user flows
- **Pass Rate**: 95%+ for P0 tests
- **Execution Time**: < 5 minutes for full suite
- **Flakiness**: < 2% flaky test rate

## Risk Assessment

### High Risk
- **Email delivery delays**: Mitigation - Use longer timeouts, retry logic
- **Admin approval dependency**: Mitigation - Create API helpers for auto-approval
- **Test data conflicts**: Mitigation - Use unique timestamps in test data

### Medium Risk
- **Cognito rate limiting**: Mitigation - Throttle test execution
- **S3 email storage delays**: Mitigation - Implement polling with backoff

### Low Risk
- **Browser compatibility**: Initially targeting Chromium only
- **Network flakiness**: Playwright has built-in retry mechanisms

## Defect Management

### Severity Levels
- **P0 (Blocker)**: Prevents core functionality, immediate fix required
- **P1 (Critical)**: Major feature broken, fix in next sprint
- **P2 (Major)**: Feature partially working, fix soon
- **P3 (Minor)**: Cosmetic or edge case, fix when convenient

### Reporting
- Create GitHub issues for defects
- Tag with severity and component
- Include test case ID and reproduction steps

## Maintenance Plan

### Weekly
- Review and update test data
- Clear old test emails from S3
- Check for flaky tests

### Monthly
- Update Playwright and dependencies
- Review test coverage
- Add tests for new features

### Quarterly
- Performance baseline testing
- Security audit
- Test strategy review

## Appendix

### Abbreviations
- **P0-P3**: Priority levels (0=highest)
- **✅**: Implemented
- **⏭️**: Requires setup (user auth, etc.)
- **🔲**: Not yet implemented
- **E2E**: End-to-end
- **API**: Application Programming Interface

### References
- [Playwright Documentation](https://playwright.dev)
- [VettID Application Code](/home/al/vettid-dev)
- [Email Testing Infrastructure](/home/al/vettid-test-infra)
- [Test Harness README](./README.md)

---

**Last Updated**: November 21, 2025
**Version**: 1.0
**Owner**: Test Engineering Team
