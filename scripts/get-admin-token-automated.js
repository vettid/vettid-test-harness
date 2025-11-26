#!/usr/bin/env node

/**
 * Automated Admin Token Acquisition
 *
 * This script uses Playwright to automatically extract the admin token
 * from the admin panel after authentication.
 *
 * Usage:
 *   node scripts/get-admin-token-automated.js
 *
 * Prerequisites:
 *   - Already logged into admin panel (cookies valid)
 *   OR
 *   - Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ADMIN_PANEL_URL = 'https://admin.vettid.dev/admin.html';

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

async function main() {
  log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║      Automated Admin Token Acquisition (Playwright)          ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════════╝\n', 'cyan');

  // Import Playwright
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (error) {
    log('❌ Playwright not found. Installing...', 'red');
    const { execSync } = require('child_process');
    try {
      execSync('npm install playwright', { stdio: 'inherit' });
      ({ chromium } = require('playwright'));
      log('✅ Playwright installed', 'green');
    } catch (installError) {
      log('❌ Failed to install Playwright', 'red');
      log('   Please run: npm install playwright', 'yellow');
      process.exit(1);
    }
  }

  log('🚀 Launching browser...', 'cyan');

  // Launch browser with persistent context to reuse cookies
  const userDataDir = path.join(__dirname, '..', '.playwright-admin');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Keep visible so user can see what's happening
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    log(`🌐 Navigating to ${ADMIN_PANEL_URL}...`, 'cyan');
    await page.goto(ADMIN_PANEL_URL, { waitUntil: 'networkidle' });

    // Wait a moment for the page to load
    await page.waitForTimeout(2000);

    // Check if we need to sign in
    const signInButton = await page.$('button:has-text("Sign in")');

    if (signInButton) {
      log('🔐 Not authenticated. Need to sign in...', 'yellow');

      // Check if credentials are provided
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (adminEmail && adminPassword) {
        log('🔑 Using provided credentials...', 'cyan');

        // Click sign in button
        await signInButton.click();
        await page.waitForTimeout(2000);

        // Wait for Cognito hosted UI
        await page.waitForSelector('input[name="username"]', { timeout: 10000 });

        // Fill in credentials
        await page.fill('input[name="username"]', adminEmail);
        await page.fill('input[name="password"]', adminPassword);

        // Click sign in
        await page.click('input[type="submit"]');

        log('⏳ Waiting for redirect...', 'cyan');
        await page.waitForURL(ADMIN_PANEL_URL + '*', { timeout: 30000 });
        await page.waitForTimeout(2000);
      } else {
        log('⏳ Please sign in manually in the browser window...', 'yellow');
        log('   Waiting for authentication...', 'yellow');

        // Wait for user to sign in (token appears in localStorage)
        await page.waitForFunction(() => {
          const tokens = localStorage.getItem('tokens');
          return tokens && JSON.parse(tokens).id_token;
        }, { timeout: 120000 }); // 2 minute timeout
      }
    }

    log('✅ Authenticated!', 'green');
    log('🔍 Extracting token from localStorage...', 'cyan');

    // Extract token from localStorage
    const token = await page.evaluate(() => {
      const tokens = localStorage.getItem('tokens');
      if (!tokens) return null;

      try {
        const parsed = JSON.parse(tokens);
        return parsed.id_token;
      } catch (error) {
        return null;
      }
    });

    if (!token) {
      log('❌ No token found in localStorage', 'red');
      process.exit(1);
    }

    // Validate token format
    if (!token.startsWith('eyJ') || token.split('.').length !== 3) {
      log('❌ Invalid token format', 'red');
      process.exit(1);
    }

    log('✅ Token extracted successfully', 'green');

    // Decode and display token info
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      log('\n📋 Token details:', 'cyan');
      log(`   User: ${payload.email || payload.username || 'unknown'}`);
      log(`   Groups: ${(payload['cognito:groups'] || []).join(', ')}`);
      if (payload.exp) {
        const expiresAt = new Date(payload.exp * 1000);
        log(`   Expires: ${expiresAt.toLocaleString()}`);
      }
    } catch (error) {
      // Ignore decode errors
    }

    log('\n💾 Updating .env file...', 'cyan');
    updateEnvFile(token);

    log('\n╔═══════════════════════════════════════════════════════════════╗', 'green');
    log('║                 ✅ Token Acquired!                            ║', 'green');
    log('╚═══════════════════════════════════════════════════════════════╝\n', 'green');

    log('You can now run admin tests:', 'bright');
    log('  npm test -- tests/api/admin-registrations.api.spec.ts', 'yellow');
    log('  npm test -- tests/api/admin-invites.api.spec.ts\n', 'yellow');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    throw error;
  } finally {
    log('\n🔒 Closing browser...', 'cyan');
    await context.close();
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log(`\n❌ Uncaught error: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled rejection: ${error.message}`, 'red');
  process.exit(1);
});

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
