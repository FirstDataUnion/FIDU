# ACM Manager & Chat Page Saver - Update Functionality

## Overview

This document describes the new update functionality implemented in both the ACM Manager and Chat Page Saver Chrome extensions. The system now handles "already exists" scenarios gracefully by performing PUT updates to replace existing data entirely, rather than failing with duplicate creation attempts.

## Problem Solved

Previously, when trying to save an ACM or conversation that already existed in FIDU Core, the system would receive a 409 CONFLICT error and fail. This was problematic because:

1. Users couldn't update existing conversations
2. The system couldn't handle idempotent operations properly
3. Duplicate data could be created if the same conversation was saved multiple times

## Solution Implemented

### 1. Error Handling

Both extensions now catch 409 CONFLICT status codes and handle them by:

```javascript
// Handle "already exists" error with PUT update
if (response.status === 409) {
    console.log('Background: ACM already exists, updating with PUT request');
    return await this.updateExistingACM(acm, token, selectedProfileId, title);
}
```

### 2. Data Replacement

When a 409 error is encountered, the system:

1. **Prepares new data**: Creates a complete data structure with current conversation state
2. **Performs PUT update**: Sends the complete data via PUT request to replace existing data entirely

### 3. Complete Data Replacement

The system replaces the entire data payload rather than merging:

#### For ACM Manager:
- **Complete replacement**: All interactions, metadata, and conversation data are replaced
- **Current state**: The current view of the conversation becomes the authoritative version
- **No duplication**: Eliminates the risk of duplicate interactions

#### For Chat Page Saver:
- **Complete replacement**: All conversation content and metadata are replaced
- **Current state**: The current HTML content and timestamps become the authoritative version

## Files Modified

### ACM Manager
- `src/data_acquisition/acm-manager/js/background.js`
  - Added `updateExistingACM()` method
  - Modified `saveACM()` to handle 409 errors
  - Removed `mergeACMData()` method (no longer needed)

### Chat Page Saver
- `src/data_acquisition/chat-page-saver/background.js`
  - Added `updateExistingConversation()` method
  - Modified `saveConversation()` to handle 409 errors
  - Removed `mergeConversationData()` method (no longer needed)

### Test File
- `src/data_acquisition/acm-manager/test_update_functionality.html`
  - Interactive test page to verify the functionality
  - Demonstrates the complete flow from creation to replacement

## API Endpoints Used

### FIDU Core API Endpoints

1. **POST** `/api/v1/data-packets` - Create new data packet
2. **PUT** `/api/v1/data-packets/{id}` - Update existing data packet (complete replacement)

### Error Codes Handled

- **409 CONFLICT**: Data packet already exists (triggers update flow)
- **401 UNAUTHORIZED**: Authentication expired
- **404 NOT FOUND**: Data packet not found (during update)

## Usage Example

### Normal Flow (New ACM)
1. User saves ACM → POST request → Success (201 Created)

### Update Flow (Existing ACM)
1. User saves ACM → POST request → 409 Conflict
2. System prepares complete data → Local processing
3. System updates ACM → PUT request → Success (200 OK)

## Testing

Use the provided test file `test_update_functionality.html` to verify the functionality:

1. **Setup**: Enter your FIDU Core API URL, auth token, and profile ID
2. **Create Initial**: Create a new ACM
3. **Create Duplicate**: Try to create the same ACM (should replace instead)
4. **Verify**: Fetch the ACM to see the replaced data

## Benefits

1. **Idempotent Operations**: Same request can be made multiple times safely
2. **No Duplication**: Eliminates the risk of duplicate interactions or content
3. **Current State**: Always reflects the most recent view of the conversation
4. **Improved UX**: Users can save conversations multiple times without errors
5. **Robust Error Handling**: Graceful degradation when conflicts occur
6. **Simplified Logic**: No complex merging logic required

## Future Enhancements

1. **Conflict Resolution**: Add UI for handling merge conflicts if needed
2. **Partial Updates**: Support for updating specific fields only
3. **Batch Operations**: Handle multiple updates in a single request
4. **Version History**: Track changes over time

## Technical Notes

- The system uses deterministic request IDs to ensure idempotency
- All timestamps are updated appropriately during replacement
- The replacement logic is simple and predictable
- Error handling includes detailed logging for debugging
- The implementation is consistent across both extensions
- No data fetching is required before updates (simplified flow) 