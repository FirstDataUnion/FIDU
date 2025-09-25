# FIDU Cloud Migration Design Document

KEY OUTSTANDING QUESTIONS:

- Does this plan follow Google Drive’s terms of service?
- How does GDPR Work with encrypted data? If completely opaque data passes through our servers, is it still making us a data processor?
- 

## Executive Summary

This document outlines the design for migrating FIDU from a local desktop application to a cloud-hosted solution while maintaining user data privacy and providing flexibility for both local and cloud users.

**Key Decision**: Maintain FIDU Vault as a local-only offering while implementing dual storage modes for Chat Lab (local vs cloud) using Google Drive for user data storage.

## Current Architecture

### FIDU Vault (Local Desktop App)

- **Technology**: Python FastAPI + SQLite
- **Deployment**: Local desktop application (PyInstaller)
- **Data Storage**: Local SQLite database (`fidu.db`)
- **Authentication**: FIDU Identity Service integration
- **API Endpoints**: REST API for data packets, API keys, profiles

### Chat Lab (React Frontend)

- **Technology**: React + TypeScript + Vite
- **Deployment**: Currently served by FIDU Vault
- **Data Access**: REST API calls to FIDU Vault
- **Authentication**: FIDU Identity Service integration

## Proposed Architecture

The Chat Lab will have its storage layer abstracted, and there will be 2 implementations. One that
connects to FIDU Vault local app as it does now, and one that is able to pull the database
file from Google Drive, and operate on it directly.

This is because the "FIDU Vault" app serves little to no purpose in this cloud-based implementation. Its main function was to act as a storage abstraction, but moving this to the cloud would mean user data passing through our infrastructure, which we want to avoid.

### Dual-Mode Storage Strategy

### Local Mode (Existing)

```
Chat Lab (Browser) → FIDU Vault API → Local SQLite Database

```

### Cloud Mode (New)

```
Chat Lab (Browser) → Google Drive API → User's Google Drive
                  ↓
              Local SQLite (Browser) → Sync Manager

```

### Benefits

- Avoid any user data touching our server
- Most of the chat lab implementation remains the same between local and online versions
- An online hosted Vault would need to be completely re-implemented, leading to 2 versions to
manage. Leaving it as the local only solution removes this issue.

### Issues

- We lose the original architecture of all apps existing around the central "FIDU App" which would
be able to control access to data.
- Access control becomes harder to manage when we get around to implementing it. See Access Control section for further discussion.
- Each app needs to implement database logic from scratch to operate directly on the database file
- This includes the Chat Grabber, which will also need to re-implement all the database reading/
syncing logic. (We know it can use IndexedDB, so this should be feasible).

# Other Considerations/Challenges of Moving to the Cloud:

## Access Control

We currently have no granular access management system due to running only 1 app. But as a key selling point of FIDU, we need to keep this in mind. Without an intermediary service between data processing apps and the database files, it becomes hard to manage their access to said data, especially with our current model of 1 database for everything, as each app will just download ALL data and can do whatever it wants with it. There's an option of ignoring this issue as it's not a problem now, but I think this could come back to bite us, and it is better to be able to demonstrate a key offering of FIDU earlier.

### Modular Database files

One idea to solve this is to break us the user data into multiple files, and utilise Google Drive's access control to manage what apps can access what files. This helps us deal with 2 problems:

- Granular access control, that can be managed from a central location that generates specific drive access tokens for specific apps, allowing them to only touch the data files that concern them. This is explored in more details in the Google OAuth Integration Plan section.
- Keeps database files a bit smaller, which will help keep each app snappier and might help with database limits on IOS Safari that are discussed later.

Modular DB files is currently the best and only idea I have for this access control issue. As we will be starting with just 1 or 2 databases anyway (LLM Conversations, and potentially a separate one for LLM API Keys), this shouldn't add too much work, and I think it's worth doing from the start, and separating a single file into miltiple later will be a difficult migration.

## Data Migration

Is there any way to allow users to migrate their current local data to the Google Drive offering?
We could add functionality to FIDU Vault to connect to a Google Drive and sync all local data onto it. This would be a medium amount of work in my mind, but might be too low priority to be worth considering.

## Data Loss

