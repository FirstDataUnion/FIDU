import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip
} from '@mui/material';

interface Model {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
}

interface ModelSelectionProps {
  models: Model[];
  selectedModels: string[];
  onModelToggle: (modelId: string) => void;
}

export const ModelSelection = React.memo<ModelSelectionProps>(({ 
  models, 
  selectedModels, 
  onModelToggle 
}) => {
  const handleModelClick = useCallback((modelId: string) => {
    onModelToggle(modelId);
  }, [onModelToggle]);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Models
      </Typography>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
        gap: 2 
      }}>
        {models.map((model) => (
          <Card 
            key={model.id}
            variant="outlined"
            sx={{ 
              cursor: 'pointer',
              border: selectedModels.includes(model.id) ? 2 : 1,
              borderColor: selectedModels.includes(model.id) ? 'primary.main' : 'divider'
            }}
            onClick={() => handleModelClick(model.id)}
          >
            <CardContent sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {model.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {model.provider}
              </Typography>
              <Chip 
                label={`${model.maxTokens.toLocaleString()} max`} 
                size="small" 
                variant="outlined"
              />
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
});

ModelSelection.displayName = 'ModelSelection'; 