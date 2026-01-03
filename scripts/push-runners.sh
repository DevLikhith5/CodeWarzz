#!/bin/bash
# Push runners to Docker Hub


if [ -z "$DOCKER_USERNAME" ]; then
    echo "Error: DOCKER_USERNAME environment variable is not set."
    echo "Usage: export DOCKER_USERNAME=myuser; ./scripts/push-runners.sh"
    exit 1
fi

echo "Building and Pushing runners for user: $DOCKER_USERNAME"


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
    path="evaluation-service/src/docker/$lang"
    tag="$DOCKER_USERNAME/$name:latest"
    
    echo "--- Processing $name ($lang) ---"
    

    echo "Building $tag from $path..."
    docker build -t $name $path
    docker tag $name $tag
    

    echo "Pushing $tag..."
    docker push $tag
    
    echo "Done with $name"
    echo ""
done

echo "All runners pushed successfully!"
