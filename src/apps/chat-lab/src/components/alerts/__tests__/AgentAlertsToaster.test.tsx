import React from 'react';
import { render, screen, act } from '@testing-library/react';
import AgentAlertsToaster from '../AgentAlertsToaster';
import { addAgentAlert } from '../../../services/agents/agentAlerts';

jest.useFakeTimers();

describe('AgentAlertsToaster', () => {
  it('renders a toast when an alert is emitted and auto-dismisses', () => {
    render(<AgentAlertsToaster />);

    act(() => {
      addAgentAlert({
        id: 'x',
        agentId: 'a1',
        createdAt: new Date().toISOString(),
        rating: 70,
        severity: 'warn',
        message: 'Background Agent Alert!',
        read: false,
      });
    });

    expect(screen.getByText('Background Agent Alert')).toBeInTheDocument();
    expect(screen.getByText('Background Agent Alert!')).toBeInTheDocument();

    // Advance timers past the auto-hide duration (5000ms)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Wait for React state updates after the timeout
    act(() => {
      jest.runOnlyPendingTimers();
    });

    // After auto-dismiss timeout, the message should be gone
    // The snackbar should be closed (open=false), so the content won't be in the DOM
    expect(
      screen.queryByText('Background Agent Alert!')
    ).not.toBeInTheDocument();
  });
});
