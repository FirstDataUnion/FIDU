import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, List, ListItem, ListItemButton } from '@mui/material';
// Icons are now imported in their respective components
// State management is now handled in individual components
import {
  APIKeyManager,
  SettingsSectionCard,
  AppearanceSettings,
  ImportExportSettings,
  PrivacySettings,
  DeleteAccountSettings,
  GoogleDriveDataSettings,
  WhatsNewSettings,
  CustomiseFeaturesSettings,
} from '../components/settings';
interface Section {
  id: string;
  label: string;
  visible: boolean;
}

// Define sections (static, no dependencies)
const sections: Section[] = [
  { id: 'appearance', label: 'Appearance', visible: true },
  { id: 'whats-new', label: "What's New", visible: true },
  { id: 'customise-features', label: 'Customise Features', visible: true },
  { id: 'sync-settings', label: 'Google Drive Data', visible: true },
  { id: 'import-export', label: 'Import & Export', visible: true },
  { id: 'privacy', label: 'Privacy & Data Collection', visible: true },
  { id: 'api-keys', label: 'Model API Keys', visible: true },
  { id: 'delete-account', label: 'Delete Account', visible: true },
];

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('appearance');

  // Refs for each section
  const appearanceRef = useRef<HTMLDivElement>(null);
  const syncSettingsRef = useRef<HTMLDivElement>(null);
  const importExportRef = useRef<HTMLDivElement>(null);
  const privacyRef = useRef<HTMLDivElement>(null);
  const apiKeysRef = useRef<HTMLDivElement>(null);
  const whatsNewRef = useRef<HTMLDivElement>(null);
  const customiseFeaturesRef = useRef<HTMLDivElement>(null);
  const deleteAccountRef = useRef<HTMLDivElement>(null);

  // Ref for the main content container (the scrollable box)
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Scroll to section handler
  const scrollToSection = useCallback((sectionId: string) => {
    const refs: { [key: string]: React.RefObject<HTMLDivElement | null> } = {
      appearance: appearanceRef,
      'sync-settings': syncSettingsRef,
      'import-export': importExportRef,
      privacy: privacyRef,
      'api-keys': apiKeysRef,
      'whats-new': whatsNewRef,
      'customise-features': customiseFeaturesRef,
      'delete-account': deleteAccountRef,
    };

    const ref = refs[sectionId];
    if (!ref?.current) {
      console.warn(`Section ref not found for: ${sectionId}`);
      return;
    }

    // Get the scrollable container (same reference as scroll spy)
    const scrollContainer =
      mainContentRef.current?.parentElement?.parentElement;
    if (!scrollContainer) {
      console.warn('Scroll container not found');
      return;
    }

    const element = ref.current;
    const offset = 50; // Offset from top of viewport for better visibility

    // getBoundingClientRect() returns position relative to viewport
    // scrollContainer.scrollTop is current scroll position of the container
    // We need to calculate position relative to the scrollable container
    const rect = element.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();

    // Calculate position relative to the scrollable container
    const elementTopRelativeToContainer =
      rect.top - containerRect.top + scrollContainer.scrollTop;
    const targetPosition = elementTopRelativeToContainer - offset;

    // Immediately update active section when clicking (visual feedback)
    setActiveSection(sectionId);

    // Smoothly scroll the container to the calculated position
    scrollContainer.scrollTo({
      top: Math.max(0, targetPosition), // Ensure we don't scroll to negative position
      behavior: 'smooth',
    });
  }, []);

  // Scroll spy functionality
  useEffect(() => {
    const handleScroll = () => {
      const scrollOffset = 150; // Offset from top of viewport

      // Get the scrollable container
      const scrollContainer =
        mainContentRef.current?.parentElement?.parentElement;
      if (!scrollContainer) return;

      const refs = [
        { id: 'appearance', ref: appearanceRef },
        { id: 'whats-new', ref: whatsNewRef },
        { id: 'customise-features', ref: customiseFeaturesRef },
        { id: 'sync-settings', ref: syncSettingsRef },
        { id: 'import-export', ref: importExportRef },
        { id: 'privacy', ref: privacyRef },
        { id: 'api-keys', ref: apiKeysRef },
        { id: 'delete-account', ref: deleteAccountRef },
      ].filter(({ id }) => sections.some(s => s.id === id));

      // Check if scrolled to the bottom (within 5px threshold for rounding)
      const isAtBottom =
        scrollContainer.scrollTop + scrollContainer.clientHeight
        >= scrollContainer.scrollHeight - 5;

      let activeId: string | null = null;

      // If scrolled to bottom, highlight the last section
      if (isAtBottom && refs.length > 0) {
        activeId = refs[refs.length - 1].id;
      } else {
        // Otherwise, find the section that's currently at or above the viewport threshold
        // getBoundingClientRect().top is relative to viewport, so we can use it directly
        for (let i = refs.length - 1; i >= 0; i--) {
          const element = refs[i].ref.current;
          if (element) {
            const rect = element.getBoundingClientRect();
            // If the top of this section is at or above our threshold (150px from top of viewport)
            if (rect.top <= scrollOffset) {
              activeId = refs[i].id;
              break;
            }
          }
        }
      }

      // Only update if we found a section (prevents clearing active section at top of page)
      if (activeId) {
        setActiveSection(activeId);
      }
    };

    // The Layout component creates a Box with overflow: 'auto' that wraps our content
    // DOM structure: Layout's scrollable Box (grandparent) -> SettingsPage root Box (parent) -> mainContentRef Box
    // The scrollable container is the grandparent (parent of parent) of mainContentRef
    const scrollContainer =
      mainContentRef.current?.parentElement?.parentElement;

    if (scrollContainer) {
      // Attach listener to the scrollable container
      scrollContainer.addEventListener('scroll', handleScroll, {
        passive: true,
      });
    } else {
      // Fallback to window if scrollable container not found
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  // Handle hash navigation on mount/route change
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove the #
    if (hash && hash === 'sync-settings') {
      // Small delay to ensure refs are mounted
      setTimeout(() => {
        scrollToSection('sync-settings');
      }, 100);
    }
  }, [scrollToSection]);

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        py: { xs: 2, md: 3 },
        px: { xs: 2, md: 3 },
        boxSizing: 'border-box',
        display: 'flex',
        gap: { xs: 0, md: 3 },
      }}
    >
      {/* Left Navigation Sidebar - Hidden on mobile */}
      <Box
        sx={{
          width: 240,
          flexShrink: 0,
          position: 'sticky',
          top: 20,
          alignSelf: 'flex-start',
          p: 2,
          borderRight: 1,
          borderColor: 'divider',
          display: { xs: 'none', md: 'block' },
        }}
      >
        <List sx={{ p: 0 }}>
          {sections.map(section => (
            <ListItem key={section.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => scrollToSection(section.id)}
                sx={{
                  borderRadius: 1,
                  py: 1,
                  px: 2,
                  backgroundColor:
                    activeSection === section.id
                      ? theme =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.08)'
                      : 'transparent',
                  color:
                    activeSection === section.id
                      ? 'text.primary'
                      : 'text.secondary',
                  '&:hover': {
                    backgroundColor: theme =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: activeSection === section.id ? 500 : 400,
                  }}
                >
                  {section.label}
                </Typography>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Main Content */}
      <Box
        ref={mainContentRef}
        sx={{
          flex: 1,
          maxWidth: { xs: '100%', md: 600 },
          width: '100%',
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Customize your FIDU Chat Lab experience with these personal
          preferences.
        </Typography>

        {/* Appearance Settings */}
        <SettingsSectionCard ref={appearanceRef}>
          <AppearanceSettings />
        </SettingsSectionCard>

        {/* What's New */}
        <SettingsSectionCard ref={whatsNewRef}>
          <WhatsNewSettings />
        </SettingsSectionCard>

        {/* Customise Features */}
        <SettingsSectionCard ref={customiseFeaturesRef}>
          <CustomiseFeaturesSettings />
        </SettingsSectionCard>

        {/* Google Drive Data Settings */}
        <SettingsSectionCard ref={syncSettingsRef}>
          <GoogleDriveDataSettings />
        </SettingsSectionCard>

        {/* Import & Export Settings */}
        <SettingsSectionCard ref={importExportRef}>
          <ImportExportSettings />
        </SettingsSectionCard>

        {/* Privacy Settings */}
        <SettingsSectionCard ref={privacyRef}>
          <PrivacySettings />
        </SettingsSectionCard>

        {/* API Key Management */}
        <SettingsSectionCard ref={apiKeysRef}>
          <APIKeyManager />
        </SettingsSectionCard>

        {/* Delete Account */}
        <SettingsSectionCard ref={deleteAccountRef}>
          <DeleteAccountSettings
            onExportClick={() => scrollToSection('import-export')}
          />
        </SettingsSectionCard>
      </Box>
    </Box>
  );
};

export default SettingsPage;
