package config

import (
	"os"
)

type Config struct {
	Port               string
	RabbitMQURL        string
	CoreServiceURL     string
	InternalAPIKey     string
	HostWorkspacesRoot string
}

func Load() Config {
	return Config{
		Port:               getEnv("PORT", "3003"),
		RabbitMQURL:        getEnv("RABBITMQ_URL", "amqp://codewarz:codewarz@localhost:5672"),
		CoreServiceURL:     getEnv("CORE_SERVICE_URL", "http://localhost:3001"),
		InternalAPIKey:     getEnv("INTERNAL_API_KEY", "INTERNAL_KEY"),
		HostWorkspacesRoot: getEnv("HOST_WORKSPACES_ROOT", ""),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
