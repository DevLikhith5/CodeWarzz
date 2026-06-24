package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port                string
	RabbitMQURL         string
	CoreServiceURL      string
	CoreGRPCAddr        string
	LeaderboardGRPCAddr string
	InternalAPIKey      string
	HostWorkspacesRoot  string
	RedisURL            string
}

func Load() Config {
	cfg := Config{
		Port:                getEnv("PORT", "3003"),
		RabbitMQURL:         getEnv("RABBITMQ_URL", "amqp://codewarz:codewarz@localhost:5672"),
		CoreServiceURL:      getEnv("CORE_SERVICE_URL", "http://localhost:3001"),
		CoreGRPCAddr:        getEnv("CORE_GRPC_ADDR", "localhost:50051"),
		LeaderboardGRPCAddr: getEnv("LEADERBOARD_GRPC_ADDR", "localhost:50052"),
		InternalAPIKey:      mustGetEnv("INTERNAL_API_KEY"),
		HostWorkspacesRoot:  getEnv("HOST_WORKSPACES_ROOT", ""),
		RedisURL:            getEnv("REDIS_URL", "redis://localhost:6379"),
	}

	if len(cfg.InternalAPIKey) < 16 {
		panic(fmt.Errorf("INTERNAL_API_KEY must be set to a 16+ char secret"))
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func mustGetEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic(fmt.Errorf("%s environment variable must be set", key))
	}
	return value
}
