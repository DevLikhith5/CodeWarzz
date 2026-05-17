package sandbox

import (
	"fmt"
	"os"
	"path/filepath"
)

type Workspace struct {
	Dir string
}

func CreateWorkspace() (*Workspace, error) {
	dir, err := os.MkdirTemp("", "judge-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create workspace: %w", err)
	}
	return &Workspace{Dir: dir}, nil
}

func WriteFile(ws *Workspace, filename, content string) error {
	path := filepath.Join(ws.Dir, filename)
	return os.WriteFile(path, []byte(content), 0644)
}

func CleanupWorkspace(ws *Workspace) {
	if ws.Dir != "" {
		os.RemoveAll(ws.Dir)
	}
}
