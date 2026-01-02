# CodeWarz Architecture

## System Overview

CodeWarz is a distributed competitive programming platform built with a microservices-inspired architecture. It consists of several specialized services working together to handle user authentication, problem processing, code evaluation, and leaderboard management.

## Architecture Diagram

```mermaid
graph TD
    %% Clients
    Client([Client / User])

    %% Gateway
    subgraph Gateway Layer
        AG[Api Gateway]
    end

    %% Services
    subgraph Service Layer
        ES[Evaluation Service]
        LS[LeaderBoard Service]
        SS[Shared Library]
    end

    %% Infrastructure / Data
    subgraph Data & Infrastructure
        DB[(Postgres DB)]
        Redis[(Redis Cache)]
        Queue[[BullMQ / Redis]]
        Loki[Loki / Grafana]
    end

    %% Sandbox
    subgraph Execution Environment
        Sandbox[Docker Sandbox]
    end

    %% Relationships
    Client -- HTTP Requests --> AG
    
    %% API Gateway Routing
    AG -- Route: /submissions, /problems --> ES
    AG -- Route: /leaderboard --> LS
    AG -- Auth & Common Logic --> SS

    %% CORE Library Usage
    ES -. Uses .-> SS
    LS -. Uses .-> SS
    AG -. Uses .-> SS

    %% Data Interactions
    SS -- Read/Write --> DB
    SS -- Metrics/Logs --> Loki
    
    %% Evaluation Flow
    ES -- 1. Queue Submission --> Queue
    ES -- 2. Consume Job --> Queue
    ES -- 3. Execute Code --> Sandbox
    Sandbox -- Return Result --> ES
    ES -- 4. Store Result --> DB
    
    %% Leaderboard Flow
    ES -- 5. Update Score --> Redis
    LS -- Read Leaderboard --> Redis
    
    %% Styling
    classDef service fill:#f9f,stroke:#333,stroke-width:2px;
    classDef storage fill:#ff9,stroke:#333,stroke-width:2px;
    classDef gateway fill:#9ff,stroke:#333,stroke-width:2px;
    
    class ES,LS,SS service;
    class DB,Redis,Queue,Loki storage;
    class AG gateway;
```

## Service Descriptions

- **ApiGateway**: The entry point for all client requests, handling routing, rate limiting (potentially), and initial request validation.
- **EvaluationService**: The core computation engine. It manages problem submissions, places them in a queue, and executes them securely within a Docker sandbox.
- **LeaderBoardService**: Manages real-time leaderboards and user rankings, utilizing high-performance caching (Redis) for low-latency updates.
- **Shared**: A common library containing shared business logic, database schemas (Drizzle ORM), repository patterns, and utility functions used across all services to ensure consistency.

## Infrastructure

- **PostgreSQL**: Primary persistent storage for users, problems, submissions, and contests.
- **Redis**: Used for both distributed job queues (BullMQ) and high-speed caching for leaderboards.
- **Docker**: Provides isolated environments for safely executing user-submitted code.
- **Grafana/Loki**: Centralized logging and monitoring solution.
