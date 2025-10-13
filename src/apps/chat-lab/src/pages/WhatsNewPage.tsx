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
  Chip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  NewReleases as NewReleasesIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { EnhancedMarkdown } from '../components/common/EnhancedMarkdown';

/**
 * What's New Page
 * 
 * Displays the changelog by loading the CHANGELOG.md file.
 * This ensures a single source of truth for feature updates and fixes.
 */
const WhatsNewPage: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load the changelog markdown file
    const loadChangelog = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch the markdown file from the public URL
        const basePath = import.meta.env.BASE_URL || '/fidu-chat-lab/';
        const response = await fetch(`${basePath}CHANGELOG.md`);
        
        if (!response.ok) {
          throw new Error(`Failed to load changelog: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error loading changelog:', err);
        setError(err instanceof Error ? err.message : 'Failed to load changelog');
      } finally {
        setLoading(false);
      }
    };

    loadChangelog();
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
    link.download = 'FIDU_ChatLab_Changelog.md';
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
            Loading What's New...
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
          <Tooltip title="Print Changelog">
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

      {/* Page Title with Icon */}
      <Box 
        display="flex" 
        alignItems="center" 
        gap={2} 
        mb={3}
        sx={{
          '@media print': {
            mb: 2,
          },
        }}
      >
        <NewReleasesIcon 
          sx={{ 
            fontSize: 40, 
            color: 'primary.main',
            '@media print': {
              display: 'none',
            },
          }} 
        />
        <Box>
          <Typography 
            variant="h3" 
            component="h1" 
            gutterBottom 
            sx={{ mb: 0.5 }}
          >
            What's New
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Latest features, improvements, and fixes in FIDU Chat Lab
          </Typography>
        </Box>
      </Box>

      {/* Info chip */}
      <Box 
        mb={3}
        sx={{
          '@media print': {
            display: 'none',
          },
        }}
      >
        <Chip 
          label="Updated regularly with new features" 
          size="small" 
          color="primary" 
          variant="outlined"
        />
      </Box>

      {/* Changelog Content */}
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
            '& h2': {
              borderBottom: '2px solid',
              borderColor: 'divider',
              paddingBottom: 1,
              marginTop: 3,
              marginBottom: 2,
            },
            '& h3': {
              color: 'primary.main',
              marginTop: 2,
            },
          }}
        />
      </Paper>

      {/* Footer */}
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
          Have suggestions or feedback?{' '}
          <a href="mailto:feedback@firstdataunion.org" style={{ color: 'inherit' }}>
            Let us know
          </a>
        </Typography>
      </Box>
    </Container>
  );
};

export default WhatsNewPage;

