#!/bin/bash

# Token Authentication Test Runner
# This script runs comprehensive tests for the token authentication system

set -e

echo "🧪 Running Token Authentication Test Suite"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run tests with nice output
run_test_suite() {
    local test_pattern="$1"
    local description="$2"
    
    echo -e "\n${BLUE}📋 $description${NC}"
    echo "----------------------------------------"
    
    if npm test -- --testPathPattern="$test_pattern" --verbose --passWithNoTests; then
        echo -e "${GREEN}✅ $description - PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ $description - FAILED${NC}"
        return 1
    fi
}

# Track overall success
overall_success=true

echo -e "\n${YELLOW}🔍 Running Individual Test Suites...${NC}"

# 1. FIDU Auth Service Tests
if ! run_test_suite "FiduAuthCookieService.test.ts" "FIDU Authentication Service Tests"; then
    overall_success=false
fi

# 2. Google Drive + FIDU Integration Tests
if ! run_test_suite "GoogleDriveAuthFiduIntegration.test.ts" "Google Drive + FIDU Integration Tests"; then
    overall_success=false
fi

# 3. Polling Behavior Tests
if ! run_test_suite "googleDriveAuthPolling.test.ts" "Authentication Polling Behavior Tests"; then
    overall_success=false
fi

# 4. Token Authentication Integration Tests
if ! run_test_suite "TokenAuthenticationIntegration.test.ts" "Complete Token Authentication Integration Tests"; then
    overall_success=false
fi

# 5. Existing Google Drive Auth Tests
if ! run_test_suite "GoogleDriveAuthCookieRestoration.test.ts" "Google Drive Cookie Restoration Tests"; then
    overall_success=false
fi

# 6. Existing Cookie Auth Integration Tests
if ! run_test_suite "CookieAuth.integration.test.ts" "Cookie Authentication Integration Tests"; then
    overall_success=false
fi

echo -e "\n${YELLOW}📊 Test Summary${NC}"
echo "=================="

if [ "$overall_success" = true ]; then
    echo -e "${GREEN}🎉 All authentication tests passed!${NC}"
    echo -e "${GREEN}✅ Token refresh loops are properly handled${NC}"
    echo -e "${GREEN}✅ FIDU token integration is working correctly${NC}"
    echo -e "${GREEN}✅ Error handling improvements are tested${NC}"
    echo -e "${GREEN}✅ Environment-specific behavior is verified${NC}"
    echo -e "${GREEN}✅ Polling behavior is stable${NC}"
    exit 0
else
    echo -e "${RED}💥 Some tests failed!${NC}"
    echo -e "${RED}❌ Please review the failed tests above${NC}"
    echo -e "${YELLOW}💡 Run individual test suites to debug specific issues${NC}"
    exit 1
fi
