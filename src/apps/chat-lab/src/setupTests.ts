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

// Mock window.location for environment detection
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    pathname: '/',
    href: 'http://localhost:3000/',
  },
  writable: true,
});

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
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('urllib3 v2 only supports OpenSSL'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };

  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
       args[0].includes('urllib3 v2 only supports OpenSSL'))
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
