

import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack
} from '@mui/material';
import {
  Settings as SettingsIcon
} from '@mui/icons-material';

export default function EmbellishmentsPage() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
          Embellishments
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage prompt embellishments - quick shortcuts to enhance your AI conversations
        </Typography>
      </Box>

      {/* Placeholder Content */}
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <SettingsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
        <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
          Coming Soon
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          The embellishments feature is currently under development. This will allow you to create
          and manage quick shortcuts for common prompt modifications like "Be concise", "Be creative",
          "Explain like I'm 5", and more.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Chip label="Concise" color="primary" variant="outlined" />
          <Chip label="Creative" color="primary" variant="outlined" />
          <Chip label="Professional" color="primary" variant="outlined" />
          <Chip label="Casual" color="primary" variant="outlined" />
        </Stack>
      </Paper>
    </Box>
  );
}
