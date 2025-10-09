# Privacy Policy for FIDU Chat Lab

**Effective Date:** 9 October 2025

## 1. Introduction

FIDU Chat Lab is a privacy-first conversational AI interface developed by First International Data Union (FIDU). This privacy policy explains how we collect, use, store, and protect your data when you use the Chat Lab application.

**Core Principles:**
- **Data Sovereignty:** You control where your data is stored
- **Transparency:** Clear disclosure of what data we collect and how we use it
- **Minimal Collection:** We only collect what's necessary for functionality and service improvement
- **No Third-Party Tracking:** We do not use advertising cookies or share your data with advertisers

## 2. Data We Collect

### 2.1. Account & Authentication Data

When you create an account or log in to FIDU Chat Lab, we collect:

- **Email address** (for account identification and login)
- **Name** (as provided during registration)
- **Profile information** (display names you create within the app)

**How we store this:**
- Account information is stored securely in our Identity Service database
- Authentication tokens are stored locally in your browser (localStorage and cookies)
- Tokens are encrypted in transit using HTTPS/TLS

### 2.2. Conversation & Application Data

Your conversations and application data include:

- **Messages** (your prompts and AI model responses)
- **Contexts** (document snippets or information you provide for context)
- **System prompts** (custom instructions you create)
- **API keys** (for AI service providers like OpenAI, Anthropic, Google)
- **Application settings** (theme preferences, storage mode, etc.)

**How we store this:**
- **File System Mode**: All conversation data is encrypted and stored on your local file system in a directory of your choosing. The File System API of your browser allows the Chat Lab app to read and write only to the chosen directory, no others. Your personal encryption key is stored separately on our Identity server, and is always encrypted in transport via HTTPS and secured at rest via file system level encryption. 
- **Google Drive Sync Mode**: If you enable Google Drive sync, your encrypted conversation data is stored in your personal Google Drive within the hidden AppData folder. The ChatLab app has access only to the FIDU folder in your AppData folder, and cannot read or write data anywhere else in your Google Drive. This access can be revoked at any time. Your personal encryption key is stored separately on our Identity server, and is always encrypted in transport via HTTPS and secured at rest via file system level encryption. 

### 2.3. Technical & Usage Data

We collect anonymous usage metrics to monitor system health and improve the service. These metrics do not include the content of your conversations or any personally identifiable information. 

For detailed information about what metrics we collect, how they are used, and how to opt out, see **Section 4: Anonymous Metrics Collection**. 

### 2.4. Google Drive Integration (Optional)

If you enable Google Drive cloud storage, we use the Google Drive API to:

- Store your encrypted conversation database in your Drive
- Synchronize changes across devices

**Important:**
- We only request access to files that FIDU Chat Lab creates
- We cannot access other files in your Google Drive
- Your data is stored in **your** Google Drive account, not on our servers
- You can revoke access at any time through Google Account settings

## 3. How We Use Cookies & Local Storage

### 3.1. Essential Cookies & Storage

FIDU Chat Lab uses cookies and browser storage mechanisms that are essential for the application to function:

#### Authentication Cookies
- **Purpose:** Maintain your logged-in session
- **Type:** Session and persistent cookies
- **Names:** `auth_token`, `refresh_token`, `fiduRefreshToken`
- **Duration:** Access tokens expire after 1 hour; refresh tokens remain valid until you log out
- **Storage:** HTTP-only cookies (where supported) and localStorage

#### Local Storage
- **Purpose:** Store authentication state, application settings, and conversation data
- **Data stored:** 
  - `auth_token` - Your session access token
  - `fiduRefreshToken` - Token for refreshing your session
  - `token_expires_in` - Token expiration information
  - `user` - Your user profile information
  - `current_profile` - Currently active profile
  - Application settings and preferences
- **Access:** Only accessible by FIDU Chat Lab in your browser

#### IndexedDB (Browser Database)
- **Purpose:** Store your conversations, contexts, system prompts, and API keys locally
- **Data stored:**
  - Conversation history and messages
  - Context documents
  - System prompts
  - Encrypted API keys (encrypted in your browser before storage)
- **Access:** Only accessible by FIDU Chat Lab in your browser
- **Persistence:** Data remains until you explicitly clear it or uninstall the application

#### Google Drive Tokens (Google Drive Mode Only)
- **Purpose:** Authenticate with Google Drive for cloud storage
- **Storage:** localStorage
- **Data:** `googleDriveAccessToken`, `googleDriveRefreshToken`, expiration times
- **Duration:** Persists until you disconnect Google Drive or log out

### 3.2. Cookies & Storage We Do NOT Use

FIDU Chat Lab does **not** use:
- **Analytics cookies** (e.g., Google Analytics, Facebook Pixel)
- **Advertising cookies** (e.g., third-party ad networks)
- **Social media tracking cookies** (e.g., Facebook Like button trackers)
- **Cross-site tracking** or fingerprinting technologies
- **Third-party data sharing** mechanisms

