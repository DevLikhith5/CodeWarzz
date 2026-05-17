# CodeWarz Chaos Engineering Suite

Randomly terminates containers and simulates network partitions to prove system resilience, targeting **99.9% uptime** under fault conditions.

## Features

| Fault Type         | Mechanism                    | Target                               |
| ------------------ | ---------------------------- | ------------------------------------ |
| Container Kill     | Docker API SIGKILL           | Any codewarz-\* container (weighted) |
| Network Partition  | Linux `tc netem` packet loss | Host network interface               |
| Steady-State Probe | HTTP GET /health every 2s    | API Gateway                          |

## Quick Start

```bash
# 1. Make sure the stack is running
docker compose up -d

# 2. Install deps + run 2-minute experiment
./run_chaos.sh

# 3. Custom duration
./run_chaos.sh --duration 300 --config chaos.config.yml

# 4. Probe-only (no faults)
./run_chaos.sh --dry-run

# 5. Via Docker Compose (chaos profile)
docker compose --profile chaos up chaos-engineering
```

## Predefined Scenarios

```bash
# Cascade failure: kill core, observe gateway degradation
python3 chaos_scenarios.py --scenario cascade_failure

# Leaderboard pressure: 50 concurrent reads during container kill
python3 chaos_scenarios.py --scenario leaderboard_pressure

# Split-brain: simultaneous core + leaderboard kill
python3 chaos_scenarios.py --scenario split_brain
```

## Report Format

Each run generates `chaos_report.json`:

```json
{
  "started_at": "2026-05-17T09:00:00Z",
  "total_probes": 60,
  "successful_probes": 60,
  "uptime_pct": 100.0,
  "p50_latency_ms": 12.3,
  "p99_latency_ms": 45.7,
  "chaos_events": [
    {
      "kind": "container_kill",
      "target": "codewarz-core",
      "outcome": "killed"
    },
    { "kind": "network_partition", "target": "eth0", "duration_s": 10.0 }
  ]
}
```

## Configuration (`chaos.config.yml`)

| Key                        | Default                  | Description               |
| -------------------------- | ------------------------ | ------------------------- |
| `experiment_duration_s`    | 120                      | Total experiment window   |
| `chaos_interval_s`         | 15                       | Fault injection frequency |
| `probe_interval_s`         | 2                        | Health poll frequency     |
| `network_fault_duration_s` | 10                       | tc loss rule duration     |
| `targets`                  | core,leaderboard,gateway | Weighted kill targets     |
| `exclude_containers`       | postgres,redis,rabbitmq  | Never killed              |

> **Note:** `tc netem` requires `CAP_NET_ADMIN` (sudo). If unavailable, the network partition fault is automatically skipped and only container kills run.
