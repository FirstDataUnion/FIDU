"""Custom exceptions for data packet operations."""


class DataPacketError(Exception):
    """Base exception for data packet operations."""


class DataPacketNotFoundError(DataPacketError):
    """Raised when a data packet is not found."""

    def __init__(self, data_packet_id: str):
        self.data_packet_id = data_packet_id
        super().__init__(f"Data packet with ID '{data_packet_id}' not found")


class DataPacketAlreadyExistsError(DataPacketError):
    """Raised when trying to create a data packet that already exists."""

    def __init__(self, data_packet_id: str):
        self.data_packet_id = data_packet_id
        super().__init__(f"Data packet with ID '{data_packet_id}' already exists")


class DataPacketValidationError(DataPacketError):
    """Raised when data packet validation fails."""

    def __init__(self, message: str):
        super().__init__(message)


class DataPacketPermissionError(DataPacketError):
    """Raised when user doesn't have permission to access a data packet."""

    def __init__(self, data_packet_id: str, user_id: str):
        self.data_packet_id = data_packet_id
        self.user_id = user_id
        super().__init__(
            f"User '{user_id}' does not have permission to access data packet '{data_packet_id}'"
        )
