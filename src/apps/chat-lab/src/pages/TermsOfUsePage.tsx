import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { EnhancedMarkdown } from '../components/common/EnhancedMarkdown';

/**
 * Terms of Use Page
 * 
 * Displays the full terms of use by loading the TERMS_OF_USE.md file.
 * This ensures a single source of truth for the terms content.
 */
const TermsOfUsePage: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load the terms of use markdown file
    const loadTermsOfUse = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch the markdown file from the public URL
        const basePath = import.meta.env.BASE_URL || '/fidu-chat-lab/';
        const response = await fetch(`${basePath}TERMS_OF_USE.md`);
        
        if (!response.ok) {
          throw new Error(`Failed to load terms of use: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error loading terms of use:', err);
        setError(err instanceof Error ? err.message : 'Failed to load terms of use');
      } finally {
        setLoading(false);
      }
    };

    loadTermsOfUse();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a blob and download the markdown file
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'FIDU_ChatLab_Terms_of_Use.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress />
          <Typography variant="body1" color="text.secondary">
            Loading Terms of Use...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header with navigation and actions */}
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={3}
        sx={{
          '@media print': {
            display: 'none',
          },
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          variant="outlined"
        >
          Back
        </Button>
        
        <Box display="flex" gap={1}>
          <Tooltip title="Print Terms of Use">
            <IconButton onClick={handlePrint} size="small">
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download as Markdown">
            <IconButton onClick={handleDownload} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Terms of Use Content */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 4 },
          backgroundColor: 'background.paper',
          '@media print': {
            boxShadow: 'none',
            backgroundColor: 'white',
          },
        }}
      >
        <EnhancedMarkdown
          content={content}
          showCopyButtons={false}
          preprocess={false}
          sx={{
            '& h1:first-of-type': {
              marginTop: 0,
            },
          }}
        />
      </Paper>

      {/* Footer with contact info */}
      <Box
        mt={4}
        py={3}
        borderTop={1}
        borderColor="divider"
        sx={{
          '@media print': {
            display: 'none',
          },
        }}
      >
        <Typography variant="body2" color="text.secondary" align="center">
          For questions about these terms, please contact us at{' '}
          <a href="mailto:hello@firstdataunion.org" style={{ color: 'inherit' }}>
            hello@firstdataunion.org
          </a>
        </Typography>
      </Box>
    </Container>
  );
};

export default TermsOfUsePage;

