import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { Message } from '../../../types';
import { ConversationCopyExportDialog } from '../ConversationCopyExportDialog';
import * as exportUtils from '../../../utils/conversationExport';

jest.mock('../../../utils/conversationExport', () => ({
  ...jest.requireActual('../../../utils/conversationExport'),
  copyTextToClipboard: jest.fn().mockResolvedValue(undefined),
  downloadTextFile: jest.fn(),
  downloadImageByUrl: jest.fn().mockResolvedValue(undefined),
}));

const theme = createTheme();

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

const baseMessage: Message = {
  id: 'm1',
  conversationId: 'c1',
  role: 'assistant',
  content: 'Hello world',
  timestamp: '2026-04-29T10:00:00.000Z',
  platform: 'other',
  isEdited: false,
};

describe('ConversationCopyExportDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies transcript from the first tab', async () => {
    const onToast = jest.fn();
    renderWithTheme(
      <ConversationCopyExportDialog
        open={true}
        onClose={() => undefined}
        messages={[baseMessage]}
        conversationTitle="Demo"
        fullPromptText="Full prompt text"
        onToast={onToast}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy all' }));

    await waitFor(() => {
      expect(exportUtils.copyTextToClipboard).toHaveBeenCalledTimes(1);
    });
    expect(onToast).toHaveBeenCalledWith('Conversation copied to clipboard!');
  });

  it('uses selected download format and emits preference change', async () => {
    const onToast = jest.fn();
    const onDownloadFormatChange = jest.fn();
    renderWithTheme(
      <ConversationCopyExportDialog
        open={true}
        onClose={() => undefined}
        messages={[baseMessage]}
        conversationTitle="Demo"
        fullPromptText="Full prompt text"
        onToast={onToast}
        initialDownloadFormat="markdown"
        onDownloadFormatChange={onDownloadFormatChange}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Download Conversation' }));
    fireEvent.mouseDown(screen.getByLabelText('Format'));
    fireEvent.click(screen.getByRole('option', { name: 'Text (.txt)' }));

    expect(onDownloadFormatChange).toHaveBeenCalledWith('txt');

    fireEvent.click(screen.getByRole('button', { name: 'Download conversation' }));

    await waitFor(() => {
      expect(exportUtils.downloadTextFile).toHaveBeenCalledTimes(1);
    });
    expect(exportUtils.downloadTextFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('.txt'),
      'txt'
    );
    expect(onToast).toHaveBeenCalledWith('Conversation downloaded.');
  });

  it('copies full prompt from the full prompt tab', async () => {
    const onToast = jest.fn();
    renderWithTheme(
      <ConversationCopyExportDialog
        open={true}
        onClose={() => undefined}
        messages={[baseMessage]}
        conversationTitle="Demo"
        fullPromptText="Full prompt text"
        onToast={onToast}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'View/Copy Full Prompt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy full prompt' }));

    await waitFor(() => {
      expect(exportUtils.copyTextToClipboard).toHaveBeenCalledWith(
        'Full prompt text'
      );
    });
    expect(onToast).toHaveBeenCalledWith('Full prompt copied to clipboard!');
  });
});
