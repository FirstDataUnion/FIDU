#!/bin/bash

# Cookie-Based Authentication and Settings Test Runner
# High-impact, low-cost tests for the critical mobile authentication flow

echo "🧪 Running Cookie-Based Authentication and Settings Tests"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test categories
FRONTEND_TESTS=(
  "src/services/settings/__tests__/CookieSettingsService.test.ts"
  "src/services/auth/__tests__/GoogleDriveAuthCookieRestoration.test.ts"
  "src/__tests__/MobileRestorationFlow.test.tsx"
  "src/__tests__/CookieAuthSettingsSmoke.test.ts"
)

BACKEND_TESTS=(
  "backend/__tests__/test_cookie_management.py"
)

# Function to run frontend tests
run_frontend_tests() {
  echo -e "${BLUE}📱 Running Frontend Tests${NC}"
  echo "----------------------------"
  
  for test in "${FRONTEND_TESTS[@]}"; do
    echo -e "${YELLOW}Running: $test${NC}"
    if npm test -- --testPathPattern="$test" --verbose --passWithNoTests; then
      echo -e "${GREEN}✅ $test passed${NC}"
    else
      echo -e "${RED}❌ $test failed${NC}"
      return 1
    fi
    echo ""
  done
  
  echo -e "${GREEN}🎉 All frontend tests passed!${NC}"
  return 0
}

# Function to run backend tests
run_backend_tests() {
  echo -e "${BLUE}🔧 Running Backend Tests${NC}"
  echo "---------------------------"
  
  for test in "${BACKEND_TESTS[@]}"; do
    echo -e "${YELLOW}Running: $test${NC}"
    if python -m pytest "$test" -v; then
      echo -e "${GREEN}✅ $test passed${NC}"
    else
      echo -e "${RED}❌ $test failed${NC}"
      return 1
    fi
    echo ""
  done
  
  echo -e "${GREEN}🎉 All backend tests passed!${NC}"
  return 0
}

# Function to run smoke tests only
run_smoke_tests() {
  echo -e "${BLUE}💨 Running Smoke Tests Only${NC}"
  echo "----------------------------"
  
  echo -e "${YELLOW}Running: CookieAuthSettingsSmoke.test.ts${NC}"
  if npm test -- --testPathPattern="CookieAuthSettingsSmoke.test.ts" --verbose --passWithNoTests; then
    echo -e "${GREEN}✅ Smoke tests passed${NC}"
    return 0
  else
    echo -e "${RED}❌ Smoke tests failed${NC}"
    return 1
  fi
}

# Function to run critical path tests
run_critical_tests() {
  echo -e "${BLUE}🚨 Running Critical Path Tests${NC}"
  echo "--------------------------------"
  
  # Run the most important tests for cookie functionality
  CRITICAL_TESTS=(
    "src/__tests__/CookieAuthSettingsSmoke.test.ts"
    "src/services/settings/__tests__/CookieSettingsService.test.ts"
    "src/services/auth/__tests__/GoogleDriveAuthCookieRestoration.test.ts"
  )
  
  for test in "${CRITICAL_TESTS[@]}"; do
    echo -e "${YELLOW}Running: $test${NC}"
    if npm test -- --testPathPattern="$test" --verbose --passWithNoTests; then
      echo -e "${GREEN}✅ $test passed${NC}"
    else
      echo -e "${RED}❌ $test failed${NC}"
      return 1
    fi
    echo ""
  done
  
  echo -e "${GREEN}🎉 All critical tests passed!${NC}"
  return 0
}

# Main execution
case "${1:-all}" in
  "frontend")
    run_frontend_tests
    ;;
  "backend")
    run_backend_tests
    ;;
  "smoke")
    run_smoke_tests
    ;;
  "critical")
    run_critical_tests
    ;;
  "all")
    echo -e "${BLUE}🚀 Running All Cookie-Based Tests${NC}"
    echo "=================================="
    
    if run_frontend_tests && run_backend_tests; then
      echo ""
      echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
      echo -e "${GREEN}Cookie-based authentication and settings are working correctly!${NC}"
      exit 0
    else
      echo ""
      echo -e "${RED}❌ SOME TESTS FAILED${NC}"
      echo -e "${RED}Please check the output above for details${NC}"
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 [frontend|backend|smoke|critical|all]"
    echo ""
    echo "Test categories:"
    echo "  frontend  - Run only frontend tests"
    echo "  backend   - Run only backend tests"
    echo "  smoke     - Run only smoke tests (fastest)"
    echo "  critical  - Run only critical path tests"
    echo "  all       - Run all tests (default)"
    exit 1
    ;;
esac
