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
  console.log('FIDU Chat Lab Environment Info:', envInfo);
  
  if (envInfo.isProduction && envInfo.identityServiceUrl.includes('dev.')) {
    console.warn('⚠️  WARNING: Production build is using dev identity service URL!');
  }
  
  if (envInfo.isProduction && envInfo.gatewayUrl.includes('dev.')) {
    console.warn('⚠️  WARNING: Production build is using dev gateway URL!');
  }
};

export const getIdentityServiceUrl = () => {
  const url = import.meta.env.VITE_IDENTITY_SERVICE_URL || 'https://identity.firstdataunion.org';
  
  // Log the URL being used in development for debugging
  if (import.meta.env.DEV) {
    console.log('Using Identity Service URL:', url);
  }
  
  return url;
};

export const getGatewayUrl = () => {
  const url = import.meta.env.VITE_GATEWAY_URL || 'https://gateway.firstdataunion.org';
  
  // Log the URL being used in development for debugging
  if (import.meta.env.DEV) {
    console.log('Using Gateway URL:', url);
  }
  
  return url;
}; 