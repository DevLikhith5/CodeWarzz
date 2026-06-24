package logger

import (
	"fmt"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Log *zap.SugaredLogger

func Init() error {
	config := zap.NewProductionConfig()
	config.Level = zap.NewAtomicLevelAt(zapcore.InfoLevel)
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	logger, err := config.Build()
	if err != nil {
		return fmt.Errorf("failed to build logger: %w", err)
	}
	Log = logger.Sugar()
	return nil
}

func Info(msg string, keysAndValues ...interface{}) {
	Log.Infow(msg, keysAndValues...)
}

func Error(msg string, keysAndValues ...interface{}) {
	Log.Errorw(msg, keysAndValues...)
}

func Warn(msg string, keysAndValues ...interface{}) {
	Log.Warnw(msg, keysAndValues...)
}

func Debug(msg string, keysAndValues ...interface{}) {
	Log.Debugw(msg, keysAndValues...)
}
