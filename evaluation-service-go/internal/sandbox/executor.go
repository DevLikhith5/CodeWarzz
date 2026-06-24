package sandbox

import (
	"fmt"
	"os/exec"
	"path/filepath"

	"evaluation-service-go/pkg/logger"
)

func Compile(ws *Workspace, lang LanguageConfig, hostWorkspacesRoot string) error {
	if lang.CompileCommand == "" {
		return nil
	}

	volumePath := resolveVolumePath(ws.Dir, hostWorkspacesRoot)

	cmd := fmt.Sprintf("docker run --rm --network none --security-opt seccomp=default --security-opt no-new-privileges:true --read-only --tmpfs /tmp:size=64m -v %s:/app -w /app %s %s",
		volumePath, lang.Image, lang.CompileCommand)

	logger.Debug("Compiling code", "command", cmd)

	output, err := exec.Command("sh", "-c", cmd).CombinedOutput()
	if err != nil {
		logger.Warn("Compilation failed", "stderr", string(output))
		return fmt.Errorf("compilation failed: %s", string(output))
	}

	logger.Debug("Compilation successful")
	return nil
}

func Execute(ws *Workspace, lang LanguageConfig, timeLimitMs, memoryLimitMb int, cpuLimit float64, hostWorkspacesRoot string) (string, error) {
	timeLimitSec := (timeLimitMs / 1000) + 2
	volumePath := resolveVolumePath(ws.Dir, hostWorkspacesRoot)

	cmd := fmt.Sprintf("docker run --rm --network none --memory %dm --cpus %.1f --pids-limit 64 --security-opt seccomp=default --security-opt no-new-privileges:true --read-only --tmpfs /tmp:size=64m -v %s:/app -w /app %s sh -c \"timeout %d %s < input.txt\"",
		memoryLimitMb, cpuLimit, volumePath, lang.Image, timeLimitSec, lang.RunCommand)

	logger.Debug("Executing code", "command", cmd)

	output, err := exec.Command("sh", "-c", cmd).CombinedOutput()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if exitErr.ExitCode() == 124 {
				return "", fmt.Errorf("TLE")
			}
			if exitErr.ExitCode() == 137 {
				return "", fmt.Errorf("MLE")
			}
		}
		return "", fmt.Errorf("RE: %s", string(output))
	}

	return string(output), nil
}

func resolveVolumePath(internalPath, hostWorkspacesRoot string) string {
	if hostWorkspacesRoot != "" {
		return filepath.Join(hostWorkspacesRoot, filepath.Base(internalPath))
	}
	return internalPath
}
