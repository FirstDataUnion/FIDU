// Manual mock for environment.ts
export const environment = {
  mode: 'test',
  isDevelopment: true,
  isProduction: false,
  identityServiceUrl: 'http://localhost:9877',
  gatewayUrl: 'http://localhost:9878',
  storageMode: 'local',
  syncInterval: 300000,
};

export const getEnvironmentInfo = () => ({
  mode: 'test',
  isDevelopment: true,
  isProduction: false,
  identityServiceUrl: 'http://localhost:9877',
  gatewayUrl: 'http://localhost:9878',
  storageMode: 'local',
  syncInterval: 300000,
});

export const logEnvironmentInfo = () => {
  console.log('Mock environment info logged');
};

export const getIdentityServiceUrl = () => 'http://localhost:9877';
export const getGatewayUrl = () => 'http://localhost:9878';

/**
 * Detect the current runtime environment based on hostname
 * Mock implementation that uses window.location.hostname if available
 */
export const detectRuntimeEnvironment = (): 'dev' | 'prod' | 'local' => {
  if (typeof window === 'undefined') {
    return 'local';
  }
  
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local';
  }
  
  if (hostname.includes('dev.') || hostname.includes('-dev.')) {
    return 'dev';
  }
  
  return 'prod';
};

export const isDevEnvironment = (): boolean => {
  if (typeof window === 'undefined') {
    return true; // Default to dev for test environment
  }
  
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }
  
  if (hostname.includes('dev.') || hostname.includes('-dev.')) {
    return true;
  }
  
  return false;
};

export const getGoogleClientId = (): string | undefined => {
  return 'test-google-client-id';
};

export const getGoogleRedirectUri = (): string | undefined => {
  return 'http://localhost:9876/oauth-callback';
};
