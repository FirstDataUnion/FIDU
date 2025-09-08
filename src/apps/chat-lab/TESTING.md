# FIDU-Chat-Lab Testing Guide

This document provides comprehensive information about the testing setup and practices for the FIDU-Chat-Lab application.

## Overview

The FIDU-Chat-Lab application now includes a comprehensive testing suite that follows industry best practices for TypeScript/React applications. The testing strategy covers:

- **Unit Tests**: Individual functions, hooks, and components
- **Integration Tests**: User flows and component interactions
- **API Tests**: Service layer with mocked HTTP requests
- **Redux Tests**: State management and async thunks

## Testing Stack

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom Jest matchers
- **@testing-library/user-event**: User interaction simulation
- **ts-jest**: TypeScript support for Jest
- **axios-mock-adapter**: HTTP request mocking
- **redux-mock-store**: Redux store mocking

## Project Structure

```
src/
├── __tests__/
│   └── integration/           # Integration tests
├── components/
│   ├── common/
│   │   └── __tests__/         # Component tests
│   └── conversations/
│       └── __tests__/         # Component tests
├── hooks/
│   └── __tests__/             # Hook tests
├── services/
│   └── api/
│       └── __tests__/         # API service tests
├── store/
│   └── slices/
│       └── __tests__/         # Redux slice tests
├── utils/
│   └── __tests__/             # Utility function tests
├── __mocks__/                 # Mock files
└── setupTests.ts              # Test setup configuration
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- ConversationCard.test.tsx

# Run tests matching a pattern
npm test -- --testNamePattern="should render"
```

### Coverage Reports

The test suite includes comprehensive coverage reporting with the following thresholds:

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

Coverage reports are generated in the `coverage/` directory and include HTML reports for detailed analysis.

## Test Categories

### 1. Utility Function Tests

Located in `src/utils/__tests__/`

**Files:**
- `conversationUtils.test.ts` - Tests for conversation-related utilities
- `validation.test.ts` - Tests for input validation and sanitization

**Coverage:**
- Platform color mapping
- Role color and icon mapping
- Tag color generation
- Date formatting
- Message content formatting
- Input sanitization
- API key validation
- Form data validation

### 2. Custom Hook Tests

Located in `src/hooks/__tests__/`

**Files:**
- `useDebouncedSearch.test.ts` - Tests for debounced search functionality
- `useConversationFilters.test.ts` - Tests for conversation filtering logic
- `usePerformanceMonitor.test.ts` - Tests for performance monitoring

**Coverage:**
- Hook state management
- Effect dependencies
- Memoization behavior
- Error handling
- Performance metrics tracking

### 3. Redux Slice Tests

Located in `src/store/slices/__tests__/`

**Files:**
- `conversationsSlice.test.ts` - Tests for conversation state management
- `authSlice.test.ts` - Tests for authentication state management

**Coverage:**
- Action creators
- Reducers
- Async thunks
- State transitions
- Error handling
- Local storage integration

### 4. API Service Tests

Located in `src/services/api/__tests__/`

**Files:**
- `conversations.test.ts` - Tests for conversation API services

**Coverage:**
- HTTP request/response handling
- Data transformation
- Error handling
- Request parameter serialization
- Response validation

### 5. Component Tests

Located in `src/components/*/__tests__/`

**Files:**
- `ErrorBoundary.test.tsx` - Tests for error boundary component
- `ConversationCard.test.tsx` - Tests for conversation card component

**Coverage:**
- Component rendering
- User interactions
- Props handling
- Event handling
- Conditional rendering
- Accessibility

### 6. Integration Tests

Located in `src/__tests__/integration/`

**Files:**
- `conversationFiltering.test.tsx` - Tests for conversation filtering flow

**Coverage:**
- User workflows
- Component interactions
- State management integration
- End-to-end scenarios

## Testing Best Practices

### 1. Test Structure

Follow the **Arrange-Act-Assert** pattern:

```typescript
it('should do something', () => {
  // Arrange
  const input = 'test input';
  const expectedOutput = 'expected result';
  
  // Act
  const result = functionUnderTest(input);
  
  // Assert
  expect(result).toBe(expectedOutput);
});
```

### 2. Mocking Strategy

- **External Dependencies**: Mock all external APIs and services
- **Browser APIs**: Mock localStorage, sessionStorage, and other browser APIs
- **React Router**: Mock router context for component tests
- **Redux Store**: Use mock store for component tests

### 3. Test Data

- Use consistent mock data across tests
- Create factory functions for generating test data
- Keep test data minimal and focused

### 4. Async Testing

- Use `waitFor` for async operations
- Mock timers for debounced functions
- Handle promises correctly in tests

### 5. Component Testing

- Test user interactions, not implementation details
- Use `screen` queries for better accessibility
- Test error states and edge cases
- Verify proper event handling

## Mock Configuration

### Global Mocks

The following are globally mocked in `setupTests.ts`:

- `window.matchMedia`
- `IntersectionObserver`
- `ResizeObserver`
- `crypto.randomUUID`
- `localStorage` and `sessionStorage`
- Console warnings (filtered for React warnings)

### API Mocks

API services are mocked using `axios-mock-adapter`:

```typescript
import MockAdapter from 'axios-mock-adapter';
import { fiduVaultAPIClient } from '../apiClientFIDUVault';

const mockAdapter = new MockAdapter(fiduVaultAPIClient);

mockAdapter.onGet('/data-packets').reply(200, mockData);
```

### Redux Mocks

Redux stores are mocked using `redux-mock-store`:

```typescript
import configureMockStore from 'redux-mock-store';

const mockStore = configureMockStore([]);
const store = mockStore(initialState);
```

## Continuous Integration

The test suite is designed to run in CI/CD environments:

- Tests run in Node.js environment (not browser)
- No external dependencies required
- Deterministic test results
- Comprehensive error reporting

## Debugging Tests

### Common Issues

1. **Async Operations**: Use `waitFor` for async state updates
2. **Mock Cleanup**: Clear mocks between tests
3. **Environment Variables**: Mock `import.meta.env` for environment-specific behavior
4. **Timer Issues**: Use `jest.useFakeTimers()` for timer-dependent tests

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --verbose

# Run tests with detailed error output
npm test -- --no-coverage

# Debug specific test
npm test -- --testNamePattern="specific test" --verbose
```

## Performance Testing

The test suite includes performance monitoring tests:

- Component render time tracking
- Memory usage monitoring
- Performance threshold validation
- Development-only performance warnings

## Future Enhancements

Planned improvements to the testing suite:

1. **Visual Regression Testing**: Screenshot comparisons
2. **E2E Testing**: Playwright integration
3. **Load Testing**: Performance under load
4. **Accessibility Testing**: Automated a11y checks
5. **Security Testing**: Input validation and XSS prevention

## Contributing

When adding new tests:

1. Follow existing patterns and conventions
2. Maintain high test coverage
3. Include both positive and negative test cases
4. Test edge cases and error conditions
5. Update this documentation as needed

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Redux Testing](https://redux.js.org/usage/writing-tests)
