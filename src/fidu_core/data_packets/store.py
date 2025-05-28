"""
Storage layer for data packets.
"""

from typing import Dict
from .schema import DataPacket


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

    def get_data_packet(self, data_packet_id: str) -> DataPacket | None:
        """Get a data packet from the system by its ID."""

        return self.data_packet_store.get(data_packet_id)