### 3.3. Managing Cookies & Storage

You can control cookies and storage through:

**Browser Settings:**
- Clear cookies through your browser's privacy settings
- Block all cookies (note: this will prevent login and app functionality)
- Use private/incognito browsing (data is cleared when you close the session)

**Important:** Blocking or clearing essential cookies will prevent you from using FIDU Chat Lab.

## 4. Anonymous Metrics Collection

### 4.1. What We Collect

FIDU Chat Lab collects anonymous usage metrics to monitor system health and improve the service:

**Metrics Collected:**
- **Error Tracking:** Types of errors (TypeError, ApiError, AuthError), page where error occurred
- **Page Views:** Navigation patterns (which pages are visited)
- **AI Model Usage:** Which AI models are used, success/failure counts
- **API Performance:** Response times for backend services
- **Google Drive Operations:** File upload/download operations, success/failure rates (cloud mode only)
- **Active User Counts:** Number of concurrent users (aggregated)

**What We DON'T Collect:**
- We do not log the content of your messages or conversations
- We do not track your AI model responses
- We do not store your API keys on our servers
- We do not collect personally identifiable information in metrics

### 4.2. How Metrics Are Collected

- **Automatic Collection:** Metrics are automatically collected as you use the app
- **Batching:** Metrics are batched in your browser and sent every 30 seconds
- **No Message Content:** We never collect the content of your conversations or prompts
- **No Personal Identifiers:** Metrics do not include your name, email, or user ID
- **Aggregation:** Metrics are aggregated across all users for monitoring

### 4.3. How We Use Metrics

Metrics help us:
- Detect and fix errors quickly
- Monitor system performance and availability
- Understand which features are most used
- Optimize API response times
- Plan infrastructure capacity
- Improve user experience

### 4.4. Metrics Storage & Access

- **Storage:** Metrics are stored in our VictoriaMetrics time-series database
- **Retention:** Metrics are retained for 90 days, then automatically deleted
- **Access:** Only FIDU technical staff can access aggregated metrics
- **No Sharing:** Metrics are never shared with third parties

### 4.5. Opting Out of Metrics

While we believe anonymous metrics improve the service for everyone, you can opt out of all metric collection:

**How to Opt Out:**
- Navigate to the Settings page in Chat Lab
- Toggle off "Enable Anonymous Metrics Collection"
- Your preference is saved immediately and no metrics will be sent

Note: Opting out of metrics does not affect your ability to use Chat Lab.

## 5. Data Security

### 5.1. Encryption

- **In Transit:** All data transmitted between your browser and our servers uses HTTPS/TLS encryption
- **At Rest:** 
  - Server-stored data (account information) is encrypted at rest
  - API keys are encrypted in your browser before being stored locally
  - Google Drive backups are encrypted before upload (when using Google Drive mode)

### 5.2. Access Controls

- **Token Expiration:** Access tokens expire after 1 hour and must be refreshed
- **Least Privilege:** Our systems follow the principle of least privilege access

### 5.3. Data Isolation

- **File System Mode:** Your conversation data never leaves your device
- **Google Drive Mode:** Your data is stored in your personal Google Drive, not on FIDU servers
- **Account Data:** Stored separately from conversation data with strict access controls

## 6. Data Retention & Deletion

### 6.1. Account Data

- **Retention:** Account data is retained as long as your account is active
- **Deletion:** You can request account deletion by emailing privacy@firstdataunion.org
- **Timeline:** Account deletion is processed within 30 days
- **What's Deleted:** Email, name, user ID, profiles, authentication records

### 6.2. Conversation Data

**File System Mode:**
- Stored only on your computer in the chosen directory
- Can be deleted manually at any time 

**Cloud Mode:**
- Stored in your Google Drive
- You control deletion by deleting files from your Drive or disconnecting Google Drive in Chat Lab
- "Clear Cloud Data" button in settings allows you to wipe all stored FIDU data in your Google Drive 
- Data persists in your Drive until you delete it

### 6.3. Metrics Data

