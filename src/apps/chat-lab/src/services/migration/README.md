# Migration Service

NOTE: This feature has been shelved for now as I fear there's very little demand and it's not worth the complexity. 

## Overview
The Migration Service handles migration of data from old FIDU Vault database format to the new cloud-based format.

## Migration Logic

### 1. Input
- Old FIDU Vault `fidu.db` SQLite file
- Contains `data_packets` and `api_keys` tables

### 2. Data Reading
- Read all entries from `data_packets` table
- Read all entries from `api_keys` table
- Parse JSON content from `data` column in data_packets
- Parse JSON tags from `tags` column in data_packets

### 3. Data Classification
- **Conversations**: Data packets with tags containing 'Conversation' or 'Chat-Bot'
- **Contexts**: Data packets with tags containing 'Context'
- **System Prompts**: Data packets with tags containing 'SystemPrompt'
- **API Keys**: All entries from `api_keys` table

### 4. Data Storage
- Use the unified storage interface to store all data
- **Conversations**: Use `storageService.createConversation()`
- **Contexts**: Use `storageService.createContext()`
- **System Prompts**: Use `storageService.createSystemPrompt()`
- **API Keys**: Use `storageService.storeAPIKey()` (or equivalent)

### 5. ID Preservation
- Preserve original IDs from the old database
- No need to generate new IDs or add prefixes
- The storage service should handle any conflicts appropriately

### 6. Storage Mode Handling
- **Local File System**: Data is immediately stored in local DB files
- **Google Drive Mode**: Data is stored in local cache DB, then synced to cloud
- Trigger sync after migration if in Google Drive mode

## Implementation Notes
- Keep the logic simple and incremental
- Use the unified storage interface - don't care about the underlying storage method
- Focus on data preservation and correct classification
- Handle errors gracefully but don't overcomplicate
