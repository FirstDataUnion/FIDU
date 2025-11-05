# Changelog

All notable changes to FIDU Chat Lab will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7] - UNRELEASED

### Added
- **FIDU Challenger System Prompt**: new built in system prompt to help challenge and strengthen ideas. 
- **Background Agents**: initial scaffolding (DataPacket-based schema/API client) to support configurable background analysis agents stored like system prompts.
- **Background Agents**: Customisable agents that can be triggered to run the background of a conversation, performing various evaluation tasks and reporting back to the user in a configurable approach
- **FIDU Evaluator Background Agent**: Added one built in background agent thay performs analysis for eithical issues in a chat bot, alerting the user if any are found. 

### Changed
- **Register Process**: Registration process now redirects users to ID service dashboard and then redirects them to chat lab once registration completes, to provide a unified registration window. 


### Fixed
- **Local login race condition**: fixed an issue where the FIDU login window would never appear when running locally due to initializing the SDK before it was ready. Added a robust readiness wait-and-retry to ensure the SDK is available before initialization.
- **Wharton System Prompts**: fixed some of the prompt content and token estimations of the wharton system prompts.

## [0.1.6] - 2025-10-27

### Added
- **G-Drive re-auth button**: Added a quick "Re-Auth" one click button to the storage misconfiguration banner to allow for quick reconnection to google drive in the case that refresh tokens aren't available.

### Changed
- **Loading Screen improvements**: Centralised auth processes and upfront loading and a more visually pleasing process that will ensure all auth and data loading is completed before the app pages appear. 


### Fixed

- **Refresh Token Storage**: Fixed issue where access and refresh tokens weren't being recorded or used correctly at times. This will greatly improve the Chatlab's ability to keep a user logged into their FIDU account for longer periods. This will apply to both Google Drive and FIDU tokens, general auth stability should be massively improved. 
- **Better storage selection memory**: Also improved chatlabs ability to remember storage preferences and auto select+ initialise this on a return visit. 
- **Mobile Authentication Persistence Improvements**: Further changes to the storage of refresh tokens and user settings in cookies to prevent excessive re-authentication on mobile devices and browsers. Added better support for mobile specific events to ensure we always try to re-auth with drive automatically when we can. 


## [0.1.5] - 2025-10-23

### Added

- **Prompt Wizard**: Interactive wizard to help craft better prompts through guided questions, accessed by a button in the main chat window
- **System Prompt Suggestor Wizard**: Interactive librarian wizard to help users find suitable system prompts for their tasks, available via button in the system prompt drawer
- **Request Cancellation**: Users can now cancel long-running requests and continue with other tasks
- **Use This Prompt Button**: Added "Use This Prompt" button to system prompt cards that navigates to the prompt lab page, opens the system prompt drawer, and automatically applies the selected prompt
- **System Prompt Librarian Access**: Added "Find System Prompt" button to the system prompts page header that navigates to the prompt lab and automatically opens the librarian wizard
- **Mobile System Prompt Selection Improvements**: Enhanced mobile system prompt drawer with selected prompts pinned at the top, clear visual indication of active prompts, and easy access to the System Prompt Librarian
- **Mobile-Optimized Conversations Page**: Complete redesign of the conversations page for mobile devices with full-screen list and detail views, improved navigation, and compact conversation cards
- **Wharton Prompts Tab**: Added dedicated tab for Wharton Generative AI Labs system prompts in the System Prompts page, providing easy access to educational and instructional prompts

### Changed

- **More stable GDrive connection on Mobile**: Shifted some storage to http cookie based rather than local storage, making it more resilient to aggressive mobile storage cleaning, along with encryption for added security of Google API refresh tokens. 
- **Request Timeout**: Extended default timeout from 90 seconds to 10 minutes to accommodate longer model processing times
- **User Experience**: Enhanced UX for long-running requests with clear feedback, progress indication, and cancellation options
- **Smart System Prompt Replacement**: When only the default system prompt is selected, choosing a new prompt now replaces it instead of adding to it, eliminating the need to manually remove the default
- **Wizard System Prompts Separation**: Moved Prompt Wizard and System Prompt Suggestor into a dedicated wizard system prompts resource, removing them from the main system prompts list to reduce clutter


## [0.1.4] - 2025-10-20

### Added

- **Enhanced Model Selection**: Added rich model information including capabilities, categories, speed ratings, cost tiers, and detailed descriptions
- **Auto Router Model**: Added intelligent model routing that automatically selects the best model for each task
- **Helpers for BYOK Filtering**: Added `isBYOKSupported` and `getModelsForMode` helpers to power UI filtering based on user-provided keys
- **OpenRouter BYOK Support**: Added OpenRouter as a provider option in API Key Manager. users can now use their own OpenRouter key to access all OpenRouter models in BYOK mode

### Fixed

- **API Key Persistence Issue**: Fixed critical bug where API keys were not persisting when using local file storage mode. The issue was caused by incorrect storage adapter routing and missing initialization state management
- **Storage Mode Fixes**: Various small fixes to make storage mode selection more persistant an automatic when returning to the page. 
- **Improved API Key Error Handling**: Enhanced error messages when storage is not configured, providing clear guidance to users about setting up storage options before managing API keys



### Changed
- **Default Model Selection**: Changed the default selected model from GPT-5.0 Nano to Auto Router for new users, providing intelligent automatic model routing out of the box
- **Model Selection UX**: Redesigned model selection interface with better visual hierarchy, Auto Router prominence, and comprehensive filtering options
- **Google Drive Authentication**: Changed OAuth prompt from `consent` to `select_account` to avoid forcing users to re-authorize on every login. Users will now only need to re-authenticate when they explicitly revoke access or after 6 months of inactivity

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

