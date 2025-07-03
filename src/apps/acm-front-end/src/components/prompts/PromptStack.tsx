import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Chip,
  IconButton,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  Minimize as MinimizeIcon,
  Terminal as TerminalIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface ContextSuggestion {
  id: string;
  title: string;
  description: string;
  relevanceScore: number;
  tokenCount: number;
  type: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
}

interface PromptStackProps {
  stackMinimized: boolean;
  stackExpanded: boolean;
  totalTokens: number;
  debouncedPromptText: string;
  debouncedPromptTokens: number;
  selectedContext: ContextSuggestion | null;
  localSelectedModels: string[];
  mockModels: Model[];
  promptText: string;
  isExecuting: boolean;
  executionError: string | null;
  onMinimize: () => void;
  onToggleExpanded: () => void;
  onRemoveContext: () => void;
  onRemoveModel: (modelId: string) => void;
  onExecute: () => void;
  onSave: () => void;
}

export const PromptStack = React.memo<PromptStackProps>(({
  stackMinimized,
  stackExpanded,
  totalTokens,
  debouncedPromptText,
  debouncedPromptTokens,
  selectedContext,
  localSelectedModels,
  mockModels,
  promptText,
  isExecuting,
  executionError,
  onMinimize,
  onToggleExpanded,
  onRemoveContext,
  onRemoveModel,
  onExecute,
  onSave
}) => {
  const handleRemoveModel = useCallback((modelId: string) => {
    onRemoveModel(modelId);
  }, [onRemoveModel]);

  if (stackMinimized) {
    return (
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 16, 
          right: 16, 
          p: 1,
          zIndex: 1000,
          cursor: 'pointer',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText'
        }}
        onClick={onMinimize}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TerminalIcon />
          <Typography variant="body2">Prompt Stack ({totalTokens} tokens)</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        top: 80, 
        right: 16, 
        width: 350, 
        maxHeight: 'calc(100vh - 100px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <TerminalIcon color="primary" />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Prompt Stack
        </Typography>
        <Chip 
          label={`${totalTokens} tokens`} 
          size="small" 
          color="primary"
        />
        <IconButton size="small" onClick={onMinimize}>
          <MinimizeIcon />
        </IconButton>
        <IconButton size="small" onClick={onToggleExpanded}>
          <ExpandMoreIcon sx={{ transform: stackExpanded ? 'rotate(180deg)' : 'none' }} />
        </IconButton>
      </Box>

      {/* Content */}
      {stackExpanded && (
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>

          {/* Current Prompt */}
          {debouncedPromptText && (
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Current Prompt
                </Typography>
                <Chip 
                  label={`${debouncedPromptTokens}t`} 
                  size="small" 
                  variant="outlined" 
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {debouncedPromptText.length > 150 
                  ? `${debouncedPromptText.substring(0, 150)}...` 
                  : debouncedPromptText
                }
              </Typography>
            </Box>
          )}

          {/* Selected Context */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Selected Context
            </Typography>
            {selectedContext ? (
              <Box sx={{ p: 1, backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {selectedContext.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip label={`${selectedContext.relevanceScore * 100}%`} size="small" color="success" />
                    <Chip label={`${selectedContext.tokenCount}t`} size="small" variant="outlined" />
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {selectedContext.description}
                </Typography>
                <Button 
                  size="small" 
                  variant="outlined" 
                  startIcon={<CloseIcon />}
                  onClick={onRemoveContext}
                  sx={{ mt: 0.5 }}
                >
                  Remove Context
                </Button>
              </Box>
            ) : (
              <Box sx={{ 
                p: 2, 
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', 
                borderRadius: 1, 
                textAlign: 'center',
                border: '2px dashed',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'grey.300'
              }}>
                <Typography variant="caption" color="text.secondary">
                  No context selected
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Select a context from the suggestions panel
                </Typography>
              </Box>
            )}
          </Box>

          {/* Selected Model */}
          {localSelectedModels.length > 0 && (
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Selected Model
              </Typography>
              {localSelectedModels.map((modelId: string) => {
                const model = mockModels.find(m => m.id === modelId);
                return model ? (
                  <Box key={modelId} sx={{ p: 1, backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {model.name}
                      </Typography>
                      <Chip label={model.provider} size="small" color="primary" />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Max tokens: {model.maxTokens.toLocaleString()}
                    </Typography>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      startIcon={<CloseIcon />}
                      onClick={() => handleRemoveModel(model.id)}
                      sx={{ mt: 0.5 }}
                    >
                      Remove Model
                    </Button>
                  </Box>
                ) : null;
              })}
            </Box>
          )}
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1}>
          <Button 
            variant="contained" 
            startIcon={isExecuting ? <CircularProgress size={16} /> : <PlayIcon />}
            size="small"
            fullWidth
            disabled={!promptText || totalTokens === 0 || isExecuting}
            onClick={onExecute}
          >
            {isExecuting ? 'Executing...' : 'Execute'}
          </Button>
          <IconButton size="small" onClick={onSave}>
            <SaveIcon />
          </IconButton>
        </Stack>
        {executionError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {executionError}
          </Alert>
        )}
      </Box>
    </Paper>
  );
});

PromptStack.displayName = 'PromptStack'; 