# CodeWarz

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)

**CodeWarz** is a high-performance, distributed competitive programming platform designed to handle massive concurrency with secure code execution. Built on a robust microservices architecture, it leverages **Docker-in-Docker sandboxing** for security, **Redis** for sub-millisecond leaderboard updates, and **Event-Driven** queues for scalable submission processing.

---

## 🚀 Key Features

### 🛡️ Secure Code Execution Engine
- **Docker-in-Docker (DinD)**: Isolates user code in ephemeral containers with strict resource limits (CPU/Memory).
- **Language Agnostic**: Supports C++, Java, Python, and more via modular executor strategies.
- **Robust Security**: Prevents malicious operations (e.g., File System access, Network requests) using read-only mounts and network isolation.

### ⚡ Event-Driven Microservices
- **Asynchronous Processing**: Uses **BullMQ (Redis)** to decouple submission ingestion from execution, ensuring zero-downtime during traffic spikes.
- **Horizontal Scaling**: The `Evaluation Service` logic is stateless, allowing `N` worker replicas to consume jobs in parallel.
- **API Gateway**: Centralized entry point handling global rate limiting, request validation, and routing.

### 📊 Real-Time Leaderboards
- **Redis Sorted Sets (ZSET)**: Implements lightning-fast ranking algorithms ($O(log N)$) for instant feedback.
- **Live Updates**: Frontend polls (or sockets) for real-time changes in rank as submissions are processed.

### 🔍 Observability & Monitoring
- **Prometheus & Grafana**: Visualization of system health, queue depth, and container metrics.
- **Loki**: Centralized log aggregation to debug issues across distributed services.

---

## 🏗️ Architecture

```mermaid
graph TD
    Client([User]) -->|HTTP/HTTPS| Gateway[API Gateway]
    
    subgraph Core Infrastructure
        Gateway -->|Auth/Routing| Core[Core Service]
        Gateway -->|Stats| Leaderboard[Leaderboard Service]
        Gateway -->|Static Assets| Web[Frontend (Vite)]
    end

    subgraph Async Processing
        Core -->|Prod. Job| Redis[(Redis Queue)]
        Redis -->|Cons. Job| Eval[Evaluation Service]
        Eval -->|Update Verdict| Core
        Eval -->|Update Rank| Leaderboard
    end

    subgraph Sandboxing
        Eval -->|Spawn| Docker[Sandbox Container]
        Docker -->|Result| Eval
    end

    subgraph Persistence
        Core --> Postgres[(PostgreSQL)]
        Leaderboard --> RedisCache[(Redis Cache)]
    end
```

---

## 🛠️ Technology Stack

| Component | Tech | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React, Vite, TailwindCSS | High-performance, responsive UI |
| **Backend** | Node.js, Express, TypeScript | Type-safe microservices |
| **Database** | PostgreSQL, Drizzle ORM | Relational data integrity |
| **Queue** | BullMQ, Redis | Async job processing |
| **DevOps** | Docker Compose, Docker | Containerization & Orchestration |
| **Monitoring** | Prometheus, Grafana, Loki | System observability |

---

## ⚡ Getting Started

The entire platform is containerized. You can spin up the full infrastructure with a single command.

### Prerequisites
- Docker & Docker Compose
- Node.js (for local dev)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/DevLikhith5/CodeWarz.git
cd CodeWarz

# 2. Build and Start Services
docker compose up --build -d

# 3. Access the Application
# Web UI: http://localhost:8080
# API Gateway: http://localhost:3000
# Grafana: http://localhost:3004 (admin/admin)
```

### Developing Locally
We support **hot-reloading** for all services via volume mounts in `docker-compose.yml`. Just edit the code in `src/`, and the services will restart automatically (except `evaluation-service` which requires rebuild for sandbox consistency).

---

## 🧠 System Design Deep Dive

### The Submission Lifecycle
1.  **Ingestion**: User submits code -> API Gateway -> Core Service.
2.  **Queuing**: Core pushes a job to `submission-queue`.
3.  **Processing**: An `Evaluation Worker` picks up the job.
4.  **Isolation**: The worker spawns a **Docker Container** with the user's code + test cases mounted.
    *   *Security Note*: Volume paths are translated from Host to Container to ensure correct mounting in the Docker-in-Docker environment.
5.  **Execution**: Code is compiled and run against inputs. Output is diffed against expected output.
6.  **Results**: Verdict (AC/WA/TLE) is written back to Postgres and Leaderboard is updated via Redis.

---

## 🤝 Contributing

We welcome contributions! Please follow the `CONTRIBUTING.md` guidelines (coming soon).

---

© 2026 CodeWarz. Built by [Your Name/Team].
