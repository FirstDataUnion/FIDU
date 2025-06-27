"""JWT token handling for authentication."""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from pydantic import BaseModel
from fastapi import HTTPException, status

# Configuration
SECRET_KEY = "your-secret-key-here"  # TODO: Move to environment variable for prod.
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30000  # Set very large for testing purposes


class Token(BaseModel):
    """Token response model."""

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Token data model."""

    user_id: str


class JWTManager:
    """JWT token management service."""

    def create_access_token(
        self, data: dict, expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create a new JWT access token.

        Args:
            data: The data to encode in the token
            expires_delta: Optional expiration time delta

        Returns:
            The encoded JWT token
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[TokenData]:
        """
        Verify and decode a JWT token.

        Args:
            token: The JWT token to verify

        Returns:
            The decoded token data if valid, None otherwise
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = str(payload.get("sub"))
            if user_id is None:
                return None
            return TokenData(user_id=user_id)
        except JWTError:
            return None

    def verify_token_or_raise(self, token: str) -> TokenData:
        """
        Verify and decode a JWT token, raising HTTPException if invalid.

        Args:
            token: The JWT token to verify

        Returns:
            The decoded token data if valid

        Raises:
            HTTPException: If the token is invalid or user_id is missing
        """
        token_data = self.verify_token(token)
        if token_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if token_data.user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return token_data
