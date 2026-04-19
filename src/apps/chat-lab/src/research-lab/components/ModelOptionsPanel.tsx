import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  getProviderColor,
  groupModelsByProvider,
  modelMatchesSearchQuery,
} from '../../utils/modelListUtils';
import { useCorpusSessionContext } from '../contexts/CorpusSessionContext';

export default function ModelOptionsPanel({
  open,
  onToggleHeader,
}: {
  open: boolean;
  onToggleHeader: () => void;
}) {
  const { modelInfo } = useCorpusSessionContext();
  const [searchQuery, setSearchQuery] = useState('');

  const m =
    modelInfo === undefined
      ? {
          loading: true as const,
        }
      : { loading: false as const, ...modelInfo };

  const modelsByProvider = useMemo(() => {
    if (!modelInfo) {
      return [];
    }
    const filtered = modelInfo.models.filter(m =>
      modelMatchesSearchQuery(m, searchQuery)
    );
    return groupModelsByProvider(filtered);
  }, [modelInfo, searchQuery]);

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        flex: open ? '1 1 0' : '0 0 auto',
      }}
    >
      <Stack
        direction="row"
        justifyContent="center"
        alignItems="center"
        sx={{ borderBottom: 1, borderColor: 'divider', m: 1 }}
      >
        <Typography
          variant="h6"
          onClick={onToggleHeader}
          sx={{ cursor: 'pointer' }}
        >
          Model options
        </Typography>
      </Stack>
      {!m.loading && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, pb: 1 }}
        >
          {m.selectedModelId}
        </Typography>
      )}
      {open && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            px: 1,
            pb: 1,
            gap: 1,
          }}
        >
          {!m.loading && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => m.selectModel('openrouter/auto')}
            >
              Use Auto Router
            </Button>
          )}
          <TextField
            size="small"
            fullWidth
            placeholder="Search models..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18 }} color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: theme =>
                `${alpha(theme.palette.text.primary, 0.35)} ${theme.palette.background.paper}`,
            }}
          >
            {m.loading ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                Loading models…
              </Typography>
            ) : m.models.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                No models available
              </Typography>
            ) : modelsByProvider.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                No models match your search
              </Typography>
            ) : (
              modelsByProvider.map((group, index) => (
                <Accordion
                  key={group.key}
                  defaultExpanded={index === 0}
                  disableGutters
                  elevation={0}
                  square
                  sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:before': { display: 'none' },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      minHeight: 44,
                      px: 1,
                      bgcolor: 'action.hover',
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 1,
                        my: 0.75,
                      },
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {group.displayLabel}
                    </Typography>
                    <Chip
                      label={group.models.length}
                      size="small"
                      color={getProviderColor(group.key)}
                      variant="outlined"
                    />
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <List dense disablePadding component="ul">
                      {group.models.map(model => (
                        <ListItem key={model.id} disablePadding component="li">
                          <ListItemButton
                            onClick={() => m.selectModel(model.id)}
                            selected={m.selectedModelId === model.id}
                          >
                            <ListItemText
                              primary={model.name}
                              slotProps={{
                                primary: { typography: { variant: 'body2' } },
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
