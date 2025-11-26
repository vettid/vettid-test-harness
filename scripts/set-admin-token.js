#!/usr/bin/env node

/**
 * Admin Token Setup Helper
 *
 * This script helps you extract and configure the admin authentication token
 * for running admin endpoint tests.
 *
 * Usage:
 *   node scripts/set-admin-token.js
 *   node scripts/set-admin-token.js <token>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ADMIN_PANEL_URL = 'https://admin.vettid.dev/admin.html';
const API_URL = process.env.API_URL || 'https://cgccjd4djg.execute-api.us-east-1.amazonaws.com';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateJWT(token) {
  // Basic JWT format validation
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is empty or invalid type' };
  }

  // Trim whitespace
  token = token.trim();

  // Check if it starts with eyJ (base64 encoded JSON)
  if (!token.startsWith('eyJ')) {
    return { valid: false, error: 'Token does not start with "eyJ" (not a JWT)' };
  }

  // Check if it has 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: `Token has ${parts.length} parts, expected 3` };
  }

  // Check token length (reasonable range)
  if (token.length < 200 || token.length > 5000) {
    return { valid: false, error: `Token length ${token.length} is suspicious (expected 200-5000)` };
  }

  // Try to decode the payload
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    // Check expiration
    if (payload.exp) {
      const expiresAt = new Date(payload.exp * 1000);
      const now = new Date();

      if (expiresAt < now) {
        return {
          valid: false,
          error: `Token expired at ${expiresAt.toISOString()}`,
          payload
        };
      }

      // Check if expires soon (within 5 minutes)
      const fiveMinutes = 5 * 60 * 1000;
      if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
        log(`⚠️  Warning: Token expires soon (${expiresAt.toISOString()})`, 'yellow');
      }
    }

    // Check if it's an admin token
    const groups = payload['cognito:groups'] || [];
    if (!groups.includes('admin')) {
      return {
        valid: false,
        error: 'Token does not have "admin" group',
        payload
      };
    }

    return { valid: true, payload, token };
  } catch (error) {
    return { valid: false, error: `Failed to decode token: ${error.message}` };
  }
}

function testToken(token) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'cgccjd4djg.execute-api.us-east-1.amazonaws.com',
      path: '/admin/registrations',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, status: res.statusCode });
        } else {
          resolve({
            success: false,
            status: res.statusCode,
            error: data
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.end();
  });
}

function updateEnvFile(token) {
  let envContent = '';

  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf8');
  }

  // Check if ADMIN_TOKEN already exists
  if (envContent.includes('ADMIN_TOKEN=')) {
    // Replace existing token
    envContent = envContent.replace(
      /ADMIN_TOKEN=.*/,
      `ADMIN_TOKEN=${token}`
    );
  } else {
    // Add new token
    envContent += `\n# Admin Authentication\nADMIN_TOKEN=${token}\n`;
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
  log('✅ Updated .env file with ADMIN_TOKEN', 'green');
}

function showInstructions() {
  log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║         VettID Admin Token Setup Helper                      ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════════╝\n', 'cyan');

  log('📋 To get your admin token, follow these steps:\n', 'bright');

  log('1️⃣  Open the admin panel:', 'blue');
  log(`   ${ADMIN_PANEL_URL}\n`);

  log('2️⃣  Sign in with your admin credentials\n', 'blue');

  log('3️⃣  Open browser Developer Tools (F12)\n', 'blue');

  log('4️⃣  Go to the Console tab and run:', 'blue');
  log('   copy(JSON.parse(localStorage.getItem(\'tokens\')).id_token)', 'yellow');
  log('   (This copies the token to your clipboard)\n');

  log('5️⃣  Run this script again with the token:', 'blue');
  log('   node scripts/set-admin-token.js <paste-token-here>', 'yellow');
  log('   OR just paste it when prompted:\n');

  log('💡 Token format:', 'cyan');
  log('   - Starts with "eyJ"');
  log('   - ~800-2000 characters long');
  log('   - Three parts separated by dots\n');
}

async function main() {
  const args = process.argv.slice(2);
  let token = args[0];

  // If no token provided, show instructions and prompt
  if (!token) {
    showInstructions();

    // Check if running interactively
    if (process.stdin.isTTY) {
      log('📝 Paste your admin token here (or press Ctrl+C to exit):', 'bright');

      // Read from stdin
      process.stdin.setEncoding('utf8');
      let input = '';

      for await (const chunk of process.stdin) {
        input += chunk;
        // If we have enough characters that look like a JWT, process it
        if (input.length > 100 && input.includes('.')) {
          token = input.trim();
          break;
        }
      }
    } else {
      process.exit(0);
    }
  }

  if (!token) {
    log('❌ No token provided', 'red');
    process.exit(1);
  }

  log('\n🔍 Validating token format...', 'cyan');
  const validation = validateJWT(token);

  if (!validation.valid) {
    log(`❌ Invalid token: ${validation.error}`, 'red');
    if (validation.payload) {
      log('\n📋 Token payload:', 'yellow');
      console.log(JSON.stringify(validation.payload, null, 2));
    }
    process.exit(1);
  }

  log('✅ Token format is valid', 'green');

  if (validation.payload) {
    log('\n📋 Token details:', 'cyan');
    log(`   User: ${validation.payload.email || validation.payload.username || 'unknown'}`);
    log(`   Groups: ${(validation.payload['cognito:groups'] || []).join(', ')}`);
    if (validation.payload.exp) {
      const expiresAt = new Date(validation.payload.exp * 1000);
      log(`   Expires: ${expiresAt.toLocaleString()}`);
    }
  }

  log('\n🧪 Testing token against API...', 'cyan');
  const testResult = await testToken(validation.token);

  if (!testResult.success) {
    log(`❌ Token test failed (${testResult.status}): ${testResult.error}`, 'red');
    log('\n💡 The token format is valid, but the API rejected it.', 'yellow');
    log('   This could mean:', 'yellow');
    log('   - Token has expired', 'yellow');
    log('   - Token is for wrong environment', 'yellow');
    log('   - User does not have admin permissions', 'yellow');
    process.exit(1);
  }

  log('✅ Token works! API returned 200 OK', 'green');

  log('\n💾 Updating .env file...', 'cyan');
  updateEnvFile(validation.token);

  log('\n╔═══════════════════════════════════════════════════════════════╗', 'green');
  log('║                 ✅ Setup Complete!                            ║', 'green');
  log('╚═══════════════════════════════════════════════════════════════╝\n', 'green');

  log('You can now run admin tests:', 'bright');
  log('  npm test -- tests/api/admin-registrations.api.spec.ts', 'yellow');
  log('  npm test -- tests/api/admin-invites.api.spec.ts\n', 'yellow');
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});

main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
