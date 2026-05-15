import json
import time
import random
import uuid
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError

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

def ensure_stream_exists():
    try:
        kinesis_client.describe_stream(StreamName=STREAM_NAME)
        print(f"Stream '{STREAM_NAME}' already exists.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"Stream '{STREAM_NAME}' not found. Creating...")
            kinesis_client.create_stream(StreamName=STREAM_NAME, ShardCount=1)
            # Wait for stream to become active
            waiter = kinesis_client.get_waiter('stream_exists')
            waiter.wait(StreamName=STREAM_NAME)
            print(f"Stream '{STREAM_NAME}' created successfully.")
        else:
            raise e

def generate_mock_event():
    actions = ["view", "add_to_cart", "purchase"]
    # Provide a slight bias to view over purchase
    chosen_action = random.choices(actions, weights=[60, 30, 10])[0]
    
    amount = 0.0
    if chosen_action in ["add_to_cart", "purchase"]:
        amount = round(random.uniform(10.0, 500.0), 2)
        
    return {
        "event_id": str(uuid.uuid4()),
        "user_id": f"user_{random.randint(1000, 9999)}",
        "action": chosen_action,
        "amount": amount,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

def main():
    print("Initializing Kinesis Producer...")
    ensure_stream_exists()
    
    print(f"Starting to emit events to '{STREAM_NAME}'...")
    try:
        while True:
            event_data = generate_mock_event()
            partition_key = event_data["user_id"]
            
            response = kinesis_client.put_record(
                StreamName=STREAM_NAME,
                Data=json.dumps(event_data),
                PartitionKey=partition_key
            )
            
            print(f"Emitted event: {event_data['action']} | ShardId: {response['ShardId']} | SeqNum: {response['SequenceNumber']}")
            
            time.sleep(1) # Emit 1 event per second
    except KeyboardInterrupt:
        print("Producer stopped.")

if __name__ == "__main__":
    # Small delay to ensure LocalStack is up before we try to connect
    time.sleep(2)
    main()
