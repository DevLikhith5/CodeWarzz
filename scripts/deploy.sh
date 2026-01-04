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
echo "=== Step 3: Running Database Migrations ==="
echo "Waiting for key services to stabilize..."
sleep 5
echo "Running migrations..."
docker compose exec core npx drizzle-kit push
echo "Migrations applied."

echo ""
echo "=== Deployment Complete! ==="
echo "Logs: docker compose logs -f"
