import { APIRequestContext } from '@playwright/test';
import { APIHelpers } from './api-helpers';
import { EmailRetriever } from './email-retriever';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminInitiateAuthCommand,
  AuthFlowType,
  RespondToAuthChallengeCommand,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// Static cache shared across all QuickAuth instances
// This prevents race conditions when parallel tests authenticate
const globalTokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Quick authentication helper for 24-hour sprint
 * Minimal setup, maximum speed - no full user fixtures
 */
export class QuickAuth {
  private apiHelpers: APIHelpers;
  private cognitoClient: CognitoIdentityProviderClient;
  private ddbClient: DynamoDBClient;

  constructor(request: APIRequestContext) {
    this.apiHelpers = new APIHelpers(request);
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.ddbClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Get admin token from environment or Cognito
   * Caches for reuse across tests (tokens expire after ~1 hour)
   */
  async getAdminToken(): Promise<string> {
    // Check environment variable first (pre-generated token)
    if (process.env.ADMIN_TOKEN) {
      return process.env.ADMIN_TOKEN;
    }

    // Check global cache - tokens are valid for ~1 hour, we'll refresh at 55 minutes
    const cached = globalTokenCache.get('admin');
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // Get credentials from environment
    const userPoolId = process.env.ADMIN_USER_POOL_ID;
    const clientId = process.env.ADMIN_CLIENT_ID;
    const username = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!userPoolId || !clientId || !username || !password) {
      throw new Error(
        'Admin credentials not configured. Required env vars: ' +
        'ADMIN_USER_POOL_ID, ADMIN_CLIENT_ID, ADMIN_EMAIL, ADMIN_PASSWORD'
      );
    }

    // Use AdminInitiateAuth (requires IAM credentials) for server-side authentication
    // This works without client secret since we're using SRP or ADMIN_NO_SRP_AUTH
    try {
      const command = new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      });

      const response = await this.cognitoClient.send(command);

      if (!response.AuthenticationResult?.AccessToken) {
        throw new Error('No access token in Cognito response');
      }

      // Cache the token in global cache (expires in 1 hour, refresh at 55 minutes)
      const token = response.AuthenticationResult.AccessToken;
      globalTokenCache.set('admin', {
        token,
        expiresAt: Date.now() + 55 * 60 * 1000,
      });

