import React, { useEffect, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import {
  addAgentAlert,
  subscribeToAgentAlerts,
} from '../../../services/agents/agentAlerts';

const InlineBannerHost: React.FC<{ lastRole: 'user' | 'assistant' }> = ({
  lastRole,
}) => {
  const [inlineAlert, setInlineAlert] = useState<null | {
    message: string;
    severity: 'info' | 'warn' | 'error';
  }>(null);
  useEffect(() => {
    const unsub = subscribeToAgentAlerts(a =>
      setInlineAlert({ message: a.message, severity: a.severity })
    );
    return unsub;
  }, []);
  return (
    <div>
      <div data-testid="last-role">{lastRole}</div>
      {inlineAlert && lastRole === 'assistant' && (
        <div role="alert">{inlineAlert.message}</div>
      )}
    </div>
  );
};

describe('Inline banner condition', () => {
  it('does not render inline banner when last message is user', async () => {
    render(<InlineBannerHost lastRole="user" />);
    await act(async () => {
      addAgentAlert({
        id: '1',
        agentId: 'a1',
        createdAt: new Date().toISOString(),
        rating: 60,
        severity: 'warn',
        message: 'Alert!',
        read: false,
      });
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders inline banner when last message is assistant', async () => {
    render(<InlineBannerHost lastRole="assistant" />);
    await act(async () => {
      addAgentAlert({
        id: '2',
        agentId: 'a1',
        createdAt: new Date().toISOString(),
        rating: 60,
        severity: 'warn',
        message: 'Alert!',
        read: false,
      });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Alert!');
  });
});
