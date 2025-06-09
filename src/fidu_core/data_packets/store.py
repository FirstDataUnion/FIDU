"""
Storage layer for data packets.
"""

from typing import Dict
from .schema import DataPacket, DataPacketUpdateRequest


class DataPacketStore:
    """Storage layer for data packets."""

    def __init__(self) -> None:
        """Initialize the storage layer."""

        # For now we will be using an in memory store
        self.data_packet_store: Dict[str, DataPacket] = {}

    def store_data_packet(self, data_packet: DataPacket) -> DataPacket:
        """Submit a data packet to the system to be stored."""

        self.data_packet_store[data_packet.id] = data_packet
        return data_packet

    def update_data_packet(
        self, data_packet_update_request: DataPacketUpdateRequest
    ) -> DataPacket:
        """Update a data packet in the system."""

        if data_packet_update_request.data_packet.id not in self.data_packet_store:
            raise ValueError(
                f"Data packet with ID {data_packet_update_request.data_packet.id} not found"
            )

        data_packet = self.data_packet_store[data_packet_update_request.data_packet.id]
        updated_data_packet = data_packet_update_request.apply_update(data_packet)
        self.data_packet_store[data_packet_update_request.data_packet.id] = (
            updated_data_packet
        )
        return updated_data_packet

    def get_data_packet(self, data_packet_id: str) -> DataPacket | None:
        """Get a data packet from the system by its ID."""

        if data_packet_id not in self.data_packet_store:
            raise ValueError(f"Data packet with ID {data_packet_id} not found")

        return self.data_packet_store[data_packet_id]
