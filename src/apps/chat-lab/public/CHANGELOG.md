# Changelog

All notable changes to FIDU Chat Lab will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - UNRELEASED

### Added
- "What is the Chat-Lab?" information dropdown on the storage selection modal for first-time visitors to help them understand the app's purpose and features
- Proactive token validation on app initialization to detect expired or revoked tokens early
- Better error handling for refresh token expiration with clear user-facing error messages

### Changed
- **Google Drive Authentication**: Changed OAuth prompt from `consent` to `select_account` to avoid forcing users to re-authorize on every login. Users will now only need to re-authenticate when they explicitly revoke access or after 6 months of inactivity
- Improved token refresh logic to handle refresh token expiration gracefully and clear stored tokens when they become invalid

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

