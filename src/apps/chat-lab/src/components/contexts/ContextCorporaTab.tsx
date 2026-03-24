import { Box, Typography } from '@mui/material';

export default function ContextCorporaTab() {
  return (
    <Box>
      <Typography variant="body1" color="text.secondary">
        A corpus is a collection of documents that you can allow the LLM to
        search for context when responding to you.
      </Typography>
    </Box>
  );
}
