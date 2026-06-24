#!/usr/bin/env bash

# CodeWarz Startup Automator
# Orchestrates dependencies, builds containers, and starts the local cluster.

set -e

# Harmonious HSL colors for logs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Check if Docker daemon is running
log_info "Checking if Docker is running..."
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
log_success "Docker daemon is online."

# 2. Syncing local package-lock.json files
log_info "Synchronizing package-lock files for all microservices..."
SERVICES=("core" "api-gateway" "leaderboard-service" "evaluation-service" "web")

for service in "${SERVICES[@]}"; do
    if [ -d "$service" ]; then
        log_info "Syncing dependencies in directory: ${CYAN}${service}${NC}..."
        # Run in a subshell so a non-zero exit doesn't abort the whole script,
        # but actually capture and check the exit code so a hard failure
        # is escalated to log_error instead of silently swallowed.
        if ! (cd "$service" && npm install --silent); then
            log_error "npm install failed in $service"
            log_warn "Continuing anyway, but $service may have stale node_modules"
        fi
    fi
done
log_success "All local dependency lockfiles are synchronized."

# 3. Fire up the docker compose stack
log_info "Launching the CodeWarz cluster (this may take a few moments to verify layers)..."
docker compose up --build -d

log_success "All containers are started successfully!"

# 4. Print Access Endpoints
echo -e "\n================================================================="
echo -e "                   ${GREEN}CodeWarz Local Cluster${NC}                   "
echo -e "================================================================="
echo -e "  Web UI:             http://localhost:8080"
echo -e "  API Gateway:        http://localhost:3000"
echo -e "  RabbitMQ UI:        http://localhost:15672 (codewarz/codewarz)"
echo -e "  Jaeger Tracing:     http://localhost:16686"
echo -e "  Grafana:            http://localhost:3004 (admin/admin)"
echo -e "  Prometheus:         http://localhost:9090"
echo -e "=================================================================\n"
echo -e "To view logs, run: ${YELLOW}docker compose logs -f${NC}"
echo -e "To stop the cluster, run: ${YELLOW}docker compose down${NC}"
