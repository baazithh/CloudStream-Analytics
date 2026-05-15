import json
import asyncio
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import boto3
from botocore.exceptions import ClientError

app = FastAPI(title="E-Commerce Analytics Engine")

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LocalStack Configuration
AWS_REGION = "us-east-1"
ENDPOINT_URL = "http://localhost:4566"
STREAM_NAME = "ecommerce-events"

kinesis_client = boto3.client(
    "kinesis",
    region_name=AWS_REGION,
    endpoint_url=ENDPOINT_URL,
    aws_access_key_id="test",
    aws_secret_access_key="test"
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        broken_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                broken_connections.append(connection)
                
        for connection in broken_connections:
            self.disconnect(connection)

manager = ConnectionManager()

def get_shard_iterator():
    try:
        describe_response = kinesis_client.describe_stream(StreamName=STREAM_NAME)
        shards = describe_response['StreamDescription']['Shards']
        if not shards:
            return None
            
        shard_id = shards[0]['ShardId']
        
        iterator_response = kinesis_client.get_shard_iterator(
            StreamName=STREAM_NAME,
            ShardId=shard_id,
            ShardIteratorType='LATEST'
        )
        return iterator_response['ShardIterator']
    except ClientError as e:
        print(f"Error getting shard iterator: {e}")
        return None

async def poll_kinesis_stream():
    print("Background task starting: Polling Kinesis stream...")
    # Give the producer a moment to create the stream if it hasn't already
    await asyncio.sleep(5)
    
    shard_iterator = None
    while shard_iterator is None:
        shard_iterator = get_shard_iterator()
        if shard_iterator is None:
            print("Stream not ready or no shard iterator. Retrying in 5s...")
            await asyncio.sleep(5)
            
    print("Successfully connected to Kinesis stream.")
    
    while True:
        try:
            records_response = kinesis_client.get_records(
                ShardIterator=shard_iterator,
                Limit=10
            )
            
            records = records_response.get('Records', [])
            for record in records:
                try:
                    data = record['Data'].decode('utf-8')
                    # Expecting valid JSON from the producer
                    json.loads(data)
                    await manager.broadcast(data)
                    print(f"Broadcasted event: {data}")
                except Exception as e:
                    print(f"Error parsing or broadcasting record: {e}")
            
            shard_iterator = records_response.get('NextShardIterator')
            
            # If the shard is closed, we need to handle it. For local testing, we'll just try to get a new one.
            if not shard_iterator:
                print("Shard iterator is missing, re-fetching...")
                await asyncio.sleep(2)
                shard_iterator = get_shard_iterator()
                continue
                
            # Sleep briefly to avoid hitting Kinesis API aggressively
            await asyncio.sleep(1)
            
        except Exception as e:
            print(f"Error polling kinesis: {e}")
            await asyncio.sleep(5)
            # Re-fetch iterator on error
            shard_iterator = get_shard_iterator()

@app.on_event("startup")
async def startup_event():
    # Start the background polling task
    asyncio.create_task(poll_kinesis_stream())

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Analytics Consumer Running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, though we only broadcast FROM server to client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
