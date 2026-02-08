import React from 'react';
import { Card, CardContent, Box } from '@mui/material';

interface SettingsSectionCardProps {
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Reusable wrapper component for settings sections
 * Provides consistent Card styling and spacing
 */
export const SettingsSectionCard = React.forwardRef<
  HTMLDivElement,
  SettingsSectionCardProps
>(({ children }, ref) => {
  return (
    <Card sx={{ mt: 3 }} ref={ref}>
      <CardContent>{children}</CardContent>
    </Card>
  );
});

SettingsSectionCard.displayName = 'SettingsSectionCard';
