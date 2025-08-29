import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material';

interface ContextBuilderProps {
  open: boolean;
  onClose: () => void;
  contextPreview: string;
  estimatedTokens: number;
  selectedCount: number;
  onExport: (format: 'clipboard' | 'json' | 'markdown') => void;
  onContextPreviewChange: (preview: string) => void;
}

const ContextBuilder: React.FC<ContextBuilderProps> = React.memo(({
  open,
  onClose,
  contextPreview,
  estimatedTokens,
  selectedCount,
  onExport,
  onContextPreviewChange,
}) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Context Builder
        <Typography variant="body2" color="text.secondary">
          {selectedCount} conversations • ~{estimatedTokens} tokens
        </Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          multiline
          fullWidth
          rows={12}
          value={contextPreview}
          onChange={(e) => onContextPreviewChange(e.target.value)}
          variant="outlined"
          placeholder="Your context will appear here..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: 'primary.dark' }}>
          Cancel
        </Button>
        <Button 
          onClick={() => onExport('clipboard')}
          startIcon={<CopyIcon />}
        >
          Copy to Clipboard
        </Button>
        <Button 
          onClick={() => onExport('markdown')}
          startIcon={<ExportIcon />}
        >
          Export Markdown
        </Button>
        <Button 
          onClick={() => onExport('json')}
          startIcon={<ExportIcon />}
        >
          Export JSON
        </Button>
      </DialogActions>
    </Dialog>
  );
});

ContextBuilder.displayName = 'ContextBuilder';

export default ContextBuilder;
