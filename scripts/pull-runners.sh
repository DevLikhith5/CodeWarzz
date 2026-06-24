#!/usr/bin/env bash
# Pull runners from Docker Hub
set -euo pipefail

if [ -z "$DOCKER_USERNAME" ]; then
    echo "Error: DOCKER_USERNAME environment variable is not set."
    echo "Usage: export DOCKER_USERNAME=myuser; ./scripts/pull-runners.sh"
    exit 1
fi

echo "Pulling runners for user: $DOCKER_USERNAME"

# Indexed arrays for bash 3 (macOS) compatibility
RUNNERS=( "cpp-runner" "python-runner" "node-runner" "java-runner" "go-runner" "rust-runner" )
LANGS=( "cpp" "python" "javascript" "java" "go" "rust" )

for i in "${!RUNNERS[@]}"; do
    name="${RUNNERS[$i]}"
    lang="${LANGS[$i]}"
    tag="$DOCKER_USERNAME/$name:latest"

    echo "--- Processing $name ($lang) ---"

    echo "Pulling $tag..."
    docker pull "$tag"

    echo "Retagging $tag -> $name..."
    docker tag "$tag" "$name"

    echo "Done with $name"
    echo ""
done

echo "All runners pulled and ready!"
