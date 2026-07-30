# CodeWarz — January Code Guide

> Generated from the codebase at commit `a3b4e1e` (Jan 5, 2026), before the May
> distributed-systems upgrade. Use this to understand the original architecture.

## Architecture (Pre-Upgrade)

Only **5 services** (no Go evaluator, no RabbitMQ, no Jaeger):

```
Browser → api-gateway (:3000) → core (:3001) + leaderboard (:3002)
                                    ↓
                            evaluation-service (:3003 × 2 replicas)
                                    ↓
                            Docker sandbox (sibling containers)
```

Infra: postgres:16-alpine, redis:alpine, Prometheus + Loki + Grafana (monitoring).

## Service Breakdown

### api-gateway (Node/TS, :3000)
- Express proxy to core/leaderboard/eval
- No bloom filter, no rate limiter, no SSE, no caching
- Basic cookie forwarding

### core (Node/TS, :3001)
- Express REST API: auth, problems, contests, submissions, users
- Drizzle ORM → PostgreSQL
- JWT auth (access 15m + refresh 7d, httpOnly cookies)
- Google OAuth
- **BullMQ** for job queues (no RabbitMQ yet)
- `queueMonitor.service.ts` polls BullMQ queue status
- `metrics.service.ts` Prometheus metrics
- Simple error middleware stack

### leaderboard-service (Node/TS, :3002)
- HTTP REST leaderboard CRUD
- Redis sorted sets for contest rankings
- No CQRS read model projection
- No gRPC

### evaluation-service (Node/TS, :3003, ×2 replicas)
- Consumes **BullMQ** queues for submissions
- Docker sandbox execution (one container per testcase)
- Language runners: cpp, python, javascript, java, go, rust
- Verdict: AC/WA/TLE/MLE/RE/CE
- REST calls to core for problem data + verdict persistence

### web (React 18 + Vite, :8080)
- Monaco editor, Tailwind, shadcn/ui
- Cookie-based auth with 401 intercept/refresh
- Routes: landing, auth, dashboard, problems, contests, profile

## Data Flow (Submit → Verdict)

1. POST /submissions → gateway → core
2. Core saves submission to Postgres, enqueues via BullMQ
3. evaluation-service picks up the job, runs docker sandbox
4. PATCH /submissions/:id with verdict → core updates DB
5. leaderboard-service reads Redis for contest rankings

## Key Differences from Current Code

| Feature | January | Current (July) |
|---|---|---|
| Job queue | BullMQ | RabbitMQ |
| Evaluator | TS only | TS + Go (migrating) |
| Leaderboard | REST + Redis ZSET | gRPC + CQRS + Lua projection |
| Cache | None | L1/L2 + singleflight |
| Bloom filter | None | Redis bit array at edge |
| Rate limiter | None | Token-bucket Lua |
| Circuit breaker | None | Redis Pub/Sub synced |
| Plagiarism | None | Winnowing + Jaccard |
| Event sourcing | None | ENTITY_events tables |
| CDC | None | pg_notify outbox relay |
| SSE | None | Redis Pub/Sub → EventSource |
| Distributed tracing | None | OTel → Jaeger |
| Chaos testing | None | Python container-kill suite |

## Running the January Build

```bash
git checkout a3b4e1e
docker compose up --build -d
```

Access: web :8080, gateway :3000, Prometheus :9090, Grafana :3004.

## Limitations (Known at the Time)

- No outbox pattern: BullMQ enqueue is a second write outside the DB transaction
- No idempotency on submissions: network retries can duplicate
- No bloom/rate-limit at the edge: bot traffic hits Postgres directly
- Leaderboard reads do `ZREVRANGE` on every request (no read model)
- No live updates: frontend must poll or refresh
- Single Postgres = single point of failure for writes
