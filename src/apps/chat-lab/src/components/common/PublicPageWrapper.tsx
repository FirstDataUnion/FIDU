import React from 'react';
import { Container } from '@mui/material';

/**
 * Minimal wrapper for public pages (Privacy Policy, Terms of Use)
 * Provides basic styling without the full app Layout, modals, or banners
 */
interface PublicPageWrapperProps {
  children: React.ReactNode;
}

const PublicPageWrapper: React.FC<PublicPageWrapperProps> = ({ children }) => {
  return (
    <Container
      maxWidth={false}
      sx={{
        minHeight: '100vh',
        py: 4,
        backgroundColor: 'background.default',
      }}
    >
      {children}
    </Container>
  );
};

export default PublicPageWrapper;
