"""Data Packet submission endpoints for the FIDU API."""

from typing import List
from fastapi import FastAPI, HTTPException, Depends
from .schema import (
    DataPacket,
    DataPacketSubmissionRequest,
    DataPacketUpdateRequest,
    DataPacketQueryParams,
)
from .service import DataPacketService


class DataPacketAPI:
    """API endpoints for data packet submission and retrieval."""

    def __init__(self, app: FastAPI, service: DataPacketService) -> None:
        """Initialize the API layer.

        Args:
            app: The FastAPI app to mount the API on
            service: The service layer object to use for storing and retrieving data packets
        """
        self.service = service
        self.app = app
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Set up the API routes."""
        self.app.add_api_route(
            "/api/v1/data-packets",
            self.submit_data_packet,
            methods=["POST"],
            response_model=DataPacket,
            tags=["data-packets"],
        )
        self.app.add_api_route(
            "/api/v1/data-packets/{data_packet_id}",
            self.update_data_packet,
            methods=["PUT"],
            response_model=DataPacket,
            tags=["data-packets"],
        )
        self.app.add_api_route(
            "/api/v1/data-packets/{data_packet_id}",
            self.get_data_packet,
            methods=["GET"],
            response_model=DataPacket,
            tags=["data-packets"],
        )
        self.app.add_api_route(
            "/api/v1/data-packets",
            self.list_data_packets,
            methods=["GET"],
            response_model=List[DataPacket],
            tags=["data-packets"],
        )
        self.app.add_api_route(
            "/api/v1/data-packets/{data_packet_id}",
            self.delete_data_packet,
            methods=["DELETE"],
            tags=["data-packets"],
        )

    async def submit_data_packet(
        self, data_packet_submission_request: DataPacketSubmissionRequest
    ) -> DataPacket:
        """Submit a data packet to the system to be stored.

        Args:
            data_packet_submission_request: a request containing the data packet to be stored

        Returns:
            The submitted data packet
        """

        # Pydantic does basic validation automatically, so no need for that here.

        print(data_packet_submission_request)

        # Pass data packet to service layer to be processed and stored
        saved_data_packet = self.service.submit_data_packet(
            data_packet_submission_request.data_packet
        )

        return saved_data_packet

    async def update_data_packet(
        self, data_packet_update_request: DataPacketUpdateRequest
    ) -> DataPacket:
        """Update a data packet in the system.

        Args:
            data_packet_update_request: a request containing the data packet to be updated

        Returns:
            The updated data packet
        """

        try:
            updated_data_packet = self.service.update_data_packet(
                data_packet_update_request
            )
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        return updated_data_packet

    async def delete_data_packet(self, data_packet_id: str) -> None:
        """Delete a data packet from the system.

        Args:
            data_packet_id: the ID of the data packet to be deleted
        """
        self.service.delete_data_packet(data_packet_id)

    async def get_data_packet(self, data_packet_id: str) -> DataPacket:
        """Get a data packet from the system by its ID.

        Args:
            data_packet_id: the ID of the data packet to be retrieved

        Returns:
            The data packet
        """
        try:
            data_packet = self.service.get_data_packet(data_packet_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        return data_packet

    async def list_data_packets(
        self,
        query: DataPacketQueryParams = Depends(DataPacketQueryParams.as_query_params),
    ) -> List[DataPacket]:
        """List data packets with filtering and pagination."""
        return self.service.list_data_packets(query)
