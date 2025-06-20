"""In-memory storage for data packets."""

from typing import Dict, List
from .store import DataPacketStoreInterface
from ..schema import DataPacket, DataPacketQueryParams, DataPacketUpdateRequest


class InMemoryDataPacketStore(DataPacketStoreInterface):
    """In-memory storage for data packets."""

    def __init__(self) -> None:
        """Initialize the storage layer."""
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

    def get_data_packet(self, data_packet_id: str) -> DataPacket:
        """Get a data packet from the system by its ID."""
        if data_packet_id not in self.data_packet_store:
            raise ValueError(f"Data packet with ID {data_packet_id} not found")
        return self.data_packet_store[data_packet_id]

    def contains_at_least_one_tag(
        self, data_packet: DataPacket, tags: List[str]
    ) -> bool:
        """Check if a data packet contains at least one of the given tags."""
        if data_packet.packet.type == "structured":
            return False  # Currently no tags in structured packets
        return any(tag in data_packet.packet.tags for tag in tags)

    def list_data_packets(
        self, data_packet_query_params: DataPacketQueryParams
    ) -> List[DataPacket]:
        """List data packets from the system."""
        results = []

        # Very naive implementation for now, no pagination or sorting
        # until we have an actual database.
        for data_packet in self.data_packet_store.values():
            if data_packet_query_params.tags and not self.contains_at_least_one_tag(
                data_packet, data_packet_query_params.tags
            ):
                continue
            if (
                data_packet_query_params.user_id
                and data_packet.user_id != data_packet_query_params.user_id
            ):
                continue
            if (
                data_packet_query_params.from_timestamp
                and data_packet.timestamp < data_packet_query_params.from_timestamp
            ):
                continue
            if (
                data_packet_query_params.to_timestamp
                and data_packet.timestamp > data_packet_query_params.to_timestamp
            ):
                continue
            if (
                data_packet_query_params.packet_type
                and data_packet.packet.type != data_packet_query_params.packet_type
            ):
                continue
            results.append(data_packet)

        return results

    def delete_data_packet(self, data_packet_id: str) -> None:
        """Delete a data packet from the system."""
        if data_packet_id not in self.data_packet_store:
            raise ValueError(f"Data packet with ID {data_packet_id} not found")
        del self.data_packet_store[data_packet_id]
