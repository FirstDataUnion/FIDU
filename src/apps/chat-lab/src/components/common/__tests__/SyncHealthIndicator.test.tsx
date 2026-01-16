/**
 * Tests for SyncHealthIndicator component
 * Covers rendering, status updates, time formatting, and tooltip content
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SyncHealthIndicator } from '../SyncHealthIndicator';
import { getUnifiedStorageService } from '../../../services/storage/UnifiedStorageService';
import type { SyncHealth } from '../../../services/storage/sync/SmartAutoSyncService';

// Mock dependencies
jest.mock('../../../services/storage/UnifiedStorageService');

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('SyncHealthIndicator', () => {
  let mockGetAdapter: jest.Mock;
  let mockAdapter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockAdapter = {
      getSyncStatus: jest.fn(),
    };

    mockGetAdapter = jest.fn().mockReturnValue(mockAdapter);

    (getUnifiedStorageService as jest.Mock).mockReturnValue({
      getAdapter: mockGetAdapter,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render null when status is not available', async () => {
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: null,
      });

      const { container } = renderWithTheme(
        <SyncHealthIndicator variant="compact" />
      );
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('should render healthy state correctly', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: oneMinuteAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 1m ago/)).toBeInTheDocument();
      });
    });

    it('should render degraded state correctly', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'degraded' as SyncHealth,
          lastSuccessfulSync: fiveMinutesAgo.toISOString(),
          consecutiveFailures: 1,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 5m ago/)).toBeInTheDocument();
        expect(screen.getByText(/retrying 1\/2/)).toBeInTheDocument();
      });
    });

    it('should render failing state correctly', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'failing' as SyncHealth,
          lastSuccessfulSync: twoHoursAgo.toISOString(),
          consecutiveFailures: 5,
          lastError: 'Network timeout',
          hasUnsyncedData: true,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 2h ago/)).toBeInTheDocument();
        expect(
          screen.getByText(/sync failing - 5 attempts/)
        ).toBeInTheDocument();
      });
    });

    it('should render "Never synced" when lastSuccessfulSync is null', async () => {
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: null,
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Never synced/)).toBeInTheDocument();
      });
    });
  });

  describe('Time Formatting', () => {
    it('should format "just now" for times less than 1 minute', async () => {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: thirtySecondsAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced just now/)).toBeInTheDocument();
      });
    });

    it('should format minutes correctly', async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: fifteenMinutesAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 15m ago/)).toBeInTheDocument();
      });
    });

    it('should format hours correctly', async () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: threeHoursAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 3h ago/)).toBeInTheDocument();
      });
    });

    it('should format days correctly', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: twoDaysAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 2d ago/)).toBeInTheDocument();
      });
    });
  });

  describe('Tooltip Content', () => {
    it('should show healthy tooltip with unsynced data', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: oneMinuteAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: true,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        // Material-UI Tooltip uses aria-label, not title
        const tooltip = screen.getByLabelText(/Local changes pending sync/);
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should show healthy tooltip without unsynced data', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: oneMinuteAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        // Material-UI Tooltip uses aria-label, not title
        const tooltip = screen.getByLabelText(
          /All data synced to Google Drive/
        );
        expect(tooltip).toBeInTheDocument();
      });
    });

    it('should show degraded tooltip with retry information', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'degraded' as SyncHealth,
          lastSuccessfulSync: tenMinutesAgo.toISOString(),
          consecutiveFailures: 2,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        // Material-UI Tooltip uses aria-label, not title
        const tooltip = screen.getByLabelText(
          /Sync is retrying after 2 failure/
        );
        expect(tooltip).toBeInTheDocument();
        expect(tooltip.getAttribute('aria-label')).toContain(
          'Will recover automatically'
        );
      });
    });

    it('should show failing tooltip with error message', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'failing' as SyncHealth,
          lastSuccessfulSync: oneHourAgo.toISOString(),
          consecutiveFailures: 3,
          lastError: 'Network timeout',
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        // Material-UI Tooltip uses aria-label, not title
        const tooltip = screen.getByLabelText(/Sync has failed 3 times/);
        expect(tooltip).toBeInTheDocument();
        expect(tooltip.getAttribute('aria-label')).toContain('Network timeout');
        expect(tooltip.getAttribute('aria-label')).toContain('Try "Sync Now"');
      });
    });
  });

  describe('Status Updates', () => {
    it('should update when sync status changes', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

      // Initial status
      mockAdapter.getSyncStatus
        .mockResolvedValueOnce({
          smartAutoSync: {
            syncHealth: 'healthy' as SyncHealth,
            lastSuccessfulSync: oneMinuteAgo.toISOString(),
            consecutiveFailures: 0,
            lastError: null,
            hasUnsyncedData: false,
          },
        })
        // Updated status
        .mockResolvedValue({
          smartAutoSync: {
            syncHealth: 'degraded' as SyncHealth,
            lastSuccessfulSync: oneMinuteAgo.toISOString(),
            consecutiveFailures: 1,
            lastError: null,
            hasUnsyncedData: false,
          },
        });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 1m ago/)).toBeInTheDocument();
      });

      // Advance timer to trigger update (component polls every 10 seconds)
      jest.advanceTimersByTime(10000);

      await waitFor(() => {
        expect(screen.getByText(/retrying 1\/2/)).toBeInTheDocument();
      });
    });

    it('should handle missing smartAutoSync status gracefully', async () => {
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: undefined,
      });

      const { container } = renderWithTheme(
        <SyncHealthIndicator variant="compact" />
      );

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('Variant Support', () => {
    it('should render compact variant', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: oneMinuteAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="compact" />);

      await waitFor(() => {
        expect(screen.getByText(/Synced 1m ago/)).toBeInTheDocument();
      });
    });

    it('should render full variant', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'healthy' as SyncHealth,
          lastSuccessfulSync: oneMinuteAgo.toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="full" />);

      await waitFor(() => {
        expect(screen.getByText(/Sync Status/)).toBeInTheDocument();
        expect(screen.getByText(/Synced 1m ago/)).toBeInTheDocument();
      });
    });

    it('should show error message in full variant when failing', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      mockAdapter.getSyncStatus.mockResolvedValue({
        smartAutoSync: {
          syncHealth: 'failing' as SyncHealth,
          lastSuccessfulSync: oneHourAgo.toISOString(),
          consecutiveFailures: 3,
          lastError: 'Connection timeout',
          hasUnsyncedData: false,
        },
      });

      renderWithTheme(<SyncHealthIndicator variant="full" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Error: Connection timeout/)
        ).toBeInTheDocument();
      });
    });
  });
});
