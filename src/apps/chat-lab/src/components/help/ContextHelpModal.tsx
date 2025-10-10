import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';

interface ContextHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ContextHelpModal({ open, onClose }: ContextHelpModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HelpOutlineIcon color="primary" />
        <Typography variant="h6" component="span">
          What are "Contexts"?
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ py: 1 }}>
          <Typography variant="body1" paragraph>
            Contexts are collections of information that you can create based on previous 
            conversations you've had with models, or wish to add from anywhere else. You can 
            add a context to a conversation so that the model will have access to this 
            information, and be able to answer your queries with ease.
          </Typography>
          
          <Typography variant="body1" paragraph sx={{ mb: 2 }}>
            For example, if you ask frequent questions about your car, you may have a context 
            that has a lot of specific information about your car (make, model, year, previous 
            issues it's had, etc.). Then when asking a new question about your car, add this 
            context to the chat, and the model will be able to reference this info without 
            asking you to clarify every time.
          </Typography>
          
          <Box 
            sx={{ 
              p: 2, 
              bgcolor: 'primary.light', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'primary.main'
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              💡 Tip
            </Typography>
            <Typography variant="body2">
              Create contexts for topics you frequently discuss to save time and get more 
              accurate responses without repeating yourself.
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
}

