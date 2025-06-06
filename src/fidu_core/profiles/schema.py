"""Profile models for the FIDU system."""

from datetime import datetime
import uuid
from pydantic import BaseModel


class Profile(BaseModel):
    """Represents a profile in the system."""

    id: str = str(uuid.uuid4())  # Unique identifier for the profile
    user_id: str  # ID of the user who owns this profile
    name: str  # Display name for the profile
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()
