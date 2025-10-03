// Mock for environment.ts to avoid import.meta issues in tests
export const environment = {
  mode: 'test',
  isDevelopment: true,
  isProduction: false,
  identityServiceUrl: 'https://identity.firstdataunion.org',
  gatewayUrl: 'https://gateway.firstdataunion.org',
  storageMode: 'local',
  syncInterval: 300000,
};

export const getIdentityServiceUrl = () => 'https://identity.firstdataunion.org';
export const getGatewayUrl = () => 'https://gateway.firstdataunion.org';
