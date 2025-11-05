// Manual mock for environment.ts
export const environment = {
  mode: 'test',
  isDevelopment: true,
  isProduction: false,
  identityServiceUrl: 'https://identity.firstdataunion.org',
  gatewayUrl: 'https://gateway.firstdataunion.org',
  storageMode: 'local',
  syncInterval: 300000,
};

export const getEnvironmentInfo = () => ({
  mode: 'test',
  isDevelopment: true,
  isProduction: false,
  identityServiceUrl: 'https://identity.firstdataunion.org',
  gatewayUrl: 'https://gateway.firstdataunion.org',
  storageMode: 'local',
  syncInterval: 300000,
});

export const logEnvironmentInfo = () => {
  console.log('Mock environment info logged');
};

export const getIdentityServiceUrl = () => 'https://identity.firstdataunion.org';
export const getGatewayUrl = () => 'https://gateway.firstdataunion.org';

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