# CodeWarz — Interview Prep (Read Once, Explain Everything)

> Everything below is grounded in the actual repository code. Where something is
> half-implemented or simulated, it is **flagged honestly** with a framing strategy.
> Secret *values* are never reproduced here — only variable names.

---

## 1. 30-Second Elevator Pitch

> **Say:** "CodeWarz is a distributed competitive-programming platform — think LeetCode meets Codeforces — built as six services around a message-driven core. Users submit code through a React frontend; an API gateway protects the edge with Redis-backed Bloom filters, Lua-script token-bucket rate limiting, and a two-tier cache with singleflight request coalescing. The core service writes submissions to PostgreSQL using the **transactional outbox pattern**, and instead of polling the outbox, a `pg_notify` trigger pushes the event over a `LISTEN` channel to a relay that publishes into RabbitMQ — so event delivery is atomic *and* zero-polling. A Go worker pool consumes the queue and executes untrusted code in locked-down Docker containers — no network, read-only rootfs, cgroup CPU/memory/PID limits — then reports verdicts back over gRPC. The leaderboard is **CQRS**: writes go to a Redis sorted set with a penalty-encoded score, and an atomic Lua script projects a read-model hash, so leaderboard reads are O(1) and never touch the database. A Redis Pub/Sub invalidation event fans out to every gateway replica, which pushes Server-Sent Events to the browser — the leaderboard updates live without polling. The whole stack is observable with Prometheus, Grafana, and Jaeger tracing via a propagated `x-correlation-id`, and there's a Python chaos-engineering suite that kills containers mid-flight to prove the failure modes actually work."

That paragraph contains **9 distinct talking hooks** (outbox, CDC, CQRS, sandboxing, gRPC, singleflight, SSE, chaos, observability). Let the interviewer pick which thread to pull.

**Scale model (be ready to justify):** single-node Docker Compose cluster locally; architecturally it scales horizontally at the gateway (stateless, L1 cache + Pub/Sub invalidation), at the Go workers (add replicas → RabbitMQ round-robins; 2 replicas already configured in compose), and at the leaderboard (read model is pure Redis). The bottlenecks are the single Postgres and single Redis — see §10.

---

## 2. High-Level Architecture

```
                         ┌──────────────────────────────────────────────────────────┐
                         │                     BROWSER (React 18)                   │
                         │  Monaco editor │ zustand │ react-query │ EventSource SSE │
                         └───────────┬──────────────────────────────▲───────────────┘
                       HTTPS+cookies │ /api/v1                      │ text/event-stream
                                     ▼                              │
┌───────────────────────────────────────────────────────────────────────────────────┐
│  API GATEWAY  (Node/TS, Express 5, :3000)          ← single entry point           │
│  helmet → CORS → correlation-id → metrics → token-bucket RL (Lua) → route RL      │
│  → CSRF double-submit → BLOOM FILTER (Redis GETBIT ×3, 404 at edge)               │
│  ├─ /leaderboard/stream/:id  ── SSE hub ◄── Redis SUB leaderboard:invalidate      │
│  ├─ /leaderboard/live/:id    ── L1 LRU(5000) + L2 Redis(3s) + SINGLEFLIGHT        │
│  └─ /*                   ── express-http-proxy ──► CORE                           │
└──────┬──────────────────────────────────────────────────────────────────────────┘
       │ REST proxy (forwards cookies + x-correlation-id)
       ▼
┌──────────────────────────────┐     gRPC :50051 (API-key auth)
│  CORE  (Node/TS, :3001)      │◄───────────────┐
│  Drizzle ORM │ REST API      │                │ GetProblem / PersistVerdict
│  gRPC server │ event store   │                │
│  plagiarism pipeline         │                │
│  ┌─ Transactional Outbox ─┐  │                │
│  │ INSERT submission +    │  │                │
│  │ outbox row in ONE TX   │  │                │
│  └──────────┬─────────────┘  │                │
│  pg_notify trigger ─► LISTEN client ─► processOutboxBatch
│  (FOR UPDATE SKIP LOCKED → IN_FLIGHT → confirm → PUBLISHED)
│  + 30s fallback poller      │        │
└──────┬───────────────────────┼────────┼──────────────────────────────────────┘
       │                       ▼        ▼
  ┌────▼─────┐        ┌────────────────┐         ┌───────────────────────────────┐
  │PostgreSQL│        │   RabbitMQ     │         │            REDIS              │
  │  16      │        │ submission.exch│         │ bloom bits │ ratelimit buckets│
  │ outbox   │        │  └►submission.q│         │ L2 cache   │ leaderboard ZSET │
  │ events   │        │   (prio 10,    │         │ read-model │ solved sets      │
  │ snapshots│        │   TTL 300s,    │         │ locks      │ idempotency      │
  └──────────┘        │   DLX→.dlq)    │         │ pub/sub: leaderboard:inval., │
                      │ verdict.q      │         │           circuit-breaker:sync│
                      │ plagiarism.q   │         └──────▲──────────────▲─────────┘
                      └───────┬────────┘                │ ZADD/Lua     │ PUBLISH
                              │ consume                 │ EVAL         │
              ┌───────────────▼──────────────────┐      │              │
              │  EVALUATION (Go 1.25, ×2 replicas)│      │              │
              │  10 goroutines, prefetch 10       │      │              │
              │  per-testcase: docker run         │      │              │
              │   --network none --memory Nm      │      │              │
              │   --cpus X --pids-limit 64        │      │              │
              │   --read-only --tmpfs /tmp:64m    │      │              │
              │   timeout → 124=TLE, 137=MLE      │      │              │
              └───────┬───────────────────┬──────┘      │              │
                      │ gRPC PersistVerdict│ gRPC UpdateLeaderboard    │
                      ▼                    ▼                           │
              (back to CORE)    ┌───────────────────────┐              │
                                │ LEADERBOARD (TS,:3002)│──────────────┘
                                │ gRPC :50052           │  ZADD encoded score →
                                │ CQRS: ZSET write →    │  Lua EVAL projection →
                                │ Lua EVAL → HASH read  │  PUBLISH invalidate
                                └───────────────────────┘
   Observability (sideband): Prometheus scrapes :3000-3004 /metrics every 5s ·
   Jaeger traces (x-correlation-id) · Loki logs via winston-loki · Grafana :3004
   Chaos: python runner kills containers / injects tc netem packet loss (profile=chaos)
   Legacy: evaluation-service (TS, :3003) ALSO consumes submission.queue — migration
           in flight (see §11). It owns RabbitMQ topology + snapshot cron.
```

**The core architectural idea — say it explicitly:**
1. **Queue-based load leveling + transactional outbox**: Postgres is the source of truth; the queue is derived from it atomically; traffic spikes are absorbed by RabbitMQ, not by the database.
2. **CQRS on the hot read path**: leaderboard writes and reads are *different Redis data structures*, projected atomically by Lua.
3. **Edge defense in depth**: shed bad traffic as early and as cheaply as possible (bloom → rate limit → cache → singleflight → proxy).
4. **Polyglot persistence by access pattern**: Postgres (relational truth), Redis (ephemeral hot state + pub/sub), RabbitMQ (work queues), Docker containers (ephemeral, untrusted compute).
---

## 3. End-to-End Flow (submit → verdict → live leaderboard)

