"""Storage layer for data packets."""

from abc import abstractmethod, ABCMeta
from typing import List
from ..schema import DataPacketInternal, DataPacketQueryParamsInternal


class DataPacketStoreInterface(metaclass=ABCMeta):
    """Interface for data packet storage."""

    @classmethod
    def __subclasshook__(cls, subclass):
        """Check if a class is a subclass of DataPacketStoreInterface."""
        return (
            hasattr(subclass, "store_data_packet")
            and callable(subclass.store_data_packet)
            and hasattr(subclass, "get_data_packet")
            and callable(subclass.get_data_packet)
            and hasattr(subclass, "update_data_packet")
            and callable(subclass.update_data_packet)
            and hasattr(subclass, "list_data_packets")
            and callable(subclass.list_data_packets)
            and hasattr(subclass, "delete_data_packet")
            and callable(subclass.delete_data_packet)
        )

    @abstractmethod
    def store_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Submit a data packet to the system to be stored."""
        raise NotImplementedError

    @abstractmethod
    def update_data_packet(
        self, request_id: str, data_packet: DataPacketInternal
    ) -> DataPacketInternal:
        """Update a data packet in the system."""
        raise NotImplementedError

    @abstractmethod
    def get_data_packet(self, data_packet_id: str) -> DataPacketInternal:
        """Get a data packet from the system by its ID."""
        raise NotImplementedError

    @abstractmethod
    def list_data_packets(
        self, data_packet_query_params: DataPacketQueryParamsInternal
    ) -> List[DataPacketInternal]:
        """List data packets from the system."""
        raise NotImplementedError

    @abstractmethod
    def delete_data_packet(self, data_packet_id: str) -> None:
        """Delete a data packet from the system."""
        raise NotImplementedError
