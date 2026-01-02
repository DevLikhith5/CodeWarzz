FROM node:20-alpine

WORKDIR /app

# Copy package files (using package*.json to include lockfiles)
COPY leaderboard-service/package*.json ./leaderboard-service/
COPY core/package*.json ./core/

# Install dependencies for core
WORKDIR /app/core
RUN npm ci

# Install dependencies for leaderboard-service
WORKDIR /app/leaderboard-service
RUN npm ci

# Copy source code
WORKDIR /app
COPY core ./core
COPY leaderboard-service ./leaderboard-service

WORKDIR /app/leaderboard-service

# Default command
CMD ["npm", "start"]
