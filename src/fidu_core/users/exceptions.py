"""Custom exceptions for data packet operations."""


class UserError(Exception):
    """Base exception for user operations."""


class UserNotFoundError(UserError):
    """Raised when a user is not found."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(f"User with ID '{user_id}' not found")


class UserAlreadyExistsError(UserError):
    """Raised when trying to create a user that already exists."""

    def __init__(self, user_id: str | None, email: str | None):
        self.user_id = user_id
        self.email = email
        if email is not None:
            super().__init__(f"User with email '{email}' already exists")
        else:
            super().__init__(f"User with ID '{user_id}' already exists")


class UserValidationError(UserError):
    """Raised when user validation fails."""

    def __init__(self, message: str):
        super().__init__(message)


class UserPermissionError(UserError):
    """Raised when user doesn't have required permissions."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(
            f"User '{user_id}' does not have required permissions to complete operation"
        )
