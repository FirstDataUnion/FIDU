#!/bin/bash

# Test runner script for refresh token functionality
# This script runs all tests related to refresh token behavior

echo "🧪 Running Refresh Token Tests..."
echo "=================================="

# Run refresh token service tests
echo "📋 Testing RefreshTokenService..."
npm test -- --testPathPattern="refreshTokenService.test.ts" --verbose

# Run API client interceptor tests
echo "📋 Testing API Client Interceptors..."
npm test -- --testPathPattern="apiClientInterceptors.test.ts" --verbose

# Run integration tests
echo "📋 Testing Token Refresh Integration..."
npm test -- --testPathPattern="tokenRefreshIntegration.test.ts" --verbose

# Run updated conversations tests
echo "📋 Testing Conversations API with Refresh Token..."
npm test -- --testPathPattern="conversations.test.ts" --verbose

# Run updated auth slice tests
echo "📋 Testing Auth Slice with Refresh Token..."
npm test -- --testPathPattern="authSlice.test.ts" --verbose

echo "=================================="
echo "✅ All refresh token tests completed!"
