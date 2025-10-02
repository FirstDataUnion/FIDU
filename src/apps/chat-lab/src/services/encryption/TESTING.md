# Encryption Testing Guide

This guide provides instructions for testing the encryption functionality in FIDU Chat Lab.

## Prerequisites

1. **Identity Service**: Ensure the identity service is running with encryption endpoints
2. **Authentication**: Have a valid auth token for testing
3. **Cloud Mode**: Set storage mode to `cloud` or `filesystem` in settings

## Endpoint Configuration

The encryption endpoints are:
- `GET /encryption/key` - Get encryption key for authenticated user
- `POST /encryption/key` - Create encryption key for authenticated user
- `DELETE /encryption/key` - Delete encryption key for authenticated user

**Note:** User ID is determined from the Bearer token, not from the URL path.

## Testing Steps

### 1. Verify Identity Service Endpoints

First, verify the identity service endpoints are working:

```bash
# Get encryption key (should return 404 if not created yet)
curl -X GET https://identity.firstdataunion.org/encryption/key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Create encryption key
curl -X POST https://identity.firstdataunion.org/encryption/key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Get encryption key (should now return the key)
curl -X GET https://identity.firstdataunion.org/encryption/key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Test Encryption in Chat Lab

#### Setup

1. **Login**: Log in to FIDU Chat Lab
2. **Set Storage Mode**: 
   - Go to Settings
   - Set storage mode to `cloud` (Google Drive) or `filesystem`
   - For cloud mode, authenticate with Google Drive
   - For filesystem mode, select a directory

#### Create a Conversation

1. Navigate to the conversation creation page
2. Create a new conversation with some messages
3. **Expected Behavior**:
   - Data should be encrypted before storage
   - You should see console logs indicating encryption
   - The conversation should save successfully

#### View the Conversation

1. Navigate back to the conversations list
2. Click on the conversation you just created
3. **Expected Behavior**:
   - Data should be decrypted automatically
   - Conversation should display correctly
   - You should see console logs indicating decryption

#### Verify Encryption

To verify data is actually encrypted, you can:

**For Cloud Mode:**
1. Open browser DevTools
2. Go to Application → IndexedDB → `fidu_conversations`
3. Look at the `data_packets` table
4. The `data` field should contain encrypted JSON with `encrypted`, `data`, `nonce`, and `tag` fields

**For Filesystem Mode:**
1. Open the selected directory
2. Open `fidu_conversations_v1.db` with a SQLite viewer
3. Look at the `data_packets` table
4. The `data` column should contain encrypted JSON

### 3. Test API Key Encryption

#### Add an API Key

1. Go to Settings → API Keys
2. Add an API key for a provider (e.g., OpenAI)
3. **Expected Behavior**:
   - API key should be encrypted before storage
   - You should see console logs indicating encryption
   - The API key should save successfully

#### Use the API Key

1. Create a conversation with the provider
2. **Expected Behavior**:
   - API key should be decrypted automatically
   - Conversation should work normally
   - You should see console logs indicating decryption

### 4. Test Error Scenarios

#### Invalid Token

1. Manually clear the auth token from localStorage
2. Try to create a conversation
3. **Expected Behavior**:
   - Should show error: "Authentication token not found. Please log in again."
   - User should be prompted to log in

#### Identity Service Down

1. Stop the identity service (or block network access)
2. Clear the encryption key cache (refresh the page)
3. Try to create a conversation
4. **Expected Behavior**:
   - Should show error: "Failed to encrypt data. Please try again."
   - Data should not be saved

#### Corrupted Encrypted Data

1. Manually modify encrypted data in the database
2. Try to view the conversation
3. **Expected Behavior**:
   - Should show error in console: "Failed to decrypt data packet"
   - Conversation should show empty or error state
   - App should continue working for other conversations

### 5. Test Key Caching

#### First Request

1. Refresh the page (clears cache)
2. Create a conversation
3. **Expected Behavior**:
   - Should fetch key from identity service
   - Console should show: "Fetching encryption key from identity service"

#### Subsequent Requests

1. Create another conversation (without refreshing)
2. **Expected Behavior**:
   - Should use cached key
   - No network request to identity service
   - Console should show: "Using cached encryption key"

#### Cache Expiration

1. Wait 10+ minutes (or modify cache TTL for testing)
2. Create a conversation
3. **Expected Behavior**:
   - Should fetch new key from identity service
   - Console should show: "Key expired, fetching new key"

## Console Logs to Watch For

### Successful Encryption
```
🔒 [EncryptionService] Encrypting data for user: user-123
🔒 [EncryptionService] Data encrypted successfully
📝 [BrowserSQLiteManager] Storing encrypted data packet: packet-id
```

### Successful Decryption
```
🔓 [EncryptionService] Decrypting data for user: user-123
🔓 [EncryptionService] Data decrypted successfully
🔍 [BrowserSQLiteManager] Retrieved encrypted data packet: packet-id
```

### Errors
```
❌ [EncryptionService] Failed to encrypt data: [error message]
❌ [EncryptionService] Failed to decrypt data: [error message]
❌ [IdentityServiceClient] Failed to fetch encryption key: [error message]
```

## Performance Checks

### Encryption Performance
- Encrypting a conversation should take < 50ms
- No noticeable UI lag

### Decryption Performance
- Decrypting a conversation should take < 50ms
- Conversation list should load smoothly

### Key Caching Performance
- First request: ~100-500ms (network + crypto)
- Cached requests: < 10ms (crypto only)

## Security Checks

### Key Isolation
1. Login as User A, create conversations
2. Logout and login as User B
3. **Expected Behavior**:
   - User B should not be able to decrypt User A's data
   - User B should get their own encryption key

### Key Storage
1. Check browser storage (localStorage, IndexedDB)
2. **Expected Behavior**:
   - Raw encryption keys should NOT be stored
   - Only encrypted data should be visible

### Network Traffic
1. Open DevTools → Network
2. Create a conversation
3. **Expected Behavior**:
   - Only encrypted data should be transmitted (for Google Drive sync)
   - Raw encryption keys should only be fetched from identity service

## Troubleshooting

### "Authentication token not found"
- Solution: Log in again
- Check: localStorage has `auth_token`

### "Failed to encrypt data"
- Check: Identity service is running
- Check: Auth token is valid
- Check: Network connectivity

### "Failed to decrypt data"
- Check: Data hasn't been corrupted
- Check: User has correct encryption key
- Check: Data was encrypted with same key

### "Encryption key not found"
- Check: Identity service has encryption endpoints
- Check: User has an encryption key (should auto-create)
- Try: Manually create key via API

## Manual Testing Checklist

- [ ] Create conversation (encrypts data)
- [ ] View conversation (decrypts data)
- [ ] Update conversation (re-encrypts data)
- [ ] Delete conversation
- [ ] Add API key (encrypts key)
- [ ] Use API key (decrypts key)
- [ ] Test with no auth token
- [ ] Test with invalid auth token
- [ ] Test with identity service down
- [ ] Test key caching (first request)
- [ ] Test key caching (subsequent requests)
- [ ] Test key expiration
- [ ] Verify encrypted data in database
- [ ] Test Google Drive sync (cloud mode)
- [ ] Test file system storage (filesystem mode)
- [ ] Test with multiple users

## Automated Testing

Run the test suite:

```bash
# Run all encryption tests
npm test -- --testPathPattern=encryption

# Run with coverage
npm test -- --testPathPattern=encryption --coverage

# Run specific test file
npm test -- EncryptionService.test.ts
```

## Next Steps

After successful testing:
1. Deploy to production
2. Monitor encryption performance
3. Set up error tracking
4. Implement key rotation (future)
5. Add audit logging (future)
