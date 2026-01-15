/**
 * Hook to load and manage the FIDU Authentication SDK
 *
 * Handles:
 * - Script injection and loading with timeout
 * - SDK initialization
 * - Error handling
 */

import { useEffect, useState, useRef } from 'react';
import { getIdentityServiceUrl } from '../utils/environment';

const FIDU_SDK_ID = 'fidu-sdk-script';
const SDK_LOAD_TIMEOUT_MS = 10000;

interface UseFiduSDKReturn {
  isLoading: boolean;
  error: string | null;
  sdk: any | null;
  isReady: boolean;
}

export function useFiduSDK(): UseFiduSDKReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [sdk, setSdk] = useState<any>(null); // Use state instead of ref to trigger re-renders
  const [sdkVersion, setSdkVersion] = useState(0); // Force re-render when SDK is recreated
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // Check if script is already loaded
    if (document.getElementById(FIDU_SDK_ID)) {
      console.log('🔑 FIDU SDK script already loaded');
      setIsLoading(false);
      setIsReady(true);
      return;
    }

    // Set timeout for SDK loading
    const loadingTimeout = window.setTimeout(() => {
      if (!cancelledRef.current) {
        console.warn(
          '🔑 FIDU SDK loading timeout - taking longer than expected'
        );
        setError(
          'Authentication system is taking longer than expected to load. Please wait or try refreshing the page.'
        );
      }
    }, SDK_LOAD_TIMEOUT_MS);

    // Inject SDK script
    const script = document.createElement('script');
    script.id = FIDU_SDK_ID;
    script.src = `${getIdentityServiceUrl()}/static/js/fidu-sdk.js`;
    script.async = true;

    script.onload = () => {
      if (!cancelledRef.current) {
        console.log('✅ FIDU SDK script loaded successfully');
        setIsLoading(false);
        setIsReady(true);
        clearTimeout(loadingTimeout);
      }
    };

    script.onerror = () => {
      if (!cancelledRef.current) {
        console.error('❌ Failed to load FIDU SDK script');
        setError('Failed to load FIDU Auth SDK.');
        setIsLoading(false);
        clearTimeout(loadingTimeout);
      }
    };

    document.body.appendChild(script);

    return () => {
      cancelledRef.current = true;
      clearTimeout(loadingTimeout);
      // Don't remove script on unmount to avoid double-loading
    };
  }, []);

  // Check on mount if SDK instance needs reinitialization (e.g., after logout)
  useEffect(() => {
    if (!isReady || !sdk) {
      return;
    }

    if (!window.__fiduAuthInstance) {
      console.log('🔄 SDK instance was cleared, triggering reinitialization');
      setSdk(null);
      setSdkVersion(v => v + 1); // Force re-initialization
    }
  }, [isReady, sdk]);

  // Wait for window.FIDUAuth to become available and initialize/reinitialize SDK
  useEffect(() => {
    if (!isReady || error) return;

    const waitForFIDUAuth = async (
      maxWaitMs: number = 15000,
      pollIntervalMs: number = 100
    ) => {
      const start = Date.now();

      // Fast path - already available
      if (window.FIDUAuth) {
        return true;
      }

      // Poll until available or timeout
      return new Promise<boolean>(resolve => {
        const interval = setInterval(() => {
          if (cancelledRef.current) {
            clearInterval(interval);
            resolve(false);
            return;
          }

          if (window.FIDUAuth) {
            clearInterval(interval);
            resolve(true);
            return;
          }

          if (Date.now() - start >= maxWaitMs) {
            clearInterval(interval);
            resolve(false);
          }
        }, pollIntervalMs);
      });
    };

    const initSDK = async () => {
      // Check if SDK instance was cleared (e.g., during logout) BEFORE any async operations
      if (!window.__fiduAuthInstance && sdk) {
        console.log(
          '🔄 SDK instance was cleared, resetting for reinitialization'
        );
        setSdk(null);
      }

      // Skip if SDK is already initialized and valid
      if (window.__fiduAuthInstance && sdk === window.__fiduAuthInstance) {
        console.log('✅ SDK already initialized and valid');
        return;
      }

      const ready = await waitForFIDUAuth();

      if (!ready || cancelledRef.current) {
        if (!error) {
          setError(
            'Authentication system did not initialize in time. Please reload or click Retry.'
          );
        }
        return;
      }

      // Get or create SDK instance
      if (!window.__fiduAuthInstance) {
        console.log('🔨 Creating new FIDU SDK instance');
        window.__fiduAuthInstance = new window.FIDUAuth({
          fiduHost: getIdentityServiceUrl(),
          origin: window.location.origin,
          debug: false,
        });
      }

      setSdk(window.__fiduAuthInstance);
      console.log('✅ FIDU SDK initialized successfully');
    };

    initSDK();

    return () => {
      cancelledRef.current = true;
    };
  }, [isReady, error, sdkVersion, sdk]);

  return {
    isLoading,
    error,
    sdk,
    isReady: isReady && sdk !== null,
  };
}
