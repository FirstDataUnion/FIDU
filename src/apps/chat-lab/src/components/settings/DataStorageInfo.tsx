import React, { useState } from 'react';
import { Box, Typography, Button, Collapse } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

export const DataStorageInfo: React.FC = () => {
  const [showLearnMore, setShowLearnMore] = useState(false);

  return (
    <Box>
      <Button
        variant="text"
        startIcon={showLearnMore ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setShowLearnMore(!showLearnMore)}
        sx={{ textTransform: 'none' }}
      >
        Learn more about how your data is stored
      </Button>

      <Collapse in={showLearnMore}>
        <Box
          sx={{
            mt: 2,
            p: 2,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Google Drive:
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            We store your conversations, contexts and custom system prompts and
            stored API keys in the AppData folder of your Google Drive. When you
            launch this app, it is fetched and stored temporarily in your
            browser for the app to use, and regularly synced back to your google
            drive. All the data is encrypted at rest, and your personal
            encryption key is stored separately with your user account on our
            servers, completely separate from the data itself.
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            We hold none of your data, we can only read from the FIDU AppData
            folder in your drive, and no one else can read the data without the
            encryption key.
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};
