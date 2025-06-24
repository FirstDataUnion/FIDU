"""
Service layer for data packets.
"""

from datetime import datetime, timezone
from typing import List
from .schema import DataPacketInternal, DataPacketQueryParams
from .store import DataPacketStoreInterface


class DataPacketService:
    """Service layer for data packets."""

    def __init__(self, store: DataPacketStoreInterface) -> None:
        """Initialize the service layer.

        Args:
            store: The storage layer object to use for storing and retrieving data packets
        """
        self.store = store

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
        """
        # TODO: Ensure profile exists

        # Set timestamps
        data_packet.create_timestamp = self._get_current_timestamp()
        data_packet.update_timestamp = self._get_current_timestamp()

        # Store the data packet in the storage layer
        saved_data_packet = self.store.store_data_packet(request_id, data_packet)
        return saved_data_packet

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
        """

        # Set update timestamp
        data_packet.update_timestamp = self._get_current_timestamp()

        # Update the data packet in the storage layer
        updated_data_packet = self.store.update_data_packet(request_id, data_packet)
        return updated_data_packet

    def get_data_packet(self, data_packet_id: str) -> DataPacketInternal:
        """Get a data packet from the system by its ID.

        Args:
            data_packet_id: The ID of the data packet to be retrieved

        Returns:
            The data packet

        Raises:
            DataPacketNotFoundError: If the data packet is not found
        """
        data_packet = self.store.get_data_packet(data_packet_id)
        return data_packet

    def list_data_packets(
        self, data_packet_query_params: DataPacketQueryParams
    ) -> List[DataPacketInternal]:
        """List data packets from the system.

        Args:
            data_packet_query_params: The query parameters for listing data packets

        Returns:
            The list of data packets
        """
        data_packets = self.store.list_data_packets(data_packet_query_params)
        return data_packets

    def delete_data_packet(self, data_packet_id: str) -> None:
        """Delete a data packet from the system.

        Args:
            data_packet_id: the ID of the data packet to be deleted

        Raises:
            DataPacketNotFoundError: If the data packet is not found
        """
        self.store.delete_data_packet(data_packet_id)

    def _get_current_timestamp(self) -> datetime:
        """Get the current timestamp in UTC.
        This helper is used to allow us to patch it in testing.
        """
        return datetime.now(timezone.utc)
