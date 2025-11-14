# Terms of Use for FIDU Chat Lab

**Effective Date:** 9 October 2025  
**Last Updated:** 9 October 2025

## 1. Acceptance of Terms

By accessing or using FIDU Chat Lab ("the Service"), you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms, you may not use the Service.

These Terms constitute a legally binding agreement between you and First International Data Union ("FIDU", "we", "us", or "our").

## 2. Description of Service

FIDU Chat Lab is an **open source**, web-based application that provides:
- A data-control-focused interface for interacting with AI language models
- Storage for conversations, contexts, and system prompts
- Integration with third-party AI services
- Cloud storage via Google Drive

The Service is designed to give you control over your data while providing a powerful AI interaction platform.

**Hosted Service vs Self-Hosted:**
- We provide a hosted version at chatlab.firstdataunion.org
- You may also download and self-host the open source code
- These Terms apply only to the hosted service we provide
- Self-hosted instances are your responsibility

## 2.1 Self Hosted Instances

While the Chat Lab and FIDU Vault are open source and can be self hosted, these services are dependant on the FIDU Identity Service for account and auth management, and our api gateway service for connection to our partners NLP. For security reasons, these services are not part of the open source offering. Hence a self hosted instance will either need to contiue using a FIDU account to access our online offerings, or sufficient modification to remove the dependancy on our identity and gateway servers. Such modifications are acceptable as part of our open source model. 

## 3. User Accounts

### 3.1. Account Creation
- You must create an account to use the Service
- You must provide accurate and complete information
- You are responsible for maintaining the security of your account credentials
- You must be at least 16 years old to create an account

### 3.2. Account Security
- You are responsible for all activities that occur under your account
- Notify us immediately of any unauthorized use of your account
- We are not liable for any loss or damage from your failure to maintain account security

### 3.3. Multiple Profiles
- You may create multiple profiles within your account
- Each profile maintains separate conversations and data
- All profiles are subject to these Terms

## 4. Your API Keys

### 4.1. Third-Party AI Services
- FIDU Chat Lab allows you to connect to third-party AI services (OpenAI, Anthropic, Google, etc.) using your own API keys as an alternative for using our paid service
- You are responsible for obtaining and managing your own API keys
- We do not store your API keys on our servers
- API keys are encrypted and stored locally on your device or in your Google Drive

### 4.2. API Key Responsibility
- You are solely responsible for usage and costs associated with your API keys
- You must comply with the terms of service of the AI service providers
- We are not responsible for charges incurred through use of your API keys
- We are not liable for any loss or compromise of your API keys

## 5. Acceptable Use Policy

### 5.1. Permitted Use
You may use the Service for:
- Personal or professional AI-assisted tasks
- Research and development
- Creative writing and content creation
- Data analysis and problem-solving
- Educational purposes

### 5.2. Prohibited Activities
You may NOT use the **hosted Service** to:
- Violate any laws or regulations
- Infringe on intellectual property rights of others
- Generate, store, or transmit malicious code or malware
- Harass, threaten, or harm others
- Impersonate any person or entity
- Interfere with or disrupt the Service or servers
- Attempt unauthorized access to our systems
- Use the Service for spam or unsolicited communications
- Generate illegal content or content that violates third-party AI provider terms
- Abuse or overload our hosted infrastructure

**Note on Open Source:**
- You are free to view, modify, and study the source code (this is not "reverse engineering")
- You may fork and redistribute the code according to the open source license
- Self-hosting your own instance is explicitly allowed and encouraged

### 5.3. AI Content Generation
When using AI models through the Service:
- You are responsible for the content you generate
- You must comply with the acceptable use policies of the AI service providers
- We do not monitor or control the content you generate
- You acknowledge that AI-generated content may be inaccurate or inappropriate

## 6. Data Storage and Ownership

### 6.1. Your Data
- You retain all ownership rights to your conversations, contexts, and content
- Your data is stored in your personal Google Drive account
- We do not claim ownership of your data
- We do not access, read, or analyze your conversation content

### 6.2. Storage Mode
- **Google Drive Mode:** Data stored in your personal Google Drive account in encrypted form
- You are responsible for backing up your data if desired
- We are not responsible for data loss due to device failure, browser issues, or Google Drive issues

### 6.3. Data Portability
- You can delete your data at any time
- Upon account deletion, your account information is removed from our servers

## 7. Third-Party Services