- Automatically deleted after 90 days
- Contains no personally identifiable information
- Cannot be deleted on demand (as it's already anonymous and aggregated)

## 7. Data Sharing & Third Parties

### 7.1. We Do NOT Share Your Data With:

- Advertisers or marketing companies
- Data brokers
- Analytics platforms (e.g., Google Analytics)
- Social media networks
- AI model providers (your API keys directly connect to them from your browser)

### 7.2. Third-Party Services We Use

**Google Drive API** 
- **Purpose:** Store your encrypted conversation data in your Google Drive
- **Data Access:** Only files created by FIDU Chat Lab
- **Privacy Policy:** [Google Privacy Policy](https://policies.google.com/privacy)

### 7.3. Legal Disclosure

We may disclose your data if required by law:
- In response to valid legal process (subpoena, court order)
- To protect our rights, property, or safety
- To prevent fraud or abuse
- In connection with a business transfer (merger, acquisition)

We will notify you of legal requests unless prohibited by law.

## 8. Your Rights & Choices

Under UK GDPR and data protection law, you have the right to:

### 8.1. Access
- Request a copy of your personal data
- Understand how we process your data

### 8.2. Rectification
- Correct inaccurate personal data
- Update your profile information

### 8.3. Erasure (Right to be Forgotten)
- Request deletion of your account and data
- Clear your conversation data at any time

### 8.4. Portability
- Export your conversation data in JSON format
- Transfer your data to another service

### 8.5. Objection
- Object to data processing for specific purposes
- Opt out of metrics collection

### 8.6. Restriction
- Request we limit how we process your data

### 8.7. Withdraw Consent
- Revoke consent for data processing at any time
- Log out to end your session
- Disconnect Google Drive integration

**To Exercise Your Rights:**
Email us at privacy@firstdataunion.org with your request. We will respond within 30 days.

## 9. Children's Privacy

FIDU Chat Lab is not directed to children under the age of 13 (or 16 in the UK and EEA). We do not knowingly collect personal information from children.

**If You Are a Parent or Guardian:**
If you believe your child has provided us with personal information, please contact us at privacy@firstdataunion.org and we will delete the information immediately.

**Age Verification:**
By using Chat Lab, you confirm that you are at least 13 years old (or 16 in the UK/EEA), or have parental consent.

## 10. International Data Transfers

FIDU is based in the United Kingdom. However, your conversation data is stored either:
- **Locally on your device** (File System Mode), or
- **In your personal Google Drive account** (Cloud Mode)

**Account Information:**
Your account information (name, email) is stored on FIDU servers located in the UK. If you access Chat Lab from outside the UK, your account data will be transferred to and processed in the UK under UK GDPR standards.

**No Cross-Border Data Sharing:**
We do not transfer or share your data with third parties outside the UK, except:
- Google Drive (if you enable Google Drive Mode) - governed by Google's international data transfer policies
- AI service providers you connect to (OpenAI, Anthropic, Google, etc.) - governed by their own respective policies. 

**Safeguards:**
All data transfers are protected by HTTPS/TLS encryption and comply with UK GDPR requirements.

## 11. Cookie Consent

**Essential Cookies:**
FIDU Chat Lab uses only essential cookies required for the application to function. These cookies are necessary for:
- Authentication and session management
- Maintaining your security
- Core application functionality

**No Consent Required:**
Under UK and EU law, consent is not required for essential cookies. We do not use optional or non-essential cookies.

**Your Control:**
You can manage or delete essential cookies through your browser settings, but this will prevent you from using Chat Lab. See Section 3.3 for details on managing cookies.

## 12. Data Breach Notification

We take data security seriously and have implemented measures to protect against unauthorized access, loss, or disclosure of your data.

**In the Event of a Breach:**

If we experience a data breach affecting your account information, we will:

1. **Assess the Breach:** Determine the scope, severity, and data affected within 24 hours
2. **Notify Authorities:** Report to the UK Information Commissioner's Office (ICO) within 72 hours if required by law
3. **Notify You:** Contact you via email within 72 hours if your personal data is affected
4. **Provide Information:** Explain what data was compromised, what we're doing about it, and steps you can take to protect yourself
5. **Remediate:** Take immediate action to secure systems and prevent future breaches

**Limited Exposure:**
Because your conversation data is stored locally or in your Google Drive (not on our servers), most data breach scenarios would only affect account information (name, email), not your conversations or API keys.

**Your Responsibility:**
- Keep your password secure
- Monitor your account for suspicious activity
- Report any suspected unauthorized access to hello@firstdataunion.org

## 13. Changes to This Privacy Policy

We may update this Privacy Policy to reflect:
- Changes in our services or features
- Legal or regulatory requirements
- Improvements to our privacy practices

**Notification:**
- Significant changes will be announced on the Chat Lab app
- Continued use after changes constitutes acceptance
- You can always review the current policy at `/fidu-chat-lab/privacy-policy`

**Version History:**
- v1.0 - 9 October 2025: Initial Chat Lab-specific privacy policy

## 14. Contact 

For privacy questions, data requests, or concerns:

**Email:** privacy@firstdataunion.org  
**Postal Address:**  
First International Data Union  
44 Wivenhoe Business Centre  
Brook Street  
Wivenhoe, Colchester  
CO7 9DP, United Kingdom

---

**Last Updated:** 9 October 2025  
**Effective Date:** 9 October 2025  
**Version:** 1.0

For the full FIDU organizational privacy policy, visit: [https://firstdataunion.org/privacy-policy](https://firstdataunion.org/privacy-policy)

