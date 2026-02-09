import { Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ImportExport as ImportExportIcon,
  Email as EmailIcon,
} from '@mui/icons-material';

const DeleteAccountPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Container maxWidth="md">
      <Typography variant="h3" gutterBottom>
        Delete Account
      </Typography>
      <Typography variant="body1" gutterBottom>
        To delete your account, please contact us at privacy@firstdataunion.org
        from the email address associated with your account. We will process
        your request within 30 days.
      </Typography>
      <Typography variant="body1" gutterBottom>
        Once your account is deleted, you will not be able to recover your
        account or data.
      </Typography>
      <Typography variant="body1" gutterBottom>
        Please consider using the Export feature to save your data before
        deleting your account.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2, mr: 2 }}
        onClick={() => navigate('/import-export')}
      >
        <ImportExportIcon sx={{ mr: 1 }} /> Export Data
      </Button>
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2 }}
        onClick={() => {
          const subject = encodeURIComponent('Request to Delete Account');
          window.location.href = `mailto:privacy@firstdataunion.org?subject=${subject}`;
        }}
      >
        <EmailIcon sx={{ mr: 1 }} /> Contact Support
      </Button>
    </Container>
  );
};

export default DeleteAccountPage;
