import { useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Modal,
  Tooltip,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { Attachment } from '../../types';

type ImageAttachment = Attachment & { url: string };

export interface AssistantAttachmentImageProps {
  attachment: ImageAttachment;
}

function inferImageExtension(attachment: ImageAttachment): string {
  const mimeType = attachment.mimeType || '';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  const dataUrlMime = /^data:([^;]+);/i.exec(attachment.url)?.[1] || '';
  if (dataUrlMime.includes('png')) return 'png';
  if (dataUrlMime.includes('jpeg') || dataUrlMime.includes('jpg')) return 'jpg';
  if (dataUrlMime.includes('webp')) return 'webp';
  if (dataUrlMime.includes('gif')) return 'gif';
  return 'png';
}

function buildDownloadFileName(attachment: ImageAttachment): string {
  const base = attachment.name?.trim() || 'generated-image';
  const sanitized = base.replace(/[^\w.-]+/g, '-');
  const ext = inferImageExtension(attachment);
  return sanitized.toLowerCase().endsWith(`.${ext}`)
    ? sanitized
    : `${sanitized}.${ext}`;
}

/**
 * Renders a generated image with a loading indicator until the browser finishes
 * loading/decoding the URL (noticeable for large data URLs).
 */
export function AssistantAttachmentImage({
  attachment,
}: AssistantAttachmentImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <Box
      sx={{
        position: 'relative',
        maxWidth: '100%',
        minHeight: !loaded && !failed ? 120 : undefined,
        borderRadius: 1,
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!loaded && !failed && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <CircularProgress size={28} thickness={4} />
        </Box>
      )}
      {!failed && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            opacity: loaded ? 1 : 0.7,
            transition: 'opacity 0.2s ease',
          }}
        >
          <Tooltip title="Download image">
            <IconButton
              component="a"
              href={attachment.url}
              download={buildDownloadFileName(attachment)}
              size="small"
              onClick={event => event.stopPropagation()}
              sx={{
                bgcolor: 'rgba(0,0,0,0.55)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
              }}
              aria-label="Download image"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      {!failed ? (
        <Box
          component="img"
          data-testid="assistant-attachment-inline-image"
          src={attachment.url}
          alt={attachment.name}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onClick={() => setIsFullscreen(true)}
          sx={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 1,
            display: 'block',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.2s ease',
            cursor: 'zoom-in',
          }}
        />
      ) : (
        <Typography variant="caption" color="error" sx={{ p: 2 }}>
          Image failed to load
        </Typography>
      )}

      <Modal open={isFullscreen} onClose={() => setIsFullscreen(false)}>
        <Box
          data-testid="assistant-attachment-fullscreen-overlay"
          onClick={() => setIsFullscreen(false)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            bgcolor: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
            cursor: 'zoom-out',
          }}
        >
          <Box
            component="img"
            data-testid="assistant-attachment-fullscreen-image"
            src={attachment.url}
            alt={attachment.name}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 1,
              display: 'block',
            }}
          />
        </Box>
      </Modal>
    </Box>
  );
}
