# CodeWarz — January 2026 Codebase Guide

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Service Topology](#2-service-topology)
3. [Data Model](#3-data-model)
4. [Authentication System](#4-authentication-system)
5. [API Gateway](#5-api-gateway)
6. [Core Service](#6-core-service)
7. [Evaluation Service](#7-evaluation-service)
8. [Leaderboard Service](#8-leaderboard-service)
9. [Queue & Worker Architecture](#9-queue--worker-architecture)
10. [Sandbox System](#10-sandbox-system)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Database Migrations & ORM](#12-database-migrations--orm)
13. [Deployment](#13-deployment)
14. [API Routes Reference](#14-api-routes-reference)

---

## 1. Architecture Overview

CodeWarz is a **microservices-based competitive coding platform** built entirely with TypeScript/Node.js (Express 5). It runs on Docker Compose in a single-host deployment model.

**Key design choices in January:**

- **Express 5** — all API services use the Express 5 beta (peer dependency `express@^5.0.0`)
- **BullMQ** — Redis-backed job queues for async processing (submission evaluation, leaderboard updates)
- **Drizzle ORM** — TypeScript-first SQL ORM with PostgreSQL
- **Redis** — dual-purpose: BullMQ job broker AND application cache
- **JWT + Google OAuth** — authentication via access/refresh token pair + social login
- **Docker-in-Docker sandboxing** — code execution in disposable Docker containers
- **Loki + Grafana + Prometheus** — centralized logging and metrics
- **Token Bucket rate limiter** — Redis-backed with Lua scripting

---

## 2. Service Topology

```
                ┌──────────────────────────────────────────┐
                │              API Gateway                  │
                │          (port 3000, Express 5)           │
                │     Rate Limiter │ Helmet │ CORS          │
                └──────┬──────────────┬─────────────┬───────┘
                       │              │             │
              ┌────────▼──┐  ┌────────▼──┐  ┌──────▼──────────┐
              │  Core     │  │Evaluation │  │ Leaderboard     │
              │ (3001)    │  │ (3003)    │  │ (3002)          │
              │ Express 5 │  │ Express 5 │  │ Express 5       │
              │ Drizzle   │  │ Docker-   │  │ BullMQ Consumer │
              │ BullMQ    │  │ in-Docker │  │ Redis SortedSet │
              │ JWT/OAuth │  │ Sandbox   │  │                 │
              └─────┬─────┘  └───────────┘  └─────────────────┘
                    │
            ┌───────▼───────┐    ┌──────────────────┐
            │  PostgreSQL 16 │    │   Redis (Alpine) │
            │  (Docker)     │    │   Queue + Cache   │
            └───────────────┘    └──────────────────┘
```

### Container topology (docker-compose.yml):

| Container | Image | Port(s) | Replicas | Dependencies |
|-----------|-------|---------|----------|-------------|
| `postgres` | postgres:16-alpine | 5432 | 1 | — |
| `redis` | redis:alpine | 6379 | 1 | — |
| `core` | custom Dockerfile | — | 1 | redis, postgres |
| `evaluation-service` | custom Dockerfile | — | **2** | redis, core |
| `leaderboard-service` | custom Dockerfile | — | 1 | redis, core |
| `api-gateway` | custom Dockerfile | 3000 | 1 | core, evaluation, leaderboard |
| `web` | custom Dockerfile | 8080 | 1 | api-gateway |
| `prometheus` | prom/prometheus:latest | 9090 | 1 | — |
| `loki` | grafana/loki:2.9.2 | 3100 | 1 | — |
| `grafana` | grafana/grafana:latest | 3004 | 1 | — |

The evaluation-service is the only service with `deploy.replicas: 2`, allowing parallel submission processing.

---

## 3. Data Model

All tables live in PostgreSQL and are managed via Drizzle ORM schema files in `core/src/db/schema/`.

### 3.1 Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, default random |
| `username` | `varchar(50)` | not null |
| `email` | `varchar(255)` | unique, not null |
| `password_hash` | `varchar(255)` | bcrypt |
| `role` | `varchar(20)` | default 'user' |
| `solved_count` | `integer` | default 0 |
| `refresh_token` | `varchar(255)` | nullable |
| `created_at` | `timestamp` | default now |
| `updated_at` | `timestamp` | default now |

Index: `refresh_token_idx` on `refresh_token`.

#### `user_daily_activity`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `uuid` | FK → users |
| `date` | `timestamp` | |
| `submissions` | `integer` | |
| `created_at` / `updated_at` | `timestamp` | |
| **PK** | | composite (user_id, date) |

#### `problems`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `title` | `varchar(255)` | |
| `slug` | `varchar(255)` | unique |
| `description` | `text` | |
| `difficulty` | `difficulty` enum | EASY / MEDIUM / HARD |
| `max_score` | `integer` | default 100 |
| `time_limit_ms` | `integer` | default 2000 |
| `memory_limit_mb` | `integer` | default 256 |
| `cpu_limit` | `integer` | default 1 |
| `stack_limit_mb` | `integer` | nullable |
| `tags` | `json` | `string[]` |
| `hints` | `json` | `string[]` |
| `created_at` / `updated_at` | `timestamp` | |

#### `testcases`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `problem_id` | `uuid` | FK → problems, cascade delete |
| `input` | `text` | |
| `output` | `text` | |
| `is_sample` | `boolean` | default false |
| `created_at` | `timestamp` | |

#### `contests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `title` | `varchar(255)` | |
| `slug` | `varchar(255)` | unique |
| `description` | `text` | |
| `start_time` | `timestamp` | |
| `end_time` | `timestamp` | |
| `is_frozen` | `boolean` | default false |
| `created_at` | `timestamp` | |

#### `contest_problems`
| Column | Type | Notes |
|--------|------|-------|
| `contest_id` | `uuid` | FK → contests |
| `problem_id` | `uuid` | FK → problems |
| **PK** | | composite (contest_id, problem_id) |

#### `contest_registrations`
| Column | Type | Notes |
|--------|------|-------|
| `contest_id` | `uuid` | FK → contests |
| `user_id` | `uuid` | FK → users |
| `registered_at` | `timestamp` | |
| **PK** | | composite (contest_id, user_id) |

#### `submissions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → users |
| `problem_id` | `uuid` | FK → problems |
| `contest_id` | `uuid` | FK → contests, nullable |
| `language` | `language` enum | cpp / java / python / javascript / go / rust |
| `code` | `text` | |
| `verdict` | `verdict` enum | AC / WA / TLE / MLE / RE / CE / PENDING |
| `score` | `integer` | default 0 |
| `time_taken_ms` | `integer` | |
| `memory_used_mb` | `integer` | nullable |
| `passed_testcases` | `integer` | |
| `total_testcases` | `integer` | |
| `failed_input` | `text` | nullable |
| `failed_expected` | `text` | nullable |
| `failed_output` | `text` | nullable |
| `error_message` | `text` | nullable |
| `created_at` | `timestamp` | |

#### `leaderboard_snapshots`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `contest_id` | `uuid` | FK → contests |
| `user_id` | `uuid` | FK → users |
| `score` | `integer` | |
| `rank` | `integer` | |
| `time_taken_ms` | `integer` | |
| `captured_at` | `timestamp` | |

### 3.2 Enums (PostgreSQL native)

- `verdict`: AC, WA, TLE, MLE, RE, CE, PENDING
- `language`: cpp, java, python, javascript, go, rust
- `difficulty`: EASY, MEDIUM, HARD

### 3.3 Drizzle Relations

Relations are defined in `core/src/db/schema/relations.ts` for type-safe queries:

```
users ──1:N──> submissions
users ──1:N──> contest_registrations
users ──1:N──> leaderboard_snapshots
users ──1:N──> user_daily_activity

contests ──1:N──> submissions
contests ──1:N──> contest_registrations
contests ──1:N──> contest_problems
contests ──1:N──> leaderboard_snapshots

problems ──1:N──> submissions
problems ──1:N──> testcases
problems ──1:N──> contest_problems
```

---

## 4. Authentication System

### 4.1 Flow

Three authentication paths exist:
1. **Email/Password**: signup → signin → JWT pair
2. **Google OAuth**: redirect → callback → auto-create user → JWT pair
3. **Internal API Key**: x-internal-api-key header for service-to-service calls

### 4.2 JWT Token Strategy

- **Access Token**: `{ id, role }`, signed with `JWT_SECRET`, expires in **1 minute**
- **Refresh Token**: `{ id }`, signed with `REFRESH_SECRET`, expires in **7 days**
- Both stored as **httpOnly cookies** (`accessToken` and `refreshToken`)
- Refresh rotates: old refresh token is replaced in DB on each refresh

### 4.3 Middleware Chain

| Middleware | Purpose |
|-----------|---------|
| `verifyToken` | Requires valid JWT from `Authorization: Bearer` or cookie `accessToken` |
| `verifyInternalOrUser` | Accepts either `x-internal-api-key` header OR verified JWT |
| `isAdmin` | Checks `req.user.role === 'admin'` |
| `extractUser` | Optional auth: sets `req.user` if token present, continues without error |

### 4.4 Google OAuth Details

1. `GET /auth/google/signin` — generates a random state, sets it as httpOnly cookie, redirects to Google
2. Google redirects back to `/auth/google/callback`
3. Callback validates state cookie, exchanges `code` for `id_token` via Google's token endpoint
4. Verifies the Google ID token, extracts email/name
5. Auto-creates user if not found (generates random password)
6. Issues JWT pair and redirects to `FRONTEND_URL/auth/callback`

### 4.5 Cookie Helper

`setAuthCookies` sets both tokens as httpOnly, sameSite lax cookies:
- Access token: 15 min maxAge
- Refresh token: 7 day maxAge
- `clearAuthCookies` clears both

### 4.6 Auth Routes

| Method | Route | Auth | Handler |
|--------|-------|------|---------|
| POST | `/auth/signup` | None | Sign up with username/email/password |
| POST | `/auth/signin` | None | Sign in with email/password |
| POST | `/auth/refresh` | Cookie | Refresh token rotation |
| GET | `/auth/google/signin` | None | Initiate Google OAuth |
| GET | `/auth/google/callback` | None | Google OAuth callback |
| POST | `/auth/logout` | None | Clear auth cookies |
| GET | `/auth/me` | verifyToken | Session check |

---

## 5. API Gateway

The API Gateway (`api-gateway/`, port 3000) is the single entry point into the backend. It uses `express-http-proxy` to route requests to downstream services.

### 5.1 Middleware Stack

1. `helmet()` — security headers
2. `cors()` — configured with `FRONTEND_URL`, credentials enabled
3. `morgan` — HTTP request logging
4. `cookie-parser` — parse cookies for downstream forwarding
5. `correlationIdMiddleware` — assigns `x-correlation-id` to every request
6. `metricsMiddleware` — Prometheus HTTP metrics
7. `rateLimiter` — token bucket algorithm, 50 tokens, 50/60 per sec refill

### 5.2 Proxy Routing

| Path Prefix | Target | Notes |
|------------|--------|-------|
| `/api/v1/leaderboard/live/:contestId` | `leaderboard-service:3002/api/v1/leaderboard/contest/:contestId/top` | Live Redis-based |
| `/api/v1/leaderboard/archive/*` | `core:3001/api/v1/leaderboard/archive/*` | Archived snapshots from DB |
| `/api/v1/*` | `core:3001/api/v1/*` | Everything else (auth, problems, contests, submissions, etc.) |

The proxy decorator forwards `x-correlation-id` and `Cookie` headers to upstream services.

### 5.3 Rate Limiter

A Redis-backed **token bucket** implementation using Lua scripting for atomicity:

- **Capacity**: 50 tokens
- **Refill rate**: 50/60 ≈ 0.83 tokens/sec
- **Key**: `ratelimit:{client_ip}`
- **TTL**: 1 hour on the key
- Returns `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers
- Returns 429 when exhausted

---

## 6. Core Service

The Core Service (`core/`, port 3001) is the primary API service. It handles all CRUD operations, authentication, and is the orchestrator for submissions.

### 6.1 Layered Architecture

```
Router ──> Controller ──> Service ──> Repository ──> Drizzle ORM ──> PostgreSQL
                                    │
                                    └──> BullMQ Queue ──> Redis
```

### 6.2 Controllers

| Controller | Key Methods |
|-----------|------------|
| `auth.controller` | signUp, signIn, refreshToken, googleSignin, googleCallBack, logout |
| `problem.controller` | createProblem, getProblems, getProblem, getProblemBySlug |
| `contest.controller` | createContest, getContest, getAllContests, addProblemToContest, registerForContest, deregisterForContest, getContestProblems, getContestLeaderboard |
| `submission.controller` | submitController, getSubmission, getSubmissions, runController, getRunResult, updateSubmission, getBestSubmission |
| `leaderboard.controller` | takeSnapshot, getArchivedLeaderboard |
| `user.controller` | getProfile, getActivity, getStats, getLastAttempted, getGlobalLeaderboard |
| `ping.controller` | Simple health ping |

All controllers wrap logic in try/catch, call services, increment Prometheus metrics, and return standardized `successResponse`.

### 6.3 Services

**AuthService** (`core/src/service/auth.service.ts`):
- `signUp` — checks for existing user, bcrypt hashes password (10 rounds), creates user
- `signIn` — validates credentials, generates JWT pair, stores refresh token in DB
- `refreshToken` — verifies refresh token JWT, checks DB for match, rotates both tokens
- `googleCallBack` — exchanges code for Google ID token, verifies, upserts user

**SubmissionService** (`core/src/service/submission.service.ts`):
- `submitSolution` — checks ongoing contest authorization, creates DB record, enqueues to `submission-queue`, increments user activity
- `runSolution` — same auth check + enqueues with `isRunOnly: true` flag
- `getRunResult` — reads directly from BullMQ job state (no DB persistence for runs)
- `updateSubmission` — called by evaluation service via internal API; if verdict=AC, increments solved count
- `getBestSubmission` — returns the best AC submission (sorted by time, memory, then date)

**ContestService** (`core/src/service/contest.service.ts`):
- Computes contest status dynamically: UPCOMING / ONGOING / ENDED based on current time
- Registration count computed per contest
- Leaderboard computed by iterating all contest submissions in memory:
  - First AC per problem counts for score (maxScore)
  - 10 min penalty per wrong attempt
  - Tie-breaking: higher score wins, then lower total time
- Supports filtering: status filter, registered-only, participated-only

**ProblemService** (`core/src/service/problem.service.ts`):
- Creates problem + testcases + optional contest association in a DB transaction
- Fetches problems with submission stats (totalSubmissions, acceptedSubmissions) via SQL aggregation
- Tracks user status: "Solved" / "Attempted" / null

**UserService** (`core/src/service/user.service.ts`):
- Computes solved counts by difficulty (EASY/MEDIUM/HARD)
- Computes submission stats (total/accepted/acceptance rate)
- Tag statistics from solved problems
- Global leaderboard sorted by solved count

**CacheService** (`core/src/service/cache.service.ts`):
- Generic Redis cache with JSON serialization
- TTL-based expirations
- Tracks cache hit/miss/error metrics

**QueueMonitorService** (`core/src/service/queueMonitor.service.ts`):
- Polls BullMQ queue depths every 5 seconds
- Exposes as Prometheus gauge `app_queue_depth`
- Monitors: submission-queue, leaderboard-queue, scheduler-queue

**MetricsService** (`core/src/service/metrics.service.ts`):
- Singleton Prometheus registry with 16 custom metrics
- Collects default Node.js metrics (event loop, GC, memory, etc.)

### 6.4 Repositories

Repositories wrap all Drizzle query operations with `observeDbQuery` for Prometheus timing:
- `observeDbQuery` starts a timer, runs the query, records duration & success/failure
- All return typed results via Drizzle query builder or raw SQL

**Key repository patterns:**

- **Cache-Aside Pattern** in `ContestRepository`: check cache → miss → query DB → populate cache (TTL 60-300s)
- **Upsert** in `UserRepository.incrementUserActivity`: `onConflictDoUpdate` for daily submission counts
- **SQL Aggregation** in `ProblemRepository`: `count(case when ...)` in LEFT JOIN for stats
- **DB Transaction** in `ProblemRepository.createProblemWithTestcases`: problem + testcases + contestProblems atomically

### 6.5 Error Handling

Custom error classes in `core/src/utils/errors/app.error.ts`:

| Class | HTTP Status |
|-------|-------------|
| `BadRequestError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `InternalServerError` | 500 |
| `NotImplementedError` | 501 |

Two middleware handlers: `appErrorHandler` (for AppError instances) and `genericErrorHandler` (fallback 500).

### 6.6 Correlation ID

Every request gets a UUID (`x-correlation-id`) via middleware, stored in `AsyncLocalStorage`. All log entries include this ID for tracing across service calls. The middleware propagates existing IDs from headers to preserve the chain.

---

## 7. Evaluation Service

The Evaluation Service (`evaluation-service/`, port 3003) handles code execution. It has **2 replicas** for parallel processing.

### 7.1 Architecture

```
Evaluation Service (Express 5)
  ├── API layer (v1, v2 routers — health only)
  ├── BullMQ Worker: consumes "submission-queue"
  │     └── Sandbox: Docker-in-Docker code execution
  ├── BullMQ Producer: pushes to "leaderboard-queue"
  ├── BullMQ Worker: "scheduler-queue" for cron snapshots
  └── Metrics + Logging (shared from core/)
```

### 7.2 Submission Worker

The main worker (`startSubmissionConsumer` in `consumer.queue.ts`) processes each submission:

1. **Fetch problem data** — HTTP call to `CORE_SERVICE_URL/api/v1/problems/:id`
2. **Prepare testcases** — if run-only and custom provided, use those; if run-only but no custom, use sample testcases; for submissions use all testcases
3. **Run sandbox** — calls `runSandbox()` with code, language, testcases, constraints
4. **Calculate score** — if AC, score = `problem.maxScore` (default 100)
5. **Persist results** — HTTP PATCH to core service (`/api/v1/submissions/:id`)
6. **Handle leaderboard** — if AC and contest:
   - Check Redis Set `CodeWarz:Solved:{contestId}:{userId}` for deduplication (first solve only)
   - Encode score with penalty: `finalScore = maxScore + (MAX_PENALTY_MINS - penaltyMinutes) / MAX_PENALTY_MINS`
   - Push to "leaderboard-queue"
7. **Record metrics** — sandbox duration, verdict counts, e2e duration

**Worker configuration:**
- `concurrency: 5` — 5 simultaneous jobs per replica
- `lockDuration: 60000` — 60 sec lock
- `lockRenewTime: 15000` — renew every 15s
- `stalledInterval: 30000` — check stalls every 30s

### 7.3 Leaderboard Snapshot Cron

A BullMQ repeatable job (`scheduler-queue`) triggers every **2 minutes**:
- HTTP POST to `CORE_SERVICE_URL/api/v1/leaderboard/snapshot`
- Core service then snapshots all active contest leaderboards from Redis -> PostgreSQL

---

## 8. Leaderboard Service

The Leaderboard Service (`leaderboard-service/`, port 3002) is a lightweight service that:

### 8.1 Redis Sorted Set Leaderboard

Uses Redis sorted sets (`ZADD`, `ZREVRANGE`, `ZREVRANK`) for real-time leaderboards:

- **Key pattern**: `CodeWarz:Leaderboard:{contestId}`
- **Score encoding**: `Math.floor(rawScore)` = points; fractional part encodes penalty
  - Decoding: `penaltyMinutes = MAX_PENALTY_MINS - (rawScore - points) * MAX_PENALTY_MINS`
  - `MAX_PENALTY_MINS = 100000`
- **TTL**: contest end time + 24 hours extension

### 8.2 Verdict Consumer

Consumes `leaderboard-queue`:
- Receives `{ contestId, userId, score, contestEndTime }`
- Calls `updateLeaderboard` which does `ZADD` with expiry
- Concurrency: 5

### 8.3 Top Leaderboard API

`GET /leaderboard/contest/:id/top?limit=N`:
- Uses `ZREVRANGE key 0 N-1 WITHSCORES`
- Decodes score back to (points, penaltyMinutes)
- Returns sorted leaderboard with decoded values

### 8.4 User Rank API

`GET /leaderboard/contest/:id/rank/:userId`:
- Uses `ZREVRANK` for position and `ZSCORE` for the encoded score
- Returns `{ rank, score, penaltyMinutes }`

---

## 9. Queue & Worker Architecture

### 9.1 Queue Topology

```
Core Service          Evaluation Service          Leaderboard Service
    │                       │                          │
    │  submission-queue     │                          │
    │──────────────────────>│                          │
    │   (BullMQ Producer)   │  (BullMQ Consumer x5)   │
    │                       │                          │
    │                       │  leaderboard-queue       │
    │                       │────────────────────────> │
    │                       │  (BullMQ Producer)       │ (BullMQ Consumer x5)
    │                       │                          │
    │                       │  scheduler-queue         │
    │                       │  (every 120s)            │
    │<──────────────────────│  HTTP POST /snapshot     │
    │   (cron trigger)      │                          │
```

### 9.2 Queue Configurations

**submission-queue** (producer: core, consumer: evaluation):
- Default: 3 retries, exponential backoff (1s base)
- `removeOnComplete`: age 300s, keep 100
- `removeOnFail`: keep 500

**leaderboard-queue** (producer: evaluation, consumer: leaderboard):
- 3 retries, exponential backoff (1s base)
- `removeOnComplete`: true
- `removeOnFail`: false (keep failed for debugging)

**scheduler-queue** (producer/consumer: evaluation):
- BullMQ job scheduler: repeat every 120,000ms (2 min)
- Calls Core leaderboard snapshot API

### 9.3 Worker Processes

Each service has separate worker entry points:
- **Evaluation Service**: `npm run dev:submission-worker` runs the submission consumer
- **Evaluation Service**: `npm run dev:leaderboard-worker` runs the snapshot cron worker
- **Or**: `npm run dev:all` runs API, submission worker, and leaderboard worker concurrently via `concurrently`

---

## 10. Sandbox System

The sandbox is the most sophisticated subsystem. It executes untrusted user code in isolated Docker containers.

### 10.1 Execution Flow

```
Code + Language + Testcases
          │
          ▼
    createWorkspace()
    │  └─ temp_workspaces/judge-{uuid}/
    │
    ▼
    Write source file (solution.cpp, solution.py, etc.)
          │
          ▼
    compile(workspace, lang)
    │  └─ docker run --rm -v {hostPath}:/app {image} {compileCommand}
    │     e.g., "g++ solution.cpp -O2 -std=gnu++17 -o solution"
    │
    ▼
    Write runner.sh script + input files
          │
          ▼
    execute(workspace, lang, constraints)
    │  └─ docker run --rm --network none --memory Xm --cpus Y \
    │       -v {hostPath}:/app -w /app {image} sh -c "timeout Z sh runner.sh"
    │
    ▼
    Read exit codes + output files
    │
    ▼
    compareOutput(actual, expected)
    │  └─ Whitespace-normalized comparison
    │
    ▼
    cleanupWorkspace()
```

### 10.2 Language Runners

Each language has a custom Docker image and config:

| Language | Image | Source File | Compile Command | Run Command |
|----------|-------|-------------|-----------------|-------------|
| C++ | `cpp-runner` | `solution.cpp` | `g++ -O2 -std=gnu++17 -o solution` | `./solution` |
| Python | `python-runner` | `solution.py` | (none — interpreted) | `python solution.py` |
| JavaScript | `node-runner` | `solution.js` | (none — interpreted) | `node solution.js` |
| Java | `java-runner` | `Main.java` | `javac Main.java` | `java Main` |
| Go | `go-runner` | `solution.go` | `go build -o solution` | `./solution` |
| Rust | `rust-runner` | `solution.rs` | `rustc -O -o solution` | `./solution` |

### 10.3 Security Constraints

Each execution container runs with:
- **`--network none`** — no network access
- **`--memory Xm`** — memory limit per problem config
- **`--cpus Y`** — CPU limit per problem config
- **`--pids-limit 64`** — prevent fork bombs
- **`timeout`** — time limit (problem timeLimitMs + 2s grace)
- **Docker-in-Docker** — the outer evaluation container mounts `temp_workspaces` from the host; inner code containers mount the same path

### 10.4 Testcase Execution Strategy

- **For submissions** (`runAllTestcases = false`): runner.sh script exits early on first failure. Only the first failed test case is returned.
- **For run requests** (`runAllTestcases = true`): all testcases are executed regardless. All results returned.

### 10.5 Output Comparison

Whitespace-insensitive comparison:
1. Trim both strings
2. Split by newlines
3. Trim each line's inner whitespace via `replace(/\s+/g, ' ')`
4. Filter empty lines
5. Compare line-by-line

### 10.6 Docker-in-Docker Path Resolution

The `HOST_WORKSPACES_ROOT` environment variable is critical:
- Inside Docker: resolves to the host machine's path to `temp_workspaces` (e.g., `/Users/cvlikhith/CodeWarz/temp_workspaces`)
- The inner Docker container mounts this host path as `/app`
- Locally: falls back to the internal path

---

## 11. Monitoring & Observability

### 11.1 Logging (Winston + Loki)

All services use a shared logging pattern with:
- **Console transport**: colorized, human-readable with timestamp and correlation ID
- **Daily Rotate File**: JSON formatted, 20MB max size, 14 day retention
- **Loki transport**: pushes structured logs to Grafana Loki at `LOKI_URL`
- **Correlation ID integration**: every log entry includes `[correlationId]` derived from `AsyncLocalStorage`

### 11.2 Prometheus Metrics (16 custom metrics)

**Singleton `MetricsService`** in core (shared by all services):

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | Histogram | method, route, status_code | HTTP latency |
| `http_requests_total` | Counter | method, route, status_code | Request count |
| `db_query_duration_seconds` | Histogram | operation, table, status | DB query latency |
| `redis_operation_duration_seconds` | Histogram | command, status | Redis latency |
| `job_processing_duration_seconds` | Histogram | queue_name, status, job_name | Queue job latency |
| `sandbox_execution_duration_seconds` | Histogram | language, status | Code execution latency |
| `submission_total` | Counter | language, type | Submission/run count |
| `verdict_total` | Counter | verdict, contest_id | Verdict distribution |
| `submission_e2e_duration_seconds` | Histogram | status, language | End-to-end latency |
| `app_queue_depth` | Gauge | queue_name, status | Queue size |
| `app_errors_total` | Counter | type, code | Error count |
| `auth_events_total` | Counter | event, status | Auth event count |
| `contest_events_total` | Counter | event, status | Contest event count |
| `problem_events_total` | Counter | event, status | Problem event count |
| `leaderboard_events_total` | Counter | event, status | Leaderboard event count |
| `user_events_total` | Counter | event, status | User event count |

Plus default Node.js metrics (event loop lag, GC, heap, etc.)

Each service exposes `/metrics` endpoint.

Route normalization in `metricsMiddleware` converts UUID path segments to `:id` to prevent cardinality explosion.

### 11.3 Grafana

- Pre-provisioned datasource: Prometheus
- Available at port 3004 (admin/admin)

### 11.4 Monitoring Stack (Docker Compose)

```
Prometheus (9090) ──scrape──> Each service /metrics endpoint
     │
     ▼
Grafana (3004) ──── datasource ──── Prometheus

Loki (3100) <── push logs from all services via winston-loki
     │
     ▼
(Queryable via Grafana Explore)
```

---

## 12. Database Migrations & ORM

### 12.1 Drizzle ORM

- **Schema**: defined in `core/src/db/schema/` (7 files: index, enums, user, problems, contest, submission, leaderboard, relations)
- **Client**: `drizzle-orm/node-postgres` with full schema export
- **Config**: `core/drizzle.config.ts`
- **Migration files**: stored in `core/drizzle/meta/` (3 snapshot generations: `_journal.json` + snapshots)
- **Relations**: defined in `relations.ts` for type-safe `findFirst`/`findMany` with deep includes

### 12.2 Migration Commands

- `npx drizzle-kit push` — pushes schema changes to DB (used in deployment)
- Migration snapshots suggest Drizzle Kit's `generate` + `migrate` workflow was used during development

---

## 13. Deployment

### 13.1 Deployment Script (`scripts/deploy.sh`)

```
1. Copy .env.example → .env (if not exists)
2. Pull sandbox runner Docker images
3. docker compose up -d --build
4. Sleep 5s for services to stabilize
5. docker compose exec core npx drizzle-kit push
```

### 13.2 Sandbox Runner Images

- Built locally with `scripts/push-runners.sh`
- Pulled from registry with `scripts/pull-runners.sh`
- Images: `cpp-runner`, `python-runner`, `node-runner`, `java-runner`, `go-runner`, `rust-runner`

### 13.3 Environment Variables

Each service requires:
- Core: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `LOKI_URL`, `INTERNAL_API_KEY`
- Evaluation: `REDIS_URL`, `CORE_SERVICE_URL`, `HOST_WORKSPACES_ROOT`, `LOKI_URL`, `INTERNAL_API_KEY`
- Leaderboard: `REDIS_URL`, `LOKI_URL`
- API Gateway: `REDIS_URL`, `FRONTEND_URL`, `CORE_SERVICE_URL`, `EVALUATION_SERVICE_URL`, `LEADERBOARD_SERVICE_URL`, `LOKI_URL`

---

## 14. API Routes Reference

### 14.1 Auth (Core)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/signup` | ✗ | Register with email/password |
| POST | `/api/v1/auth/signin` | ✗ | Login with email/password |
| POST | `/api/v1/auth/refresh` | Cookie | Rotate tokens |
| GET | `/api/v1/auth/google/signin` | ✗ | Start Google OAuth |
| GET | `/api/v1/auth/google/callback` | ✗ | Google OAuth callback |
| POST | `/api/v1/auth/logout` | ✗ | Clear auth cookies |
| GET | `/api/v1/auth/me` | JWT | Session validation |

### 14.2 Problems (Core)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/problems` | Optional | List problems (paginated) |
| POST | `/api/v1/problems` | Admin | Create problem |
| GET | `/api/v1/problems/:id` | Optional | Get problem by ID |
| GET | `/api/v1/problems/slug/:slug` | Optional | Get problem by slug |

### 14.3 Contests (Core)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/contests` | Admin | Create contest |
| GET | `/api/v1/contests` | Optional | List contests (filters: status, registered, participated) |
| POST | `/api/v1/contests/add-problem` | Admin | Add problem to contest |
| GET | `/api/v1/contests/:id` | Optional | Get contest details |
| POST | `/api/v1/contests/:id/register` | JWT | Register for contest |
| POST | `/api/v1/contests/:id/deregister` | JWT | Deregister from contest |
| GET | `/api/v1/contests/:id/problems` | JWT | Get contest problems |
| GET | `/api/v1/contests/:id/leaderboard` | ✗ | Get contest leaderboard |

### 14.4 Submissions (Core)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/submissions` | Internal | Create submission (enqueue) |
| GET | `/api/v1/submissions` | JWT | List user's submissions |
| GET | `/api/v1/submissions/best` | JWT | Get best AC for problem |
| GET | `/api/v1/submissions/:id` | JWT | Get submission detail |
| PATCH | `/api/v1/submissions/:id` | Internal | Update submission result |
| POST | `/api/v1/submissions/run` | JWT | Run code (no persist) |
| GET | `/api/v1/submissions/run/:id` | JWT | Get run result |

### 14.5 Users (Core)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/users/profile` | JWT | Get own profile + stats |
| GET | `/api/v1/users/activity` | JWT | Get daily activity |
| GET | `/api/v1/users/stats` | JWT | Get solved/submission/tag stats |
| GET | `/api/v1/users/last-attempted` | JWT | Get last attempted problem |
| GET | `/api/v1/users/leaderboard` | ✗ | Global leaderboard by solved count |

### 14.6 Leaderboard (Core)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/leaderboard/snapshot` | ✗ | Snapshot active contests to DB |
| GET | `/api/v1/leaderboard/archive/:contestId` | ✗ | Get archived snapshots |

### 14.7 Leaderboard (Leaderboard Service) — via Gateway

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/leaderboard/live/:contestId/top` | ✗ | Get live top N from Redis |
| GET | `/api/v1/leaderboard/live/:contestId/rank/:userId` | ✗ | Get user rank |

### 14.8 Health

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| GET | `/api/v1/ping` | Core | Ping |
| GET | `/api/v1/ping` | Leaderboard | Ping |
| GET | `/health` | Core | Health check |
| GET | `/health` | Gateway | Health check |
| GET | `/metrics` | All | Prometheus metrics |

---

## Architectural Decisions Summary

1. **Monorepo with microservices**: All services in a single repo for simplicity, deployed as separate Docker containers
2. **Express 5**: Early adoption of Express 5 beta for async error handling improvements
3. **PostgreSQL + Drizzle**: Type-safe ORM with SQL-like querying; migrations via Drizzle Kit
4. **BullMQ over RabbitMQ**: Redis-based queues for simplicity (no additional message broker)
5. **Redis Sorted Sets for leaderboard**: Real-time ranking with O(log N) operations
6. **Docker-in-Docker sandboxing**: Strong isolation without per-language custom runners; each language has a pre-built image
7. **Token Bucket rate limiting via Redis Lua**: Atomic rate limiting without race conditions
8. **No gRPC**: All inter-service communication is HTTP REST with JSON
9. **Shared core modules**: Evaluation and Leaderboard services import middleware and utilities directly from `core/src/` via relative paths
10. **Async correlation IDs**: Using Node.js AsyncLocalStorage for request-scoped tracing across async boundaries
