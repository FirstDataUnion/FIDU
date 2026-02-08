import React from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Alert,
} from '@mui/material';
import {
  DeleteForever as DeleteAccountIcon,
  FileUpload as ExportIcon,
  Email as EmailIcon,
} from '@mui/icons-material';

interface DeleteAccountSettingsProps {
  onExportClick?: () => void;
}

export const DeleteAccountSettings: React.FC<DeleteAccountSettingsProps> = ({
  onExportClick,
}) => {
  const handleContactSupport = () => {
    const subject = encodeURIComponent('Request to Delete Account');
    window.location.href = `mailto:support@firstdataunion.org?subject=${subject}`;
  };

  const handleExportClick = () => {
    if (onExportClick) {
      onExportClick();
    }
  };

  return (
    <>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <DeleteAccountIcon />
        Delete Account
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        To delete your account, please contact us at support@firstdataunion.org
        from the email address associated with your account. We will process your
        request within 30 days.
      </Typography>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Warning:</strong> Once your account is deleted, you will not be
          able to recover your account or data. Please consider using the Export
          feature to save your data before deleting your account.
        </Typography>
      </Alert>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        <Button
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={handleExportClick}
        >
          Export Data First
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<EmailIcon />}
          onClick={handleContactSupport}
        >
          Contact Support to Delete Account
        </Button>
      </Stack>
    </>
  );
};
