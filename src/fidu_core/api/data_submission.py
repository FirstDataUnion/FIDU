from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict
from fidu_core.resources.data_packet import DataPacket
from dataclasses import dataclass
from pydantic import UUID4


app = FastAPI()

@dataclass
class DataSubmissionRequest(BaseModel):
    request_id: UUID4 # Required UUID v4 for request tracking
    data_packet: DataPacket # The data packet to be submitted


@app.post("/data-submission")
async def submit_data(data_packet: DataPacket):
    # TODO: Store the data packet in the database
    return data_packet