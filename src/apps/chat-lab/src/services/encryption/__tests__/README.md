# Encryption Service Tests

This directory contains comprehensive tests for the encryption functionality in FIDU Chat Lab.

## Test Structure

### Unit Tests

- **`EncryptionService.test.ts`** - Tests for the core encryption service
  - Encryption/decryption functionality
  - Key caching and expiration
  - Error handling
  - Crypto operations

- **`IdentityServiceClient.test.ts`** - Tests for the identity service client
  - Key retrieval, creation, and deletion
  - Authentication handling
  - Error responses
  - HTTP request/response handling

### Integration Tests

- **`integration.test.ts`** - End-to-end encryption flow tests
  - Complete encrypt/decrypt cycles
  - Different data types
  - Error scenarios
  - Key caching behavior

## Running Tests

```bash
# Run all encryption tests
npm test -- --testPathPattern=encryption

# Run specific test file
npm test -- --testPathPattern=EncryptionService.test.ts

# Run with coverage
npm test -- --testPathPattern=encryption --coverage
```

## Test Coverage

The tests cover:

- ✅ Encryption and decryption operations
- ✅ Key management and caching
- ✅ Error handling and edge cases
- ✅ Identity service integration
- ✅ Different data types
- ✅ Authentication scenarios
- ✅ Network failure handling

## Mocking Strategy

### Crypto API Mocking

The tests mock the Web Crypto API to:
- Simulate encryption/decryption operations
- Test error scenarios
- Avoid actual cryptographic operations in tests

### Identity Service Mocking

The identity service client is mocked to:
- Simulate API responses
- Test authentication scenarios
- Test network failures
- Avoid actual HTTP requests

### LocalStorage Mocking

LocalStorage is mocked to:
- Test token retrieval
- Simulate different authentication states
- Test error scenarios

## Test Data

### Sample Data Types

The tests use various data types to ensure compatibility:

```typescript
// Simple object
{ message: 'Hello, World!' }

// Complex object
{
  string: 'test',
  number: 123,
  boolean: true,
  array: [1, 2, 3],
  object: { nested: 'value' }
}

// Empty object
{}
```

### Sample Keys

Mock keys are base64-encoded strings:
- `'mock-base64-key'`
- `'new-base64-encoded-key'`

## Error Scenarios

The tests cover various error scenarios:

- Key retrieval failures
- Encryption/decryption failures
- Authentication failures
- Network failures
- Invalid data
- Expired keys

## Performance Considerations

The tests are designed to:
- Run quickly without actual crypto operations
- Use minimal memory
- Avoid network dependencies
- Provide fast feedback

## Security Considerations

The tests:
- Use mock data only
- Don't expose real keys
- Don't perform actual encryption
- Test security boundaries
- Validate error handling

## Future Enhancements

Potential test improvements:
- Add performance benchmarks
- Test key rotation scenarios
- Add stress testing
- Test concurrent operations
- Add security vulnerability tests
