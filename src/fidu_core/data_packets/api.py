"""Data Packet submission endpoints for the FIDU API."""

from fastapi import FastAPI
from .schema import DataPacket, DataPacketSubmissionRequest

# TODO: Turn this into a class and add a constructor that takes a database connection
app = FastAPI()


@app.post("/")
async def submit_data_packet(
    data_packet_submission_request: DataPacketSubmissionRequest,
) -> DataPacket:
    """Submit a data packet to the system to be stored.

    Args:
        data_packet_submission_request: a request containing the data packet to be stored

    Returns:
        The submitted data packet
    """
    # TODO: Store the data packet in the database
    return data_packet_submission_request.data_packet


@app.get("/{data_packet_id}")
async def get_data_packet(data_packet_id: str) -> DataPacket:  # TODO: Async? Or sync?
    """Get a data packet from the system by its ID.

    Args:
        data_packet_id: the ID of the data packet to be retrieved

    Returns:
        The data packet
    """
    # TODO: Retrieve the data packet from the database
    raise NotImplementedError("Not implemented")
