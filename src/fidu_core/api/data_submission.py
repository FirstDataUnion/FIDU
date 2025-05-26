"""Data submission endpoint for the FIDU API."""
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, UUID4
from typing import List, Optional, Dict
from fidu_core.resources.data_packet import DataPacket
from dataclasses import dataclass


app = FastAPI()


@dataclass
class DataSubmissionRequest(BaseModel):
    """Request model for data submission."""
    request_id: UUID4  # Required UUID v4 for request tracking
    data_packet: DataPacket  # The data packet to be submitted


@app.post("/data-submission")
async def submit_data(data_packet: DataPacket):
    """Submit a data packet to the system.
    
    Args:
        data_packet: The data packet to be submitted
        
    Returns:
        The submitted data packet
    """
    # TODO: Store the data packet in the database
    return data_packet