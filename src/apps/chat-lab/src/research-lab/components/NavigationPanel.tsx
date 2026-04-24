import { IconButton, Paper, Stack } from '@mui/material';
import {
  Close as CloseIcon,
  ArrowUpward as UpIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function NavigationPanel({
  upUrl,
  showBack,
}: {
  upUrl?: string;
  showBack: boolean;
}) {
  const navigate = useNavigate();
  const shouldShowUp = !!upUrl;
  const shouldShowBack = showBack && !upUrl;

  return (
    <Paper>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <IconButton
          onClick={() => {
            navigate('/research-lab/');
          }}
        >
          <CloseIcon />
        </IconButton>
        {shouldShowUp && (
          <IconButton
            onClick={() => {
              if (upUrl) {
                navigate(upUrl);
              }
            }}
          >
            <UpIcon />
          </IconButton>
        )}
        {shouldShowBack && (
          <IconButton
            onClick={() => {
              navigate(-1);
            }}
          >
            <BackIcon />
          </IconButton>
        )}
      </Stack>
    </Paper>
  );
}
