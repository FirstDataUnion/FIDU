import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useState } from 'react';
import ContextCorporaTab from '../components/contexts/ContextCorporaTab';
import ContextDocumentsTab from '../components/contexts/ContextDocumentsTab';
import ContextUrlsTab from '../components/contexts/ContextUrlsTab';

type RagTab = 'corpora' | 'documents' | 'urls';

export default function RagPage() {
  const [activeTab, setActiveTab] = useState<RagTab>('corpora');
  return (
    <Box
      sx={{
        height: '100%', // Use full height of parent container
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden', // Prevent outer page scrolling
      }}
    >
      {/* Scrollable Content Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto', // Enable scrolling for content
          p: 3,
          minHeight: 0, // Ensure flex child can shrink properly
        }}
      >
        <Typography variant="h5">Contexts</Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your knowledge bases for adding context to your conversations.
        </Typography>

        <Paper sx={{ borderRadius: 2, mb: 2, mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue: RagTab) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Corpora" value="corpora" />
            <Tab label="Documents" value="documents" />
            <Tab label="URLs" value="urls" />
          </Tabs>
        </Paper>

        {activeTab === 'corpora' && <ContextCorporaTab />}
        {activeTab === 'documents' && <ContextDocumentsTab />}
        {activeTab === 'urls' && <ContextUrlsTab />}
      </Box>
    </Box>
  );
}
