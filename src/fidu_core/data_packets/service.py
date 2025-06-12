"""
Service layer for data packets.
"""

from typing import Any, List
from .schema import DataPacket, DataPacketQueryParams, DataPacketUpdateRequest


class DataPacketService:
    """Service layer for data packets."""

    def __init__(self, store: Any) -> None:
        """Initialize the service layer.

        Args:
            store: The storage layer object to use for storing and retrieving data packets
        """
        self.store = store

    def submit_data_packet(self, data_packet: DataPacket) -> DataPacket:
        """Submit a data packet to the system to be stored.

        Args:
            data_packet: The data packet to be stored

        Returns:
            The submitted data packet
        """

        # TODO: Any Business logic for submitting a data packet will sit here, such as:
        # - Ensuring profile exists

        # Store the data packet in the storage layer
        saved_data_packet = self.store.store_data_packet(data_packet)
        return saved_data_packet

    def get_data_packet(self, data_packet_id: str) -> DataPacket:
        """Get a data packet from the system by its ID.

        Args:
            data_packet_id: The ID of the data packet to be retrieved

        Returns:
            The data packet
        """
        return self.store.get_data_packet(data_packet_id)

    def update_data_packet(
        self, data_packet_update_request: DataPacketUpdateRequest
    ) -> DataPacket:
        """Update a data packet in the system.

        Args:
            data_packet_update_request: The request to update the data packet

        Returns:
            The updated data packet
        """
        return self.store.update_data_packet(data_packet_update_request)

    def list_data_packets(
        self, data_packet_query_params: DataPacketQueryParams
    ) -> List[DataPacket]:
        """List data packets from the system.

        Args:
            data_packet_query_params: The query parameters for listing data packets

        Returns:
            The list of data packets
        """
        return self.store.list_data_packets(data_packet_query_params)

    def delete_data_packet(self, data_packet_id: str) -> None:
        """Delete a data packet from the system.

        Args:
            data_packet_id: the ID of the data packet to be deleted
        """
        self.store.delete_data_packet(data_packet_id)
