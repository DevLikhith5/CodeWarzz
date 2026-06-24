// Package safego provides helpers for running goroutines with panic
// recovery, so a single bad message or downstream call cannot kill the
// entire worker pool.
package safego

import (
	"fmt"
	"runtime/debug"

	"evaluation-service-go/pkg/logger"
)

// Go runs fn in a new goroutine. If fn panics, the panic is caught,
// logged with the full stack trace, and the goroutine exits cleanly
// without taking the whole process down.
func Go(name string, fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Recovered from panic in goroutine",
					"name", name,
					"panic", fmt.Sprintf("%v", r),
					"stack", string(debug.Stack()),
				)
			}
		}()
		fn()
	}()
}

// Wrap returns a function that, when called, executes fn under a deferred
// recover. Use this to wrap existing functions (e.g. message handlers)
// without changing their signature.
func Wrap(name string, fn func()) func() {
	return func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Recovered from panic",
					"name", name,
					"panic", fmt.Sprintf("%v", r),
					"stack", string(debug.Stack()),
				)
			}
		}()
		fn()
	}
}
