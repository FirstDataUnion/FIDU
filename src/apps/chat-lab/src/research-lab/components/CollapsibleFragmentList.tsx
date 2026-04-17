import { Box, Button, List, ListItem, Typography } from '@mui/material';
import {
  KeyboardArrowDown as ExpandedIcon,
  KeyboardArrowRight as CollapsedIcon,
} from '@mui/icons-material';
import { Children, type ReactNode } from 'react';

export type CollapsibleFragmentListProps = {
  title: string;
  children: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  /** Rows shown from the end when collapsed; `0` = header only. Default `1`. */
  collapsedVisibleCount?: number;
};

export function CollapsibleFragmentList({
  title,
  children,
  collapsed,
  onToggle,
  collapsedVisibleCount: collapsedVisibleCountProp = 1,
}: CollapsibleFragmentListProps) {
  const fragments = Children.toArray(children);
  const collapsedVisibleCount = Math.max(
    0,
    Math.floor(collapsedVisibleCountProp)
  );

  const visibleFragments = collapsed
    ? collapsedVisibleCount === 0
      ? []
      : fragments.slice(-collapsedVisibleCount)
    : fragments;

  const hiddenCount = collapsed
    ? Math.max(0, fragments.length - visibleFragments.length)
    : 0;

  const showList = visibleFragments.length > 0;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'rgba(0, 0, 0, 0.12)',
        overflow: 'hidden',
        alignSelf: 'stretch',
      }}
    >
      <Button
        type="button"
        variant="text"
        color="inherit"
        fullWidth
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        endIcon={collapsed ? <CollapsedIcon /> : <ExpandedIcon />}
        sx={{
          justifyContent: 'space-between',
          px: 1.25,
          py: 0.75,
          minHeight: 0,
          textTransform: 'none',
          borderRadius: 0,
          borderBottom: showList ? 1 : 0,
          borderColor: 'rgba(255, 255, 255, 0.25)',
          '& .MuiButton-endIcon': { ml: 0.5, color: 'inherit' },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.95 }}>
          {title}
          {hiddenCount > 0 ? ` (${hiddenCount} hidden)` : null}
        </Typography>
      </Button>
      {showList ? (
        <List dense disablePadding sx={{ py: 0.5 }}>
          {visibleFragments.map((fragment, idx) => (
            <ListItem key={idx} disablePadding sx={{ px: 1.25 }}>
              {fragment}
            </ListItem>
          ))}
        </List>
      ) : null}
    </Box>
  );
}
