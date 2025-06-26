"""Custom exceptions for profile operations."""


class ProfileError(Exception):
    """Base exception for profile operations."""


class ProfileNotFoundError(ProfileError):
    """Raised when a profile is not found."""

    def __init__(self, profile_id: str):
        self.profile_id = profile_id
        super().__init__(f"Profile with ID '{profile_id}' not found")


class ProfileIDAlreadyExistsError(ProfileError):
    """Raised when a profile ID already exists in the system."""

    def __init__(self, profile_id: str):
        self.profile_id = profile_id
        super().__init__(f"Profile with ID '{profile_id}' already exists")


class ProfileUserAlreadyHasProfileError(ProfileError):
    """Raised when a user already has a profile with the same name in the system."""

    def __init__(self, user_id: str, profile_name: str):
        self.user_id = user_id
        self.profile_name = profile_name
        super().__init__(
            f"User with ID '{user_id}' already has a profile with the name '{profile_name}'"
        )
