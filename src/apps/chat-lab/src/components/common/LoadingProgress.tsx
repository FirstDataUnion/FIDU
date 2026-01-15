/**
 * Loading Progress Component
 *
 * A unified loading screen with step-by-step progress indicators.
 * This component provides clear feedback to users about what's happening
 * during initialization and authentication.
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ErrorIcon from '@mui/icons-material/Error';

export interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  errorMessage?: string;
}

export interface LoadingProgressProps {
  steps: LoadingStep[];
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
}

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  steps,
  title = 'Initializing FIDU Chat Lab...',
  subtitle,
  showProgress = true,
}) => {
  // Calculate progress percentage
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercentage =
    totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  // Get current step
  const currentStep = steps.find(s => s.status === 'in_progress');
  const hasError = steps.some(s => s.status === 'error');

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      flexDirection="column"
      gap={3}
      p={3}
    >
      {/* Main spinner */}
      <CircularProgress size={60} />

      {/* Title */}
      <Typography variant="h6" textAlign="center">
        {title}
      </Typography>

      {/* Subtitle */}
      {subtitle && (
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {subtitle}
        </Typography>
      )}

      {/* Progress bar */}
      {showProgress && !hasError && (
        <Box width="100%" maxWidth="400px">
          <LinearProgress
            variant="determinate"
            value={progressPercentage}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            textAlign="center"
            display="block"
            mt={0.5}
          >
            {completedSteps} of {totalSteps} steps completed
          </Typography>
        </Box>
      )}

      {/* Step list */}
      <Box
        width="100%"
        maxWidth="500px"
        bgcolor="background.paper"
        borderRadius={2}
        p={2}
        boxShadow={1}
      >
        {steps.map((step, index) => {
          const isActive = step.status === 'in_progress';
          const isCompleted = step.status === 'completed';
          const isError = step.status === 'error';
          const isPending = step.status === 'pending';

          return (
            <Box
              key={step.id}
              display="flex"
              alignItems="center"
              gap={2}
              mb={index < steps.length - 1 ? 1.5 : 0}
              sx={{
                opacity: isPending ? 0.5 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              {/* Status icon */}
              {isCompleted && (
                <CheckCircleIcon sx={{ color: 'success.main', fontSize: 24 }} />
              )}
              {isActive && (
                <CircularProgress size={20} sx={{ color: 'primary.main' }} />
              )}
              {isError && (
                <ErrorIcon sx={{ color: 'error.main', fontSize: 24 }} />
              )}
              {isPending && (
                <RadioButtonUncheckedIcon
                  sx={{ color: 'text.disabled', fontSize: 24 }}
                />
              )}

              {/* Step label and error message */}
              <Box flex={1}>
                <Typography
                  variant="body2"
                  fontWeight={isActive ? 600 : 400}
                  color={
                    isError ? 'error' : isActive ? 'primary' : 'text.primary'
                  }
                >
                  {step.label}
                </Typography>
                {isError && step.errorMessage && (
                  <Typography
                    variant="caption"
                    color="error"
                    display="block"
                    mt={0.5}
                  >
                    {step.errorMessage}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Current step message */}
      {currentStep && !hasError && (
        <Typography
          variant="caption"
          color="text.secondary"
          textAlign="center"
          maxWidth="400px"
        >
          {currentStep.label}... This may take a few moments.
        </Typography>
      )}

      {/* Error message */}
      {hasError && (
        <Box
          color="error.main"
          textAlign="center"
          maxWidth="400px"
          bgcolor="error.light"
          p={2}
          borderRadius={2}
        >
          <Typography fontWeight="bold" mb={1}>
            Initialization Error
          </Typography>
          <Typography fontSize="0.9em">
            Please check your connection and try again.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default LoadingProgress;
