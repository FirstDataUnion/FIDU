"""Data Packet submission endpoints for the FIDU API."""
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, UUID4
from typing import List, Optional, Dict
from fidu_core.resources.data_packet import DataPacket
from dataclasses import dataclass
 
# TODO: Turn this into a class and add a constructor that takes a database connection
app = FastAPI()


@dataclass
class DataPacketSubmissionRequest(BaseModel):
    """Request model for data Packet submission."""
    request_id: UUID4  # Required UUID v4 for request tracking
    data_packet: DataPacket  # The data packet to be submitted


@app.post("/data-packet")
async def submit_data_packet(data_packet_submission_request: DataPacketSubmissionRequest):
    """Submit a data packet to the system to be stored.
    
    Args:
        data_packet_submission_request: a request containing the data packet to be stored
        
    Returns:
        The submitted data packet
    """
    # TODO: Store the data packet in the database
    return data_packet_submission_request.data_packet

@app.get("/data-packet/{data_packet_id}")
async def get_data_packet(data_packet_id: str): #TODO: Async? Or sync?
    """Get a data packet from the system by its ID.
    
    Args:
        data_packet_id: the ID of the data packet to be retrieved
        
    Returns:
        The data packet
    """
    # TODO: Retrieve the data packet from the database
    raise NotImplementedError("Not implemented")
    return None