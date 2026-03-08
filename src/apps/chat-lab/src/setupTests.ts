import '@testing-library/jest-dom';

// Mock TextEncoder and TextDecoder for tests
global.TextEncoder = class TextEncoder {
  encode(input: string): Uint8Array {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
} as any;

global.TextDecoder = class TextDecoder {
  decode(input: Uint8Array): string {
    return Buffer.from(input).toString('utf8');
  }
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock crypto.randomUUID for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123',
  },
});

// Mock import.meta.env for tests
// Our custom transformer replaces import.meta.env with globalThis.__import_meta_env__
(globalThis as any).__import_meta_env__ = {
  DEV: true,
  PROD: false,
  MODE: 'test',
  BASE_URL: '/',
  VITE_GOOGLE_CLIENT_ID: 'test_client_id',
  VITE_GOOGLE_CLIENT_SECRET: 'test_client_secret',
  VITE_GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
  VITE_DISABLE_INSECURE_FALLBACK: 'false',
  VITE_APP_VERSION: '0.0.0-test',
};

// Mock localStorage with actual storage behavior
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
};

Object.defineProperty(global, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true,
});

// Mock fetch for HTTP-only cookie services
global.fetch = jest.fn();

// Type for mock location values (used in mockWindowLocation helper)
type MockLocationValues = {
  hostname?: string;
  pathname?: string;
  href?: string;
  search?: string;
  hash?: string;
  protocol?: string;
  port?: string;
};

// Helper function to compute origin from location properties
function computeOrigin(location: Location): string {
  const protocol = location.protocol || 'http:';
  const hostname = location.hostname || 'localhost';
  const port = location.port || '';
  const defaultPort = protocol === 'https:' ? '443' : '80';

  if (port && port !== defaultPort && port !== '') {
    return `${protocol}//${hostname}:${port}`;
  }
  return `${protocol}//${hostname}`;
}

// Note: locationOverrides was removed as it was unused

// Helper function to mock window.location in jsdom v30
// Recommended approach: Use window.history.replaceState to change the URL
// This is a legitimate browser API that jsdom supports and will update location properties
// DEPRECATED: In jsdom v30, location properties are read-only and cannot be mocked
// This function is kept for backward compatibility but will only update search/hash via history API
// Tests should use mock location objects passed to functions instead
(global as any).overrideLocationProperties = (overrides: {
  hostname?: string;
  search?: string;
  pathname?: string;
  protocol?: string;
  port?: string;
  hash?: string;
}) => {
  // Only attempt to set search/hash/pathname via history API (safe in jsdom v30)
  if (
    overrides.search !== undefined
    || overrides.hash !== undefined
    || overrides.pathname !== undefined
  ) {
    const url = new URL(window.location.href);
    if (overrides.pathname !== undefined) {
      url.pathname = overrides.pathname;
    }
    if (overrides.search !== undefined) {
      url.search = overrides.search;
    }
    if (overrides.hash !== undefined) {
      url.hash = overrides.hash;
    }
    try {
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Silently fail - navigation errors can cause leaks
    }
  }

  // hostname, port, and protocol cannot be changed in jsdom v30 without causing navigation errors
  // These attempts are silently ignored to prevent leaks
};

// Helper to restore original window (call in afterEach if needed)
(global as any).restoreWindowLocation = () => {
  if ((global as any).__originalWindow) {
    (global as any).window = (global as any).__originalWindow;
    delete (global as any).__originalWindow;
  }
};

// Helper function to update origin getter after setting location properties
// Export it so tests can use it
(global as any).updateLocationOrigin = () => {
  try {
    Object.defineProperty(window.location, 'origin', {
      get: () => computeOrigin(window.location),
      configurable: true,
    });
  } catch {
    // Ignore if we can't update origin
  }
};

// Override the origin getter since it's read-only in jsdom v30
// We compute it from protocol, hostname, and port
try {
  const locationDescriptor = Object.getOwnPropertyDescriptor(
    window,
    'location'
  );
  if (locationDescriptor) {
    Object.defineProperty(window.location, 'origin', {
      get: () => computeOrigin(window.location),
      configurable: true,
    });
  }
} catch (error) {
  // If we can't override origin, that's okay - tests can handle it
  console.warn('Could not override window.location.origin:', error);
}

// Note: buildHrefFromProperties was removed as it was unused

// Helper function for tests to mock window.location properties
// In jsdom v30, location properties are read-only and cannot be mocked directly
// Tests should use mock location objects passed to functions instead
// This helper is deprecated - use window.history.replaceState for search/hash changes
(global as any).mockWindowLocation = (values: Partial<MockLocationValues>) => {
  console.warn(
    'mockWindowLocation is deprecated in jsdom v30. '
      + 'Use window.history.replaceState for search/hash changes, '
      + 'or pass mock location objects to functions that accept them.'
  );
  // Only attempt to set search/hash via history API (safe in jsdom v30)
  if (values.search !== undefined || values.hash !== undefined) {
    const url = new URL(window.location.href);
    if (values.search !== undefined) {
      url.search = values.search;
    }
    if (values.hash !== undefined) {
      url.hash = values.hash;
    }
    window.history.replaceState({}, '', url.toString());
  }
};

// In jsdom v30+, window.location properties are read-only and non-configurable
// Attempting to modify them causes navigation errors and leaks
// Individual tests that need location mocking should pass mock location objects
// to functions that accept them, or use window.history.replaceState for search/hash
// We no longer attempt to mock window.location globally in setupTests

// Mock document.cookie for cookie operations
Object.defineProperty(document, 'cookie', {
  value: '',
  writable: true,
});

// Note: window.location.reload mocking is handled in individual test files that need it

// Suppress console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string'
      && (args[0].includes('Warning: ReactDOM.render is no longer supported')
        || args[0].includes('urllib3 v2 only supports OpenSSL'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string'
      && (args[0].includes('Warning: ReactDOM.render is no longer supported')
        || args[0].includes('urllib3 v2 only supports OpenSSL'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});
