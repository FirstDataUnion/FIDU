/**
 * Environment utility functions for the FIDU Chat Lab application
 */

export const getEnvironmentInfo = () => {
  return {
    mode: import.meta.env.MODE,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
    identityServiceUrl:
      import.meta.env.VITE_IDENTITY_SERVICE_URL
      || 'https://identity.firstdataunion.org',
    gatewayUrl:
      import.meta.env.VITE_GATEWAY_URL || 'https://gateway.firstdataunion.org',
    storageMode: import.meta.env.VITE_STORAGE_MODE || 'local',
    syncInterval: parseInt(import.meta.env.VITE_SYNC_INTERVAL || '300000'),
  };
};

export const logEnvironmentInfo = () => {
  const envInfo = getEnvironmentInfo();

  if (envInfo.isProduction && envInfo.identityServiceUrl.includes('dev.')) {
    console.warn(
      '⚠️  WARNING: Production build is using dev identity service URL!'
    );
  }

  if (envInfo.isProduction && envInfo.gatewayUrl.includes('dev.')) {
    console.warn('⚠️  WARNING: Production build is using dev gateway URL!');
  }

  console.log(`📦 Storage Mode: ${envInfo.storageMode}`);
  console.log(`⏱️  Sync Interval: ${envInfo.syncInterval}ms`);
};

export const getIdentityServiceUrl = () => {
  const url =
    import.meta.env.VITE_IDENTITY_SERVICE_URL
    || 'https://identity.firstdataunion.org';
  return url;
};

export const getGatewayUrl = () => {
  const url =
    import.meta.env.VITE_GATEWAY_URL || 'https://gateway.firstdataunion.org';
  return url;
};

/**
 * Detect the current runtime environment based on hostname
 * This is used for cookie prefixes and environment-specific behavior
 *
 * @param location - Optional Location object to use for detection. Defaults to window.location.
 * @returns 'dev' | 'prod' | 'local'
 */
export const detectRuntimeEnvironment = (
  location?: Location
): 'dev' | 'prod' | 'local' => {
  if (typeof window === 'undefined') {
    // Fallback for SSR or non-browser contexts
    return import.meta.env.DEV ? 'dev' : 'prod';
  }

  // Use provided location or fall back to window.location
  // Check explicitly for undefined/null to avoid issues with falsy values
  let hostname: string;

  if (location !== undefined && location !== null) {
    // Use provided location (e.g., from tests)
    // For mock objects, access hostname directly as a property
    // Try multiple ways to access it to handle different object types
    const locAny = location as any;
    hostname =
      locAny.hostname || locAny['hostname'] || (location as Location).hostname;

    // Debug: log what we got (only in test environment)
    if (process.env.NODE_ENV === 'test' && !hostname) {
      console.warn(
        'detectRuntimeEnvironment: location provided but hostname not found',
        {
          location,
          keys: Object.keys(locAny),
          hasHostname: 'hostname' in locAny,
        }
      );
    }
  } else {
    // Use window.location
    hostname = window.location.hostname;
  }

  if (!hostname || typeof hostname !== 'string') {
    // If hostname is missing or invalid, default to local for safety
    return 'local';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local';
  }

  if (hostname.includes('dev.') || hostname.includes('-dev.')) {
    return 'dev';
  }

  return 'prod';
};

/**
 * Check if we're in a dev/staging environment for workbench selection
 * Dev deployment points to staging workbench, prod deployment points to prod workbench
 *
 * Priority:
 * 1. VITE_WORKBENCH_ENV env var (explicit control)
 * 2. Hostname detection (for deployments)
 * 3. Default to 'dev' for localhost (for local testing with staging workbench)
 *
 * @param location - Optional Location object to use for detection. Defaults to window.location.
 */
export const isDevEnvironment = (location?: Location): boolean => {
  // First, check for explicit env var override
  const envVar = import.meta.env.VITE_WORKBENCH_ENV;
  if (envVar === 'dev' || envVar === 'staging') {
    return true;
  }
  if (envVar === 'prod' || envVar === 'production') {
    return false;
  }

  if (typeof window === 'undefined') {
    // Fallback for SSR or non-browser contexts
    return import.meta.env.DEV;
  }

  // Use provided location or fall back to window.location
  const loc = location || window.location;
  const hostname = loc.hostname;

  // Localhost defaults to dev/staging for local testing
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }

  // Check hostname patterns for dev/staging
  if (hostname.includes('dev.') || hostname.includes('-dev.')) {
    return true;
  }

  // Default to prod for production deployments
  return false;
};

export const getGoogleClientId = (): string | undefined => {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID;
};

export const getGoogleRedirectUri = (): string | undefined => {
  return import.meta.env.VITE_GOOGLE_REDIRECT_URI;
};