      return token;
    } catch (error: any) {
      throw new Error(`Failed to authenticate admin user: ${error.message}`);
    }
  }

  /**
   * Create approved user quickly via API (no UI)
   * Returns user info with tokens
   */
  async createApprovedUser(options?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    autoApprove?: boolean;
  }): Promise<{
    email: string;
    registrationId: string;
    userId: string;
  }> {
    const email = options?.email || this.generateTestEmail();
    const firstName = options?.firstName || 'Test';
    const lastName = options?.lastName || 'User';

    // Get or create auto-approve invite
    let inviteCode: string;
    if (options?.autoApprove !== false) {
      inviteCode = await this.getOrCreateAutoApproveInvite();
    } else {
      inviteCode = process.env.TEST_INVITE_CODE || '';
    }

    // Submit registration
    const regResponse = await this.apiHelpers.submitRegistration({
      first_name: firstName,
      last_name: lastName,
      email: email,
      invite_code: inviteCode
    });

    if (regResponse.status !== 201) {
      throw new Error(`Registration failed: ${JSON.stringify(regResponse.body)}`);
    }

    const registrationId = regResponse.body.registration_id;

    // If not auto-approved, approve manually
    if (!regResponse.body.auto_approved) {
      const adminToken = await this.getAdminToken();
      this.apiHelpers.setAuthToken(adminToken);

      const approveResponse = await this.apiHelpers.approveRegistration(registrationId);
      if (approveResponse.status !== 200) {
        throw new Error(`Approval failed: ${JSON.stringify(approveResponse.body)}`);
      }
    }

    return {
      email,
      registrationId,
      userId: regResponse.body.user_guid || registrationId
    };
  }

  /**
   * Get member auth token
   * Tries multiple approaches:
   * 1. Environment variable MEMBER_TOKEN (pre-generated)
   * 2. Password auth if MEMBER_EMAIL + MEMBER_PASSWORD configured
   * 3. Magic link flow via email retrieval
   */
  async getMemberToken(email?: string): Promise<string> {
    // Option 1: Use pre-generated token from environment
    if (process.env.MEMBER_TOKEN) {
      return process.env.MEMBER_TOKEN;
    }

    // Check global cache - use 'member:email' as cache key
    const memberEmail = email || process.env.MEMBER_EMAIL;
    const cacheKey = `member:${memberEmail || 'default'}`;
    const cached = globalTokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // Option 2: Password auth (if test member has password)
    const memberPassword = process.env.MEMBER_PASSWORD;
    const userPoolId = process.env.USER_POOL_ID;
    const clientId = process.env.CLIENT_ID;

    if (memberEmail && memberPassword && userPoolId && clientId) {
      try {
        const command = new AdminInitiateAuthCommand({
          UserPoolId: userPoolId,
          ClientId: clientId,
          AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
          AuthParameters: {
            USERNAME: memberEmail,
            PASSWORD: memberPassword,
          },
        });

        const response = await this.cognitoClient.send(command);

        if (response.AuthenticationResult?.AccessToken) {
          const token = response.AuthenticationResult.AccessToken;
          globalTokenCache.set(cacheKey, {
            token,
            expiresAt: Date.now() + 55 * 60 * 1000,
          });
          return token;
        }
      } catch (error: any) {
        console.warn(`Password auth failed for ${memberEmail}: ${error.message}`);
        // Fall through to magic link flow
      }
    }

    // Option 3: Magic link flow via direct DynamoDB token retrieval
    if (memberEmail && userPoolId && clientId && process.env.MAGIC_LINK_TABLE) {
      return this.getMemberTokenViaMagicLink(memberEmail);
    }

    throw new Error(
      'Member token not available. Configure one of:\n' +
      '1. MEMBER_TOKEN (pre-generated token)\n' +
      '2. MEMBER_EMAIL + MEMBER_PASSWORD + USER_POOL_ID + CLIENT_ID (password auth)\n' +
      '3. MEMBER_EMAIL + USER_POOL_ID + CLIENT_ID + MAGIC_LINK_TABLE (magic link flow)'
    );
  }

  /**
   * Get member token via magic link flow
   *
   * For test automation, this bypasses email by:
   * 1. Initiating CUSTOM_AUTH (which triggers magic link creation)
   * 2. Querying the MagicLinkTokens DynamoDB table directly
   * 3. Responding to the challenge with the token
   */
  private async getMemberTokenViaMagicLink(email: string): Promise<string> {
    const userPoolId = process.env.USER_POOL_ID;
    const clientId = process.env.CLIENT_ID;
    const magicLinkTable = process.env.MAGIC_LINK_TABLE;

    if (!userPoolId || !clientId) {
      throw new Error('USER_POOL_ID and CLIENT_ID required for magic link flow');
    }

    if (!magicLinkTable) {
      throw new Error('MAGIC_LINK_TABLE required for direct token retrieval');
    }

    // Retry logic wraps the entire auth flow to handle race conditions
    // when parallel tests consume tokens before we can use them
    const maxAttempts = 5;
    let lastError: Error | undefined;
    let authResponse;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Record timestamp BEFORE initiating auth
        const beforeInitTimestamp = Math.floor(Date.now() / 1000) - 2; // 2 second buffer

        // Step 1: Initiate CUSTOM_AUTH (triggers createAuthChallenge Lambda)
        const initiateCommand = new InitiateAuthCommand({
          ClientId: clientId,
          AuthFlow: AuthFlowType.CUSTOM_AUTH,
          AuthParameters: {
            USERNAME: email,
          },
        });

        const initiateResponse = await this.cognitoClient.send(initiateCommand);

        if (!initiateResponse.Session) {
          throw new Error('No session returned from CUSTOM_AUTH initiation');
        }

        // Step 2: Query DynamoDB for the magic link token
        const now = Math.floor(Date.now() / 1000);

        // First, try to find a token created after we initiated auth
        let scanResult = await this.ddbClient.send(new ScanCommand({
          TableName: magicLinkTable,
          FilterExpression: 'email = :email AND expiresAt > :now AND createdAtTimestamp >= :since',
          ExpressionAttributeValues: {
            ':email': { S: email },
            ':now': { N: now.toString() },
            ':since': { N: beforeInitTimestamp.toString() },
          },
        }));

        // If no tokens found in our window, try fallback scan for any valid token
        if (!scanResult.Items || scanResult.Items.length === 0) {
          scanResult = await this.ddbClient.send(new ScanCommand({
            TableName: magicLinkTable,
            FilterExpression: 'email = :email AND expiresAt > :now',
            ExpressionAttributeValues: {
              ':email': { S: email },
              ':now': { N: now.toString() },
            },
          }));
        }

        if (!scanResult.Items || scanResult.Items.length === 0) {
          // No token found - another test likely consumed it
          // Throw a specific error to trigger retry with new InitiateAuth
          throw new Error('TOKEN_CONSUMED');
        }

        // Sort by timestamp and use most recent token
        const tokens = scanResult.Items.map(item => unmarshall(item));
        tokens.sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
        const magicToken = tokens[0].token;

        // Step 3: Respond to custom challenge with the token
        const respondCommand = new RespondToAuthChallengeCommand({
          ClientId: clientId,
          ChallengeName: ChallengeNameType.CUSTOM_CHALLENGE,
          Session: initiateResponse.Session,
          ChallengeResponses: {
            USERNAME: email,
            ANSWER: magicToken,
          },
        });

        authResponse = await this.cognitoClient.send(respondCommand);
        break; // Success!

      } catch (error: any) {
        lastError = error;
        const isRetryable = error.message === 'TOKEN_CONSUMED' ||
                           error.name === 'NotAuthorizedException';

        if (isRetryable && attempt < maxAttempts - 1) {
          console.log(`Magic link auth attempt ${attempt + 1} failed (${error.message}), retrying...`);
          // Wait before retry with exponential backoff (500ms, 1s, 1.5s, 2s)
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }

        // Non-retryable error or exhausted retries
        if (error.message === 'TOKEN_CONSUMED') {
          throw new Error(`No valid magic link token found for ${email} after ${maxAttempts} attempts`);
        }
        throw error;
      }
    }

    if (!authResponse) {
      throw lastError || new Error('Failed to authenticate after retries');
    }

    // Use IdToken instead of AccessToken because API handlers expect email claim
    // which is only present in ID tokens, not access tokens
    if (!authResponse.AuthenticationResult?.IdToken) {
      throw new Error('No ID token from magic link authentication');
    }

    const token = authResponse.AuthenticationResult.IdToken;

    // Cache the token in global cache
    globalTokenCache.set(`member:${email}`, {
      token,
      expiresAt: Date.now() + 55 * 60 * 1000,
    });

    return token;
  }

  /**
   * Generate unique test email
   */
  generateTestEmail(prefix: string = 'sprint'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}@test.vettid.dev`;
  }

  /**
   * Get or create an auto-approve invite code
   * Caches the code for reuse across tests
   */
  private async getOrCreateAutoApproveInvite(): Promise<string> {
    // Check if we have a cached invite
    const cachedInvite = process.env.AUTO_APPROVE_INVITE_CODE;
    if (cachedInvite) {
      return cachedInvite;
    }

    // Create new auto-approve invite
    const adminToken = await this.getAdminToken();
    this.apiHelpers.setAuthToken(adminToken);

    const inviteResponse = await this.apiHelpers.createInvite(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );

    if (inviteResponse.status !== 201) {
      // Fallback to env variable if creation fails
      if (process.env.TEST_INVITE_CODE) {
        return process.env.TEST_INVITE_CODE;
      }
      throw new Error('Failed to create auto-approve invite');
    }

    return inviteResponse.body.code;
  }

  /**
   * Create user with PIN enabled
   */
  async createUserWithPin(pin: string = '123456'): Promise<{
    email: string;
    token: string;
    pin: string;
  }> {
    const user = await this.createApprovedUser();
    const token = await this.getMemberToken(user.email);

    // Enable PIN
    this.apiHelpers.setAuthToken(token);
    await this.apiHelpers.enablePin(pin);

    return {
      email: user.email,
      token,
      pin
    };
  }

  /**
   * Create user with membership approved
   */
  async createMemberUser(): Promise<{
    email: string;
    token: string;
  }> {
    const user = await this.createApprovedUser();
    const token = await this.getMemberToken(user.email);

    // Request membership
    this.apiHelpers.setAuthToken(token);
    await this.apiHelpers.requestMembership();

    // Approve membership as admin
    const adminToken = await this.getAdminToken();
    this.apiHelpers.setAuthToken(adminToken);

    // Get registration ID to approve membership
    const regsResponse = await this.apiHelpers.listRegistrations();
    const reg = regsResponse.body.find((r: any) => r.email === user.email);

    if (reg) {
      // TODO: Add approveMembership method to APIHelpers
      // For now, this is a placeholder
      console.warn('Membership approval not implemented in sprint');
    }

    return {
      email: user.email,
      token
    };
  }

  /**
   * Clean up test user
   */
  async cleanupUser(userId: string): Promise<void> {
    try {
      const adminToken = await this.getAdminToken();
      this.apiHelpers.setAuthToken(adminToken);

      // Soft delete the user
      await this.apiHelpers.makeRequest('DELETE', `/admin/users/${userId}`);
    } catch (error) {
      console.warn(`Failed to cleanup user ${userId}:`, error);
    }
  }

  /**
   * Batch create multiple approved users for testing
   */
  async createBatchUsers(count: number): Promise<Array<{
    email: string;
    registrationId: string;
    userId: string;
  }>> {
    const users = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createApprovedUser({
        email: this.generateTestEmail(`batch${i}`)
      });
      users.push(user);
    }

    return users;
  }
}
