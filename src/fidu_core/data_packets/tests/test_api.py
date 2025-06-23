"""
Test the DataPacket API layer.
"""

import pytest
from datetime import datetime
from unittest.mock import Mock
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.testclient import TestClient

from ..api import DataPacketAPI
from ..schema import (
    DataPacket,
    DataPacketSubmissionRequest,
    DataPacketUpdateRequest,
    DataPacketQueryParams,
    StructuredDataPacket,
    PersonalData,
    NameInfo,
)
from ..service import DataPacketService


@pytest.fixture
def mock_service():
    """Create a mock service object for testing."""
    return Mock(spec=DataPacketService)


@pytest.fixture
def app():
    """Create a FastAPI app for testing."""
    return FastAPI()


@pytest.fixture
def api(app, mock_service):
    """Create a DataPacketAPI instance with mocked service."""
    # Note that this fixture MUST be called before the test_client fixture
    # can be used as it sets up the API routes. Errors related to missing routes
    # are likly due to this not being called.
    return DataPacketAPI(app, mock_service)


@pytest.fixture
def test_client(app):
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_data_packet():
    """Create a sample data packet for testing."""
    return DataPacket(
        user_id="test_user_123",
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="Falco", family_name="Lombardi")
            )
        ),
    )


def test_submit_data_packet_passes_request_to_service(
    api,
    test_client,
    mock_service,
    sample_data_packet,
):
    """Test that submit data packet passes the request to the service layer."""

    # Prepare expected calls
    request = DataPacketSubmissionRequest(
        request_id="req_123", data_packet=sample_data_packet
    )

    expected_saved_packet = DataPacket(
        user_id="test_user_123",
        id="saved_packet_id",
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="Falco", family_name="Lombardi")
            )
        ),
    )
    mock_service.submit_data_packet.return_value = expected_saved_packet

    # Call submit data packet
    json_compatible_request = jsonable_encoder(request)
    response = test_client.post("/api/v1/data-packets", json=json_compatible_request)

    # Assert expectations
    mock_service.submit_data_packet.assert_called_once_with(sample_data_packet)
    assert response.status_code == 200
    assert response.json() == jsonable_encoder(expected_saved_packet)


def test_update_data_packet_passes_request_to_service(
    api, test_client, mock_service, sample_data_packet
):
    """Test that update data packet passes the request to the service layer."""
    # Prepare expected calls
    update_request = DataPacketUpdateRequest(
        data_packet=sample_data_packet,
        update_mask={"packet.personal_data.name.given_name"},
    )
    expected_updated_packet = DataPacket(
        user_id="test_user_123",
        id="updated_packet_id",
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="Fox", family_name="McCloud")
            )
        ),
    )
    mock_service.update_data_packet.return_value = expected_updated_packet

    # Call update data packet
    json_compatible_request = jsonable_encoder(update_request)
    response = test_client.put(
        "/api/v1/data-packets/test_packet_id", json=json_compatible_request
    )

    # Assert expectations
    mock_service.update_data_packet.assert_called_once_with(update_request)
    assert response.status_code == 200
    assert response.json() == jsonable_encoder(expected_updated_packet)


def test_update_data_packet_raises_404_if_data_packet_not_found(
    api, test_client, mock_service, sample_data_packet
):
    """Test that update data packet raises a 404 if the data packet is not found."""
    # Prepare expected calls
    update_request = DataPacketUpdateRequest(
        data_packet=sample_data_packet,
        update_mask={"packet.personal_data.name.given_name"},
    )
    mock_service.update_data_packet.side_effect = ValueError("Data packet not found")

    # Call update data packet
    json_compatible_request = jsonable_encoder(update_request)
    response = test_client.put(
        "/api/v1/data-packets/test_packet_id", json=json_compatible_request
    )

    # Assert expectations
    assert response.status_code == 404


def test_delete_data_packet_passes_request_to_service(api, test_client, mock_service):
    """Test that delete data packet passes the request to the service layer."""
    # Prepare expected calls
    data_packet_id = "test_packet_id"
    mock_service.delete_data_packet.return_value = None

    # Call delete data packet
    response = test_client.delete(f"/api/v1/data-packets/{data_packet_id}")

    # Assert expectations
    mock_service.delete_data_packet.assert_called_once_with(data_packet_id)
    assert response.status_code == 200


