package grpcclient

import (
	"context"
	"errors"
	"testing"
	"evaluation-service-go/pkg/logger"

	"github.com/sony/gobreaker"
	"google.golang.org/grpc"
)

// Helper function to reset the global circuit breaker for isolated tests
func init() {
	logger.Init()
}

func resetCircuitBreaker() {
	cb = gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "gRPC-Client-Test",
		MaxRequests: 3,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 3
		},
	})
}

func TestCircuitBreakerInterceptor_Success(t *testing.T) {
	resetCircuitBreaker()
	interceptor := traceAndCircuitBreakerInterceptor()
	invoker := func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, opts ...grpc.CallOption) error {
		return nil // Simulate a successful RPC
	}

	err := interceptor(context.Background(), "/test/Method", nil, nil, nil, invoker)
	if err != nil {
		t.Fatalf("expected no error on success, got %v", err)
	}

	if cb.State() != gobreaker.StateClosed {
		t.Fatalf("circuit breaker should remain closed on success, got state: %v", cb.State())
	}
}

func TestCircuitBreakerInterceptor_TripAndOpen(t *testing.T) {
	resetCircuitBreaker()
	interceptor := traceAndCircuitBreakerInterceptor()
	expectedErr := errors.New("rpc timeout or failure")
	
	invoker := func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, opts ...grpc.CallOption) error {
		return expectedErr // Simulate a failing RPC
	}

	// Trigger failures to trip the circuit (Threshold is 3 for this test)
	for i := 0; i < 3; i++ {
		err := interceptor(context.Background(), "/test/Method", nil, nil, nil, invoker)
		if err != expectedErr {
			t.Fatalf("expected underlying rpc error, got %v", err)
		}
	}

	// The circuit should now be OPEN. The next call should be rejected immediately.
	if cb.State() != gobreaker.StateOpen {
		t.Fatalf("circuit breaker should be open after consecutive failures, got state: %v", cb.State())
	}

	err := interceptor(context.Background(), "/test/Method", nil, nil, nil, invoker)
	if err != gobreaker.ErrOpenState {
		t.Fatalf("expected ErrOpenState from circuit breaker, got %v", err)
	}
}
