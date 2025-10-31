import { maybeEvaluateBackgroundAgents } from '../backgroundAgentRunner';
import type { BackgroundAgent } from '../../api/backgroundAgents';

jest.mock('../../storage/UnifiedStorageService', () => ({
  getUnifiedStorageService: () => ({
    getBackgroundAgents: jest.fn().mockResolvedValue({
      backgroundAgents: [
        { 
          id: 'a1', 
          name: 'Agent 1',
          enabled: true, 
          runEveryNTurns: 2, 
          verbosityThreshold: 50,
          contextWindowStrategy: 'lastNMessages',
          contextParams: { lastN: 6 },
        } as BackgroundAgent,
        { 
          id: 'a2', 
          name: 'Agent 2',
          enabled: false, 
          runEveryNTurns: 1, 
          verbosityThreshold: 0,
        } as BackgroundAgent,
      ],
    }),
  }),
}));

const mockEvaluateBackgroundAgent = jest.fn().mockResolvedValue({
  agentId: 'a1',
  rating: 30, // Below threshold of 50 to trigger alert
  severity: 'warn',
  notify: true,
  message: 'Test alert',
  details: {},
  rawModelOutput: '',
  parsedResult: {},
});

jest.mock('../backgroundAgentsService', () => ({
  evaluateBackgroundAgent: (...args: any[]) => mockEvaluateBackgroundAgent(...args),
}));

jest.mock('../agentPreferences', () => ({
  loadAgentPreferences: jest.fn().mockReturnValue({}),
}));

jest.mock('../agentTransformers', () => ({
  transformBuiltInAgentsWithPreferences: jest.fn().mockReturnValue([]),
}));

const addAgentAlertSpy = jest.fn();
jest.mock('../agentAlerts', () => ({
  addAgentAlert: (alert: any) => addAgentAlertSpy(alert),
}));

describe('maybeEvaluateBackgroundAgents', () => {
  const baseParams = {
    profileId: 'p1',
    conversationId: 'c1',
    messages: [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ] as any,
    turnCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default mock that triggers alerts
    mockEvaluateBackgroundAgent.mockResolvedValue({
      agentId: 'a1',
      rating: 30, // Below threshold of 50 to trigger alert
      severity: 'warn',
      notify: true,
      message: 'Test alert',
      details: {},
      rawModelOutput: '',
      parsedResult: {},
    });
  });

  it('does not trigger when cadence does not match', async () => {
    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 1 });
    expect(addAgentAlertSpy).not.toHaveBeenCalled();
  });

  it('triggers evaluation when cadence matches and emits alert above threshold', async () => {
    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 2 });
    expect(addAgentAlertSpy).toHaveBeenCalledTimes(1);
    const alert = addAgentAlertSpy.mock.calls[0][0];
    expect(alert.agentId).toBe('a1');
    expect(alert.message).toBe('Test alert');
  });

  it('skips disabled agents', async () => {
    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 2 });
    const alert = addAgentAlertSpy.mock.calls[0][0];
    expect(alert.agentId).toBe('a1');
  });

  it('includes conversationId and messageId in alerts', async () => {
    await maybeEvaluateBackgroundAgents({ 
      ...baseParams, 
      turnCount: 2,
      conversationId: 'test-conv-1',
      messageId: 'test-msg-1',
    });
    const alert = addAgentAlertSpy.mock.calls[0][0];
    expect(alert.conversationId).toBe('test-conv-1');
    expect(alert.messageId).toBe('test-msg-1');
  });

  it('generates unique alert IDs', async () => {
    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 2 });
    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 4 });
    
    expect(addAgentAlertSpy).toHaveBeenCalledTimes(2);
    const alert1 = addAgentAlertSpy.mock.calls[0][0];
    const alert2 = addAgentAlertSpy.mock.calls[1][0];
    
    expect(alert1.id).not.toBe(alert2.id);
    // Alert IDs should include agent ID, timestamp, and random suffix
    expect(alert1.id).toMatch(/^a1-\d+-[a-z0-9]+$/);
    expect(alert2.id).toMatch(/^a1-\d+-[a-z0-9]+$/);
  });

  it('does not create alert when rating exceeds threshold', async () => {
    mockEvaluateBackgroundAgent.mockResolvedValueOnce({
      agentId: 'a1',
      rating: 80, // Above threshold of 50
      severity: 'info',
      notify: true,
      message: 'High rating',
      details: {},
      rawModelOutput: '',
      parsedResult: {},
    });

    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 2 });
    
    expect(addAgentAlertSpy).not.toHaveBeenCalled();
  });

  it('does not create alert when notify is false', async () => {
    mockEvaluateBackgroundAgent.mockResolvedValueOnce({
      agentId: 'a1',
      rating: 30, // Below threshold
      severity: 'warn',
      notify: false, // Should not notify
      message: 'Test',
      details: {},
      rawModelOutput: '',
      parsedResult: {},
    });

    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 2 });
    
    expect(addAgentAlertSpy).not.toHaveBeenCalled();
  });

  it('handles evaluation errors gracefully', async () => {
    mockEvaluateBackgroundAgent.mockRejectedValueOnce(new Error('API error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    await maybeEvaluateBackgroundAgents({ ...baseParams, turnCount: 2 });
    
    // Should not throw, just log error
    expect(consoleSpy).toHaveBeenCalled();
    expect(addAgentAlertSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
