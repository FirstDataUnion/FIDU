# FIDU Version Management System

This document describes the centralized version management system for the FIDU application.

## Overview

The FIDU application uses a centralized version management system that:
- Maintains a single source of truth for all version information
- Automatically syncs versions across all components
- Provides automatic update checking from GitHub releases
- Displays version information in the user interface

## Architecture

### Central Version File

The `version.yaml` file in the project root serves as the single source of truth:

```yaml
version: "0.1.0"
build_number: 1
release_date: "2024-01-15"
release_notes: "Initial alpha release with basic functionality"

components:
  vault: "0.1.0"          # Python backend
  chat_lab: "0.1.0"       # React frontend
  chat_grabber: "0.1.0"   # Chrome extension

update_check:
  github_repo: "FirstDataUnion/FIDU"
  check_interval_hours: 24
  auto_check_enabled: true
```

### Components

The system manages versions for three main components:

1. **FIDU Vault** (`vault`) - Python backend server
2. **FIDU Chat Lab** (`chat_lab`) - React frontend application
3. **FIDU Chat Grabber** (`chat_grabber`) - Chrome browser extension

## Usage

### Updating Versions

#### Update All Components
```bash
# Update main version and sync all components
python3 scripts/update_version.py 0.2.0 --sync

# Update with release notes
python3 scripts/update_version.py 0.2.0 --notes "Added new features" --sync
```

#### Update Specific Component
```bash
# Update only the Chrome extension
python3 scripts/update_version.py 0.2.0 --component chat_grabber --sync
```

#### Manual Sync
```bash
# Sync all component files with current version.yaml
python3 scripts/sync_versions.py
```

### Version Checking

The system automatically checks for updates when users access the dashboard. The update checking:

- Queries GitHub releases API for the latest version
- Compares with the current version
- Displays update notifications to users
- Provides direct download links

## API Endpoints

The version system provides several API endpoints:

### Get Version Information
```http
GET /version/
```

Returns:
```json
{
  "main_version": "0.1.0",
  "build_number": 1,
  "release_date": "2024-01-15",
  "release_notes": "Initial alpha release",
  "components": {
    "vault": "0.1.0",
    "chat_lab": "0.1.0",
    "chat_grabber": "0.1.0"
  }
}
```

### Check for Updates
```http
GET /version/check-updates
```

Returns (when update available):
```json
{
  "status": "update_available",
  "current_version": "0.1.0",
  "latest_version": "0.2.0",
  "release_notes": "New features and bug fixes",
  "download_url": "https://github.com/FirstDataUnion/FIDU/releases/latest",
  "published_at": "2024-01-20T10:00:00Z",
  "prerelease": false
}
```

Returns (when up to date):
```json
{
  "status": "up_to_date",
  "current_version": "0.1.0",
  "message": "Application is up to date"
}
```

Returns (when check skipped due to rate limiting):
```json
{
  "status": "skipped",
  "message": "Update check skipped (disabled or too frequent)",
  "current_version": "0.1.0",
  "next_check_in_hours": 24
}
```

### Force Check for Updates
```http
POST /version/force-check-updates
```

Forces an immediate update check, ignoring the timer interval. Useful for testing or manual checks.

### Get Component Version
```http
GET /version/component/{component_name}
```

Where `component_name` is one of: `vault`, `chat_lab`, `chat_grabber`

## Frontend Integration

The dashboard automatically:
- Displays the current version in the navigation bar
- Checks for updates on page load
- Shows update notifications when available
- Provides download links to new releases

## File Locations

- **Central version file**: `version.yaml`
- **Python utilities**: `src/fidu_vault/utils/version.py`
- **API endpoints**: `src/fidu_vault/api/version.py`
- **Sync script**: `scripts/sync_versions.py`
- **Update script**: `scripts/update_version.py`

## Component Files Updated

The sync process updates these files:

- `pyproject.toml` - Python package version
- `src/fidu_vault/__init__.py` - Python module version
- `src/fidu_vault/main.py` - FastAPI app version
- `src/apps/chat-lab/package.json` - React app version
- `src/data_acquisition/fidu-chat-grabber/manifest.json` - Chrome extension version

## GitHub Integration

The system integrates with GitHub releases for update checking:

1. **Repository**: Configured in `version.yaml` under `update_check.github_repo`
2. **API**: Uses GitHub Releases API to fetch latest version
3. **Rate Limiting**: Respects GitHub API rate limits with configurable intervals
4. **Error Handling**: Gracefully handles API failures
5. **Caching**: Stores last check results to avoid excessive API calls

### Rate Limiting and Timer System

The update checker implements intelligent rate limiting to respect GitHub's API limits:

