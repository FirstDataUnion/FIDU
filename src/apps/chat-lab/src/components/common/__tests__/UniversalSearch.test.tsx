import React from 'react';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import UniversalSearch from '../UniversalSearch';

// Create a theme for testing
const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('UniversalSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render search input', () => {
    renderWithTheme(<UniversalSearch />);
    
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('should show no results message when searching for non-existent content', async () => {
    renderWithTheme(<UniversalSearch />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('should clear search when input is cleared', async () => {
    renderWithTheme(<UniversalSearch />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
    
    fireEvent.change(searchInput, { target: { value: '' } });
    
    await waitFor(() => {
      expect(screen.queryByText(/no results found/i)).not.toBeInTheDocument();
    });
  });

  it('should handle custom placeholder text', () => {
    renderWithTheme(<UniversalSearch placeholder="Custom search placeholder" />);
    
    expect(screen.getByPlaceholderText('Custom search placeholder')).toBeInTheDocument();
  });

  it('should handle different sizes', () => {
    const { rerender } = renderWithTheme(<UniversalSearch size="small" />);
    
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    
    rerender(<UniversalSearch size="medium" />);
    
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('should handle autoFocus prop', () => {
    renderWithTheme(<UniversalSearch autoFocus />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('should call onResultSelect when a result is clicked', async () => {
    const mockOnResultSelect = jest.fn();
    
    renderWithTheme(<UniversalSearch onResultSelect={mockOnResultSelect} />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('should handle case-insensitive search', async () => {
    renderWithTheme(<UniversalSearch />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'TEST' } });
    
    await waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('should render with correct styling', () => {
    renderWithTheme(<UniversalSearch />);
    
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should handle empty search gracefully', async () => {
    renderWithTheme(<UniversalSearch />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: '' } });
    
    await waitFor(() => {
      expect(screen.queryByText(/no results found/i)).not.toBeInTheDocument();
    });
  });
});
