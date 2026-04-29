import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { Message } from '../../types';
import {
  buildConversationExportFilename,
  buildConversationExportText,
  collectImageAttachments,
  copyTextToClipboard,
  downloadImageByUrl,
  downloadTextFile,
  type ConversationExportFormat,
} from '../../utils/conversationExport';

interface ConversationCopyExportDialogProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  conversationTitle?: string;
  fullPromptText: string;
  onToast: (message: string) => void;
  initialDownloadFormat?: ConversationExportFormat;
  onDownloadFormatChange?: (format: ConversationExportFormat) => void;
}

export function ConversationCopyExportDialog({
  open,
  onClose,
  messages,
  conversationTitle,
  fullPromptText,
  onToast,
  initialDownloadFormat = 'markdown',
  onDownloadFormatChange,
}: ConversationCopyExportDialogProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [downloadFormat, setDownloadFormat] =
    useState<ConversationExportFormat>(initialDownloadFormat);
  const [includeImages, setIncludeImages] = useState(false);
  const handleDownloadFormatChange = (format: ConversationExportFormat) => {
    setDownloadFormat(format);
    onDownloadFormatChange?.(format);
  };

  const copyViewText = useMemo(
    () =>
      buildConversationExportText(messages, {
        format: 'txt',
        title: conversationTitle,
        includeTimestamps: false,
      }),
    [messages, conversationTitle]
  );

  useEffect(() => {
    setDownloadFormat(initialDownloadFormat);
  }, [initialDownloadFormat]);

  const handleCopyAll = async () => {
    await copyTextToClipboard(copyViewText);
    onToast('Conversation copied to clipboard!');
  };

  const handleCopyFullPrompt = async () => {
    await copyTextToClipboard(fullPromptText);
    onToast('Full prompt copied to clipboard!');
  };

  const handleDownload = async () => {
    const transcript = buildConversationExportText(messages, {
      format: downloadFormat,
      title: conversationTitle,
      includeTimestamps: false,
    });
    const filename = buildConversationExportFilename(
      conversationTitle,
      downloadFormat
    );
    downloadTextFile(transcript, filename, downloadFormat);

    if (!includeImages) {
      onToast('Conversation downloaded.');
      return;
    }

    const images = collectImageAttachments(messages);
    let successCount = 0;
    let failedCount = 0;
    for (const [index, image] of images.entries()) {
      const extension = image.fileName.includes('.') ? '' : '.png';
      const imageFilename = `${image.fileName || `image-${index + 1}`}${extension}`;
      try {
        await downloadImageByUrl(image.url, imageFilename);
        successCount += 1;
      } catch (_err) {
        failedCount += 1;
      }
    }

    if (images.length === 0) {
      onToast('Conversation downloaded. No downloadable images found.');
      return;
    }
    onToast(
      `Conversation downloaded. Images downloaded: ${successCount}${failedCount > 0 ? ` (${failedCount} unavailable)` : ''}.`
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Copy / Export Conversation</DialogTitle>
      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(_e, value) => setActiveTab(value)}
          sx={{ mb: 2 }}
        >
          <Tab label="View/Copy Transcript" />
          <Tab label="Download Conversation" />
          <Tab label="View/Copy Full Prompt" />
        </Tabs>

        {activeTab === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Clean transcript view for easy copy/paste.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={12}
              maxRows={20}
              value={copyViewText}
              InputProps={{ readOnly: true }}
            />
          </Box>
        )}

        {activeTab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="conversation-download-format-label">
                Format
              </InputLabel>
              <Select
                labelId="conversation-download-format-label"
                value={downloadFormat}
                label="Format"
                onChange={e =>
                  handleDownloadFormatChange(
                    e.target.value as ConversationExportFormat
                  )
                }
              >
                <MenuItem value="markdown">Markdown (.md)</MenuItem>
                <MenuItem value="txt">Text (.txt)</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeImages}
                  onChange={e => setIncludeImages(e.target.checked)}
                />
              }
              label="Include images (downloaded separately)"
            />
            <Alert severity="info" variant="outlined">
              Images are downloaded as separate files when available.
            </Alert>
          </Box>
        )}

        {activeTab === 2 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Full request payload view used to generate the response.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={12}
              maxRows={20}
              value={fullPromptText}
              InputProps={{ readOnly: true }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 2,
          gap: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {activeTab === 0 ? (
          <Button
            onClick={handleCopyAll}
            variant="contained"
            sx={{ fontWeight: 600 }}
          >
            Copy all
          </Button>
        ) : activeTab === 1 ? (
          <Button
            onClick={handleDownload}
            variant="contained"
            sx={{ fontWeight: 600 }}
          >
            Download conversation
          </Button>
        ) : (
          <Button
            onClick={handleCopyFullPrompt}
            variant="contained"
            sx={{ fontWeight: 600 }}
          >
            Copy full prompt
          </Button>
        )}
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            color: 'text.primary',
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'text.primary',
              backgroundColor: 'action.hover',
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConversationCopyExportDialog;
