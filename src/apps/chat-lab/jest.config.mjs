/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/utils/environment$': '<rootDir>/src/__mocks__/utils/environment.ts',
    '^@/utils/environment\\.ts$': '<rootDir>/src/__mocks__/utils/environment.ts',
    '.*/utils/environment$': '<rootDir>/src/__mocks__/utils/environment.ts',
    '.*/utils/environment\\.ts$': '<rootDir>/src/__mocks__/utils/environment.ts',
    '.*/utils/version$': '<rootDir>/src/__mocks__/utils/version.ts',
    '.*/utils/version\\.ts$': '<rootDir>/src/__mocks__/utils/version.ts',
    '.*/database/BrowserSQLiteManager$': '<rootDir>/src/__mocks__/services/storage/database/BrowserSQLiteManager.ts',
    '.*/metrics/MetricsService$': '<rootDir>/src/__mocks__/services/metrics/MetricsService.ts',
    '.*/auth/GoogleDriveAuth$': '<rootDir>/src/__mocks__/services/auth/GoogleDriveAuth.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
      useESM: true,
    }],
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/src/__tests__/utils/',
    '<rootDir>/src/__tests__/pageObjects/',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/index.ts',
    '!src/utils/environment.ts',
    '!src/components/auth/FiduAuthLogin.tsx',
  ],
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80,
  //   },
  // },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@reduxjs/toolkit|@mui|@emotion))',
  ],
};