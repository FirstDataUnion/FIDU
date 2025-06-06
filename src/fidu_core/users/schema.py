"""User models for the FIDU system."""

from typing import Optional
from datetime import datetime
import uuid
from pydantic import BaseModel, EmailStr


class User(BaseModel):
    """Represents a user in the system."""

    id: str = str(uuid.uuid4())  # Unique identifier for the user
    email: EmailStr  # User's email address (used for login)
    password_hash: str  # Hashed password
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()
    first_name: Optional[str] = None
    last_name: Optional[str] = None
