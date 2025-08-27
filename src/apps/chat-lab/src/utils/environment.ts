/**
 * Environment utility functions for the FIDU Chat Lab application
 */

export const getEnvironmentInfo = () => {
  return {
    mode: import.meta.env.MODE,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    identityServiceUrl: import.meta.env.VITE_IDENTITY_SERVICE_URL || 'https://identity.firstdataunion.org',
    gatewayUrl: import.meta.env.VITE_GATEWAY_URL || 'https://gateway.firstdataunion.org',
  };
};

export const logEnvironmentInfo = () => {
  const envInfo = getEnvironmentInfo();
  
  if (envInfo.isProduction && envInfo.identityServiceUrl.includes('dev.')) {
    console.warn('⚠️  WARNING: Production build is using dev identity service URL!');
  }
  
  if (envInfo.isProduction && envInfo.gatewayUrl.includes('dev.')) {
    console.warn('⚠️  WARNING: Production build is using dev gateway URL!');
  }
};

export const getIdentityServiceUrl = () => {
  const url = import.meta.env.VITE_IDENTITY_SERVICE_URL || 'https://identity.firstdataunion.org';
  return url;
};

export const getGatewayUrl = () => {
  const url = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.firstdataunion.org';
  return url;
}; 