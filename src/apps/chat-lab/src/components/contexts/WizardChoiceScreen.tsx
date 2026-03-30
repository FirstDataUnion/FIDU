import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';

const optionStyle = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  '&.Mui-selected': {
    borderColor: 'primary.main',
  },
};

export default function WizardChoiceScreen<T extends string>({
  title,
  choices,
  onChoiceMade,
}: {
  title: string;
  choices: {
    label: string;
    description: React.ReactNode[];
    value: T;
    disabled?: boolean;
  }[];
  onChoiceMade: (choice: T) => void;
}) {
  const [selectedChoice, setSelectedChoice] = useState<T | undefined>(
    undefined
  );

  const handleNext = useCallback(() => {
    setSelectedChoice(undefined);
    if (!selectedChoice) {
      console.error('Next pressed with no choice selected');
      return;
    }
    onChoiceMade(selectedChoice);
  }, [setSelectedChoice, onChoiceMade, selectedChoice]);

  return (
    <>
      <Box>
        <Typography>{title}</Typography>
        <List disablePadding sx={{ mt: 2 }}>
          {choices.map(choice => (
            <ListItem disablePadding sx={{ mb: 1 }} key={choice.value}>
              <ListItemButton
                selected={selectedChoice === choice.value}
                onClick={() => setSelectedChoice(choice.value)}
                disabled={choice.disabled}
                sx={optionStyle}
              >
                <ListItemText
                  primary={<Typography variant="h6">{choice.label}</Typography>}
                  slotProps={{ secondary: { component: 'div' } }}
                  secondary={<Stack direction="column" spacing={1}>
                    {choice.description.map((description, i) => (
                      <Typography variant="body2" color="text.secondary" key={`${choice.value}-${i}`}>
                        {description}
                      </Typography>
                    ))}
                  </Stack>}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="primary"
            disabled={!selectedChoice}
            onClick={handleNext}
          >
            Next
          </Button>
        </Box>
      </Box>
    </>
  );
}
