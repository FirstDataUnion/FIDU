# Database File Locations

This document describes where the FIDU application stores its database file on different operating systems.

## Overview

The FIDU application now uses consistent, OS-appropriate locations for storing the database file (`fidu.db`). This ensures that:

- Database files persist across application updates
- Data is stored in standard application data directories
- Users can easily locate and backup their data
- Multiple versions of the application can share the same database

## Database Locations by Operating System

### Windows
- **Path**: `%APPDATA%\FIDU\fidu.db`
- **Example**: `C:\Users\Username\AppData\Roaming\FIDU\fidu.db`
- **Fallback**: `C:\Users\Username\AppData\Roaming\FIDU\fidu.db`

### macOS
- **Path**: `~/Library/Application Support/FIDU/fidu.db`
- **Example**: `/Users/username/Library/Application Support/FIDU/fidu.db`

### Linux
- **Path**: `~/.local/share/fidu/fidu.db`
- **Example**: `/home/username/.local/share/fidu/fidu.db`

## Migration

When you first run the updated application, it will automatically:

1. Check if a database exists in the old location (current working directory)
2. If found, copy it to the new location
3. Leave the old database in place (you can delete it manually if desired)
4. Use the new location for all future operations

## Benefits

- **Consistency**: Database is always in the same location regardless of where the application is run from
- **Persistence**: Data survives application updates and reinstallations
- **Standards Compliance**: Uses standard OS application data directories
- **Backup Friendly**: Easy to locate for backup and restore operations
- **Multi-User Support**: Each user gets their own database in their home directory

## Troubleshooting

If you encounter issues with database access:

1. Check that the application data directory exists and is writable
2. Verify file permissions on the database file
3. Ensure sufficient disk space in the user's home directory
4. Check application logs for migration or path-related errors

## Manual Database Location Override

For testing or special use cases, you can override the database location by setting the `_TEST_DB_PATH` variable in the database utilities module. This is primarily intended for testing purposes.