def test_get_data_packet_passes_request_to_service(
    api, test_client, mock_service, sample_data_packet
):
    """Test that get data packet passes the request to the service layer."""
    # Prepare expected calls
    data_packet_id = "test_packet_id"
    mock_service.get_data_packet.return_value = sample_data_packet

    # Call get data packet
    response = test_client.get(f"/api/v1/data-packets/{data_packet_id}")

    # Assert expectations
    mock_service.get_data_packet.assert_called_once_with(data_packet_id)
    assert response.status_code == 200
    assert response.json() == jsonable_encoder(sample_data_packet)


def test_get_data_packet_raises_404_if_data_packet_not_found(
    api, test_client, mock_service
):
    """Test that get data packet raises a 404 if the data packet is not found."""
    # Prepare expected calls
    data_packet_id = "nonexistent_packet_id"
    mock_service.get_data_packet.side_effect = ValueError("Data packet not found")

    # Call get data packet
    response = test_client.get(f"/api/v1/data-packets/{data_packet_id}")

    # Assert expectations
    assert response.status_code == 404


def test_list_data_packets_passes_request_to_service(
    api, test_client, mock_service, sample_data_packet
):
    """Test that list data packets passes the request to the service layer."""
    # Prepare expected calls
    query_params = DataPacketQueryParams(user_id="test_user_123", limit=10, offset=0)
    expected_packets = [sample_data_packet]
    mock_service.list_data_packets.return_value = expected_packets

    # Call list data packets - only pass the specific params we want to test
    response = test_client.get(
        "/api/v1/data-packets",
        params={
            "user_id": "test_user_123",
            "limit": 10,
            "offset": 0,
        },
    )

    # Assert expectations
    assert response.status_code == 200
    assert response.json() == jsonable_encoder(expected_packets)
    mock_service.list_data_packets.assert_called_once_with(query_params)


def test_list_data_packets_passes_request_to_service_with_all_params(
    api, test_client, mock_service, sample_data_packet
):
    """Test that list data packets passes the request to the service layer."""
    # Prepare expected calls
    query_params = DataPacketQueryParams(
        user_id="test_user_123",
        limit=10,
        offset=0,
        tags=["arwing", "wolfen"],
        from_timestamp=datetime(2025, 1, 1),
        to_timestamp=datetime(2025, 1, 2),
        packet_type="unstructured",
        sort_order="asc",
    )
    expected_packets = [sample_data_packet]
    mock_service.list_data_packets.return_value = expected_packets

    # Call list data packets - pass tags as individual query parameters
    response = test_client.get(
        "/api/v1/data-packets",
        params={
            "tags": [
                "arwing",
                "wolfen",
            ],  # FastAPI will handle this as repeated parameters
            "user_id": "test_user_123",
            "limit": 10,
            "offset": 0,
            "from_timestamp": "2025-01-01T00:00:00",
            "to_timestamp": "2025-01-02T00:00:00",
            "packet_type": "unstructured",
            "sort_order": "asc",
        },
    )

    # Assert expectations
    assert response.status_code == 200
    assert response.json() == jsonable_encoder(expected_packets)
    mock_service.list_data_packets.assert_called_once_with(query_params)


def test_list_data_packets_returns_multiple_expected_data_packets(
    api, test_client, mock_service
):
    """Test that list data packets returns the expected data packets."""
    # Prepare expected calls
    query_params = DataPacketQueryParams(user_id="test_user_123", limit=5, offset=0)

    # Create multiple sample packets
    packet1 = DataPacket(
        user_id="test_user_123",
        id="packet_1",
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="Falco", family_name="Lombardi")
            )
        ),
    )
    packet2 = DataPacket(
        user_id="test_user_123",
        id="packet_2",
        packet=StructuredDataPacket(
            personal_data=PersonalData(
                name=NameInfo(given_name="Fox", family_name="McCloud")
            )
        ),
    )
    expected_packets = [packet1, packet2]
    mock_service.list_data_packets.return_value = expected_packets

    # Call list data packets
    json_compatible_query_params = jsonable_encoder(query_params)
    response = test_client.get(
        "/api/v1/data-packets", params=json_compatible_query_params
    )

    # Assert expectations
    assert response.status_code == 200
    assert response.json() == jsonable_encoder(expected_packets)
    assert len(response.json()) == 2
    assert response.json()[0]["id"] == "packet_1"
    assert response.json()[1]["id"] == "packet_2"
