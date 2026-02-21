package handler

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/protean/vfs-server/internal/fsops"
	"github.com/protean/vfs-server/internal/middleware"
)

type renameRequest struct {
	Path    string `json:"path"`
	NewName string `json:"newName"`
}

func Rename(workspaceBase string, locker *fsops.UserLocker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		root := filepath.Join(workspaceBase, userID)

		var req renameRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			fsops.WriteError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
			return
		}

		newName := strings.TrimSpace(req.NewName)
		if newName == "" || strings.Contains(newName, "/") || strings.Contains(newName, "\\") {
			fsops.WriteError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid new name")
			return
		}

		resolved, err := fsops.ResolveWithinRoot(root, req.Path)
		if err != nil {
			fsops.WriteError(w, http.StatusForbidden, "PATH_TRAVERSAL", err.Error())
			return
		}

		newPath := filepath.Join(filepath.Dir(resolved), newName)
		// Verify new path is still within root
		if _, err := fsops.ResolveWithinRoot(root, newPath[len(root):]); err != nil {
			fsops.WriteError(w, http.StatusForbidden, "PATH_TRAVERSAL", err.Error())
			return
		}

		locker.Lock(userID)
		defer locker.Unlock(userID)

		if err := os.Rename(resolved, newPath); err != nil {
			if os.IsNotExist(err) {
				fsops.WriteError(w, http.StatusNotFound, "NOT_FOUND", "file or directory not found")
				return
			}
			fsops.WriteError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
			return
		}

		fsops.WriteJSON(w, http.StatusOK, map[string]interface{}{
			"renamed": true,
		})
	}
}
