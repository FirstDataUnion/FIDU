"""Data Packet submission endpoints for the FIDU API."""

from fastapi import FastAPI
from .schema import DataPacket, DataPacketSubmissionRequest
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
            self.get_data_packet,
            methods=["GET"],
            response_model=DataPacket,
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

        # Pass data packet to service layer to be processed and stored
        saved_data_packet = self.service.submit_data_packet(
            data_packet_submission_request.data_packet
        )

        return saved_data_packet

    async def get_data_packet(self, data_packet_id: str) -> DataPacket:
        """Get a data packet from the system by its ID.

        Args:
            data_packet_id: the ID of the data packet to be retrieved

        Returns:
            The data packet
        """
        data_packet = self.service.get_data_packet(data_packet_id)
        return data_packet