### 7.1. Natural Language Processing (NLP)
- We partner with Natrual Language Processing (NLP) Ltd. to provide access to a range of AI providers via their agentic workbech
- Requests from the Chat Lab to AI models are sent to NLP's passthrough service for a level of pre-processing before being sent to the model provider's API 
- NLP will typically store no information of the passed requests, with the exception of encrypted caching short lived in the case of expensive operations
- NLP's full privacy policy can be found here: https://nlp-processing.com/privacy-policy


### 7.2. AI Service Providers
- The Service integrates with third-party AI providers (OpenAI, Anthropic, Google, etc.)
- These providers have their own terms of service and privacy policies
- We are not responsible for the actions, content, or policies of these providers
- Your use of these services is governed by their respective terms

### 7.3. Google Drive Integration
- If you choose to use Google Drive storage, you grant the Service limited access to your Google Drive
- We can only access files created by FIDU Chat Lab in your AppData folder
- Your use of Google Drive is governed by Google's Terms of Service
- We are not responsible for Google Drive availability, security, or data integrity

### 7.4. No Endorsement
- We do not endorse any third-party services
- References to third-party services do not constitute endorsement
- Third-party services may change their terms without notice to us

## 8. Open Source and Intellectual Property

### 8.1. Open Source Software
- FIDU Chat Lab is open source software
- The source code is available at: [https://github.com/FirstDataUnion/FIDU](https://github.com/FirstDataUnion/FIDU) (or relevant repository)
- The code is licensed under the **MIT License** (see repository for full license text)
- You are free to:
  - View and study the source code
  - Fork the repository
  - Modify the code for personal or commercial use
  - Self-host your own instance
  - Distribute modified or unmodified versions
  - Use in proprietary software
  - Contribute improvements back to the project

### 8.2. Open Source License Terms
- Your use of the source code is governed by the open source license in the repository
- Any modifications or derivatives must comply with the license terms
- If you self-host or fork the Service, you are responsible for:
  - Complying with all applicable laws
  - Providing your own privacy policy and terms of use
  - Managing your own infrastructure and security
  - Complying with third-party service terms (AI providers, Google Drive, etc.)

### 8.3. Hosted Service vs Self-Hosted
- These Terms of Use apply to the **hosted service** at chatlab.firstdataunion.org
- If you self-host the software, these Terms do **not** apply to your instance
- You may create your own terms for your self-hosted instance
- We are not responsible for self-hosted instances or forks

### 8.4. Trademarks
- While the code is open source, "FIDU" and "First International Data Union" are trademarks of FIDU
- The open source license does not grant trademark rights
- If you fork or redistribute, please:
  - Do not imply endorsement by FIDU without permission
  - Consider using a different name to avoid confusion
  - Provide clear attribution to the original project

### 8.5. Your Content License
- You grant us a limited license to store and process your data solely for the purpose of providing the Service
- This license terminates when you delete your data or account
- We do not use your data for any other purpose

### 8.6. Contributions
- If you contribute code to the FIDU Chat Lab repository, you:
  - Grant FIDU a license to use your contribution under the project's open source license
  - Certify that you have the right to make the contribution
  - Agree that your contribution will be under the same license as the project
- See CONTRIBUTING.md in the repository for detailed contribution guidelines

### 8.7. Feedback
- If you provide feedback, suggestions, or ideas about the Service, you grant us the right to use them without compensation or obligation
- Feedback may be incorporated into the open source codebase

## 9. Service Availability

### 9.1. Uptime
- We strive to provide reliable service but do not guarantee 100% uptime
- The Service may be unavailable due to maintenance, updates, or technical issues
- We will provide notice of planned maintenance when possible

### 9.2. Service Changes
- We reserve the right to modify, suspend, or discontinue the Service at any time
- We will provide reasonable notice of significant changes when possible
- We are not liable for any modification, suspension, or discontinuation

### 9.3. No Guarantee of Availability
- The Service is provided "as is" without guarantees of availability
- We do not guarantee compatibility with all devices or browsers
- File System Mode may not be available in all browsers (e.g., Firefox, Safari)

## 10. Disclaimers and Limitations of Liability

### 10.1. Disclaimer of Warranties
THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
- Warranties of merchantability
- Fitness for a particular purpose
- Non-infringement
- Accuracy or reliability of results
- Security or freedom from viruses or other harmful code

**Open Source Disclaimer:**  
AS OPEN SOURCE SOFTWARE, THE SERVICE IS PROVIDED WITHOUT WARRANTY OF ANY KIND. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE SERVICE IS WITH YOU. SHOULD THE SERVICE PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR, OR CORRECTION.

### 10.2. AI Content Disclaimer
- AI-generated content may be inaccurate, incomplete, or inappropriate
- You should not rely solely on AI-generated content for critical decisions
- We are not responsible for the accuracy or quality of AI-generated content
- You use AI-generated content at your own risk

### 10.3. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, FIDU SHALL NOT BE LIABLE FOR:
- Indirect, incidental, special, consequential, or punitive damages
- Loss of profits, data, use, or goodwill
- Service interruptions or data loss
- Third-party actions (AI providers, Google Drive, etc.)
- User-generated content or AI-generated content
- Unauthorized access to your data or account

OUR TOTAL LIABILITY SHALL NOT EXCEED £100 (GBP) OR THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS, WHICHEVER IS GREATER.

### 10.4. Indemnification
You agree to indemnify and hold harmless FIDU from any claims, damages, losses, or expenses (including legal fees) arising from:
- Your use of the Service
- Your violation of these Terms
- Your violation of third-party rights
- Content you generate or store using the Service

## 11. Privacy

Your use of the Service is also governed by our [Privacy Policy](https://chatlab.firstdataunion.org/privacy-policy), which is incorporated into these Terms by reference.

Key privacy points:
- We do not read or analyze your conversations
- Your data is encrypted
- You control where your data is stored
- We collect minimal account information
- Anonymous metrics can be opted out

## 12. Termination

### 12.1. Termination by You
- You may stop using the Service at any time
- You may delete your account through your account settings or by contacting us
- Deleting your account removes your account data from our servers
- Your conversation data (stored locally or in Google Drive) must be deleted separately

### 12.2. Termination by Us
We may suspend or terminate your access to the Service if:
- You violate these Terms
- You engage in prohibited activities
- We are required to do so by law
- We discontinue the Service

### 12.3. Effect of Termination
Upon termination:
- Your right to use the Service immediately ceases
- Your account data will be deleted within 30 days
- Provisions that should survive termination will remain in effect (e.g., liability limitations, indemnification)

## 13. Changes to Terms

### 13.1. Modifications
- We may modify these Terms at any time
- Significant changes will be notified via email or in-app notification
- Continued use of the Service after changes constitutes acceptance
- We will update the "Last Updated" date at the top of this document

### 13.2. Your Options
If you do not agree with modified Terms:
- Stop using the Service
- Delete your account
- Contact us with concerns before the changes take effect

## 14. Governing Law and Disputes

### 14.1. Governing Law
These Terms are governed by the laws of England and Wales, without regard to conflict of law principles.

### 14.2. Dispute Resolution
- We encourage you to contact us first to resolve any disputes informally
- Any disputes that cannot be resolved informally shall be resolved in the courts of England and Wales
- You agree to submit to the personal jurisdiction of these courts

### 14.3. Class Action Waiver
To the extent permitted by law, you agree that any dispute resolution proceedings will be conducted on an individual basis and not as a class action.

## 15. General Provisions

### 15.1. Entire Agreement
These Terms, together with our Privacy Policy, constitute the entire agreement between you and FIDU regarding the Service.

### 15.2. Severability
If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full effect.

### 15.3. Waiver
Our failure to enforce any right or provision of these Terms does not constitute a waiver of that right or provision.

### 15.4. Assignment
- You may not assign or transfer these Terms without our written consent
- We may assign these Terms to a successor entity in connection with a merger, acquisition, or sale of assets

### 15.5. No Agency
No agency, partnership, joint venture, or employment relationship is created between you and FIDU by these Terms.

### 15.6. Force Majeure
We are not liable for any failure or delay in performance due to circumstances beyond our reasonable control (e.g., natural disasters, war, internet outages).

## 16. Contact Information

If you have questions about these Terms of Use, please contact us:

**Email:** hello@firstdataunion.org  
**Legal Inquiries:** hello@firstdataunion.org  
**Postal Address:**  
First International Data Union  
44 Wivenhoe Business Centre  
Brook Street  
Wivenhoe, Colchester  
CO7 9DP, United Kingdom

## 17. Additional Resources

- **Privacy Policy:** [https://chatlab.firstdataunion.org/privacy-policy](https://chatlab.firstdataunion.org/privacy-policy)
- **Source Code:** [https://github.com/FirstDataUnion/FIDU](https://github.com/FirstDataUnion/FIDU)
- **Documentation:** See repository README and docs/ folder
- **Support:** hello@firstdataunion.org
- **Report Bugs:** Use GitHub Issues in the repository

---

**Acknowledgment:** By using FIDU Chat Lab, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use.

**Version:** 1.0  
**Effective Date:** 9 October 2025  
**Last Updated:** 9 October 2025

