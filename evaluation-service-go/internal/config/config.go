package config

import (
	"os"
)

type Config struct {
	Port                string
	RabbitMQURL         string
	// Legacy HTTP URL kept for non-gRPC health endpoints
	CoreServiceURL      string
	// gRPC addresses (host:port) — replaces REST inter-service calls
	CoreGRPCAddr        string
	LeaderboardGRPCAddr string
	InternalAPIKey      string
	HostWorkspacesRoot  string
}

func Load() Config {
	return Config{
		Port:                getEnv("PORT", "3003"),
		RabbitMQURL:         getEnv("RABBITMQ_URL", "amqp://codewarz:codewarz@localhost:5672"),
		CoreServiceURL:      getEnv("CORE_SERVICE_URL", "http://localhost:3001"),
		CoreGRPCAddr:        getEnv("CORE_GRPC_ADDR", "localhost:50051"),
		LeaderboardGRPCAddr: getEnv("LEADERBOARD_GRPC_ADDR", "localhost:50052"),
		InternalAPIKey:      getEnv("INTERNAL_API_KEY", "INTERNAL_KEY"),
		HostWorkspacesRoot:  getEnv("HOST_WORKSPACES_ROOT", ""),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
