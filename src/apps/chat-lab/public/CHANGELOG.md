# Changelog

All notable changes to FIDU Chat Lab will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-10-20

### Added

- **Enhanced Model Selection**: Added rich model information including capabilities, categories, speed ratings, cost tiers, and detailed descriptions
- **Auto Router Model**: Added intelligent model routing that automatically selects the best model for each task
- **Helpers for BYOK Filtering**: Added `isBYOKSupported` and `getModelsForMode` helpers to power UI filtering based on user-provided keys
- **OpenRouter BYOK Support**: Added OpenRouter as a provider option in API Key Manager; users can now use their own OpenRouter key to access all OpenRouter models in BYOK mode

### Fixed

- **API Key Persistence Issue**: Fixed critical bug where API keys were not persisting when using local file storage mode. The issue was caused by incorrect storage adapter routing and missing initialization state management
- **Storage Mode Fixes**: Various small fixes to make storage mode selection more persistant an automatic when returning to the page. 
- **Improved API Key Error Handling**: Enhanced error messages when storage is not configured, providing clear guidance to users about setting up storage options before managing API keys



### Changed
- **Default Model Selection**: Changed the default selected model from GPT-5.0 Nano to Auto Router for new users, providing intelligent automatic model routing out of the box
- **Model Architecture**: Completely refactored model management from hardcoded individual methods to a centralized, scalable configuration system
- **API Client**: Updated NLP Workbench API client to use dynamic model execution with automatic URL resolution and legacy model ID support
- **UI Components**: Enhanced model selection modals with rich metadata display, provider color coding, performance indicators, and improved tooltip functionality
- **Model Selection UX**: Redesigned model selection interface with better visual hierarchy, Auto Router prominence, and comprehensive filtering options
- **Backward Compatibility**: Maintained support for existing model IDs while adding new comprehensive model definitions
- **Google Drive Authentication**: Changed OAuth prompt from `consent` to `select_account` to avoid forcing users to re-authorize on every login. Users will now only need to re-authenticate when they explicitly revoke access or after 6 months of inactivity
- Improved token refresh logic to handle refresh token expiration gracefully and clear stored tokens when they become invalid
 - **Storage Persistence & Auto-Reconnect**: If users previously selected Google Drive, the app now auto-initiates OAuth on return and marks storage configured once authenticated, minimizing manual steps. A new local override `chatlab_auto_gdrive_auth=false` can disable auto-start.

## [0.1.3] - 2025-10-13

### Added
- Privacy Policy and Terms of Use documents
- This changelog!
- Google OAuth permissions guide for users
- Helpful tooltips for Contexts and System Prompts features

### Changed
- Reworked storage selection process for better user experience
- Better handling of new lines in chat messages

## [0.1.2] - 2025-10-11

### Added
- Initial release of FIDU Chat Lab web hosted version

---

## Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements and vulnerability fixes

