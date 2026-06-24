package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"evaluation-service-go/internal/config"
	"evaluation-service-go/internal/queue"
	"evaluation-service-go/pkg/logger"
	"evaluation-service-go/pkg/safego"
)

func main() {
	if err := logger.Init(); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	cfg := config.Load()

	logger.Info("Starting Go Evaluation Service Worker",
		"rabbitmq", cfg.RabbitMQURL,
		"core_grpc", cfg.CoreGRPCAddr,
		"leaderboard_grpc", cfg.LeaderboardGRPCAddr,
	)

	consumer, err := queue.NewConsumer(
		cfg.RabbitMQURL,
		cfg.CoreGRPCAddr,
		cfg.LeaderboardGRPCAddr,
		cfg.HostWorkspacesRoot,
		cfg.RedisURL,
	)
	if err != nil {
		log.Fatalf("Failed to create consumer: %v", err)
	}

	if err := consumer.StartSubmissionConsumer(); err != nil {
		log.Fatalf("Failed to start consumer: %v", err)
	}

	logger.Info("Go Evaluation Service Worker is running (gRPC mode)")

	// Graceful shutdown: wait for SIGINT/SIGTERM, then drain workers
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigChan

	logger.Info("Received signal, draining workers", "signal", sig.String())

	// Stop accepting new messages; workerWG inside consumer ensures in-flight
	// messages are processed (or requeued) before closing. The shutdown
	// goroutine is wrapped in safego so a panic during Close (e.g. double
	// close of a channel) cannot deadlock the shutdown sequence.
	done := make(chan struct{})
	safego.Go("consumer-shutdown", func() {
		defer close(done)
		consumer.Close()
	})

	select {
	case <-done:
		logger.Info("Clean shutdown complete")
	case <-time.After(30 * time.Second):
		logger.Warn("Shutdown timed out after 30s, forcing exit")
		os.Exit(1)
	}

	_ = context.Background()
}