It will be easier to lose user data using this cloud model. Some paths of this we can't do anything about, like the user going and wiping their Drive. To mitigate a lot of these issues, the best approach is user eduction, having built in pages/guides explaining where their data is, and not to mess with the files unless they know the risks.

Keeping local and online versions of the database will be very complicated, there's another enture section lower down to cover this, but if these mechanisms go wrong we can risk losing the latest data of the user. Same with Browser crashes.

The simplest trade off for this is to "sync" the local database with the online one more frequently, but this could be a big operation when the DBs get quite large, and doing this every time the users sends a new message to a model could be quite a bad experience.

Mitigations could be more broken up, smaller database files, making frequent syncs quicker, and less likely to overlap and conflict with each other. In the first version, I think we should try frequesnt, async background syncs and see if this causes performance issues, and if so, work on more advanced breaking up of the data into separate files.

## Data Encryption

With more data moving around non-locally, should we consider doing more encyrption of the raw data when storing it in users' personal drives?

This could help us ensure things like LLM API keys can still be stored in the database files without risk of exposure, but will come with some potential tradeoffs:

### No Encryrption

Rely on Google Drive security to keep user data safe. Our apps download unencrypted sensitive data into user's browser DBs, potentially exposing them to malicous plays on the user's broswer itself. Browser storage is vulnerable to XSS attacks, so people's API keys could potentially be read and stolen if stored unencrypted in Browser Storage

### Password based encryption

Use user's FIDU password to encrypt and decrypt the raw data (potentially not metadata, to make it easier to handle).

In the app, user uses their password to decrypt database contents once it's downloaded. it's re-encrypted before syncing with Drive.

If user cahnges password, all data must be decryted and re-encerypted. This can't happen on the ID service, as we don't want to process data on our servers, so it would have to happen within each app? This could be complex and manual. If user forgets old password, data could be lost permanently.

### Encryption with static per user encryption key

Each user is generated a data encryption key that is stored on the ID server, which they can access anytime. This key is pulled by apps (when user is authorised) to encrypt and decrypt data when it's pulled from Drive. This key will be locked behind a user's password, but not bound to it, so is not impacted by forgotten/changing passwords. Less secure, and key rotation would still be complex to implement, but less risk of a user locking themselves out.

EDIT: actually I think this one is a really nice approach, and gives us a great story. All the user’s data is stored in Drive (or where-ever), but Google or who ever the provider is can’t read any of the data as it’s encrypted and they don’t have the key. 
We store the encryption key on our secure servers, but we don’t have access to the data without the user’s permission, so also can’t read any of their data. 

Only apps given permission by the user can access the select G-Drive files they need to work to download the encrypted data, then use a FIDU-Authorised request to us to get the encryption key, then they can read the data. 

### Encryption with use managed key

Leave users responsible for creating and managing an encryption key for their data. Adds a big technical overhead, and could only be optional at best.

Of the above, I feel like "Encryption with static per user encryption key" would be the nicest balance of userability and an extra layer of security, however it's also possible that we're happy with just leaving it up to Drive, and temporarily storing unencypted data in the browser is ok. The other two options add too much technical overhead for the user in my opinion.

The fact that any data stored in browser DBs are vulnerable to XSS attacks is a potential issue for all of these. In these cases, we may need to keep data encrypted when in the broswer DB and only decrypt when reading. This will bring a performance impact of course, and it's hard to say if the tradeoff is worth it here. Perhaps we do this with particularly sensitive data like API keys, but not so for the rest of the data.

## Google OAuth Integration Plan

### Overview

Google OAuth integration is required across all FIDU components to enable secure access to user's Google Drive data. The implementation follows a centralized token management approach through the FIDU Identity Service, with individual apps receiving scoped access tokens.

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   FIDU Apps     │    │ Identity Service │    │   Google APIs   │
│                 │    │                  │    │                 │
│ • Chat Lab      │◄──►│ • OAuth Manager  │◄──►│ • Drive API     │
│ • Chat Grabber  │    │ • Token Store    │    │ • OAuth 2.0     │
│ • Future Apps   │    │ • Access Control │    │ • Scopes        │
└─────────────────┘    └──────────────────┘    └─────────────────┘

