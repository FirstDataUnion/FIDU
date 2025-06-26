"""Data Packet submission endpoints for the FIDU API."""

from typing import List
from fastapi import FastAPI, HTTPException, Depends, status
from .schema import (
    DataPacket,
    DataPacketCreateRequest,
    DataPacketUpdateRequest,
    DataPacketQueryParams,
    DataPacketInternal,
)
from .service import DataPacketService
from .exceptions import (
    DataPacketError,
    DataPacketNotFoundError,
    DataPacketAlreadyExistsError,
    DataPacketValidationError,
    DataPacketPermissionError,
)


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
        self._setup_exception_handlers()

    def _setup_routes(self) -> None:
        """Set up the API routes."""
        self.app.add_api_route(
            "/api/v1/data-packets",
            self.create_data_packet,
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

    def _setup_exception_handlers(self) -> None:
        """Set up exception handlers for converting service exceptions to HTTP responses."""

        @self.app.exception_handler(DataPacketNotFoundError)
        async def handle_data_packet_not_found(request, exc: DataPacketNotFoundError):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

        @self.app.exception_handler(DataPacketAlreadyExistsError)
        async def handle_data_packet_already_exists(
            request, exc: DataPacketAlreadyExistsError
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

        @self.app.exception_handler(DataPacketValidationError)
        async def handle_data_packet_validation_error(
            request, exc: DataPacketValidationError
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            )

        @self.app.exception_handler(DataPacketPermissionError)
        async def handle_data_packet_permission_error(
            request, exc: DataPacketPermissionError
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

        @self.app.exception_handler(DataPacketError)
        # pylint: disable=unused-argument
        async def handle_data_packet_error(request, exc: DataPacketError):
            print(f"Data packet error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred while processing the data packet",
            )

    async def create_data_packet(
        self, data_packet_create_request: DataPacketCreateRequest
    ) -> DataPacket:
        """Create a data packet in the system.

        Args:
            data_packet_create_request: a request containing the data packet to be created

        Returns:
            The created data packet
        """
        # Convert to internal model
        internal_data_packet = DataPacketInternal(
            **data_packet_create_request.data_packet.model_dump()
        )

        # Pass data packet to service layer to be processed and stored
        # Service layer will handle all error cases and raise appropriate exceptions
        created_data_packet = self.service.create_data_packet(
            data_packet_create_request.request_id, internal_data_packet
        )

        # Convert to response model
        response_data_packet = DataPacket(**created_data_packet.model_dump())

        return response_data_packet

    async def update_data_packet(
        self, data_packet_update_request: DataPacketUpdateRequest
    ) -> DataPacket:
        """Update a data packet in the system.

        Args:
            data_packet_update_request: a request containing the data packet to be updated

        Returns:
            The updated data packet
        """
        # Convert to internal model
        internal_data_packet = DataPacketInternal(
            **data_packet_update_request.data_packet.model_dump()
        )

        # Pass data packet to service layer to be processed and updated
        # Service layer will handle all error cases and raise appropriate exceptions
        saved_data_packet = self.service.update_data_packet(
            data_packet_update_request.request_id, internal_data_packet
        )

        # Convert to response model
        response_data_packet = DataPacket(**saved_data_packet.model_dump())

        return response_data_packet

    async def delete_data_packet(self, data_packet_id: str) -> None:
        """Delete a data packet from the system.

        Args:
            data_packet_id: the ID of the data packet to be deleted
        """
        # Service layer will handle all error cases and raise appropriate exceptions
        self.service.delete_data_packet(data_packet_id)

    async def get_data_packet(self, data_packet_id: str) -> DataPacket:
        """Get a data packet from the system by its ID.

        Args:
            data_packet_id: the ID of the data packet to be retrieved

        Returns:
            The data packet
        """
        # Service layer will handle all error cases and raise appropriate exceptions
        data_packet = self.service.get_data_packet(data_packet_id)

        # Convert to response model
        return DataPacket(**data_packet.model_dump())

    async def list_data_packets(
        self,
        query: DataPacketQueryParams = Depends(DataPacketQueryParams.as_query_params),
    ) -> List[DataPacket]:
        """List data packets with filtering and pagination."""
        data_packets = self.service.list_data_packets(query)

        # Convert to response models
        return [DataPacket(**dp.model_dump()) for dp in data_packets]
