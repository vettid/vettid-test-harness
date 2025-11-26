import { test, expect } from '@playwright/test';
import { APITestClient } from '../../utils/api-test-client';
import { testDataGenerator } from '../../utils/test-data-generator';

/**
 * Input Boundary Testing Suite
 * Tests edge cases and boundary conditions for input validation
 *
 * Validates that the API properly handles:
 * - Empty strings
 * - Maximum length strings
 * - Special characters
 * - Unicode characters
 * - Numeric boundaries
 * - Whitespace handling
 */

let apiClient: APITestClient;

test.beforeEach(async ({ request }) => {
  apiClient = new APITestClient(request);
});

test.describe('Input Boundary Testing', () => {

  test.describe('String Length Boundaries', () => {

    test('BOUND-001: Empty string handling for first_name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect(response.status).toBe(400);
      console.log('✓ Empty first_name rejected with 400');
    });

    test('BOUND-002: Single character first_name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'A',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      // Should be accepted (minimum valid) or rejected based on policy
      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Single character first_name: ${response.status}`);
    });

    test('BOUND-003: Very long first_name (1000 chars)', async () => {
      const longName = 'A'.repeat(1000);
      const response = await apiClient.submitRegistration({
        first_name: longName,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      // Should either accept or reject gracefully (no crash)
      expect([200, 201, 400, 413]).toContain(response.status);
      expect(response.status).not.toBe(500);
      console.log(`✓ Very long first_name handled: ${response.status}`);
    });

    test('BOUND-004: Maximum reasonable length (255 chars)', async () => {
      const maxName = 'A'.repeat(255);
      const response = await apiClient.submitRegistration({
        first_name: maxName,
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      expect(response.status).not.toBe(500);
      console.log(`✓ Max length first_name: ${response.status}`);
    });

  });

  test.describe('Email Boundary Cases', () => {

    test('BOUND-005: Minimum valid email format', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: 'a@b.co',
        invite_code: 'TEST-CODE'
      });

      // Minimum format - might be accepted or rejected
      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Minimum email format: ${response.status}`);
    });

    test('BOUND-006: Very long email address', async () => {
      const longLocal = 'a'.repeat(64); // RFC max local part
      const longEmail = `${longLocal}@test.vettid.dev`;

      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: longEmail,
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Long email (${longEmail.length} chars): ${response.status}`);
    });

    test('BOUND-007: Email with plus addressing', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `test+tag-${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Plus addressed email: ${response.status}`);
    });

    test('BOUND-008: Email with dots in local part', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `test.user.name.${Date.now()}@test.vettid.dev`,
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Dotted email: ${response.status}`);
    });

    test('BOUND-009: Email with numbers', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: `test123456789@test.vettid.dev`,
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Numeric email: ${response.status}`);
    });

  });

  test.describe('Special Character Handling', () => {

    test('BOUND-010: Name with hyphen', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Mary-Jane',
        last_name: 'Watson-Parker',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Hyphenated name: ${response.status}`);
    });

    test('BOUND-011: Name with apostrophe', async () => {
      const response = await apiClient.submitRegistration({
        first_name: "O'Brien",
        last_name: "D'Angelo",
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Apostrophe name: ${response.status}`);
    });

    test('BOUND-012: Name with spaces', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Mary Jane',
        last_name: 'Van Der Berg',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Spaced name: ${response.status}`);
    });

    test('BOUND-013: Name with period', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Dr.',
        last_name: 'Smith Jr.',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Period in name: ${response.status}`);
    });

  });

  test.describe('Unicode and International Characters', () => {

    test('BOUND-014: Name with accented characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'José',
        last_name: 'García',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Accented characters: ${response.status}`);
    });

    test('BOUND-015: Name with umlauts', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Müller',
        last_name: 'Schröder',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Umlauts: ${response.status}`);
    });

    test('BOUND-016: Name with Chinese characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '李',
        last_name: '明',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Chinese characters: ${response.status}`);
    });

    test('BOUND-017: Name with Arabic characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'محمد',
        last_name: 'أحمد',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Arabic characters: ${response.status}`);
    });

    test('BOUND-018: Name with Cyrillic characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Иван',
        last_name: 'Петров',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Cyrillic characters: ${response.status}`);
    });

    test('BOUND-019: Name with emoji', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test 😀',
        last_name: 'User 🎉',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      // Emoji might be rejected
      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Emoji in name: ${response.status}`);
    });

  });

  test.describe('Whitespace Handling', () => {

    test('BOUND-020: Leading whitespace in name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '  John',
        last_name: '  Smith',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Leading whitespace: ${response.status}`);
    });

    test('BOUND-021: Trailing whitespace in name', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'John  ',
        last_name: 'Smith  ',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Trailing whitespace: ${response.status}`);
    });

    test('BOUND-022: Only whitespace', async () => {
      const response = await apiClient.submitRegistration({
        first_name: '   ',
        last_name: '   ',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect(response.status).toBe(400);
      console.log('✓ Whitespace-only rejected with 400');
    });

    test('BOUND-023: Tab characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'John\tSmith',
        last_name: 'User\tName',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Tab characters: ${response.status}`);
    });

    test('BOUND-024: Newline characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'John\nSmith',
        last_name: 'User\nName',
        email: testDataGenerator.generateEmail(),
        invite_code: 'TEST-CODE'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Newline characters: ${response.status}`);
    });

  });

  test.describe('Invite Code Boundaries', () => {

    test('BOUND-025: Empty invite code', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: ''
      });

      expect(response.status).toBe(400);
      console.log('✓ Empty invite code rejected');
    });

    test('BOUND-026: Very long invite code', async () => {
      const longCode = 'A'.repeat(500);
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: longCode
      });

      expect([400, 413]).toContain(response.status);
      expect(response.status).not.toBe(500);
      console.log(`✓ Long invite code: ${response.status}`);
    });

    test('BOUND-027: Invite code with special characters', async () => {
      const response = await apiClient.submitRegistration({
        first_name: 'Test',
        last_name: 'User',
        email: testDataGenerator.generateEmail(),
        invite_code: 'CODE-123_ABC!@#'
      });

      expect([200, 201, 400]).toContain(response.status);
      console.log(`✓ Special char invite code: ${response.status}`);
    });

  });

  test.describe('Null and Undefined Handling', () => {

    test('BOUND-028: Missing first_name field', async () => {
      const response = await apiClient.request('POST', '/register', {
        body: JSON.stringify({
          last_name: 'User',
          email: testDataGenerator.generateEmail(),
          invite_code: 'TEST-CODE'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(400);
      console.log('✓ Missing first_name rejected');
    });

    test('BOUND-029: Null values', async () => {
      const response = await apiClient.request('POST', '/register', {
        body: JSON.stringify({
          first_name: null,
          last_name: null,
          email: testDataGenerator.generateEmail(),
          invite_code: 'TEST-CODE'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(400);
      console.log('✓ Null values rejected');
    });

    test('BOUND-030: Extra unexpected fields', async () => {
      const response = await apiClient.request('POST', '/register', {
        body: JSON.stringify({
          first_name: 'Test',
          last_name: 'User',
          email: testDataGenerator.generateEmail(),
          invite_code: 'TEST-CODE',
          extra_field: 'should be ignored',
          another_field: 12345,
          nested: { field: 'value' }
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      // Should handle gracefully (ignore extra fields)
      expect([200, 201, 400]).toContain(response.status);
      expect(response.status).not.toBe(500);
      console.log(`✓ Extra fields handled: ${response.status}`);
    });

  });

});
