## Running Instructions

First, set up your dev environment and virtual python env with the setup script using the following command:

`source scripts/setup_dev.sh`

next, from the top level directory, you can start up the FIDU Vault app by running it as such:

`.venv/bin/python src/fidu_vault/main.py`

or to use with uvicorn's hot reloading:

`uvicorn src.fidu_vault.main:app --port 4000 --reload`

This will run the app, and also display the URLS that contain the API docs for reference. 

Once this is running, the FIDU Chat Grabber plugin can be switched to 'use fidu vault' mode in the options, and the chat-lab front-end can be run (see the readme in that directory). 

## cURL Examples 

Some example cURL commands to interact with the FIDU Vault API are as follows:

Create DataPacket:

```
curl --location 'http://127.0.0.1:4000/api/v1/data-packets' \
--header 'accept: application/json' \
--header 'Content-Type: application/json' \
--data '{
  "request_id": "8f6f6479-4436-47db-aaf1-eb5df9bb8e29",
  "data_packet": {
    "user_id": "123456789",
    "id": "packet-id",
    "timestamp": "2025-05-28T21:24:28.123Z",
    "packet": {
      "type": "unstructured",
      "tags": ["test"],
      "data": {"field1": "kitties", "field2": ["boots", "cats"], "field3": {"foo": "bar"}}
    }
  }
}'
```

Update DataPacket:

```
curl --location --request PUT 'http://127.0.0.1:4000/api/v1/data-packets/string' \
--header 'accept: application/json' \
--header 'Content-Type: application/json' \
--data '{
  "data_packet": {
    "id": "packet-id",
    "user_id": "1",
    "packet": {
      "type": "unstructured",
      "data": {"field2": ["boots", "cats"], "field3": {"foo": "bar"}, "field4": "update_complete"}
    }
  },
  "update_mask": ["packet.data"]
}'
```

Get DataPacket:

```
curl --location 'http://127.0.0.1:4000/api/v1/data-packets/packet-id' \
--header 'accept: application/json' \
--header 'Content-Type: application/json'
```

List Data Packets: 

  Get All: 

```
curl --location 'http://127.0.0.1:4000/api/v1/data-packets \
--header 'accept: application/json' \
--header 'Content-Type: application/json'
```

    Get All tagged 'Conversation':

```
curl --location 'http://127.0.0.1:4000/api/v1/data-packets?tags=Conversation' \
--header 'accept: application/json' \
--header 'Content-Type: application/json'
```

See the API docs for a full list of available filters (most of which have been implemented...)