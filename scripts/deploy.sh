#!/bin/bash

# Deploy Script
# 1. Pulls Runner Images
# 2. Starts/Restarts Docker Containers

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else 
        echo "Warning: .env.example not found."
    fi
fi

# 1. Pull Runners
echo "=== Step 1: Pulling Sandbox Runners ==="
if [ -z "$DOCKER_USERNAME" ]; then
    echo "Warning: DOCKER_USERNAME not set. Skipping runner pull."
    echo "Please set DOCKER_USERNAME and run './scripts/pull-runners.sh' manually if needed."
else
    ./scripts/pull-runners.sh
fi

echo ""
echo "=== Step 2: Starting Services ==="
docker compose up -d --build

echo ""
echo "=== Deployment Complete! ==="
echo "Logs: docker compose logs -f"
