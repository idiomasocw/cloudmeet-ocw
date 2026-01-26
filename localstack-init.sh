#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
sleep 5

# Create S3 bucket for recordings
echo "Creating S3 bucket: livekit-recordings"
awslocal s3 mb s3://livekit-recordings

# Verify bucket was created
echo "Verifying bucket creation..."
awslocal s3 ls

echo "LocalStack initialization complete!"
