"""
Service layer for data packets.
"""

from datetime import datetime, timezone
from typing import List
from fidu_core.profiles.schema import ProfileQueryParamsInternal
from .schema import DataPacketInternal, DataPacketQueryParamsInternal
from .store import DataPacketStoreInterface
from ..profiles.service import ProfileService
from .exceptions import (
    DataPacketPermissionError,
    DataPacketNotFoundError,
    DataPacketValidationError,
)


class DataPacketService:
    """Service layer for data packets."""

    def __init__(
        self, store: DataPacketStoreInterface, profile_service: ProfileService
    ) -> None:
        """Initialize the service layer.

        Args:
            store: The storage layer object to use for storing and retrieving data packets
        """
        self.store = store
        self.profile_service = profile_service

    def create_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Create a data packet in the system.

        Args:
            request_id: The request ID for idempotency
            data_packet: The data packet to be created

        Returns:
            The created data packet

        Raises:
            DataPacketAlreadyExistsError: If a data packet with the same ID already exists
            DataPacketPermissionError: If the profile does not belong to the user
            ProfileNotFoundError: If the profile does not exist
        """

        user_id = data_packet.user_id
        if user_id is None:
            raise DataPacketValidationError(
                "User ID is required to create a data packet"
            )

        profile_id = data_packet.profile_id
        if profile_id is None:
            raise DataPacketValidationError(
                "Profile ID is required to create a data packet"
            )

        # Set timestamps
        data_packet.create_timestamp = self._get_current_timestamp()
        data_packet.update_timestamp = self._get_current_timestamp()

        # Store the data packet in the storage layer
        saved_data_packet = self.store.store_data_packet(request_id, data_packet)
        return saved_data_packet

    def get_profile_ids(self, user_id: str) -> List[str]:
        """Get the profile IDs for a user.

        Temporary hack to maintain functionality with online service
        """
        profiles = self.profile_service.list_profiles(ProfileQueryParamsInternal(user_id=user_id))
        return [profile.id for profile in profiles]

    def update_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Update a data packet in the system.

        Args:
            request_id: The request ID for idempotency
            data_packet: The data packet to be updated

        Returns:
            The updated data packet

        Raises:
            DataPacketNotFoundError: If the data packet is not found
            DataPacketPermissionError: If the data packet does not belong to the user
        """

        # query the data packet to ensure it exists and check permissions
        # will correctly raise an exception if the data packet does not exist
        existing_data_packet = self.store.get_data_packet(data_packet.id)
        if existing_data_packet.user_id != data_packet.user_id:
            raise DataPacketPermissionError(
                data_packet.id,
                data_packet.user_id if data_packet.user_id else "unknown",
            )

        # Set update timestamp
        data_packet.update_timestamp = self._get_current_timestamp()

        # Update the data packet in the storage layer
        updated_data_packet = self.store.update_data_packet(request_id, data_packet)
        return updated_data_packet

    def get_data_packet(self, user_id: str, data_packet_id: str) -> DataPacketInternal:
        """Get a data packet from the system by its ID.

        Args:
            data_packet_id: The ID of the data packet to be retrieved

        Returns:
            The data packet

        Raises:
            DataPacketNotFoundError: If the data packet is not found
            DataPacketPermissionError: If the data packet does not belong to the user
        """
        data_packet = self.store.get_data_packet(data_packet_id)
        if data_packet is None:
            raise DataPacketNotFoundError(f"Data packet {data_packet_id} not found")

        if data_packet.user_id != user_id:
            raise DataPacketPermissionError(data_packet_id, user_id)

        return data_packet

    def list_data_packets(
        self, data_packet_query_params: DataPacketQueryParamsInternal
    ) -> List[DataPacketInternal]:
        """List data packets from the system.

        Args:
            data_packet_query_params: The query parameters for listing data packets

        Returns:
            The list of data packets
        """
        data_packets = self.store.list_data_packets(data_packet_query_params)
        return data_packets

    def delete_data_packet(self, user_id: str, data_packet_id: str) -> None:
        """Delete a data packet from the system.

        Args:
            data_packet_id: the ID of the data packet to be deleted
            user_id: the ID of the user deleting the data packet

        Raises:
            DataPacketNotFoundError: If the data packet is not found
            DataPacketPermissionError: If the data packet does not belong to the user
        """

        # query the data packet to ensure it exists and check permissions
        # will correctly raise an exception if the data packet does not exist
        existing_data_packet = self.store.get_data_packet(data_packet_id)
        if existing_data_packet.user_id != user_id:
            raise DataPacketPermissionError(data_packet_id, user_id)

        self.store.delete_data_packet(data_packet_id)

    def _get_current_timestamp(self) -> datetime:
        """Get the current timestamp in UTC.
        This helper is used to allow us to patch it in testing.
        """
        return datetime.now(timezone.utc)
