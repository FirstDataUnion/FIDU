import { Box, Button } from '@mui/material';
import { useCallback, useState } from 'react';
import NewContextCorpusDialog from './NewContextCorpusDialog';

export default function ContextCorporaTab() {
  const [newContextCorpusDialogOpen, setNewContextCorpusDialogOpen] =
    useState(false);

  const handleOpenNewCorpusDialog = useCallback(() => {
    setNewContextCorpusDialogOpen(true);
  }, []);

  return (
    <Box>
      <Button
        variant="outlined"
        color="primary"
        onClick={() => {
          handleOpenNewCorpusDialog();
        }}
      >
        Add New
      </Button>

      <NewContextCorpusDialog
        open={newContextCorpusDialogOpen}
        onClose={() => setNewContextCorpusDialogOpen(false)}
      />
    </Box>
  );
}
