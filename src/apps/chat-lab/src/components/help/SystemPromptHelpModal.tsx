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

interface SystemPromptHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SystemPromptHelpModal({ open, onClose }: SystemPromptHelpModalProps) {
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
          What are "System Prompts"?
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ py: 1 }}>
          <Typography variant="body1" paragraph>
            System prompts are instructions to the model on how they should go about 
            answering your prompt. They can set the tone, professionalism, output format, 
            or otherwise specify how each model should respond to your prompt.
          </Typography>
          
          <Typography variant="body1" paragraph>
            The ChatLab comes included with a wide range of System Prompts sourced from 
            open source AI projects online, but you can also create your own custom ones 
            if you have very specific tasks you'd like the models to do, but don't want 
            to write out the same instructions every time.
          </Typography>
          
          <Typography variant="body1" paragraph sx={{ mb: 2 }}>
            Remember you can even try using multiple System Prompts at the same time, 
            though be warned that this could get experimental!
          </Typography>
          
          <Box 
            sx={{ 
              p: 2, 
              bgcolor: 'warning.light', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'warning.main'
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              ⚠️ Note
            </Typography>
            <Typography variant="body2">
              Using multiple system prompts simultaneously can produce interesting results, 
              but may also cause unexpected behavior as instructions could conflict.
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