1. **Browser** — User hits `Cmd/Ctrl+Shift+Enter` in Monaco (`web/src/features/problems/routes/Problem.tsx`). `POST /api/v1/submissions` via axios (`withCredentials: true`, CSRF header read from the `csrf` cookie, 15s timeout). Payload: `{problemId, contestId?, language, code}`.
2. **Gateway edge** (`api-gateway/src/server.ts`) — helmet → CORS → `correlationIdMiddleware` (reads or generates an `x-correlation-id` UUID, stores it in AsyncLocalStorage) → Prometheus metrics → **token bucket**: Lua script against Redis key `ratelimit:<ip>`, 50 tokens, refill 50/60 per second → **route limiter** (`POST:/submissions` = 10/min) → CSRF double-submit check → **Bloom filter** (only guards `/problems/:id` and `/contests/:id` paths — not this one) → `express-http-proxy` forwards to core, copying the `Cookie` and `x-correlation-id` headers.
3. **Core auth & validation** (`core/src/routers/v1/submission.router.ts`) — `verifyToken` validates the JWT (HS256, `JWT_SECRET`, 15-min access token) from the `accessToken` httpOnly cookie → Zod schema validates the body.
4. **Business guards** (`core/src/service/submission.service.ts:submitSolution`) — if the problem belongs to an *ongoing* contest, the user must be registered (cache-aside check, 60s TTL) → backpressure check **(currently a no-op, §11 #16)**.
5. **Transactional outbox** — ONE Postgres transaction: `INSERT INTO submissions (...)` **and** `INSERT INTO outbox_messages (aggregate_type='submission', event_type='SUBMISSION_QUEUED', payload={submissionId,userId,contestId,problemId,language,code,submissionCreatedAt}, exchange='submission.exchange', routing_key='submission.route', max_attempts=5)`. Both commit or both roll back.
6. **CDC push** — the `AFTER INSERT` trigger `outbox_notify_trigger` fires `pg_notify('new_outbox_message', NEW.id::text)`. Core's dedicated `pg.Client` (running `LISTEN new_outbox_message`) receives the notification on its socket within ~1ms of commit and calls `processOutboxBatch(20)`. (A 30-second interval poller covers missed notifications.)
7. **Relay** (`processOutboxBatch`) — `SELECT ... WHERE status='PENDING' ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED` → mark `IN_FLIGHT` → `publishToExchange` on a **ConfirmChannel** with `persistent: true` and an `x-correlation-id` header → `waitForConfirms()` → mark `PUBLISHED` + `published_at`. On failure → `attempts+1`; `FAILED` once attempts reach maxAttempts.
8. **Queue** — `submission.exchange` (direct, durable) → `submission.queue` (durable, `x-max-priority: 10` — contest submissions publish with priority 10 vs practice 1, `x-message-ttl: 300000`, DLX `dlx.exchange` / routing key `submission.dlq.route` → `submission.dlq`).
9. **Go consumer** (`evaluation-service-go/internal/queue/consumer.go`) — `ch.Qos(10,0,false)` prefetch 10, manual ack; 10 goroutines compete on the shared delivery channel. Parse JSON `SubmissionJob` → extract `x-correlation-id` from AMQP headers.
10. **Fetch problem** — gRPC `ProblemService.GetProblem(problem_id)` to `core:50051` (API key in `x-internal-api-key` metadata, 5s timeout, `WaitForReady`, sony/gobreaker circuit breaker). Core returns limits + **all** testcases (including hidden ones) from Postgres.
11. **Sandbox** (`internal/sandbox/`) — `os.MkdirTemp("judge-*")`, write `solution.<ext>` + `input.txt` → **one container per testcase**:

    ```
    docker run --rm --network none --memory 256m --cpus 1.0 --pids-limit 64 \
      --security-opt seccomp=default --security-opt no-new-privileges:true \
      --read-only --tmpfs /tmp:size=64m -v <workspace>:/app -w /app \
      <lang>-runner sh -c "timeout <limit+2s> <runCmd> < input.txt"
    ```

    Exit 124 → `TLE`, 137 → `MLE`, any other non-zero → `RE`, else whitespace-normalized line-by-line output compare → `AC`/`WA`. Compiled languages first get a separate compile container (`g++ -O2 -std=gnu++17`, `javac`, `go build`, `rustc -O`).
12. **Persist verdict** — gRPC `SubmissionService.PersistVerdict{submission_id, verdict, score, time_taken_ms, passed/total_testcases, failed_expected, failed_output, error_message}` → core updates the row in a transaction; on `AC` it wraps the update in a **Redis distributed lock** (`SET lock:solved-count:<user>:<problem> <uuid> PX 5000 NX`, Lua compare-and-delete unlock) before touching `solved_count` **(buggy — §11 #7)**.
13. **Duplicate-solve dedupe** — Go worker: `SADD CodeWarz:Solved:<contestId>:<userId> <problemId>`; if the member already existed → `Ack` and skip the leaderboard update entirely (second AC on the same problem must not re-score).
14. **Score encoding** — `encoded = score + (100000 − penaltyMinutes)/100000`. Points live in the integer part, time in the fraction → a single sorted-set score encodes "more points wins; ties broken by earlier time".
15. **Leaderboard write** — gRPC `LeaderboardService.UpdateLeaderboard` to `leaderboard-service:50052` → `ZADD CodeWarz:Leaderboard:<contestId> <encoded> <userId>`, `EXPIREAT` = contest end + 24h.
16. **Atomic projection** — fire-and-forget `project(contestId)`: a single Lua `EVAL` does `ZREVRANGE ... WITHSCORES` → decode points/penalty → `DEL` + rebuild `HSET CodeWarz:ReadModel:LB:<contestId> <userId> {rank,score,penaltyMinutes}` and `ZADD CodeWarz:ReadModel:LBIdx:...` + `EXPIRE 172800` (48h) — all **indivisible** — then `PUBLISH leaderboard:invalidate <contestId>`.
17. **Edge fan-out** — every gateway replica's subscriber receives the invalidate → purges matching L1 keys → its SSE hub emits `update:<contestId>` → every open `EventSource` gets `data: {"type":"UPDATE"}` → React refetches `/contests/:id/leaderboard`, which resolves from cache in ~ms.
18. **Async extras** — the Go worker also fire-and-forget publishes a plagiarism job (`plagiarism.exchange` → `plagiarism.queue`) → core's plagiarism consumer fingerprints the code (normalize → 5-gram rolling hash → winnowing w=4 → Jaccard ≥ 0.80) and writes `plagiarism_reports` with `ON CONFLICT DO NOTHING`.

**Formats to name-drop:** JSON over REST at the edge; Protocol Buffers (proto3, `proto/codewarz.proto`) on gRPC; AMQP 0-9-1 with JSON bodies + headers in RabbitMQ; Lua inside Redis; SQL inside Postgres; SSE frames (`data: {...}\n\n`) to the browser.
---

## 4. Component Deep-Dives

### 4.1 API Gateway (`api-gateway/`)

| | |
|---|---|
| Stack | Node 20, TypeScript, Express **5**, `express-http-proxy` v2, ioredis, helmet, cors, winston→Loki, OpenTelemetry→Jaeger |
| Port | 3000 |
| Entry | `src/server.ts` |

**What it does:** the only public entry point. Runs the security/performance middleware gauntlet, then reverse-proxies to core; hosts the SSE hub for live leaderboards and the two-tier cache for hot reads.

**Exact middleware order (`server.ts`):** helmet → `cors({origin: FRONTEND_URL, credentials:true})` → morgan→winston → cookieParser → correlation → metrics → local Redis token bucket (`rateLimiter({maxTokens:50, refillRate:50/60})`) → core's route-specific `distributedRateLimiter` → `csrfProtection` → `bloomFilterMiddleware` → routes: `GET /metrics`, `GET /health`, `/api/v1/leaderboard/stream` (SSE router), `/api/v1/leaderboard/live` (3s cache + proxy → leaderboard-service), `/api/v1/leaderboard/archive` (proxy → core), `/api/v1/*` (proxy → core).

**External interactions:** Redis `GETBIT`×3 in one pipeline (bloom), `EVAL` Lua (rate limit), `GET`/`SETEX` (L2 cache), `SUBSCRIBE leaderboard:invalidate` (two separate subscribers: cache invalidation + SSE), HTTP proxy calls to core/leaderboard, Jaeger spans, Loki logs.

**Key code — singleflight coalescing** (`src/middlewares/cache.ts`):
```ts
if (inFlightRequests.has(cacheKey)) {
    res.setHeader("X-Cache", "COALESCED");
    const emitter = inFlightRequests.get(cacheKey)!;
    return await new Promise<void>((resolve) => {
        emitter.once("done", (body) => { res.send(body); resolve(); });
        emitter.once("error", () => { res.status(503).json({success:false, ...}); resolve(); });
    });
}
// first request monkey-patches res.send → fills L1 + L2 → emitter.emit("done", body)
```
Cache keys: `gateway:cache:<originalUrl>`; L1 = LRU `max: 5000`; only GETs, only 2xx responses; `X-Cache` header reports `L1-HIT | L2-HIT | MISS | COALESCED`.

**Key code — bloom check** (`src/middlewares/bloomFilter.ts`): 100,000 bits, 3 offsets via double hashing `(h1 + i*h2) % SIZE` (djb2-style h1, custom h2), one pipelined `GETBIT` per offset; **any 0 bit → immediate 404** with zero DB I/O; Redis error → fail-open (`next()`). Whitelists the literal IDs `live`, `stream`, `archive` so leaderboard sub-routes aren't shed. Hydration happens in **core** at boot (`hydrateBloomFilters()`: DEL + SETBIT every contest/problem id in one pipeline) plus incremental adds on entity creation.

**Key code — SSE** (`src/routes/leaderboard.sse.ts`): headers `text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`; initial `{"type":"CONNECTED"}` frame; `: heartbeat` comment frame every **15s**; a per-contest EventEmitter fed by the Redis subscriber; listener removed on `req.on('close')`. The SSE frame carries **only a tick** (`{"type":"UPDATE","timestamp":...}`), never data — the client refetches from the cached REST endpoint.

**Interview detail:** the gateway imports core's modules (logger, correlation, metrics, rate limiter, CSRF, circuit breaker) via relative paths — this is a **monorepo with shared source**, not independently buildable packages. That's why its Dockerfile needs the repo root as build context.

### 4.2 Core Service (`core/`)

| | |
|---|---|
| Stack | Node 20, TS, Express 5, Drizzle ORM + pg, ioredis, amqplib (ConfirmChannel), @grpc/grpc-js + proto-loader, Zod, jsonwebtoken + bcryptjs, prom-client, OTel |
| Ports | 3001 REST, 50051 gRPC |
| Entry | `src/server.ts` |

**Startup order (say it):** process safety net (uncaughtException/unhandledRejection → metric → exit 1) → tracing init → middleware (morgan → json → cookies → correlation → metrics → CSRF) → routers v1/v2 → error handlers → `/metrics`, `/health/circuit-breakers`, `/health/outbox` → then `startServer()`: `setupRabbitMQTopology()` (fatal, `process.exit(1)` on failure) → plagiarism consumer → `hydrateBloomFilters()` → gRPC server (dynamic import) → `initializeCDC()` + `startCDCListener()` + `startOutboxPoller()` → backpressure monitor → `app.listen`. SIGTERM/SIGINT: HTTP close → gRPC `tryShutdown` → queue monitor stop → RabbitMQ close → CDC stop → circuit breakers → Redis quit → tracing shutdown, with a 15s hard cap.

**DB schema (Drizzle, `src/db/schema/`):** `users` (email unique, `password_hash`, `role`, `solved_count`, `refresh_token` indexed), `user_daily_activity` (PK `(user_id, date)`), `problems` (`time_limit_ms` default 2000, `memory_limit_mb` 256, `cpu_limit` 1, `max_score` 100, `tags`/`hints` json), `testcases` (`is_sample` flag), `contests` + `contest_problems` + `contest_registrations`, `submissions` (verdict enum AC/WA/TLE/MLE/RE/CE/PENDING), `outbox_messages` (status PENDING/IN_FLIGHT/PUBLISHED/FAILED, `attempts`/`max_attempts`, indexes on status/aggregate/created_at), 4 event-sourcing tables (`submission_events`, `contest_events`, `user_events`, `problem_events`, each `UNIQUE(entity_id, version)`), `code_fingerprints`, `plagiarism_reports` (`UNIQUE(submission_id_1, submission_id_2)`), `leaderboard_snapshots`.

**The CDC trigger (created at runtime by `initializeCDC`, `src/service/outbox.service.ts`):**
```sql
CREATE OR REPLACE FUNCTION notify_outbox() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('new_outbox_message', NEW.id::text);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER outbox_notify_trigger
AFTER INSERT ON outbox_messages
FOR EACH ROW EXECUTE FUNCTION notify_outbox();
```
Listener: a dedicated `pg.Client` runs `LISTEN new_outbox_message`; each notification → `processOutboxBatch(20)`; on `error`/`end` → cleanup + reconnect after 5s; a 30s fallback poller sweeps stuck PENDING rows. The relay's `FOR UPDATE SKIP LOCKED` means the CDC push and the poller (or multiple core replicas) can never double-claim a row.

**RabbitMQ topology (`src/queues/rabbitmq/topology.ts`):** exchanges `submission.exchange`, `verdict.exchange`, `plagiarism.exchange` (direct, durable), `events.exchange` (fanout), `dlx.exchange` (direct); queues `submission.queue` (`x-max-priority: 10`, `x-message-ttl: 300000`), `verdict.queue` (TTL 120000), `plagiarism.queue` (TTL 600000), each dead-lettering to its `.dlq` via `dlx.exchange`. Consumer-side retry: a per-queue `retry.exchange` + `<queue>.retry` queue holds messages with a per-message `expiration` (exponential backoff: 1s → 2s → 4s), then dead-letters them back to the original queue; after `maxRetries: 3` the message is `nack(false,false)`ed into the DLQ. Publisher: ConfirmChannel, `persistent: true`, `await waitForConfirms()` after **every** publish, with headers `x-correlation-id` + `x-published-at`.

**gRPC server (`src/grpc/grpc.server.ts`):** implements `ProblemService.GetProblem` (loads problem + testcases, returns limits) and `SubmissionService.PersistVerdict` (transactional update; AC path wrapped in `withDistributedLock(..., 5000)`). Auth = `x-internal-api-key` metadata must equal the env key (≥16 chars enforced at boot); optional TLS via `GRPC_TLS_KEY_PATH`/`GRPC_TLS_CERT_PATH`, with a loud warning if production runs insecure. Header comment claims REST p99 ~45ms → gRPC p99 ~9ms.

**Plagiarism (`src/service/plagiarism/`)** — the MOSS-family algorithm:
1. `tokenizer.ts`: per-language comment stripping (6 languages), string literals → `STR`, numbers → `NUM`, user identifiers renamed `ID_0..n` in order of appearance (language keywords preserved).
2. `fingerprint.ts`: rolling hash over **5-grams** (`hash = hash*31 + charCode`), then **winnowing** — the minimum hash of every sliding window of **4** hashes becomes a fingerprint.
3. `similarity.ts`: plain **Jaccard** `|A∩B| / |A∪B|`; flag pairs ≥ `PLAGIARISM_THRESHOLD` (0.80).
4. Idempotent storage: `code_fingerprints` upserted with `onConflictDoNothing`; reports bulk-inserted in one transaction, also `onConflictDoNothing`.

**Event store (`src/service/eventStore.service.ts`):** optimistic concurrency — read max version for the entity, insert `version+1`, rely on the `UNIQUE(entity_id, version)` constraint; on Postgres error `23505` retry up to 5×. `replayEvents` folds events into a status state machine.

**Auth flow (`src/service/auth.service.ts`):** signup (bcrypt cost 10) / signin → access JWT `{id, role}` signed with `JWT_SECRET`, **15 min**; refresh JWT `{id}` with `REFRESH_SECRET`, **7 days**; refresh token stored on the user row → rotation + reuse detection. Cookies: `accessToken` httpOnly, 15min, path `/`; `refreshToken` httpOnly, 7d, **path-scoped to `/api/v1/auth/refresh`**. Google OAuth: 32-byte `state` cookie → `accounts.google.com/o/oauth2/v2/auth` code flow → `axios.post('https://oauth2.googleapis.com/token', ...)` → `verifyIdToken` with **explicit issuer** (`accounts.google.com`), **audience** (`GOOGLE_CLIENT_ID`), and **`email_verified`** checks → find-or-create user (random 32-byte password) → cookies → redirect `${FRONTEND_URL}/auth/callback`.

**Route inventory (all under `/api/v1`):**
- `auth`: `POST /signup`, `POST /signin`, `POST /refresh`, `GET /google/signin`, `GET /google/callback`, `POST /logout`, `GET /me`
- `problems`: `GET /`, `GET /:id`, `GET /slug/:slug` (optional auth via `extractUser`), `POST /` (admin)
- `contests`: `POST /` + `POST /add-problem` (admin), `GET /` + `GET /:id` + `GET /:id/leaderboard` (public-ish), `POST /:id/register` + `/:id/deregister` + `GET /:id/problems` (user)
- `submissions`: `GET /best`, `GET /`, `GET /:id`, `GET /run/:id`, `POST /`, `POST /run`, `PATCH /:id` (last three: `verifyInternalOrUser`/`verifyToken`)
- `leaderboard`: `POST /snapshot` (admin), `GET /archive/:contestId`
- `users`: `GET /profile|/stats|/activity|/last-problem` (user), `GET /leaderboard/global` (**public**)
- `plagiarism`: `GET /problem/:id|/contest/:id|/submission/:id` (admin)
- `events`: `GET /:entity/:entityId`, `GET /:entity/:entityId/replay` (admin)
- Root-level (no auth): `/api/v1/health`, `/metrics`, `/health/circuit-breakers`, `/health/outbox`

### 4.3 Leaderboard Service (`leaderboard-service/`)

| | |
|---|---|
| Stack | Node/TS, Express 5, ioredis, @grpc/grpc-js, amqplib, Zod (unused validators) |
| Ports | 3002 REST, 50052 gRPC |

**The CQRS data model (memorize the keys):**
```
Write model:  ZADD  CodeWarz:Leaderboard:<contestId>      <encodedScore> <userId>
Read model:   HSET  CodeWarz:ReadModel:LB:<contestId>     <userId>  {rank,score,penaltyMinutes,rawScore}
              ZADD  CodeWarz:ReadModel:LBIdx:<contestId>  <rawScore> <userId>
Cold-start:   SET   CodeWarz:ReadModel:Lock:<contestId>   1  PX 10000 NX
TTLs:         write key → EXPIREAT contest end + 24h · read model → 48h
```

**Score codec** (`src/services/leaderboard.service.ts`):
```ts
const MAX_PENALTY_MINS = 100000;
const penaltyMinutes = Math.min(MAX_PENALTY_MINS, Math.max(0, Math.floor(timeTakenInMs / 60000)));
const encodedScore = score + (MAX_PENALTY_MINS - penaltyMinutes) / MAX_PENALTY_MINS;
// decode:  points  = Math.floor(raw)
//          penalty = Math.round(MAX_PENALTY_MINS - (raw - points) * MAX_PENALTY_MINS)
```

**The Lua projection (the crown jewel — `src/services/leaderboard.readmodel.service.ts`)** runs via `redis.eval(lua, 3, writeKey, readHashKey, readIdxKey, READ_MODEL_TTL_S)`:
```lua
local data = redis.call('ZREVRANGE', writeKey, 0, -1, 'WITHSCORES')
if #data == 0 then return 0 end
redis.call('DEL', readHashKey)
redis.call('DEL', readIdxKey)
for i = 1, #data, 2 do
    local userId = data[i]
    local rawScore = tonumber(data[i+1])
    local score = math.floor(rawScore)
    local penaltyMinutes = math.floor(maxPenaltyMins - (rawScore - score) * maxPenaltyMins + 0.5)
    local rank = math.floor(i / 2) + 1
    redis.call('HSET', readHashKey, userId, cjson.encode({
        userId = userId, rawScore = rawScore, score = score,
        penaltyMinutes = penaltyMinutes, rank = rank }))
    redis.call('ZADD', readIdxKey, rawScore, userId)
end
redis.call('EXPIRE', readHashKey, ttl)
redis.call('EXPIRE', readIdxKey, ttl)
```
Immediately after the EVAL: `redis.publish("leaderboard:invalidate", contestId)`. Reads: `getTop` = `ZREVRANGE idx 0 limit-1` + pipelined `HGET` per user (corrupted JSON entries skipped); cold start guarded by the NX lock (losers sleep 100ms then read). `getUserEntry` = a single `HGET` — true O(1).

**gRPC server (`src/grpc/grpc.server.ts`):** `UpdateLeaderboard` (API-key auth → `updateLeaderboard` → **async non-blocking projection**), `GetTopLeaderboard` (read model only), `GetUserRank` (write-model `ZREVRANK` + `ZSCORE`, 1-based rank). Proto loaded from the shared `proto/codewarz.proto` with `keepCase: false`.

**Also consumes `verdict.queue` from RabbitMQ** (`src/queues/verdict/consumer.queue.ts`) with idempotency key `verdict:<submissionId>` + a per-user distributed lock (`withDistributedLock('leaderboard:<c>:<u>', ..., 10000)`) — **but that path never projects the read model or publishes the invalidation (§11 #18).**

**HTTP routes:** `POST /api/v1/leaderboard/update` (**unauthenticated — §11 #19**), `GET /contest/:contestId/top?limit=50`, `GET /contest/:contestId/user/:userId`, plus `/ping`. v2 router is an empty placeholder.
### 4.4 Evaluation Service — Go (`evaluation-service-go/`)

| | |
|---|---|
| Stack | Go 1.25, `streadway/amqp` (note: archived upstream), grpc-go, go-redis/v9, sony/gobreaker, zap, prometheus client |
| Binaries | `cmd/worker` (the consumer), `cmd/api` (health + `/metrics` sidecar) |
| Deploy | 2 replicas in compose; mounts `/var/run/docker.sock` (Docker-out-of-Docker) |

**Worker pool (exact pattern — channel-fed competing consumers, not a semaphore):**
```go
msgs, err := c.channel.Consume("submission.queue", "", false, false, false, false, nil) // manual ack
// prefetch: ch.Qos(10, 0, false)
workerPoolSize := 10
for i := 0; i < workerPoolSize; i++ {
    c.workerWG.Add(1)
    safego.Go(fmt.Sprintf("submission-worker-%d", i), func() {
        defer c.workerWG.Done()
        for {
            select {
            case <-c.stopCh:
                return
            case msg, ok := <-msgs:
                if !ok { return }
                func() {
                    defer func() { // per-message panic guard → DLQ
                        if r := recover(); r != nil {
                            logger.Error("Recovered from panic in handleSubmission — sending message to DLQ", ...)
                            _ = msg.Nack(false, false)
                        }
                    }()
                    c.handleSubmission(msg)
                }()
            }
        }
    })
}
```
Max concurrency = 10 sandboxes per pod (bounded also by prefetch 10). Each worker is synchronous per message — a full sandbox run blocks its worker.

**Ack discipline:** parse failure / `GetProblem` failure / panic → `Nack(false,false)` → DLQ; `PersistVerdict` failure → `Nack(false,true)` requeue **(unbounded — §11 #14)**; success / duplicate-solve → `Ack`.

**Sandbox guarantees (exact flags, `internal/sandbox/executor.go`):** `--network none` (no exfiltration), `--memory <limit>m` (cgroup RSS; OOM-kill → exit 137 → MLE), `--cpus <limit>`, `--pids-limit 64` (fork-bomb guard), `--read-only` + `--tmpfs /tmp:size=64m` (no disk persistence), `--security-opt seccomp=default`, `no-new-privileges:true`, `--rm` (no container leakage), inner `timeout <limit+2s>` → exit 124 → TLE. One container per testcase. The volume path is rewritten through `HOST_WORKSPACES_ROOT/<basename>` because the daemon is the **host's** daemon (sibling containers).

**Language table (`internal/sandbox/languages.go`):**
| Lang | Image | Source | Compile | Run |
|---|---|---|---|---|
| C++ | `cpp-runner` | `solution.cpp` | `g++ solution.cpp -O2 -std=gnu++17 -o solution` | `./solution` |
| Python | `python-runner` | `solution.py` | — | `python solution.py` |
| JS | `node-runner` | `solution.js` | — | `node solution.js` |
| Java | `java-runner` | `Main.java` | `javac Main.java` | `java Main` |
| Go | `go-runner` | `solution.go` | `go build -o solution solution.go` | `./solution` |
| Rust | `rust-runner` | `solution.rs` | `rustc -O -o solution solution.rs` | `./solution` |

**Output compare (`sandbox.go`, mirrors TS):** trim → split lines → trim each → collapse internal whitespace (`strings.Fields`) → drop empty lines → exact equality. Severity order for run-all mode: `TLE > MLE > RE > WA > AC`; submit mode early-exits on first failure.

**gRPC client (`internal/grpc/client.go`):** 5s per-call timeout, `WaitForReady(true)`, keepalive 30s/10s, one global gobreaker (5 consecutive failures → OPEN 30s → 3 half-open probes), optional TLS (`GRPC_TLS_ENABLED`, plus a `GRPC_TLS_SKIP_VERIFY` escape hatch). Calls: `GetProblem` + `PersistVerdict` on core, `UpdateLeaderboard` on leaderboard-service.

**`pkg/safego` — the interview-catnip util:**
```go
func Go(name string, fn func()) {
    go func() {
        defer func() {
            if r := recover(); r != nil {
                logger.Error("Recovered from panic in goroutine",
                    "name", name, "panic", fmt.Sprintf("%v", r), "stack", string(debug.Stack()))
            }
        }()
        fn()
    }()
}
```
Rationale to articulate: **an unrecovered panic in ANY goroutine crashes the entire Go process** — there is no "thread-local" failure. So every spawned goroutine gets a named, logged recovery boundary; one poison message can never take down the fleet.

**Graceful shutdown (`cmd/worker/main.go`):** SIGINT/SIGTERM → `consumer.Close()` (close `stopCh` → `workerWG.Wait()` → close AMQP channel/connection) wrapped in safego with a 30s `os.Exit(1)` deadline.

### 4.5 Evaluation Service — legacy TS (`evaluation-service/`)

Node/TS twin of the Go worker, still deployed (2 replicas) and **still consuming the same `submission.queue`** — a migration in flight, not a finished cutover. Differences that matter:

- **Retry:** uses core's retry+DLQ consumer (`maxRetries: 3`, exponential backoff via `retry.exchange`) instead of Go's infinite requeue.
- **Idempotency:** has submission-level idempotency (`idempotency:eval:<id>` — EXISTS check → process → `SETEX` 3600s) and `run-result:<jobId>` caching (300s TTL). **Go lacks both.**
- **Transport:** calls core over **REST** (`GET /api/v1/problems/:id`, `PATCH /api/v1/submissions/:id` with `x-internal-api-key`, 5s `AbortSignal.timeout`, circuit breaker 3 failures/15s) and updates the leaderboard by publishing to `verdict.queue` instead of gRPC.
- **Penalty semantics:** `submissionTime − contestStart` (position within contest) vs Go's `now − submissionCreatedAt` (queue wait). **The two services rank the same submissions differently.**
- **Batching:** runs **all testcases in ONE container** via a generated `runner.sh` loop — much less `docker run` overhead, but a single global `timeout` covers the whole batch (§11 #15).
- **Owns shared infra:** `setupRabbitMQTopology()` (the Go worker *assumes* topology exists) and the 120s leaderboard-snapshot cron (`POST /api/v1/leaderboard/snapshot` with the internal key).

**Say:** "The Go service is the strategic direction — compiled binary, tiny memory footprint, goroutine pool, strongly-typed gRPC. The TS service is legacy but still owns two pieces of shared infrastructure (topology declaration and the snapshot cron) and still has features not yet ported: idempotency keys and run-result caching. The honest state is 'migration 80% done'."

**Runner images (`evaluation-service/src/docker/*/Dockerfile`):** `cpp-runner` (alpine + g++), `python-runner` (python:3.10-alpine), `node-runner` (node:18-alpine), `java-runner` (amazoncorretto:17-alpine), `go-runner` (golang:alpine), `rust-runner` (rust:alpine). Built/pushed by `scripts/push-runners.sh`; `pull-runners.sh` pulls and retags them to bare local names for `docker run`.

### 4.6 Frontend (`web/`)

React 18.3 + Vite 5 (SWC plugin) + Tailwind 3.4 + shadcn/ui (~45 Radix primitives) + zustand 5 + TanStack Query 5 + react-router 6 + **Monaco** (the VS Code editor) + axios.

- **Auth:** cookie-based (`withCredentials: true`, no tokens in localStorage). Axios **response interceptor implements a single-flight 401 refresh queue**: the first 401 triggers `POST /auth/refresh`; concurrent 401s queue behind it and replay their original requests after it succeeds; on refresh failure → logout + redirect to `/auth`.
- **CSRF:** request interceptor reads the `csrf` cookie and mirrors it into `x-csrf-token` on every mutating request (double-submit pattern).
- **SSE:** `new EventSource('/api/v1/leaderboard/stream/<contestId>')` in `ContestLeaderboard.tsx`; on `{"type":"UPDATE"}` → refetch. The only `EventSource` in the app.
- **Editor:** Monaco with Cmd/Ctrl+Enter (run → `POST /submissions/run`, then polls `GET /submissions/run/:jobId`) and Cmd/Ctrl+Shift+Enter (submit). Drafts persist per problem+language in localStorage via zustand `persist`.
- **Routes:** `/`, `/auth`, `/auth/callback`, `/dashboard`, `/problems`, `/problems/create`, `/problems/:id`, `/profile`, `/leaderboard`, `/contests`, `/contests/create`, `/contest/:id`, `/contest/:id/problem/:problemId`, `/contest/:id/leaderboard`, `/contest/:id/results`. Protected routes wrapped in an `AuthGuard` that calls `GET /auth/me`.
- **Half-built (know this):** all 16 footer links route to `/under-construction`; `src/pages/ContestDetail.tsx` and `ContestProblem.tsx` are orphaned duplicates with broken imports (not routed; they survive only because the build doesn't run `tsc`).

### 4.7 Chaos Engineering (`chaos-engineering/`)

Python suite with three primitives (`chaos_runner.py`):
1. **`ContainerKiller`** — weighted-random target selection, `container.kill()` (SIGKILL) via the Docker SDK.
2. **`NetworkPartitioner`** — `tc qdisc add dev <iface> root netem loss <20-60>%` on the host interface, auto-restored by a daemon thread after `network_fault_duration_s` (10s).
3. **`SteadyStateProbe`** — background thread probing `GET <gateway>/health` every 2s; records uptime %, p50/p99 latency.

Loop: every `chaos_interval_s` (15s) inject a random fault for `experiment_duration_s` (120s); writes `chaos_report.json`; declares "SYSTEM RESILIENT" at ≥99.9% probe uptime. Named scenarios (`chaos_scenarios.py`): **`cascade_failure`** (kill core, assert gateway degrades gracefully), **`leaderboard_pressure`** (read loop while killing leaderboard), **`split_brain`** (kill core + leaderboard with random delays). Run via `docker compose --profile chaos up` or `./chaos-engineering/run_chaos.sh --scenario cascade_failure`.

**Honest framing:** it SIGKILLs containers and relies on restart policies for recovery (most compose services here have no `restart:` policy, so killed services stay down until manually restarted — the probe measures *degradation*, not self-healing); datastores (Postgres/Redis/RabbitMQ) are excluded from kill targets; `tc` is Linux-only, so network faults silently skip on macOS. It's a solid fault-injection harness, not a full chaos-mesh replacement.
---

## 5. Implementation Walkthrough ("How did you build this?")

Console-level, in the order it was actually assembled:

1. **Monorepo skeleton** — 6 top-level packages. The TS services share code from `core/src` via relative imports (logger, metrics, correlation middleware, error classes, queue libraries, circuit breaker). Consequence: `api-gateway/Dockerfile`, `leaderboard-service/Dockerfile`, and `evaluation-service/Dockerfile` all use the **repo root as build context** and `npm ci` both `core/` and the service's own `package.json` into one image.
2. **Infra first** — `docker-compose.yml`: `postgres:16-alpine` (host port 5435→5432), `redis:alpine`, `rabbitmq:3-management-alpine` (5672 + management UI 15672, healthcheck `rabbitmq-diagnostics -q ping`), one bridge network `codewarz-network`, named volumes (`postgres-data`, `redis-data`, `rabbitmq-data`, …) for persistence.
3. **Schema** — Drizzle ORM schema in `core/src/db/schema/*.ts`; `drizzle.config.ts` points at `DATABASE_URL`; applied with `docker compose exec core npx drizzle-kit push` (see `scripts/deploy.sh`). The CDC trigger is created **at app boot** by `initializeCDC()`, not in the SQL migrations (§11 #8).
4. **Queue topology** — declared at service startup by `setupRabbitMQTopology()`; `assertExchange`/`assertQueue` are idempotent, so core, leaderboard-service, and the TS evaluator can all safely declare the same topology at boot. DLX wiring via queue arguments: `x-dead-letter-exchange`, `x-dead-letter-routing-key`, `x-message-ttl`, `x-max-priority`.
5. **gRPC contract** — hand-written `proto/codewarz.proto` at repo root (3 services: `ProblemService`, `SubmissionService`, `LeaderboardService`). Go stubs generated into `evaluation-service-go/internal/grpc/pb` (`protoc --go_out --go-grpc_out`); the TS services load the same `.proto` at runtime with `@grpc/proto-loader` (`keepCase: false` → camelCase fields in JS objects).
6. **Sandbox runner images** — 6 per-language Dockerfiles under `evaluation-service/src/docker/`; `DOCKER_USERNAME=<you> ./scripts/push-runners.sh` builds + pushes all six; `./scripts/pull-runners.sh` pulls and retags them to the bare names (`cpp-runner`, …) the executor passes to `docker run`. The evaluator containers mount `/var/run/docker.sock` and set `HOST_WORKSPACES_ROOT` so the sandbox container's `-v` bind resolves a **host** path — Docker-out-of-Docker with sibling containers (be ready to explain why the path rewrite is needed: the daemon is the host's, so a container-internal path is meaningless to it).
7. **Permissions / roles** — Postgres credentials from env (`POSTGRES_USER/PASSWORD/DB`; compose defaults `postgres/postgres/codewarz`); RabbitMQ `RABBITMQ_DEFAULT_USER/PASS` (`codewarz/codewarz`); application roles via the `users.role` column (`'admin' | 'user'`) enforced by the `isAdmin` middleware; service-to-service auth via a shared `INTERNAL_API_KEY` (≥16 chars, enforced fail-fast at boot) sent as the `x-internal-api-key` header (REST) or gRPC metadata; user auth via `JWT_SECRET` / `REFRESH_SECRET` (≥32 chars, fail-fast).
8. **Environment wiring** — per-service `.env` files (only `.env.example` files are committed; `.env*` is gitignored). Core needs: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `INTERNAL_API_KEY`, `REDIS_URL`, `RABBITMQ_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. Compose injects service-discovery addresses: `CORE_GRPC_ADDR=core:50051`, `LEADERBOARD_GRPC_ADDR=leaderboard-service:50052`, `REDIS_URL=redis://redis:6379`, `RABBITMQ_URL=amqp://codewarz:codewarz@rabbitmq:5672`. `INTERNAL_API_KEY` is **required** by compose for the eval services (`${INTERNAL_API_KEY:?must be set}`).
9. **Run** — `./run.sh`: verifies the Docker daemon, runs `npm install` in each TS service to sync lockfiles, then `docker compose up --build -d` and prints the access table (web :8080, gateway :3000, RabbitMQ UI :15672, Jaeger :16686, Grafana :3004, Prometheus :9090). One-shot variant: `./scripts/deploy.sh` (pull runners → `up -d --build` → drizzle push).
10. **Monitoring** — `monitoring/prometheus.yml` scrapes `/metrics` on all 5 backend services every **5s**; Grafana (`:3004`, admin/admin) auto-provisions 3 datasources (Prometheus, Loki, Jaeger) from `monitoring/grafana/provisioning/datasources/datasources.yml`; services ship logs to Loki via `winston-loki` and spans to Jaeger via the OTel `JaegerExporter` (`JAEGER_URL` + `/api/traces`); core's `queueMonitor.service.ts` polls the RabbitMQ management HTTP API every 5s and exports `app_queue_depth` gauges for all 6 queues (3 main + 3 DLQ).
11. **CI** — `.github/workflows/ci.yml`: `go test -v -coverprofile ./...` for the Go service, plus Buildx builds of all 6 images with GitHub Actions layer caching (`push: false`). No Node tests or lint in CI; the web image build is misconfigured (§11 #26).

---

## 6. Concepts You MUST Be Able to Explain (first principles + why)

- **Transactional Outbox** — you cannot atomically write to Postgres *and* RabbitMQ (they share no transaction coordinator). So you write the event into an `outbox_messages` row **in the same local transaction** as the business row; a relay asynchronously moves it to the broker. This turns a distributed transaction into a local one. The cost is **at-least-once delivery**: the relay can crash after publishing but before marking `PUBLISHED`, so consumers must tolerate duplicates (hence idempotency/dedupe downstream).
- **CDC via LISTEN/NOTIFY** — classic outbox relays poll (`SELECT ... WHERE status='PENDING'` every N seconds): short intervals waste CPU on empty polls, long intervals add latency. Postgres `pg_notify(channel, payload)` pushes a message over an existing TCP connection to every session that ran `LISTEN channel` — the trigger fires at commit and the relay wakes in ~1ms. Caveats you should volunteer: payloads are capped at **8000 bytes** (we send only the row UUID), notifications are **not persisted** (a disconnected listener misses them — which is exactly why the 30s fallback poller exists), and notification delivery is at-most-once, so the poller is what restores the at-least-once guarantee.
- **`FOR UPDATE SKIP LOCKED`** — a row-locking read modifier: matching rows already locked by another transaction are *skipped* rather than waited on. This is the standard "use Postgres as a queue" primitive — it lets the CDC handler and the interval poller (or N core replicas) drain `outbox_messages` concurrently without ever processing the same row twice or blocking each other.
- **CQRS** — Command Query Responsibility Segregation: the write model (Redis ZSET — optimal for `ZADD` and rank math) and the read model (a HASH of hydrated JSON entries + an index ZSET — optimal for `HGET` and top-N) are two structures of the same data, synchronized by an atomic projection. Why: leaderboard reads vastly outnumber writes during a contest, and a read should never pay `ZREVRANGE`-plus-hydration cost on the hot path.
- **Why Lua inside Redis** — Redis is single-threaded for command execution and runs `EVAL` scripts **atomically**: no other command interleaves with a running script. The projection (range → decode → DEL → rebuild hash + index → EXPIRE) is a read-modify-write that would race if issued as separate client commands; in Lua it is one indivisible unit and one network round trip. Trade-off: the script blocks Redis while it runs — O(N) over the contest's ranked users, fine at thousands of users, a genuine concern at millions (→ paginate the projection; see §10).
- **Bloom filter** — a bit array + k hash functions. `add` sets k bits; `check` reads k bits: any 0 ⇒ **definitely absent**; all 1 ⇒ **probably present** (false positives possible, false negatives impossible). Ours: m = 100,000 bits, k = 3, offsets by double hashing `(h1 + i·h2) mod m`. False-positive rate ≈ (1 − e^(−kn/m))^k → ~0.003% at 1,000 IDs, ~1.7% at 10,000 IDs. Why at the edge: rejecting a random-UUID bot request costs one Redis pipeline and zero DB I/O. Known trade-offs: no deletion (bits are shared — deleted entities linger until the next rehydration), and it must be hydrated before traffic or it 404s everything (§11 #17).
- **Token bucket (executed in Lua)** — a bucket holds at most `maxTokens`; it refills at `rate × elapsed`; each request spends one token. Bursts up to `maxTokens` are allowed while the sustained rate stays capped. Implemented as a Redis `EVAL` so the read-refill-decrement-write sequence is atomic **across gateway replicas** — a per-process bucket would multiply the real limit by the replica count. Both limiters fail open on Redis errors (availability over strictness — a deliberate choice, know how to defend it).
- **Singleflight / request coalescing** — on a cache miss, exactly one request per key goes to the origin; concurrent duplicates subscribe to its result instead. This kills the **thundering herd** when a hot key expires mid-traffic. (Go ships this as `golang.org/x/sync/singleflight`; here it's a hand-rolled `Map<key, EventEmitter>` in Node.)
- **gRPC vs REST** — gRPC gives HTTP/2 multiplexing, binary protobuf payloads, and a strongly-typed contract shared by Go and TS from one `.proto`. It's used on the worker↔services hot path (core's own comment claims REST p99 ~45ms → gRPC p99 ~9ms). REST stays at the edge because browsers, axios, and SSE speak HTTP/JSON natively.
- **SSE vs WebSockets vs polling** — SSE is plain HTTP, server→client only, with automatic reconnection and native browser support (`EventSource`), and it traverses proxies/load balancers trivially. The platform needs only "leaderboard changed" ticks — no client→server frames — so WebSocket's bidirectional statefulness buys nothing. Design note: the SSE frame carries only a **tick**, not data; the payload comes from the (cached) REST refetch, keeping the SSE hub stateless and the data path cacheable.
- **Dead Letter Exchange (DLX)** — RabbitMQ republishes messages to the DLX when they are nacked without requeue, expire via TTL, or overflow queue length limits. Each main queue has a `.dlq` bound to `dlx.exchange` — failed evaluations are parked for audit/replay instead of silently vanishing. Pair it with the consumer-side `retry.exchange` (per-message TTL = exponential backoff) to explain the difference between *transient* failures (retry) and *poison* messages (DLQ).
- **Idempotency** — at-least-once delivery is guaranteed by the outbox + publisher confirms, so every consumer assumes duplicates. Patterns used: Redis `SET key val NX EX ttl` atomic claims (idempotency middleware), `SADD` dedupe for duplicate solves (a set add returning 0 = already processed), `ON CONFLICT DO NOTHING` in Postgres (plagiarism reports, fingerprints), and unique constraints as the final arbiter (`UNIQUE(entity_id, version)` in the event store).
- **Circuit breaker** — CLOSED → OPEN after 5 consecutive failures → HALF_OPEN after 30s → CLOSED after 3 consecutive successes. Prevents cascading failure by failing fast instead of piling up timeouts against a dead dependency. The codebase also has a *distributed* variant that broadcasts `OPEN` over Redis Pub/Sub so the whole cluster trips together — **but note §11 #16: the gateway/core breakers are instantiated, never executed**; the only live breakers are in the Go gRPC client and the TS evaluator's REST calls.
- **Distributed lock (Redis)** — `SET lock:<resource> <uuid> PX <ttl> NX` (atomic acquire with expiry), released by a Lua compare-and-delete (`if get(KEY)==ARGV then del`) so you never delete someone else's lock after your TTL expired. Used to serialize `solved_count` increments per user+problem. Limits to volunteer: it's a single-Redis lease, not fencing — a paused holder can lose the lock while still working (Martin Kleppmann's Redlock critique).
- **Sandbox threat model** — untrusted code is hostile by default: it may fork-bomb (`--pids-limit 64`), exhaust memory (`--memory`, OOM-kill → 137 → MLE), busy-spin (`timeout` → 124 → TLE, `--cpus`), exfiltrate data or attack the network (`--network none`), persist state (`--read-only`, `--tmpfs /tmp:64m`, `--rm`), or escalate (`no-new-privileges`, default seccomp profile). Docker-out-of-Docker via the mounted socket means the *evaluator* is trusted, but every sandbox it spawns is a locked-down sibling.
- **Priority queues (RabbitMQ)** — `x-max-priority: 10` on `submission.queue`; contest submissions publish at priority 10, practice at 1. The broker delivers higher-priority messages first while consumers have capacity. Why: during a live contest, a contestant's 5-second window matters more than a practice run. (Caveat to mention: priorities only reorder *queued* messages, and deep priority queues cost broker memory.)
- **Winnowing / document fingerprinting** — the plagiarism pipeline is the same family as Stanford's MOSS: normalize away renames/comments (so `int a` vs `int b` converge), hash k-grams, keep the minimum hash of each sliding window (winnowing) as a robust sub-linear fingerprint, then Jaccard-compare fingerprint sets. k=5 and w=4 are the repo's chosen trade-off between sensitivity and false positives.
---

## 7. Language/Framework Deep-Dive — the technically impressive parts

### 7.1 The `FOR UPDATE SKIP LOCKED` outbox relay (core, TypeScript)

The relay (`core/src/service/outbox.service.ts`) is a transactional state machine per batch:

```ts
return await db.transaction(async (tx) => {
    const pendingMessages = await tx.select().from(outboxMessages)
        .where(and(eq(outboxMessages.status, 'PENDING'),
                   lte(outboxMessages.attempts, outboxMessages.maxAttempts)))
        .orderBy(asc(outboxMessages.createdAt))
        .limit(batchSize)
        .for('update', { skipLocked: true });
    // mark IN_FLIGHT in the same tx → publish with confirms → PUBLISHED
    // on error: attempts+1 → FAILED at maxAttempts, else back to PENDING
});
```

**Likely Q: "Why SKIP LOCKED and not just a single relay thread?"**
**A:** Because the CDC handler and the 30s poller (and any future core replica) can invoke the relay concurrently. `SKIP LOCKED` gives horizontal scalability of the relay with zero coordination — competing transactions physically cannot select the same rows. It's the same primitive behind pg-boss and Graphile Worker.

**Likely Q: "What's the weakness of this exact implementation?"**
**A (shows seniority):** The publish happens *inside* the DB transaction while holding row locks — lock time includes network I/O to RabbitMQ (`waitForConfirms`), and a crash after publish but before commit rolls the rows back to `PENDING`, yielding a duplicate delivery. That's the accepted at-least-once trade-off; the refinement is to claim → commit `IN_FLIGHT` → publish *after* commit → confirm → second tx to mark `PUBLISHED`, relying on idempotent consumers. Also the retry selector is `attempts <= maxAttempts` — an off-by-one granting one extra attempt (§11 #20).

### 7.2 The atomic Lua projection (leaderboard, Redis)

**Likely Q: "Why not do the projection in application code — read ZSET, then write the HASH?"**
**A:** Three reasons. (1) **Atomicity**: a client-side read-modify-write races with concurrent `ZADD`s — between my `ZREVRANGE` and my `HSET`s a new score can land, and the read model is born stale. Inside `EVAL`, Redis's single-threaded execution makes the sequence indivisible. (2) **Latency**: one round trip instead of 1 + N. (3) **Rank consistency**: ranks derive from the ZSET snapshot at script start; client-side, the ranking basis can shift mid-write.

**Likely Q: "What breaks at 1M users in a contest?"**
**A:** The script is O(N) and blocks Redis while running — at ~1M entries you're stalling the event loop for hundreds of ms, freezing *all* Redis clients (rate limiting, cache included). Mitigations: project only top-K (since `getTop` never reads beyond `limit`), run full projections on a replica, or go incremental (`ZINCRBY` + `ZREVRANK` for just the affected user).
### 7.3 The Go worker pool + panic containment (evaluation-service-go)

**Likely Q: "Why a fixed pool of 10 goroutines instead of one goroutine per message?"**
**A:** Each message can spawn multiple Docker containers (one per testcase). Unbounded goroutines = unbounded containers = host OOM. The pool caps concurrent sandbox load at 10 per pod; combined with `Qos(10)` prefetch, backpressure flows naturally back to RabbitMQ, which just queues deeper. To scale out: add pods (compose already runs 2) — the broker round-robins deliveries.

**Likely Q: "Why the double recover (safego + per-message)?"**
**A:** In Go, one unrecovered panic in any goroutine **terminates the whole process** — there is no try/catch across goroutine boundaries. `safego.Go` protects the worker *loop* (process survival); the inner `recover` protects the *message* (converts a panic into `Nack(false,false)` → DLQ, instead of infinite redelivery of a poison message). Two layers, two different failure semantics.

**Likely Q: "How does graceful shutdown actually work here?"**
**A:** SIGTERM → `close(stopCh)` → workers exit their `select` after the in-flight message → `workerWG.Wait()` → close AMQP channel/connection, all inside a 30s deadline that force-exits. In-flight messages that were never acked are **redelivered** by RabbitMQ once the channel closes — which is exactly why manual-ack + duplicate tolerance are designed in.

### 7.4 Error-handling philosophy across languages

- **TS services:** typed `AppError` hierarchy (`NotFoundError`, `ForbiddenError`, …) with an `isAppError` type guard; two terminal middlewares (`appErrorHandler` → status from the error; `genericErrorHandler` → opaque 500). Every error bumps the `app_errors_total` metric. Zod at the boundary (parse, don't validate).
- **Go service:** errors are values; verdicts derive from process exit codes (124/137); panics are treated as catastrophic and contained at goroutine boundaries — the gRPC interceptor even recovers panics and converts them to errors so a panic follows the normal nack path.
- **Fail-fast config:** `JWT_SECRET`/`REFRESH_SECRET` (≥32 chars) and `INTERNAL_API_KEY` (≥16 chars) throw at module load — misconfiguration never reaches traffic.

### 7.5 Performance tricks worth volunteering

1. **Bloom rejection costs one Redis pipeline, zero DB I/O** — the cheapest possible 404.
2. **The outbox relay is push-driven** — zero idle CPU, ~1ms commit→publish.
3. **SSE sends ticks, not data** — the data path stays HTTP-cacheable (L1 ~0ms, L2 ~1–3ms).
4. **Penalty-encoded single-score ZSET** — ranking + tie-breaking in one `ZADD`, no secondary sort keys.
5. **Low-cardinality metrics labels** — route labels normalized (`req.baseUrl + req.route.path`, UUID/numeric regex collapsing) so Prometheus cardinality can't explode.
6. **AsyncLocalStorage for correlation IDs** — every log line and AMQP header carries the correlation ID without threading it through every function signature.
---

## 8. Interview Q&A — General

**Q1. How does this system scale?**
A: Horizontally at three layers: the gateway (stateless — L1 cache is per-instance but invalidated cluster-wide via Pub/Sub), the Go workers (add replicas; RabbitMQ competing-consumers distributes the load; compose already runs 2), and leaderboard reads (pure Redis). The vertical bottlenecks are the single Postgres (writes + outbox) and single Redis (leaderboard, rate limits, cache). Next steps: Postgres read replicas + partitioning `submissions` by `created_at`; Redis Cluster with hash-tagged `{contestId}` keys so a contest's structures colocate.

**Q2. Where are the bottlenecks, honestly?**
A: (1) `docker run` per testcase — container start is ~100–300ms, so a 20-testcase submission costs 2–6s of wall time per worker; with 10 workers/pod that's the throughput ceiling (~2–5 submissions/s/pod). (2) The Lua projection is O(N) per write — fine at contest scale, blocks Redis at very large N. (3) Postgres: every submission is a 2-row transaction plus a trigger. (4) `waitForConfirms()` after every publish serializes relay throughput on broker RTT — batch confirms or async confirm-tracking would raise it.

**Q3. How do you handle the failure of each dependency?**
A: RabbitMQ down → outbox rows accumulate as `PENDING`, the poller retries with the `attempts` counter; nothing is lost (durable queues + persistent messages + publisher confirms). Redis down → rate limiter and bloom **fail open** (deliberate: availability over strictness); leaderboard writes fail → gRPC error → message requeued; cache misses fall through to origin. Postgres down → API 500s; the CDC listener reconnects every 5s. Core down → the gateway proxy error handler returns 503; the Go worker's `GetProblem` failure nacks to the DLQ — that's actually over-aggressive for a *transient* outage (§11 #14 territory).

**Q4. Is submission processing idempotent?**
A: Partially, and I know exactly where (this honesty lands well): the *leaderboard* side is deduped (`SADD CodeWarz:Solved:<contest>:<user>` → second AC can't double-score), the *plagiarism* writes are idempotent (`ON CONFLICT DO NOTHING`), and the verdict consumer has an idempotency key. But the *sandbox execution* itself is not deduped in the Go worker — a redelivered message re-runs the code (§11 #13). The TS worker had `idempotency:eval:<id>`; porting it is on my list. The *submit* API also has an unused idempotency middleware (`submit:{user}:{problem}:{contest}:{sha256(code)[:16]}`) — infrastructure exists, isn't wired (§11 #15).

**Q5. Why RabbitMQ over Kafka?**
A: This is *work-queue* semantics, not *event-log* semantics: each message is consumed once by one worker, needs per-message acks, priorities, TTLs, and DLQs — RabbitMQ's native model. Kafka wins when you need replayable ordered logs at high throughput (event sourcing, stream processing); its partition model makes per-message ack/retry/priority awkward. The trade-off I accepted: RabbitMQ's throughput ceiling and broker-side state vs Kafka's near-limitless log retention.

**Q6. Why gRPC only internally and REST at the edge?**
A: The internal hops (worker↔core, worker↔leaderboard) are high-frequency, latency-sensitive, and benefit from typed contracts shared across Go and TS — protobuf + HTTP/2. The edge must serve browsers (axios, `EventSource`, plain curl debugging) where JSON/REST is native and tooling is universal. The gateway is the protocol boundary.

**Q7. How do you guarantee a submission is never lost?**
A: Defense in depth: (1) the submission row + outbox row commit atomically — no "queued but unsaved" or "saved but unqueued" state exists; (2) the relay uses publisher confirms and retries up to `maxAttempts` (5 for submissions); (3) the queue is durable, messages persistent, TTL 300s with a DLX safety net; (4) consumers manual-ack only after successful persistence; (5) failures land in `submission.dlq` for replay; (6) chaos tests kill containers mid-flow to validate. The one honest gap: a message whose *evaluation* repeatedly fails in Go gets requeued forever instead of DLQ'd (§11 #14).

**Q8. How is the system secured?**
A: Edge: bloom shedding, two rate limiters, CSRF double-submit, helmet, CORS lockdown to the frontend origin. AuthN: JWT in httpOnly cookies (15m access + 7d refresh with rotation and reuse detection), Google OAuth with verified `state`, `iss`, `aud`, and `email_verified`. AuthZ: role column + `isAdmin`. Service-to-service: shared `INTERNAL_API_KEY` on every internal call (REST header + gRPC metadata). Sandbox: the full locked-down container profile from §4.4. **And then I volunteer the known issues** — privilege escalation on signup, an IDOR on submissions, and an unauthenticated leaderboard write endpoint (§11) — finding your own bugs before they do is credibility.

**Q9. Why CQRS only for the leaderboard and not everywhere?**
A: Cost-benefit. CQRS earns its complexity where read:write ratios are extreme and reads must be O(1) — exactly the leaderboard during a contest (thousands of reads per write). Problems/contests/submissions are CRUD-dominated with modest read rates; Postgres + cache-aside (60–300s TTLs) is simpler and sufficient. Over-applying CQRS is a real anti-pattern.

**Q10. How do you trace a request end-to-end?**
A: The gateway generates/echoes `x-correlation-id`, stores it in AsyncLocalStorage (so every log line includes it without parameter drilling), forwards it on proxy hops and into AMQP headers (`x-correlation-id` on publish); the Go worker extracts it from message headers and (intended to — §11 #12) forwards it in gRPC metadata; OTel auto-instrumentation (http/express/pg/ioredis) emits spans to Jaeger; the same ID ties Jaeger traces, Loki logs, and Prometheus exemplars together.

**Q11. What trade-offs did you make that you'd revisit?**
A: (a) Publish-inside-transaction in the outbox relay (lock time + duplicate window) → claim-then-publish-after-commit; (b) one container per testcase → batch with per-case `timeout` inside one container (the TS service's approach, but fix its global-timeout bug); (c) fail-open rate limiting → fail-closed for auth endpoints specifically; (d) shared `INTERNAL_API_KEY` → mTLS or per-service JWTs.

**Q12. How would you do zero-downtime deploys?**
A: The pieces are already there: health endpoints per service, graceful shutdown with connection draining (SIGTERM → stop accepting → finish in-flight → close), stateless gateway/workers. Missing: `restart:` policies/healthchecks in compose and an orchestrator. On Kubernetes: RollingUpdate with `maxUnavailable: 0` for gateway/leaderboard; for workers, `terminationGracePeriodSeconds: 30` matching the shutdown deadline, and PodDisruptionBudgets so voluntary evictions never drop all replicas.
---

## 9. Interview Q&A — Technology Deep-Dive

**Q1. Why PostgreSQL LISTEN/NOTIFY over Debezium/Kafka Connect?**
A: LISTEN/NOTIFY is zero-infra, zero-latency (~1ms), and ships with Postgres. Debezium+Kafka is the right choice when you have multiple downstream subscribers, need log-compacted replay, or must respect ordering guarantees across partitions. For *one* relay with *at-most-once* notification and a poller safety net, LISTEN/NOTIFY is the simpler tool that wins. Cost: 8000-byte payload cap (trivial for a UUID), no persistence, no WAL-level guarantees — that's why the 30s poller exists.

**Q2. PostgreSQL LISTEN/NOTIFY — what are the sharp edges?**
A: (1) Payload ≤ 8000 bytes (we stay under). (2) No persistence: a disconnected listener misses notifications — solved by our 30s poller which scans `status='PENDING'`. (3) At-most-once delivery per notify — if two listeners are connected, both get it; if zero, nobody does. (4) NOTIFY is exclusive-lock-free, so no throughput impact on writes. (5) The LISTEN connection is a dedicated Postgres session — increase `max_connections` or you risk connection starvation under heavy load. (6) Replication: on a standby, NOTIFY doesn't fire (logical replication can bridge this if needed).

**Q3. Why Redis for the leaderboard, not Postgres?**
A: Postgres would need an index on `(contest_id, score DESC, time_taken_ms ASC)`, which is ~40 bytes/row, and a `ROW_NUMBER() OVER (PARTITION BY contest_id ORDER BY ...)` window function for ranks — fine at 10K rows, O(N log N) at 1M. Redis sorted sets use a skiplist + hash table: `ZADD` is O(log N), `ZREVRANGE` is O(log N + M), `ZREVRANK` is O(log N). The Lua projection then hydrates an O(1) HASH for reads. Trade-off: Redis is in-memory; a contest with 1M participants needs ~100MB. The Postgres `leaderboard_snapshots` table provides hot-cold archival — the snapshot cron (120s) bridges the two worlds.

**Q4. Why RabbitMQ priorities and TTLs instead of separate queues?**
A: Separate queues require consumer-side multiplexing (every worker listens to both `submission.contest` and `submission.practice`), which in AMQP 0-9-1 can't atomically dequeue the highest-priority message across queues. Priorities on one queue let the broker do that work: if a contest submission arrives, it jumps the line of practice messages without consumer changes. Trade-off: priority queues degrade broker performance at very high cardinalities (10 levels is fine; 1000 is not). TTL is safe — it's a queue-level declaration on pre-existing queues, not a per-message header overhead.

**Q5. gRPC — explain the exact mechanics: did you use unary, streaming, or bidirectional?**
A: All unary RPCs (`GetProblem`, `PersistVerdict`, `UpdateLeaderboard`, `GetTopLeaderboard`, `GetUserRank`). The worker sends a single request, blocks for a single response. Server streaming would make sense for `GetProblem` if testcases were huge (stream them one by one), but at current sizes it's premature. Bidirectional streaming is the natural fit for a *live connection* from worker to core (heartbeat + verdict push), but our current 5s unary timeout is simpler. The TS services load the `.proto` at runtime via `@grpc/proto-loader`. The Go stubs are pre-generated (`protoc --go_out --go-grpc_out`).

**Q6. What are the limits of your sandbox Docker setup?**
A: (1) Docker-out-of-Docker via `docker.sock` mount: the evaluator is a root-like sibling on the host; a vulnerability in the evaluator is root-equivalent — the real isolation is the *sandbox containers*, not the worker. (2) No user-namespace remapping (`--userns=host` default), so root-in-sandbox maps to root in the container (but the `--network none` + `--read-only` + seccomp + capabilities drop neutralizes most escapes). (3) `docker run` per testcase is expensive (~100ms cold, less for a replay of the same image on the same host). (4) Container start latency is added to real execution time — time-limit fairness needs to subtract Docker overhead (we don't). (5) No resource accounting for the compile step (no `--memory`, no `timeout`). (6) Images are unpinned (`alpine:latest`, `cpp-runner:latest` → supply-chain risk). The read model: **"This is a competitive-programming platform, not a production Code Runner API — the threat model is noisy-but-not-nation-state, and the sandbox is one layer of a defense-in-depth stack that also includes per-worker process isolation and dedicated eval nodes."**

**Q7. Drizzle ORM — why over Prisma / raw SQL / Knex?**
A: Drizzle is TypeScript-native, generates zero runtime overhead (no query engine binary like Prisma), and its SQL-like DSL is close enough to raw SQL that you can `sql` escape for complex queries (like the global leaderboard `COUNT DISTINCT CASE...`) while getting type safety on standard CRUD. The trade-off: migrations are file-based SQL (not an ORM DSL), and our migrations are stale (§11 #8) — so the ORM choice is an implementation detail; the Postgres-native CDC trigger + `FOR UPDATE SKIP LOCKED` are what matter.

**Q8. Why winnowing + Jaccard for plagiarism instead of an LSH library or tree edit distance?**
A: Winnowing is the core of the MOSS (Measure Of Software Similarity) algorithm — the gold standard in CS education. It's robust to renaming, reordering independent statements, and dead-code insertion. Jaccard is cheap and interpretable (0.0–1.0). Tree edit distance (AST-level diff) would be stronger against heavy refactoring but dramatically more expensive (O(N³) for trees). The honest weaknesses: (1) our rolling hash uses only `charCodeAt(0)` — the first character of each token — making it extremely collision-prone (§11 #22); (2) we don't filter by language, so normalized C++ and normalized Python can match; (3) the `orderBy` is ascending, so the least-similar matches show first.

**Q9. Express 5 vs Express 4 — why and what broke?**
A: Express 5 is pre-release but ships the native `req.query` as a getter-only property (cannot be reassigned). Our `validate` middleware does `req.query = Zod.parse(req.query)` → TypeError on any route with query params (`GET /submissions`, `GET /contests`). This is a real bug (§11 #21). The answer for "why Express 5": it was presumably installed because it was the latest when `npm i express` ran; the peer-dependency model across the monorepo makes version drift likely. The honest fix: use `req.query` as an immutable source and store the parsed result on `req.validatedQuery` instead.

**Q10. ioredis vs node-redis — why?**
A: ioredis has built-in cluster support, Lua scripting (`redis.eval`), pipelining, Pub/Sub streams, and a transparent reconnect strategy. It's the standard for Node/Redis work. `maxRetriesPerRequest: null` means it retries indefinitely on connection loss — which is correct for connections that issue blocking commands (Pub/Sub subscribers must never be disconnected during a subscribe), but a gotcha for ordinary clients during Redis outages (requests hang indefinitely; the middleware `catch` blocks are the defense).

**Q11. Why `ts-node` in production instead of `tsc` + `node dist`?**
A: The gateway, leaderboard-service, evaluation-service, and web all run `ts-node src/server.ts` as their `npm start` command — slower startup, more memory, requires shipping `devDependencies` in the Docker image. The exception is `core`, which has a `tsc` build step and runs `node dist/server.js` — the only compiled Node service. This is an infrastructure debt item: ts-node in prod means slower container starts and larger images. Fix: add `tsc` build steps to package.json scripts (like core has) or switch to `tsup`/`esbuild` for sub-second builds.

**Q12. cookie-parser + CSRF double-submit — explain the threat model.**
A: The double-submit pattern stores a random token in a non-httpOnly cookie (so JS can read it — `src/lib/api.ts` does `document.cookie` split) and requires the same token in an `x-csrf-token` header on mutating requests. Since an attacker's site can't read cookies from our domain (same-origin policy), they can't forge the header — even with a CSRF-attack form submission. It's stateless (no server-side CSRF token storage), which makes it friendly to load-balanced gateways. The downside: the csrf cookie has `httpOnly: false` (JS-readable), so an XSS can grab it — mitigated by the JWT being in an httpOnly cookie (the real key is never in JS scope). That's the layered defense: even with a stolen CSRF token, an attacker can't forge the auth session.

**Q13. Helm / K8s — how would you deploy this in a real cluster?**
A: The compose service definitions map cleanly to Kubernetes: each service → a Deployment with `replicas`, health probes (`/health` endpoint, RabbitMQ ping), `resources.requests/limits` (the evaluations need CPU for Docker and memory for sandboxes). The problems: Docker socket mount → a `privileged` container or a dedicated node with dind sidecar; the `docker run` dependency → switch to a gVisor or Kata Containers runtime that the Kubelet can schedule natively. Redis → Redis Enterprise or the Helm chart with Sentinel for HA; Postgres → Crunchy Postgres Operator or Cloud SQL; RabbitMQ → RabbitMQ Cluster Operator. The chaos suite → integrate into Litmus or Chaos Mesh.

**Q14. Why gRPC circuit breaker via gobreaker instead of enrichment at the client?**
A: gRPC-Go's built-in retry/resilience features (hedging, transparent retries via `service_config`) require `.proto` annotations or client-side JSON config, and the retry logic is black-box. gobreaker gives explicit control: I can inspect the breaker state from a `/health` endpoint, log transitions, and align the policy with the retry/DLQ strategy in the queue consumer. The cost: one global breaker shared across `CoreClient` and `LeaderboardClient` — a leaderboard outage trips the breaker for the core path too (§11).

**Q15. Why Prometheus + Grafana + Loki + Jaeger instead of Datadog / CloudWatch?**
A: It's the open-source observability trinity — zero vendor cost, a single `docker compose up` deploys the entire stack, and local experimentation matches production behavior. Datadog/CloudWatch become compelling at multi-cluster scale or when you need retention beyond what local volumes give you. The instrumentation (OTel exporters + `prom-client` + `winston-loki`) is vendor-agnostic — swapping to Datadog means changing exporters, not ripping out traces.
---

## 10. Interview Q&A — Scenarios & System Design

**S1. What happens when 10,000 users submit simultaneously at contest start?**
A: The gateway's rate limiter per-IP caps at 50/min — a botnet uses many IPs and gets through; bloom does nothing for this path (submissions aren't ID-based). Each submission hits core, which serializes the *outbox transaction* (Postgres row-level locking — the hot spot is the `outbox_messages` table's `FOR UPDATE SKIP LOCKED` contention). The CDC relay then pumps into RabbitMQ. The Go workers are the bottleneck: 10 goroutines × 2 pods = 20 concurrent evaluations; a 20-testcase run at ~2–6s each yields ~3–10 submissions/s throughput. The queue fills rapidly — 10K submissions at 10/s would drain in ~17 minutes. The TTL (300s on `submission.queue`) could kill late-starters before they're evaluated. **Fix:** increase workers/pods; reduce TTL for contest mode; add autoscaling based on RabbitMQ queue depth (the `queueMonitor` already exports the depth metric).

**S2. What happens when a problem has 500 testcases?**
A: The Go service spawns one container per testcase — 500 sequential Docker creates × ~200ms = 100 seconds of overhead before any test code runs. A single submission monopolizes a worker for ~3 minutes; the total `timeout` is generous (`(limit+2s) × 500`). The TS service's batched `runner.sh` would handle this better (one container), but its single `timeout` would wrap the whole batch. **Fix:** implement batch container evaluation (like TS) with per-testcase `timeout` inside the script (an `alarm(limit)` per case); or flag "this problem has many testcases" and scale up workers only during contest evaluations.

**S3. What happens when RabbitMQ dies mid-contest?**
A: The outbox accumulates `PENDING` rows in Postgres (durable, committed); the relay's `publishToExchange` fails → `attempts+1`, rows stay `PENDING` or go `FAILED` at `maxAttempts`. No submissions are lost — they just sit unprocessed. The worker's `Consume` hangs; when the broker comes back, the publisher reconnects and drains the backlog. The 30s poller is the safety net (it sweeps any rows the CDC missed before the crash). The queue itself is durable + mirrored; rebooted RabbitMQ re-declares topology and messages survive AMQP restart.

**S4. What happens when a Go worker crashes mid-evaluation?**
A: The in-flight message's manual ack is **not sent** → RabbitMQ detects the channel/connection close and **redelivers** the message to another consumer (or the same one after restart). The new consumer runs the evaluation again (no idempotency in Go — §11). The Docker sandbox: `--rm` removes the container, so the "orphan" is gone if Docker completes cleanup before the worker exits; if the worker dies while `docker run` is mid-command, Docker's client-side timeout eventually kills the container (or it becomes an orphan if the whole daemon is shared). Workspace dir: `os.MkdirTemp` inside the container → cleaned by the OS on process exit (the container is ephemeral, temp dir is inside it). The new worker creates a fresh workspace.

**S5. What happens when a malicious submission tries to fork-bomb your sandbox?**
A: `--pids-limit 64` caps forked processes at 64. `--memory <N>m` with OOM-kill at 137 → MLE. `--cpus <N>` limits CPU burn to N cores (so TLE, not starvation of the Node or Go worker). `--network none` prevents the sandbox from phoning home or attacking other services. `--read-only --tmpfs /tmp:64m` prevents filling disk. `seccomp=default` blocks a set of dangerous syscalls. And `--security-opt no-new-privileges:true` means even if the container has a setuid binary, it can't be exploited to escape.

**S6. What happens when the leaderboard service temporarily goes down?**
A: The Go worker's `UpdateLeaderboard` gRPC call fails → `Nack(false,true)` requeues the message with **no cap** — it redelivers forever (§11 #14). The submission *has* been persisted (verdict saved to core), so technically no data loss, but the leaderboard entry is stuck. A better approach: persist the `UpdateLeaderboard` in a Redis list / outbox row and retry with backoff. **Fix:** add a retry counter + DLQ to the leaderboard update path, exactly as the verdict queue has.

**S7. What happens if the Gateway and Core are restarted simultaneously?**
A: Graceful shutdown: core stops accepting HTTP → finishes in-flight requests → closes RabbitMQ → quits Redis; gateway does the same. The window of total outage is the startup time (~seconds). The outbox relay reconnects on boot; the CDC trigger is re-created (idempotent `CREATE OR REPLACE`). Any messages published to `submission.queue` before core went down survive in RabbitMQ. The gateway's L1 cache is cold on restart — the first request takes a miss and fans out to core (singleflight ensures only one of the many cold-start requests hits the origin). The bloom filter is re-hydrated by core.

**S8. What happens on a double-POST due to network retry?**
A: The submission endpoint has **no idempotency protection** — the middleware infrastructure exists (`idempotency.middleware.ts` with `SET NX EX`, `submitSolutionWithIdempotency`) but the controller calls `submitSolution` directly (§11 #15). So a double-POST from a network retry (or a frontend retry) creates two submission rows and two evaluation jobs — and the user gets evaluated twice. The *leaderboard* dedupe (`SADD CodeWarz:Solved:<c>:<u>`) prevents double-scoring; the *sandbox* runs twice. **Fix:** wire the idempotency middleware (key = `submit:{userId}:{problemId}:{contestId || 'practice'}:{sha(code)[:16]}`) — it's written and tested, just not plugged in.

**S9. What happens on a cache stampede for the leaderboard?**
A: The L1 cache is an LRU with 5,000 entries, TTL 3s for `/leaderboard/live`. When the TTL expires on a hot contest, the first request misses L1 → hits L2 (Redis, 3s) → also cold → the **singleflight** intercepts: one request goes to `leaderboard-service`, the other 9999 coalesce on an EventEmitter. The origin call is `ZREVRANGE idx 0 limit-1` + pipelined `HGET`s — fast (~1ms in Redis). So a stampede causes exactly one origin call, period. The singleflight timeout gap (§11 #26) is a genuine edge case but unlikely under 3s expiry vs 1ms Redis latency.

**S10. How would you support multi-region?**
A: `leaderboard:invalidate` is a Redis Pub/Sub message — it doesn't cross regions. A multi-region topology would need: (1) a global PostgreSQL (Aurora Global Database, CockroachDB) for the `outbox_messages` source of truth; (2) regional RabbitMQ clusters connected by Federation/Shovel to move messages between regions; (3) each region's own gateway + leaderboard service + Redis (regional caches); (4) the outbox poller writes to local RabbitMQ, and the CDC relay writes to the *nearest* queue (respecting sharded outbox by region). The global leaderboard is computed asynchronously from all regions' score events, not from a single sorted set.

**S11. A new contributor asks: "Why does `solved_count` never increment?" — your response.**
A: (Smile — it's a real bug you found yourself.) In `submission.service.ts:171–187`, `updateSubmission` sets `verdict='AC'`, then immediately calls `getBestSubmissionWithTx(userId, problemId)` — which returns the *just-saved* submission because it's now AC. So `best` is truthy, and `incrementSolvedCountWithTx` never runs. The fix: check the *previous* best before the update, or use a separate flag in the transaction.
---

## 11. Known Weaknesses (find bugs in your own code = credibility)

Each item below: **where** (file:line), **what's wrong**, **how to frame it in an interview** (Say:), and the fix direction (Fix:). These are ALL real, verified bugs found by reading the code.

### SECURITY — Critical

**B1. Self-service admin escalation** — `core/src/dtos/auth.dto.ts:7` accepts `role: z.enum(["admin","user"]).default("user")` and `core/src/service/auth.service.ts:34` does `const userRole = role === 'admin' ? 'admin' : 'user'`. Anyone can POST `{..., role:"admin"}` and become an admin.

**Say:** "The signup Zod schema includes an optional `role` field defaulting to user, but the service blindly honors it. A signed-out user can self-escalate to admin."
**Fix:** strip the `role` field from the Zod schema server-side; never trust user-supplied roles. Only set role='admin' from an admin-authenticated PATCH endpoint.

**B2. IDOR on submissions** — `core/src/controllers/submission.controller.ts:27-39` — `GET /submissions/:id` returns any submission (including source code) to any authenticated user; no `ownerId === req.user.id` check.

**Say:** "Any authenticated user can read anyone else's code. For a competitive programming platform, this is catastrophic (leaks solutions during a live contest). The fix is an ownership guard."
**Fix:** add `submission.userId === req.user.id` filter before the query.

**B3. Any user can PATCH any submission** — `core/src/routers/v1/submission.router.ts:20`: `PATCH /:id` uses `verifyInternalOrUser`, which falls through to plain-user JWT when no `x-internal-api-key` header is present. Coupled with `submission.controller.ts:94-102` (no ownership check), any logged-in user can set their own verdict to AC on any problem.

**Say:** "The `PATCH /submissions/:id` endpoint is meant for the evaluation service (authenticated with the internal API key) to persist verdicts. But the middleware falls through to user authentication — so any signed-in user can call it and give themselves an AC. The evaluation service also has no authZ check on whether this user owns the submission."
**Fix:** require internal API key for the verdict path; separate the user-facing PATCH (e.g., to update code or add notes) with an ownership guard.

**B4. OAuth state cookie prevents Google login** — `core/src/utils/helpers/oAuth/state.helper.ts:15` — `sameSite: 'strict'` on the state cookie. Browsers withhold `strict` cookies on the cross-site redirect from `accounts.google.com` back to the app. The state cookie is missing on the callback → `state mismatch` → 400 → Google login fails.

**Say:** "Google OAuth login redirects the user cross-site. With `sameSite: 'strict'`, the state cookie is stripped by the browser. The login flow never completes for any Google user."
**Fix:** change to `sameSite: 'lax'` (covers the top-level navigation redirect safely). See also no `Secure` flag in dev (fine, localhost).

**B5. CSRF always 403s on first auth request** — `core/src/middlewares/csrf.middleware.ts:74` — `req.path.startsWith('/auth/')` is the intended exemption, but the middleware is app-level so `req.path` is `/api/v1/auth/signin`, not `/auth/`. First-ever signup/signin from a browser that never got a csrf cookie → 403.

**Say:** "The CSRF exemption for auth routes never fires due to the path prefix mismatch. The first signin from any browser returns 403 (though it does set the csrf cookie in the response, so a retry succeeds). This is a user-facing bug."
**Fix:** match against `req.originalUrl` or mount the exemption at the correct path level.

### FUNCTIONAL — Critical/High

**B6. `solved_count` never increments** — `core/src/service/submission.service.ts:171-187`. `updateSubmission` sets `verdict='AC'` inside the transaction, then calls `getBestSubmissionWithTx(userId, problemId)` — which now finds *this very submission* as best → `best` truthy → `incrementSolvedCountWithTx` never runs. `users.solved_count` stays 0 permanently.

**Say:** "Because the AC verdict is saved *before* the 'get best' check, the new submission is always considered the best, so solved_count never increments. The global leaderboard recomputes from submissions (so it's functionally correct), but the cached count and profile stats are stuck at 0."
**Fix:** check the existing best *before* the update, or use a separate SQL `UPDATE users SET solved_count = solved_count + 1` on the AC path.

**B7. Migrations missing critical tables** — the `drizzle/0000-0002` SQL files don't include `outbox_messages`, `submission_events`, `contest_events`, `user_events`, `problem_events`, `code_fingerprints`, or `plagiarism_reports`. A fresh DB deploy fails on `initializeCDC()` (only logs the error) and every `saveOutboxMessage` throws "relation does not exist" → all submissions fail with 500.

**Say:** "The Drizzle migrations tracking doesn't include the outbox, event-sourcing, or plagiarism tables. This was discovered during code reading; it means a 'docker compose down -v' followed by 'up' breaks the entire submission flow. The CDC trigger is created at app boot (not in migrations), which also masks this."
**Fix:** generate fresh migrations with `npx drizzle-kit generate`, verify against a clean database.

**B8. gRPC proto missing in Docker image** — `core/src/grpc/grpc.server.ts:30` resolves `../../../proto/codewarz.proto` (i.e., `/app/proto/codewarz.proto` at runtime). The core `Dockerfile` only copies the `core/` directory, not `proto/`. At startup, `protoLoader.loadSync` fails → gRPC server crashes → service exits.

**Say:** "The gRPC server can't start inside its container because the shared `proto/codewarz.proto` isn't copied into the image. The service runs but gRPC is dead. The Go worker's `GetProblem` calls fail and messages nack to the DLQ."
**Fix:** `COPY proto ./proto` in the core Dockerfile, or embed the proto file.

**B9. Gateway /leaderboard/live always 503s** — `api-gateway/src/server.ts:105-110` — the proxy is mounted at `/api/v1/leaderboard/live`, Express strips the mount, `req.url` = `/abc123`. Splitting on `/` yields `['abc123']`, and `parts[1]` is `undefined` → throws → `proxyErrorHandler` returns 503.

**Say:** "The path parser uses `parts[1]` instead of `parts[0]` for the contestId — a classic off-by-one that renders the live leaderboard endpoint permanently unavailable. This is the only route that uses the cache+singleflight infrastructure, so that infrastructure is untested in practice."
**Fix:** `const contestId = parts[0]`.

**B10. Go service: RE verdict string pollution** — `evaluation-service-go/internal/sandbox/executor.go:52` — on non-124/137 exit codes, returns `fmt.Errorf("RE: %s", string(output))`. `sandbox.go:131-140` uses the `Error()` value as the verdict string in run-all mode (`severity[ver]` lookup), so `"RE: <stderr>"` doesn't match `"RE"` → RE is ignored and the submission may come out AC/WA. In submit mode, the persisted verdict is literally `"RE: <entire stderr>"` instead of `"RE"`.

**Say:** "A `fmt.Errorf` with the output in the error string is used directly as a verdict — this pollutes the database and breaks the severity ranking in run-all mode."
**Fix:** return a clean `errors.New("RE")` and store stderr separately in the result struct.

**B11. Go service: correlation ID silently broken** — `consumer.go:187` stores the ID with typed key `ctxKey("correlation-id")`, but `client.go:51` reads it with a plain string `"correlation-id"` — different types, `ctx.Value()` never finds it. Distributed tracing across the Go path is dead.

**Say:** "The Go context key type mismatch means the correlation ID is extracted from AMQP headers but never forwarded in gRPC metadata. Distributed traces are broken for every submission flow through the Go worker."
**Fix:** use a shared constant or the same type for the context key.

**B12. Go service: duplicate-solve keys never expire** — `consumer.go:29` declares `duplicateSolveTTL = 86400` (constant) but the `SADD` at line 286 never calls `EXPIRE` or `EXPIREAT`. Solved-set keys grow unbounded → Redis memory leak. The TS version sets `EXPIREAT` = contest end + 24h.

**Say:** "The duplicate-solve Redis sets never expire, so they accumulate indefinitely — a Redis memory leak that grows with each contest solved."
**Fix:** after `SADD`, call `EXPIREAT` with the contest end time + 24h.

**B13. Go: infinite requeue on leaderboard/verdict failure** — `consumer.go:278`: `Nack(false, true)` retries forever. A transient leaderboard outage recycles the same message indefinitely, consuming worker bandwidth.

**Say:** "There's no retry cap on the PersistVerdict path. A leaderboard outage causes infinite requeue. Compare this to the TS service's `maxRetries: 3` + DLX + exponential backoff."
**Fix:** add a `x-retry-count` header check and nack to DLQ after N retries, exactly as the TS consumer does.

**B14. TS service: single global timeout for batch runner** — `evaluation-service/src/sandbox/runSandbox.ts:81-87` generates a `runner.sh` where a single `timeout <limit+2s>` wraps the entire for loop. A 20-testcase problem needs 20× the individual time limit.

**Say:** "The batch runner wraps all testcases in one timeout, so per-testcase time limits aren't enforced. A 200ms-limit problem with 10 testcases fails after 2 seconds instead of 10 × 220ms = 2.2s."
**Fix:** install a per-case `timeout` inside the shell loop (the Go service does this correctly with one container per case, at the cost of start-up overhead).

**B15. Backpressure is a complete no-op** — `core/src/service/backpressure.service.ts:27` reads `redis.llen('backpressure:submission-queue')` — nothing in the system ever LPUSHes to that Redis key (queues live in RabbitMQ, the key name is a BullMQ-era relic). Depth is permanently 0, the overload guard never triggers.

**Say:** "The backpressure check exists in the submission flow as a guard, but the metric it reads is never written. The system has no actual backpressure signal — it accepts submissions regardless of queue depth."
**Fix:** read the actual RabbitMQ queue depth via the management API (already done by `queueMonitor`), or use a local channel-count pattern in the Go worker.

**B16. Dead code density is high** — `Saga` class in `saga.service.ts` (never instantiated), `submitSolutionWithIdempotency` (never called), circuit breaker `getCircuitBreaker()` in gateway/core (zero call sites), `enqueueSubmission`/`enqueueRun` in `submission.queue.ts` (superseded by outbox), v2 routers (empty placeholders in all services), `decrementUserActivity` (unused).

**Say:** "The codebase was built incrementally, and refactors left behind infrastructure that's fully written but never wired. The Saga orchestration and idempotent submit wrappers are probably from an earlier design phase. Cleaning this up is on the backlog."

**B17. Leaderboard MQ path doesn't project the read model** — `leaderboard-service/src/queues/verdict/consumer.queue.ts` calls `updateLeaderboard()` but *never* calls `leaderboardReadModelService.project()` or publishes `leaderboard:invalidate`. Verdicts arriving via the verdict queue leave the read model stale and SSE listeners silent — only gRPC writes trigger the full projection.

**Say:** "The MQ path into the leaderboard is half-implemented: it writes to the ZSET but skips the projection step. If any submission's verdict arrives via RabbitMQ (which is the common path — the Go service sends `UpdateLeaderboard` over gRPC, but the TS evaluator publishes to `verdict.queue`), the read model never updates and SSE never fires."
**Fix:** add `await leaderboardReadModelService.project(contestId)` after the write.

**B18. Unauthenticated HTTP leaderboard write endpoint** — `leaderboard-service/src/routers/v1/leaderboard.router.ts:7-10`: `POST /update` has no auth middleware at all. Anyone can inject arbitrary scores.

**Say:** "There's an HTTP endpoint to update the leaderboard that's completely unauthenticated — no API key, no JWT, nothing. The gRPC path is authenticated; this HTTP endpoint, which was presumably for internal testing, is wide open."
**Fix:** remove the HTTP endpoint or add `verifyInternalOrUser` middleware.

**B19. API Gateway runs as root, ships `.env` into the Docker image** — `api-gateway/Dockerfile` has no `USER` directive, no `.dockerignore` entry for `.env` or `logs/`, and runs `npm start` (ts-node in dev mode, no TypeScript compilation step).

**Say:** "Security and operational hygiene gaps: the gateway container runs as root, `.env` files with secrets are baked into the image, and production runs ts-node instead of compiled JavaScript."
**Fix:** add `USER node`, expand `.dockerignore` to exclude `.env` `logs/`, add a build step (`tsc` or `esbuild`) to the Dockerfile.

**B20. web image CI build is broken** — `.github/workflows/ci.yml` builds `web` with `context: .` but `web/Dockerfile` does `COPY package*.json ./` expecting the web directory to be the root — at the repo root there's no `package.json`. The CI always fails for the web image.

**Say:** "The web Docker image build in CI is misconfigured — the context should be `./web`, not `.`. This means the CI's sixth image never builds, and there's no regression check for frontend changes."
**Fix:** change `context: ./web` in the `ci.yml` or point `Dockerfile` from repo-root context.
---

## 12. Future Improvements ("What would you do next?")

| Area | What to say | Priority |
|---|---|---|
| **Security fix sprint** | Close the 5 critical security holes (admin escalation, submission IDOR, unauthenticated leaderboard write, leaky metrics, root containers) before any feature work. | P0 |
| **Complete the Go migration** | Port TS features to Go: submission idempotency (`eval:` keys), `run-result:` caching, `Solved:` key expiry, retry-with-DLQ for PersistVerdict, batch sandbox execution. Then decommission the TS evaluation service. | P0 |
| **Saga & event sourcing lifecycle** | The `Saga` class and event-sourcing tables exist but power no observable flow. Complete a submission lifecycle saga: SUBMITTED → QUEUED → EVALUATING → COMPLETED → RANKED, with compensations on failure. | P1 |
| **Wire idempotency middleware** | The `submitSolutionWithIdempotency` function and `idempotency.middleware.ts` exist but are not called. Wire them to protect the submit endpoint against network-retry double-submissions. | P1 |
| **Fix leaderboard MQ projection** | Add `project()` call in the verdict queue consumer so the read model updates regardless of whether the write arrived via gRPC or RabbitMQ. | P1 |
| **Move CDC trigger to migrations** | The `initializeCDC()` SQL should live in Drizzle migrations so a fresh DB deployment works without the app creating its own trigger at runtime. | P1 |
| **Dockerfile hardening** | Multi-stage builds for all Node services (tsc compile → `node dist/`), `USER node`, prune devDeps, correct `.dockerignore`, healthchecks, `tini` as init. | P1 |
| **Autoscaling workers** | Use the `app_queue_depth` metric (already exported) to autoscale Go worker pods based on RabbitMQ backlog. | P2 |
| **Producer-side outbox separation** | Move publish *after* the DB transaction commits (claim → commit IN_FLIGHT → publish → confirm → second tx → PUBLISHED) to reduce duplicate risk. | P2 |
| **Global leaderboard** | The `GET /users/leaderboard/global` endpoint (`user.router.ts:11`) is defined but backed by a computed SQL query. For scale, materialize it as a daily task or a Redis sorted set with weekly expiry. | P2 |
| **CI/CD** | Add Node tests (`jest`/`vitest`), lint (`eslint`), a `tsc --noEmit` check, and a proper staging deploy to the CI pipeline. Fix the web image context. | P2 |
| **Batch sandbox execution** | Port the TS batched `runner.sh` approach (one container per submission, not per testcase) to Go, with per-case `timeout` inside the shell script. | P2 |
| **Plagiarism pipeline improvements** | Fix the rolling hash (use full token content not just `charCodeAt(0)`), add language filtering, order by descending similarity, add a CLI review tool. | P3 |
| **Token-bucket fail-closed for auth** | Switch auth endpoints (`POST /auth/signin`, `/auth/signup`) to fail-closed on Redis errors. A crypto-microburst should not open the login floodgates. | P3 |
| **Chaos engineering on data plane** | Extend chaos tests to kill Postgres, Redis, and RabbitMQ — currently only app services are targeted. Add validated data-loss checks. | P3 |

---

## 13. Quick-Reference Cheat Sheet

Last-minute refresh — one line per concept.

| Concept | One-liner |
|---|---|
| Monorepo structure | 6 TS/Go services; 3 TS services share source from `core/src` via relative imports |
| Gateway middleware order | Helmet → CORS → morgan → cookies → correlation → metrics → token-bucket (Lua) → route RL → CSRF → bloom → proxy |
| Bloom filter | m=100k, k=3, double hashing, Redis GETBIT pipeline; any 0 → 404 at edge |
| Rate limit (global) | 50 tokens, 50/60 refill, Lua EVAL on `ratelimit:<ip>`, fail-open |
| Rate limit (route) | 10/min submissions, 30/min run, 60/min problems, 120/min leaderboard (all per-IP, fail-open) |
| Cache hierarchy | L1 = LRU max 5000 (Node heap), L2 = Redis SETEX 3s, singleflight on MISS |
| Cache invalidation | `leaderboard:invalidate` Pub/Sub → L1 purge by substring match |
| SSE | `text/event-stream`, `: heartbeat` every 15s, per-contest EventEmitter, tick-only (data via REST refetch) |
| Outbox table | `outbox_messages(id, aggregate_type, event_type, payload, exchange, routing_key, status, attempts, max_attempts)` |
| CDC trigger | `pg_notify('new_outbox_message', NEW.id)` on `AFTER INSERT ON outbox_messages` |
| CDC relay | Dedicated pg.Client LISTEN → `processOutboxBatch(20)` → FOR UPDATE SKIP LOCKED → publisher confirms |
| Poller safety net | 30s interval, same `processOutboxBatch(20)` |
| RabbitMQ topology | 3 direct exchanges + 1 fanout + 1 DLX; queues: submission/verdict/plagiarism, each with TTL + DLQ + retry queue |
| Priority | contest=10 practice=1 via `x-max-priority: 10` |
| Go worker pool | 10 goroutines × 2 pods, prefetch 10, manual ack; synchronous per-message |
| Sandbox limits | `--network none --memory Nm --cpus X --pids-limit 64 --read-only --tmpfs /tmp:64m no-new-privileges seccomp` |
| Verdict exit codes | 124=TLE, 137=MLE, other→RE (but Go has string pollution bug) |
| Output compare | Trim → split → trim lines → collapse whitespace → drop empties → exact equality |
| gRPC port mapping | Core :50051, Leaderboard :50052; API key auth in metadata; 5s timeout; gobreaker |
| Score encoding | `score + (100000 − min(max(floor(ms/60000),0),100000))/100000` |
| CQRS keys | Write: `CodeWarz:Leaderboard:<cid>`, Read: `CodeWarz:ReadModel:LB:[Idx:]<cid>`, Lock: `CodeWarz:ReadModel:Lock:<cid>` |
| Read model TTL | 48h |
| Lua projection | `ZREVRANGE → DEL → HSET + ZADD → EXPIRE → PUBLISH invalidate` — all atomically in one EVAL |
| JWT tokens | Access 15m (JWT_SECRET), Refresh 7d (REFRESH_SECRET); cookies httpOnly scoped |
| Google OAuth | state cookie → code flow → `verifyIdToken(iss, aud, email_verified)` → find-or-create |
| Plagiarism | strip comments → normalize → 5-gram rolling hash → winnowing w=4 → Jaccard ≥ 0.80 |
| Distributed lock | `SET lock:<res> <uuid> PX <ttl> NX`; Lua `get==val → del` unlock |
| Circuit breaker | 5 failures → OPEN, 30s → HALF_OPEN, 3 consecutive → CLOSED; Redis Pub/Sub sync (but wired = dead) |
| Chaos toolkit | Python: ContainerKiller (weighted docker kill) + NetPartitioner (tc loss 20-60%) + Probe (health check) |
| Namespaces | Docker: `codewarz-*` containers on `codewarz-network`; Redis: `gateway:*`, `CodeWarz:*`, `ratelimit:*`, `lock:*`, `idempotency:*` |
| Ports | web 8080, gateway 3000, core 3001+50051, leaderboard 3002+50052, eval-ts 3003, eval-go 3004, grafana 3004, rabbitmq 5672+15672, postgres 5435, redis 6379, jaeger 16686, prometheus 9090, loki 3100 |
| Env variable names | `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `INTERNAL_API_KEY`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `SERVICE_NAME`, `CORE_GRPC_PORT`, `LEADERBOARD_GRPC_PORT`, `PLAGIARISM_THRESHOLD`, `FRONTEND_URL`, `JAEGER_URL`, `LOKI_URL`, `RABBITMQ_MANAGEMENT_URL`, `HOST_WORKSPACES_ROOT`, `GRPC_TLS_KEY/CERT_PATH`, `GRPC_TLS_ENABLED` |
| Prometheus scrape | Every 5s on 5 services; 17 custom metrics in core (`http_duration`, `queue_depth`, `submission_total`, `verdict_total`, …) |
| Key numbers | Bloom FPR ~0.003% at 1k IDs; Gateway 50/min/IP; Worker pool 10/pod; `waitForConfirms` per publish; outbox batch 10 (20 on CDC); 30s poller; 5s gRPC timeout; 30/15s breaker timeouts |
| Bugs count | 20+ documented in §11; top 3 to mention: admin self-escalation, `solved_count` never increments, Go RE verdict pollution |

---

## End: How to Steer the Conversation

**Your strongest talking points, in order (lead with these if the interviewer says "tell me about this project"):**

1. **The CDC-driven outbox relay** — atomic dual-write + pg_notify + FOR UPDATE SKIP LOCKED + publisher confirms. This is the most architecturally distinctive piece of the whole project. Start here.
2. **The CQRS Lua projection** — `ZREVRANGE` → `HSET` + `ZADD` + `PUBLISH` in one atomic script. Show you understand the trade-offs (Redis blocking, O(N), pagination).
3. **The defense-in-depth edge stack** — bloom → two rate limiters → cache+singleflight → CSRF → proxy. Walk through how an attack gets shed at four different layers before ever touching Postgres.
4. **The Go sandbox design** — `--network none`, cgroup limits, exit-code-based verdicts, the safego pattern, graceful shutdown. Concrete, mechanical, and security-focused.

**Your honesty angles (managers love these):** say "I read the code carefully and found 20+ bugs, including 5 security issues — let me walk you through the worst one (admin escalation) and how I'd fix it." This transforms a weakness question into a strength.

**What to avoid unless asked:** the frontend styling (shadcn, Tailwind — it's boilerplate), the empty v2 routers, the dead Saga class, the chaos suite (it's a Python script, not Litmus). Focus on the distributed systems infrastructure.

---

*Generated from actual code at `/Users/cvlikhith/CodeWarz` | Last updated 2026-07-29*
