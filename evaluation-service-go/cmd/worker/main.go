package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"evaluation-service-go/internal/config"
	"evaluation-service-go/internal/queue"
	"evaluation-service-go/pkg/logger"
)

func main() {
	logger.Init()
	cfg := config.Load()

	logger.Info("Starting Go Evaluation Service Worker",
		"rabbitmq", cfg.RabbitMQURL,
		"core_service", cfg.CoreServiceURL,
	)

	consumer, err := queue.NewConsumer(
		cfg.RabbitMQURL,
		cfg.CoreServiceURL,
		cfg.InternalAPIKey,
		cfg.HostWorkspacesRoot,
	)
	if err != nil {
		log.Fatalf("Failed to create consumer: %v", err)
	}
	defer consumer.Close()

	if err := consumer.StartSubmissionConsumer(); err != nil {
		log.Fatalf("Failed to start consumer: %v", err)
	}

	logger.Info("Go Evaluation Service Worker is running")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	logger.Info("Shutting down Go Evaluation Service Worker")
}
