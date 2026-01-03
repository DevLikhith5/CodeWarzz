#!/bin/bash


if [ -z "$DOCKER_USERNAME" ]; then
    echo "Error: DOCKER_USERNAME environment variable is not set."
    echo "Usage: export DOCKER_USERNAME=myuser; ./scripts/pull-runners.sh"
    exit 1
fi

echo "Pulling runners for user: $DOCKER_USERNAME"

declare -A runners
runners=( 
    ["cpp"]="cpp-runner" 
    ["python"]="python-runner" 
    ["javascript"]="node-runner" 
    ["java"]="java-runner" 
    ["go"]="go-runner" 
    ["rust"]="rust-runner" 
)

for lang in "${!runners[@]}"; do
    name=${runners[$lang]}
    tag="$DOCKER_USERNAME/$name:latest"
    
    echo "--- Processing $name ---"
    
    echo "Pulling $tag..."
    docker pull $tag
    
    echo "Retagging $tag -> $name..."
    docker tag $tag $name
    
    echo "Done with $name"
    echo ""
done

echo "All runners pulled and ready!"
