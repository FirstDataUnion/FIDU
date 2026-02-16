import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  AutoAwesome as AutoModeIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { updateTheme } from '../../store/slices/settingsSlice';

export const AppearanceSettings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { settings } = useAppSelector(state => state.settings);

  const handleThemeChange = (event: SelectChangeEvent<string>) => {
    const newTheme = event.target.value as 'light' | 'dark' | 'auto';
    dispatch(updateTheme(newTheme));
  };

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'light':
        return <LightModeIcon />;
      case 'dark':
        return <DarkModeIcon />;
      case 'auto':
        return <AutoModeIcon />;
      default:
        return <AutoModeIcon />;
    }
  };

  const getThemeDescription = (theme: string) => {
    switch (theme) {
      case 'light':
        return 'Always use light theme regardless of system preference';
      case 'dark':
        return 'Always use dark theme regardless of system preference';
      case 'auto':
        return 'Automatically switch between light and dark based on system preference';
      default:
        return 'Automatically switch between light and dark based on system preference';
    }
  };

  return (
    <>
      <Typography
        variant="h6"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        {getThemeIcon(settings.theme)}
        Appearance
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose how FIDU Chat Lab looks. You can set a specific theme or let it
        automatically match your system preference.
      </Typography>

      <FormControl fullWidth>
        <InputLabel id="theme-select-label">Theme</InputLabel>
        <Select
          labelId="theme-select-label"
          id="theme-select"
          value={settings.theme}
          label="Theme"
          onChange={handleThemeChange}
        >
          <MenuItem value="auto">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoModeIcon />
              Auto (System)
            </Box>
          </MenuItem>
          <MenuItem value="light">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LightModeIcon />
              Light
            </Box>
          </MenuItem>
          <MenuItem value="dark">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DarkModeIcon />
              Dark
            </Box>
          </MenuItem>
        </Select>
      </FormControl>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 2,
          p: 2,
          backgroundColor: 'action.hover',
          borderRadius: 1,
          fontStyle: 'italic',
        }}
      >
        {getThemeDescription(settings.theme)}
      </Typography>
    </>
  );
};
