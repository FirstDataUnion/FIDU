/**
 * Authentication Error Boundary
 *
 * Catches and handles authentication-related errors to prevent
 * cascading failures and infinite loops.
 *
 * Features:
 * - Detects auth errors and provides recovery options
 * - Prevents error loops with automatic recovery
 * - Logs errors for debugging
 */

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Paper, Typography, Button, Alert } from '@mui/material';
import { getFiduAuthService } from '../../services/auth/FiduAuthService';
import { completeLogout } from '../../services/auth/logoutCoordinator';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  lastErrorTime: number;
}

const MAX_ERRORS_PER_MINUTE = 3;
const ERROR_RESET_TIME_MS = 60000; // 1 minute

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const now = Date.now();
    const timeSinceLastError = now - this.state.lastErrorTime;

    // Reset error count if it's been more than a minute
    const errorCount =
      timeSinceLastError > ERROR_RESET_TIME_MS ? 1 : this.state.errorCount + 1;

    console.error('🚨 [AuthErrorBoundary] Caught authentication error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorCount,
    });

    // Check if this looks like an auth-related error
    const isAuthError = this.isAuthError(error);

    if (isAuthError) {
      console.warn(
        '⚠️ [AuthErrorBoundary] Detected auth error - clearing state to prevent loops'
      );

      // Clear auth state to prevent loops
      try {
        getFiduAuthService().clearAllAuthTokens();
        completeLogout(); // Ensure logout coordinator is reset
      } catch (cleanupError) {
        console.error('Error during auth cleanup:', cleanupError);
      }
    }

    // If we're getting too many errors, force a page reload
    if (errorCount >= MAX_ERRORS_PER_MINUTE) {
      console.error(
        '❌ [AuthErrorBoundary] Too many errors, forcing page reload'
      );
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }

    this.setState({
      errorCount,
      lastErrorTime: now,
    });
  }

  private isAuthError(error: Error): boolean {
    const authKeywords = [
      'authentication',
      'auth',
      'token',
      'login',
      'logout',
      'unauthorized',
      '401',
      'session',
      'credentials',
    ];

    const errorMessage = error.message.toLowerCase();
    const errorStack = (error.stack || '').toLowerCase();

    return authKeywords.some(
      keyword => errorMessage.includes(keyword) || errorStack.includes(keyword)
    );
  }

  private handleReset = () => {
    // Clear error state
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: 0,
    });
  };

  private handleClearAndReload = () => {
    // Clear all auth data and reload
    getFiduAuthService().clearAllAuthTokens();
    completeLogout();
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2,
          }}
        >
          <Paper
            elevation={24}
            sx={{
              p: 4,
              width: '100%',
              maxWidth: 500,
              borderRadius: 3,
            }}
          >
            <Typography
              variant="h5"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 600,
                color: 'error.main',
                mb: 2,
              }}
            >
              Authentication Error
            </Typography>

            <Alert severity="error" sx={{ mb: 3 }}>
              An authentication error occurred. This might be due to an expired
              session or a temporary issue with the authentication system.
            </Alert>

            {this.state.error && (
              <Box sx={{ mb: 3 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  Error details:
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    backgroundColor: 'action.hover',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    maxHeight: 150,
                    overflow: 'auto',
                  }}
                >
                  {this.state.error.message}
                </Paper>
              </Box>
            )}

            {this.state.errorCount >= MAX_ERRORS_PER_MINUTE && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Multiple errors detected. The page will reload automatically in
                a moment.
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={this.handleReset}
                fullWidth
                disabled={this.state.errorCount >= MAX_ERRORS_PER_MINUTE}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleClearAndReload}
                fullWidth
              >
                Clear Data & Reload
              </Button>
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 3, textAlign: 'center' }}
            >
              If this problem persists, please contact support.
            </Typography>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
