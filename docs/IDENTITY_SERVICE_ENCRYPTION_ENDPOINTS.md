# Identity Service Encryption Endpoints

This document defines the required endpoints for encryption key management in the identity service.

## Overview

The identity service needs to support encryption key management for FIDU Chat Lab users. Each user will have a unique AES-256 encryption key that is used to encrypt their sensitive data (conversations and API keys).

## Database Schema

### User Encryption Keys Table

```sql
CREATE TABLE user_encryption_keys (
    user_id VARCHAR(255) PRIMARY KEY,
    encryption_key VARCHAR(255) NOT NULL,  -- Base64 encoded AES-256 key
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## API Endpoints

**Note:** All endpoints use the authenticated user from the Bearer token. No user ID is required in the path.

### 1. Get Encryption Key

**Endpoint:** `GET /encryption/key`

**Description:** Retrieve the encryption key for the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "encryption_key": {
    "id": "5118f3de-a844-4947-b887-9bd4fb43ee16",
    "key": "base64-encoded-aes-256-key",
    "algorithm": "AES-256-GCM",
    "created_at": "2024-01-01T00:00:00Z",
    "version": 1
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Encryption key not found for user"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid or expired token"
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Access forbidden"
}
```

### 2. Create Encryption Key

**Endpoint:** `POST /encryption/key`

**Description:** Create a new encryption key for the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Response (201 Created):**
```json
{
  "encryption_key": {
    "id": "5118f3de-a844-4947-b887-9bd4fb43ee16",
    "key": "base64-encoded-aes-256-key",
    "algorithm": "AES-256-GCM",
    "created_at": "2024-01-01T00:00:00Z",
    "version": 1
  }
}
```

**Response (409 Conflict):**
```json
{
  "error": "Encryption key already exists for user"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid or expired token"
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Access forbidden"
}
```

### 3. Delete Encryption Key

**Endpoint:** `DELETE /encryption/key`

**Description:** Delete the encryption key for the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Response (204 No Content):**
```
(Empty response body)
```

**Response (404 Not Found):**
```json
{
  "error": "Encryption key not found for user"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid or expired token"
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Access forbidden"
}
```

## Implementation Details

### Key Generation

- Generate a random 32-byte (256-bit) key using a cryptographically secure random number generator
- Encode the key as base64 for storage and transmission
- Store the key encrypted at rest using a master key

### Security Considerations

1. **Key Storage**: Encrypt keys at rest using a master key stored in environment variables
2. **Access Control**: Only allow users to access their own encryption keys
3. **Audit Logging**: Log all key access, creation, and deletion events
4. **Key Rotation**: Support for key rotation (future enhancement)

### Error Handling

- Return appropriate HTTP status codes
- Provide clear error messages
- Log security events for monitoring

### Rate Limiting

- Implement rate limiting to prevent abuse
- Consider implementing per-user rate limits

## Example Implementation (Python/FastAPI)

```python
import secrets
import base64
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet

router = APIRouter()

def get_current_user_id(token: str = Depends(get_auth_token)) -> str:
    # Validate token and return user ID
    pass

def get_db() -> Session:
    # Get database session
    pass

@router.get("/encryption/key")
async def get_encryption_key(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # Get key from database for authenticated user
    key_record = db.query(UserEncryptionKey).filter(
        UserEncryptionKey.user_id == current_user_id
    ).first()
    
    if not key_record:
        raise HTTPException(status_code=404, detail="Encryption key not found")
    
    return {
        "encryption_key": {
            "id": key_record.id,
            "key": key_record.encryption_key,
            "algorithm": "AES-256-GCM",
            "created_at": key_record.created_at.isoformat(),
            "version": 1
        }
    }

@router.post("/encryption/key")
async def create_encryption_key(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # Check if key already exists for authenticated user
    existing_key = db.query(UserEncryptionKey).filter(
        UserEncryptionKey.user_id == current_user_id
    ).first()
    
    if existing_key:
        raise HTTPException(status_code=409, detail="Encryption key already exists")
    
    # Generate new key
    key_bytes = secrets.token_bytes(32)  # 256-bit key
    key_b64 = base64.b64encode(key_bytes).decode('utf-8')
    
    # Store key (encrypted at rest)
    encrypted_key = encrypt_at_rest(key_b64)
    
    key_record = UserEncryptionKey(
        user_id=current_user_id,
        encryption_key=encrypted_key
    )
    
    db.add(key_record)
    db.commit()
    
    return {
        "encryption_key": {
            "id": key_record.id,
            "key": key_b64,
            "algorithm": "AES-256-GCM",
            "created_at": key_record.created_at.isoformat(),
            "version": 1
        }
    }

@router.delete("/encryption/key")
async def delete_encryption_key(
    current_user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # Delete key from database for authenticated user
    key_record = db.query(UserEncryptionKey).filter(
        UserEncryptionKey.user_id == current_user_id
    ).first()
    
    if not key_record:
        raise HTTPException(status_code=404, detail="Encryption key not found")
    
    db.delete(key_record)
    db.commit()
    
    return Response(status_code=204)

def encrypt_at_rest(key: str) -> str:
    """Encrypt key at rest using master key"""
    master_key = os.getenv('MASTER_ENCRYPTION_KEY')
    if not master_key:
        raise ValueError("Master encryption key not configured")
    
    fernet = Fernet(master_key.encode())
    return fernet.encrypt(key.encode()).decode()
```

## Testing

### Unit Tests

- Test key generation
- Test key storage and retrieval
- Test access control
- Test error handling

### Integration Tests

- Test end-to-end key management flow
- Test authentication and authorization
- Test database operations

### Security Tests

- Test key isolation between users
- Test access control enforcement
- Test audit logging

## Deployment Considerations

1. **Environment Variables**: Set `MASTER_ENCRYPTION_KEY` in production
2. **Database Migration**: Run migration to create `user_encryption_keys` table
3. **Monitoring**: Set up monitoring for key access patterns
4. **Backup**: Ensure encrypted keys are included in database backups

## Future Enhancements

1. **Key Rotation**: Support for rotating encryption keys
2. **Key Versioning**: Support for multiple key versions
3. **Key Escrow**: Support for key recovery mechanisms
4. **Audit Dashboard**: Web interface for monitoring key usage
