#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CodeWarz Chaos Engineering — Quick Start Script
# ─────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./run_chaos.sh [--duration 60] [--dry-run] [--config chaos.config.yml]
#
# Network partition requires sudo (tc/netem). If not run as root, that fault
# type is automatically skipped and only container kills are exercised.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════════╗"
echo "║   CodeWarz Chaos Engineering Suite               ║"
echo "╚══════════════════════════════════════════════════╝"

# Install Python deps if missing
if ! python3 -c "import docker, requests, yaml, rich" 2>/dev/null; then
    echo "[*] Installing Python dependencies..."
    pip3 install docker requests pyyaml rich --quiet
fi

# Verify Docker is reachable
if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker daemon not reachable. Start Docker and retry."
    exit 1
fi

# Verify at least one CodeWarz container is running
RUNNING=$(docker ps --filter "name=codewarz" --format "{{.Names}}" | wc -l | tr -d ' ')
if [ "$RUNNING" -eq 0 ]; then
    echo "[WARN] No CodeWarz containers found running."
    echo "       Start the stack first: docker compose up -d"
    echo "       Continuing in dry-run mode..."
    exec python3 "${SCRIPT_DIR}/chaos_runner.py" --dry-run "$@"
fi

echo "[*] Found ${RUNNING} CodeWarz containers"
echo "[*] Starting chaos experiment..."
echo ""

exec python3 "${SCRIPT_DIR}/chaos_runner.py" "$@"
