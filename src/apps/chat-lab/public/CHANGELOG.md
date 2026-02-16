# Changelog

All notable changes to FIDU Chat Lab will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - UNRELEASED

### Changed
- **UI Simplification** Redesigned the main UI to slim down the number of buttons available. Most options have been moved to settings. Profiles and workspaces have been merged into the single concept of "workspaces". Feature flags have been set more aggressively to reduce initial number of features, but these can all be set back on via the settings menu. 

## [0.2.1] - 2026-02-11

### Added
- **Conversation renaming**: Add ability to rename conversations in Conversations page.
- **Conversation deletion**: Add ability to delete conversations in Conversations page.
- **Most-used models**: Calculate most-frequently used models (locally) and display at the top of the list.

### Changed
- **Post-rewind Ghost Messages**: When rewinding, the previous messages hang around (as ghosts) while the chat page is open so the responses can be compared.
- **Default sync timer**: Now syncs after 1 minute unless overridden by user in settings.

### Fixed
- **Cancel Request**: Pressing the Cancel Request button now stops polling for message completion and the response will not be added to the conversation.
- **Preserve Indentation**: No longer strip out indentation in code blocks or nested bullet points
- **Recognise Inline Codeblocks**: No longer put `single-backticked` strings on their own line
- **Rewinding to top deletes conversation**: That way new conversation gets suitable name created

## [0.2.0] - 2026-01-21

### Added
- **Shared Workspaces**: Experimental team collaboration feature (behind feature flag) allowing multiple users to share conversations, contexts, system prompts, and background agents through a shared Google Drive folder
- **Feature Flags System**: User-configurable feature flags allowing users to enable/disable experimental features and customize their experience
- **Last Sync UI**: Extra UI to show last successful sync to google drive, and current sync health status

### Changed
- **Token Handling**: Improved auth and refresh token logic to reduce authentication issues
- **Drive Sync Resilience**: Added extra mechanisms to try to automatically recover from sync failures from long lived sessions
- **Allow Multiple Context Selection**: Multiple contexts can now be added to a prompt at once

### Fixed
- **Prompt Persistence**: Current prompt persists across page navigations (such as adding system prompt)
- **UI Data Refresh**: UI data (contexts, documents, etc.) now automatically refreshes after sync operations to ensure consistency

## [0.1.9] - 2025-12-04

### Added
- **Background Agent Model Selection**: Allow a model used by background agents to be manually chosen.
- **Background Agent to Document**: Allow creation of a background agent which writes to a document instead of alerting.
- **Welcome/Explainer page**: Help explain the site and onboard new users.
- **Links to GitHub Issues**: In welcome page and sidebar - please let us know how things are going for you!

### Changed
- **Clear Context Button**: Added a button to clear the current context on the chat page. 
- **Disable ethics monitor**: Added ability to disable the ethics background agent
- **Background Agent UI**: Alerts no longer appear within messages, instead the chat bubble interface has been improved, and the alert bubbles are now clickable taking you to an expanded view.
- **Storage Mode Simplification**: Removed LocalFileSystem storage support from cloud deployments. Now exclusively uses Google Drive storage, streamlining the setup process and simplifying the app.

### Fixed
- **Background Agent Verbosity**: Fixed issue that meant verbosity threshold changes in Chat page weren't persisted correctly. 
- **Context Clearing**: Contexts now reset when starting a new conversation.

## [0.1.8] - 2025-11-08

### Changed
- **Model display**: Assistant message badges now show the actual provider and model returned by executions (including auto-router selections) with graceful fallbacks to the requested model when routing details are unavailable.
- **Import & Export hub**: Dedicated navigation page that surfaces mass resource backup and restore actions in a single place, moving the controls out of the general settings area.

### Fixed
- **Conversation storage tags**: Ensure updates always retain required protected tags so newly created chats stay visible on the conversations page and sync correctly to Google Drive, fixing bug that caused conversations to not be saved. 
- **Immediate logout restore**: Wait for Google Drive re-initialization before finishing login so immediate logout→login cycles no longer trigger storage errors.
- **Authentication logout loops**: Fixed infinite logout loops caused by stuck logout coordinator state with automatic 10-second timeout recovery
- **Login Window not appearing afer logout**: Fixed a bug that caused the login window to not load correctly after logging out.
- **Google Auth Failed**: Fixed edge cases where Google Drive auth can fail due to a token encoding error, now automatically recovers. 
- **Background agent configuration inputs**: Debounced numeric inputs so background agents no longer refresh on every keystroke and replaced verbosity fields with sliders for smoother adjustments across the app.

## [0.1.7] - 2025-11-06

### Added
- **FIDU Challenger System Prompt**: new built in system prompt to help challenge and strengthen ideas. 
- **Background Agents**: initial scaffolding (DataPacket-based schema/API client) to support configurable background analysis agents stored like system prompts.
- **Background Agents**: Customisable agents that can be triggered to run the background of a conversation, performing various evaluation tasks and reporting back to the user in a configurable approach
- **FIDU Evaluator Background Agent**: Added one built in background agent thay performs analysis for eithical issues in a chat bot, alerting the user if any are found. 
- **Import/Export process**: Added the ability to export resources (System Prompts, Contexts, Conversations, BackgroundAgents) in JSON files that can then be imported again user another profile, user, etc. intended as an early sharing mechanism. All resource display cards now show an export button that allow multi selection, and there is a settings option that allows for mass exporting of multiple resource types in a single file. 

### Changed
- **Register Process**: Registration process now redirects users to ID service dashboard and then redirects them to chat lab once registration completes, to provide a unified registration window. 


### Fixed
- **Local login race condition**: fixed an issue where the FIDU login window would never appear when running locally due to initializing the SDK before it was ready. Added a robust readiness wait-and-retry to ensure the SDK is available before initialization.
- **Wharton System Prompts**: fixed some of the prompt content and token estimations of the wharton system prompts.
- **Model Selection Reset on un-focus**: fixed a bug that caused the model selection to reset to default when focus was lost/regained to the chatlab window. 

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
