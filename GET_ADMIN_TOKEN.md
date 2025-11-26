# How to Get Admin Token for Testing

## Admin Authentication Details

**Cognito Domain**: `https://vettid-admin-vettidstac.auth.us-east-1.amazoncognito.com`
**Client ID**: `4cesvt13gboup14elsi90fiete`
**Redirect URI**: `https://admin.vettid.dev/admin.html`

## Method 1: Extract from Browser (EASIEST - 2 minutes)

### Steps:

1. **Open Admin Panel**
   ```
   https://admin.vettid.dev/admin.html
   ```

2. **Sign In**
   - Click "Sign in" button
   - Complete Cognito authentication
   - You'll be redirected back to admin panel

3. **Extract Token**
   - Press `F12` to open Developer Tools
   - Go to **Console** tab
   - Type: `localStorage.getItem('tokens')`
   - Press Enter

4. **Copy ID Token**
   - You'll see JSON like: `{"id_token":"eyJ...","access_token":"...","refresh_token":"..."}`
   - Copy the `id_token` value (starts with `eyJ`)
   - **OR** type: `JSON.parse(localStorage.getItem('tokens')).id_token`

5. **Add to .env**
   ```bash
   cd /home/al/vettid-test-harness
   echo 'ADMIN_TOKEN=<paste-token-here>' >> .env
   ```

### Quick Script:
```javascript
// Run this in browser console at https://admin.vettid.dev/admin.html
copy(JSON.parse(localStorage.getItem('tokens')).id_token)
// Token is now in your clipboard!
```

## Method 2: AWS Cognito CLI (if you have AWS credentials)

### Steps:

1. **Get Admin User Pool Info**
   ```bash
   aws cognito-idp list-users \
     --user-pool-id us-east-1_vfBJnI9Xu \
     --filter 'cognito:groups = "admin"' \
     --region us-east-1
   ```

2. **Initiate Auth** (requires username/password)
   ```bash
   aws cognito-idp admin-initiate-auth \
     --user-pool-id us-east-1_vfBJnI9Xu \
     --client-id 4cesvt13gboup14elsi90fiete \
     --auth-flow ADMIN_NO_SRP_AUTH \
     --auth-parameters USERNAME=<admin-email>,PASSWORD=<password> \
     --region us-east-1
   ```

3. **Extract Token**
   - Look for `IdToken` in response
   - Add to .env

## Method 3: Programmatic OAuth (ADVANCED)

I can implement automated OAuth flow if needed, but Method 1 is faster for now.

## Token Format

A valid admin token looks like:
```
eyJraWQiOiJ...very-long-string...xyz
```

- Starts with `eyJ`
- ~800-2000 characters long
- Three parts separated by dots

## Verify Token Works

After adding to .env, test it:

```bash
cd /home/al/vettid-test-harness

# Test admin endpoint
npm test -- tests/api/admin-registrations.api.spec.ts --grep "ADMIN-REG-001"
```

Should see:
```
✓ ADMIN-REG-001: List all registrations (admin only)
```

## Token Expiry

- Tokens typically expire after 1 hour
- When expired, get a new token using Method 1
- Future: Implement refresh token flow

## Troubleshooting

### "ADMIN_TOKEN environment variable required"
- Token not in .env
- Run: `echo $ADMIN_TOKEN` to check
- Make sure no extra spaces/quotes

### "401 Unauthorized"
- Token expired (get new one)
- Token invalid (check format)
- Not an admin user (check Cognito groups)

### "Token manipulation detection"
- Token was modified
- Get fresh token from browser

## Security Notes

- ⚠️ **Never commit tokens to git**
- ⚠️ Token grants full admin access
- ⚠️ Rotate tokens regularly
- ✅ .env file is gitignored

## Ready to Use?

Once you have the token:

```bash
# Verify .env has token
cat .env | grep ADMIN_TOKEN

# Run all admin tests
npm test -- tests/api/admin-registrations.api.spec.ts
npm test -- tests/api/admin-invites.api.spec.ts

# Run all tests
npm test
```

---

**Quick Start**: Use Method 1 (browser extraction) - takes 2 minutes!