- **Configurable Interval**: Set `check_interval_hours` in `version.yaml` (default: 24 hours)
- **Database Tracking**: Stores last check time in local SQLite database
- **Cached Results**: Returns cached results when within the check interval
- **Force Check**: Manual override available via API endpoint
- **Error Handling**: Doesn't update timer on API failures, allowing retry sooner

#### Database Table

The system creates a `update_check_tracking` table to store:
- `last_check_timestamp`: When the last check was performed
- `last_check_result`: Cached JSON result from last successful check
- `created_timestamp`: When the record was first created
- `updated_timestamp`: When the record was last updated

### GitHub Release Version Format

For proper version comparison, GitHub releases must follow specific conventions:

#### ✅ Recommended Format
Use **semantic versioning** tags with `v` prefix:

```
v0.1.0
v0.1.1
v0.2.0
v1.0.0
```

#### 📋 GitHub Release Process

1. **Create a Git Tag**:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Create GitHub Release**:
   - Go to your GitHub repo → Releases → "Create a new release"
   - Select the tag `v0.1.0`
   - Set release title: `FIDU v0.1.0`
   - Add release notes describing changes
   - Mark as "Latest release" if it's the newest

#### 🔍 How Version Comparison Works

The version checker:
1. Fetches the latest release from GitHub API
2. Extracts the version from the `tag_name` field
3. Strips the `v` prefix (so `v0.1.0` becomes `0.1.0`)
4. Compares with your current version using semantic versioning

#### 📝 Example GitHub Release Structure

```json
{
  "tag_name": "v0.1.0",
  "name": "FIDU v0.1.0 - Initial Release",
  "body": "## What's New\n- Initial alpha release\n- Basic chat functionality\n- Data collection features",
  "draft": false,
  "prerelease": false,
  "published_at": "2024-01-15T10:00:00Z"
}
```

#### ⚠️ Common Mistakes to Avoid

**❌ Don't use these formats:**
- `release-0.1.0` (custom prefix)
- `0.1.0` (no v prefix - works but not standard)
- `FIDU-0.1.0` (custom prefix)
- `v0.1.0-beta` (prerelease should be marked in GitHub, not in tag)

**✅ Do use these formats:**
- `v0.1.0` (standard semantic versioning)
- `v1.0.0` (major releases)
- `v0.1.1` (patch releases)

#### 🚀 Recommended Release Workflow

1. **Update your version**:
   ```bash
   python3 scripts/update_version.py 0.1.0 --notes "Initial release" --sync
   ```

2. **Commit and push changes**:
   ```bash
   git add .
   git commit -m "Release v0.1.0"
   git push
   ```

3. **Create Git tag**:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. **Create GitHub release**:
   - Use the GitHub web interface
   - Select tag `v0.1.0`
   - Add release notes
   - Mark as "Latest release"

#### 🔧 Testing Your Setup

You can test if your version checking works by:

1. **Check current version**:
   ```bash
   curl http://localhost:4000/version/
   ```

2. **Test update check**:
   ```bash
   curl http://localhost:4000/version/check-updates
   ```

#### 📊 Version Comparison Logic

The system compares versions like this:
- `0.1.0` < `0.1.1` ✅
- `0.1.1` < `0.2.0` ✅  
- `0.2.0` < `1.0.0` ✅
- `1.0.0` < `1.0.1` ✅

#### 🎯 Pro Tips

1. **Always use `v` prefix** - it's the GitHub standard
2. **Keep release notes detailed** - they appear in update notifications
3. **Mark prereleases properly** - use GitHub's prerelease checkbox
4. **Use semantic versioning** - MAJOR.MINOR.PATCH format
5. **Test the update flow** - create a test release to verify it works

#### 📋 Release Checklist

- [ ] Tag format: `v0.1.0`
- [ ] Release title: `FIDU v0.1.0`
- [ ] Release notes: Detailed changelog
- [ ] Mark as "Latest release"
- [ ] Not marked as prerelease (unless it is)
- [ ] Version matches your `version.yaml`

## Best Practices

### Version Numbering
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Increment PATCH for bug fixes
- Increment MINOR for new features
- Increment MAJOR for breaking changes

### Release Process
1. Update `version.yaml` with new version
2. Run sync script to update all components
3. Test the application
4. Create GitHub release
5. Tag the release with version number

### Update Notifications
- Users see update notifications on the dashboard
- Notifications include version number and download link
- Users can dismiss notifications
- Notifications respect check intervals to avoid spam

## Troubleshooting

### Common Issues

**Version not syncing**: Run `python3 scripts/sync_versions.py` manually

**Update check failing**: Check GitHub repository configuration in `version.yaml`

**Frontend not showing version**: Ensure JavaScript is enabled and API endpoints are accessible

### Manual Override

If automatic syncing fails, manually update these files:
- `pyproject.toml`: Update `version = "X.Y.Z"`
- `package.json`: Update `"version": "X.Y.Z"`
- `manifest.json`: Update `"version": "X.Y.Z"`

