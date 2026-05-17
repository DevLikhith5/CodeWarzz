package main

import (
	"fmt"
	"net/http"

	"evaluation-service-go/internal/config"
	"evaluation-service-go/pkg/logger"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	logger.Init()
	cfg := config.Load()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"UP","service":"evaluation-service-go"}`))
	})

	mux.Handle("/metrics", promhttp.Handler())

	addr := fmt.Sprintf(":%s", cfg.Port)
	logger.Info("Go Evaluation Service API starting", "port", cfg.Port)

	if err := http.ListenAndServe(addr, mux); err != nil {
		logger.Error("Failed to start API server", "error", err)
	}
}