```

### OAuth Flow Implementation

### 1. Identity Service (Central OAuth Manager)

**Purpose**: Centralized OAuth token management and access control

**Key Implementation Details**:

**OAuth Flow Management**:

- Generate secure OAuth URLs for each app with specific permission scopes
- Handle the authorization code exchange process securely
- Manage access and refresh tokens with automatic renewal
- Store tokens separately for each app to maintain isolation

**Permission Scoping**:

- Each app receives only the minimum permissions it needs
- Chat Lab: Can create/modify files and read metadata
- Chat Grabber: Same permissions as Chat Lab
- FIDU Vault: Same permissions for migration purposes (maybe)
- No app can access data it doesn't need

**Token Security**:

- Access tokens expire after 1 hour for security
- Refresh tokens are long-lived but encrypted in ID service database
- Automatic token refresh prevents user interruption
- All tokens stored with app-specific isolation

**Google Drive Storage Strategy**:

- **App Data Folder Approach**: Uses Google's `appDataFolder` for isolated storage
- **Minimal Permissions**: Only requires `drive.file` scope (create/modify app files)
- **User Control**: Users can access App Data folder if needed for data management
- **Security Benefits**: Cannot access user's personal files, only FIDU-created files
- **Alternative Rejected**: Custom directory would require full Drive access (`drive` scope)
- **Why App Data is Better**: Maximum security with minimal permissions, maintains user trust

With the AppData approach, the Identity Service will have access to create and manage database files for all FIDU apps within the App Data folder. However, its permissions are strictly limited to only the files it creates - it cannot access any other files in the user's Drive, including other apps' data or personal files. Each individual app then receives even more limited access tokens that only work with their specific database files.

**Database Requirements**:

- New table to store Google OAuth tokens per user and app
- Separate table to track Google Drive file IDs for each app
- Encrypted storage for sensitive refresh tokens
- Audit trail for all token access and modifications

### 2. Chat Lab Implementation

**Key Implementation Details**:

**OAuth Integration**:

- Redirect users to Google's consent screen when they choose cloud mode
- Handle the OAuth callback to exchange authorization codes for tokens
- Store access tokens securely in browser memory (not persistent storage)
- Automatically refresh expired tokens without user intervention
- Integrate with existing FIDU authentication system

**Google Drive Operations**:

- Create dedicated database files in user's Google Drive app folder
- Upload database changes to Google Drive periodically
- Download latest database version when app starts
- Handle file conflicts and sync errors gracefully
- Use Google's app-specific folder to avoid cluttering user's Drive

### 3. Chat Grabber Implementation

**Key Implementation Details**:

**Chrome Extension OAuth**:

- Use Chrome's built-in identity API for OAuth (simpler than web OAuth)
- Request Google Drive permissions during extension installation
- Store access tokens securely within Chrome's extension storage
- Handle token refresh automatically in background scripts

**Google Drive Integration**:

- Create separate database files for Chat Grabber data
- Sync conversation data to Google Drive in background
- Download latest data when extension starts
- Handle offline scenarios when Google Drive is unavailable
- Use Chrome's background sync for reliable data upload

### User Experience Flow

### Initial Setup

1. User logs into Chat Lab
2. System detects no Google Drive integration
3. User clicks "Connect Google Drive"
4. Redirected to Google OAuth consent screen
5. User grants permissions
6. System creates database file in Google Drive
7. User can now use cloud mode

Alternative Initial Setup

1. User logs into Chat Lab
2. No Google Drive integration detected
3. User is directed to the Identity Service to set up core Google Drive FIDU folder and permissions
4. ID Service present OAuth consent screen
5. user grants permission
6. ID Service creates all needed database files, refresh tokens, etc.
7. User is returned to Chat Lab
8. OAuth hopefully remembers sign in, and user doesn't have to auth again in chat lab
9. Chat Lab can now fetch access token from ID service to access database files in drive

### Daily Usage

1. User opens Chat Lab
2. System checks for valid access token
3. If expired, automatically refreshes token via ID service
4. Downloads latest database from Google Drive
5. User works with local data
6. Changes sync to Google Drive periodically

### Potential Challenges

1. **Token Synchronization**: Keeping tokens in sync across apps
2. **Error Recovery**: Handling OAuth failures gracefully
3. **User Confusion**: Multiple OAuth flows for different apps
4. **Chrome Extension Limitations**: Different OAuth flow for extensions

This OAuth integration provides a solid foundation for the cloud migration while maintaining security and user experience standards. It might be quite tricky or confusing for some users to set up, however a google OAuth window is far better then our current manual download process, so while it may not be perfect, I think it will be a big improvement, and we'll have to work hard to ensure everything is intuitive and flows nicely. Difficult but possible.

## Data Consistency/Syncing

A key issue in this design is that there will be a single database file that is copied and editied by multiple apps, and there's nothing stopping this from happening from multiple devices at the same time. We could end up in nasty situations if two apps have different versions of the database and both try to sync. To offer a good experience, we need to be able to handle this without losing any data. Drive won't offer any way to automatically "merge" different versions, so we're gonna have to do this ourselves.

Proposed soltuion would be that every time an app tries to sync it's DB file, it will check to see if the current version in Drive is less than the version it currently have (we need to implement an incremental versioning system for DB files that increments on each sync, or use timestamps, but incrememnting ints can be more reliable and easier to understand). If the drive has an unexpected version, the app will have to download the new version, and "merge" the databases. This should be easy enough for new data packets, but if packets have recieved updates, then it could be messy. We may be able to use timestamps here to always favour the more recent "version" in a merge conflict.

I think this is do-able, but is another complicated mechanism that will need to be implemented separately in each app we develop.

### Sync Strategies

- **Real-time**: WebSocket connections (complex)
- **Periodic**: Every 5-10 minutes (recommended)
- **Event-driven**: Sync on user actions
- **Background**: Service Worker background sync

periodic seems like the obvious chouce, but we need to be careful that a sync always happens when a user closes the browser page (if possible) so no work is lost.

## Technical Considerations

### Performance & Scalability

### Browser Storage Limitations

- **iOS Safari**: ~50MB IndexedDB limit, could be a limiting factor
- **Android Chrome**: ~2GB+ storage available, should be fine for a long time
- **Desktop Browsers**: Generally 2GB+ available

iOS on safari has a quite limited space limit for downloading database files into local storage to work on. My local FIDU DB is already 1MB, so 50 is a number we could feasably reach. At which point, we'd have to look into workarounds, lazy loading, breaking up App DBs smaller, etc. or developing a standalong app.

### General Scaling

This design scales very well. We don't need to worry about storage scaling, and the most heavy duty API calls of pulling data, as this is delegated to Google Drive. We keep our existing scaling plan for the ID service (pretty lightweight).

The Chat Lab will now be hosted online, but as most of the work aims to be client side rather than server side, the service hosting this should not come under too much load besides service the webpages themselves, which should be easy to scale.

I think we can continue to not worry about this for the time being.

## Areas Requiring Further Analysis

### 1. Mobile Device Considerations

- [ ]  iOS Safari storage limitations and workarounds
- [ ]  Android Chrome capabilities and optimizations
- [ ]  Progressive Web App (PWA) implementation
- [ ]  Native app alternatives (React Native/Flutter)
- [ ]  Offline functionality and sync strategies

### 2. Complience

- does everything here work with our complience requirements?
I think we're fairly safe if no personal data goes through our servers, this reduces a lot of our potential issues, but I've not done a deep dive on this.

### 3. User Experience

- We've touched on this a bit, but I think this will be easier to work on once a prototype is in place, as the exact process for authing with google is a bit unknown right now.

### 4. Security

### Additional Security Concerns Not Previously Covered:

(Claude generated missing security concerns)

**Token Storage & Transmission Security:**

- **Risk**: Access tokens transmitted over HTTP could be intercepted
- **Mitigation**: Ensure all API calls use HTTPS, implement token binding
- **Risk**: Tokens stored in browser memory could be extracted via memory dumps
- **Mitigation**: Use secure token storage, implement token rotation

**Google Drive API Security:**

- **Risk**: Google Drive API rate limiting could be exploited for DoS attacks
- **Mitigation**: Implement rate limiting, exponential backoff, circuit breakers
- **Risk**: Malicious apps could request excessive permissions during OAuth
- **Mitigation**: Strict scope validation, user education about permission requests

**Browser Security Vulnerabilities:**

- **Risk**: SQLite databases in browser could be corrupted by malicious scripts
- **Mitigation**: Input validation, database integrity checks, backup mechanisms
- **Risk**: Browser extensions could access FIDU data without permission
- **Mitigation**: Content Security Policy (CSP), extension permission validation

**Data Integrity & Tampering:**

- **Risk**: Database files could be modified by malicious browser extensions
- **Mitigation**: File integrity checksums, digital signatures, audit logging
- **Risk**: Sync conflicts could be exploited to inject malicious data
- **Mitigation**: Conflict resolution validation, data sanitisation

**Authentication & Session Security:**

- **Risk**: Session hijacking through compromised browser sessions
- **Mitigation**: Short session timeouts, secure session management
- **Risk**: Cross-site request forgery (CSRF) attacks on OAuth flows
- **Mitigation**: CSRF tokens, state parameter validation

**Network Security:**

- **Risk**: Man-in-the-middle attacks on Google Drive API calls
- **Mitigation**: Certificate pinning, secure communication protocols
- **Risk**: DNS hijacking could redirect OAuth flows to malicious sites
- **Mitigation**: DNS over HTTPS, certificate validation

**Client-Side Security:**

- **Risk**: Browser developer tools could expose sensitive data during debugging
- **Mitigation**: Production builds with obfuscation, sensitive data masking
- **Risk**: Browser cache could persist sensitive data after logout
- **Mitigation**: Cache clearing, secure storage practices

**Multi-Device Security:**

- **Risk**: Compromised device could access data from other devices
- **Mitigation**: Device-specific tokens, suspicious activity monitoring
- **Risk**: Shared devices could expose user data to other users
- **Mitigation**: Clear data on logout, session isolation

**Data Leakage Prevention:**

- **Risk**: Browser history could reveal sensitive conversation data
- **Mitigation**: Private browsing recommendations, data minimisation
- **Risk**: Browser autofill could cache sensitive API keys
- **Mitigation**: Disable autofill for sensitive fields, secure input handling

**Compliance & Audit Security:**

- **Risk**: Inadequate audit trails for data access and modifications
- **Mitigation**: Comprehensive logging, audit trail integrity
- **Risk**: Data retention policies not properly implemented
- **Mitigation**: Automated data lifecycle management, retention controls

## Conclusion

### Advantages

### User Benefits

- **Data Ownership**: Users control their own data
- **Multi-device Access**: Access from any device
- **Automatic Backup**: Google Drive handles backups
- **Offline Support**: Works without internet
- **Privacy**: No data on FIDU servers

### Technical Benefits

- **Scalability**: No database hosting costs
- **Reliability**: Google Drive's infrastructure
- **Flexibility**: Users can choose local or cloud
- **Maintenance**: Reduced server maintenance

### Disadvantages

### User Experience

- **Complexity**: More complex setup for cloud users
- **Dependencies**: Relies on Google Drive availability
- **Storage Limits**: Browser storage constraints
- **Sync Delays**: Potential data inconsistency
- **Google Dependant**: Confusing message given our long term goals

### Technical Challenges

- **Multilpe Chat Lab versions**: Multiple storage implementations
- **Testing Complexity**: Need to test both modes
- **Browser Compatibility**: Different browser capabilities
- **Mobile Limitations**: iOS storage restrictions

In conclusion, this is a plan that I think we are going to have to try no matter what, especially due to a lack of a proper hosted solution being available for storage. Our goal should be to keep as much of the existing applications untouched as possible so we don't have to manage 2 completely separate projects for the local/deployed version, which would inevitably lead to us abandoning one.

This document has laid out as many initial design options and questions that I can think of, however I'd say my confidence that it will work exactly as laid out here is maybe 60%.

One way to mitigate this risk is to first try to develop an extremely basic MVP to prototype the main storage/database ideas without getting bogged down in performance and scaling, using the dev ID server for our online components, with the intention of throwing away most of this code and implementing it more properly in the existing repo. This will let us catch and key design issues that would prevent the whole thing before we start getting stuck into it.

---

**Document Version**: 1.0