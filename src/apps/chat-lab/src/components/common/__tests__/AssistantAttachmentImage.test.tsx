import type { ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AssistantAttachmentImage } from '../AssistantAttachmentImage';

const theme = createTheme();

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

/** Minimal valid 1×1 PNG data URL */
const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('AssistantAttachmentImage', () => {
  it('shows a progress indicator until the image loads', () => {
    renderWithTheme(
      <AssistantAttachmentImage
        attachment={{
          id: 'a1',
          name: 'Generated image 1',
          type: 'image',
          url: tinyPng,
        }}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    fireEvent.load(screen.getByRole('img'));

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders a one-click download control', () => {
    renderWithTheme(
      <AssistantAttachmentImage
        attachment={{
          id: 'a2',
          name: 'Generated image 2',
          type: 'image',
          url: tinyPng,
          mimeType: 'image/png',
        }}
      />
    );

    const downloadLink = screen.getByRole('link', { name: 'Download image' });
    expect(downloadLink).toHaveAttribute('href', tinyPng);
    expect(downloadLink).toHaveAttribute('download', 'Generated-image-2.png');
  });
});
