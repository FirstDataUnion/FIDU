/**
 * Environment utility functions for the FIDU Chat Lab application
 */

export const getEnvironmentInfo = () => {
  return {
    mode: import.meta.env.MODE,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    identityServiceUrl: import.meta.env.VITE_IDENTITY_SERVICE_URL || 'https://identity.firstdataunion.org',
    hasNlpApiKey: !!import.meta.env.VITE_NLP_WORKBENCH_AGENT_API_KEY,
  };
};

export const logEnvironmentInfo = () => {
  const envInfo = getEnvironmentInfo();
  console.log('FIDU Chat Lab Environment Info:', envInfo);
  
  if (envInfo.isProduction && envInfo.identityServiceUrl.includes('dev.')) {
    console.warn('⚠️  WARNING: Production build is using dev identity service URL!');
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