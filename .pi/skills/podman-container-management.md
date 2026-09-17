---
name: podman-container-management
description: Podman sandbox architecture, tmpfs copy-up behavior, user namespaces, and troubleshooting.
---

# Podman Container Management & Sandbox Architecture

## Sandbox Storage Architecture

1. **`/workspace` (Persistent Host Worktree)**:
   - Volume-mounted with shared SELinux label (`-v <host_path>:/workspace:rw,z`).
   - Changes survive container restarts and persist directly on the host repository.

2. **`/home/pi` (In-Memory Transient `tmpfs`)**:
   - Mounted as `--tmpfs /home/pi:U`.
   - **Default Copy-Up Behavior**: Podman automatically copies build-time files from the image layer into the tmpfs mount at container startup. This allows globally installed tools (under `/home/pi/.npm-global/`) and configurations (`/home/pi/.pi/agent/`) to exist in userspace.
   - **Ephemeral Runtime**: Any files created, installed, or modified in `/home/pi` *during container execution* are stored only in RAM and are lost when the container exits.

3. **User Namespace & Permissions**:
   - Runs with `--userns=keep-id:uid=1000,gid=1000` to map host user UID/GID to container `pi` user (UID 1000).
   - Provides identical file ownership between container and host worktree without requiring root.

4. **Git Metadata & Worktree Architecture**:
   - **Read-Only Mounting (`:ro,z`)**: `pi-launch` resolves and mounts Git metadata directories read-only. For standard repos, `.git` is mounted read-only over `/workspace`. For detached worktrees, both the worktree gitdir (`.git/worktrees/<name>`) and common gitdir (`.git`) are mounted read-only at their host paths.
   - **Worktree Pointers**: In a worktree, `/workspace/.git` is a single-line pointer (`gitdir: /host/path/...`). The live state is stored in `<worktree_gitdir>/HEAD`, which contains `ref: refs/heads/<branch>` (on branches) or the raw 40-character commit hash (detached worktrees).
   - **Write Protection**: Any write operation (`git commit`, `git add`, `git tag`) fails with `Read-only file system` at the Linux VFS kernel level.
   - **Live Footer Updates**: The container extension `container-info` watches `<worktree_gitdir>/HEAD` via `fs.watch`. When the user commits on the host, `HEAD` updates atomically, triggering an immediate TUI redraw with the new 8-character commit hash.

---

## Troubleshooting Sandbox & Tmpfs Issues

### 1. Build-Time Packages Missing at Runtime
* **Cause**: Global packages installed in hidden paths, or image was not rebuilt.
* **Diagnosis**: Run `ls -la /home/pi/.npm-global/lib/node_modules/` to verify build-time packages.
* **Fix**: Ensure package installation runs during `Containerfile` build as the `pi` user, then run `just build` on the host.

### 2. Runtime Changes Not Persisting Across Sessions
* **Cause**: Packages or configurations were written to `/home/pi` instead of `/workspace` or `Containerfile`.
* **Fix**:
  - For project-specific dependencies: Use `uv` or `npm` inside `/workspace` (e.g. `uv add <pkg>`).
  - For sandbox-wide dependencies: Add them to `Containerfile` and rebuild (`just build`).

### 3. Root Package Installation (`sudo` / `apt-get` Fails)
* **Cause**: Sandbox runs as unprivileged user `pi` without `sudo`.
* **Fix**: Instruct the user to run the root installation helper on their host terminal:
  ```bash
  just root-install <container-name> <package-name>
  ```
  Or access a root shell from the host with `just root <container-name>`.

### 4. Git Write Operations Inside Container Fail (`Read-only file system`)
* **Behavior**: Git metadata is intentionally mounted read-only (`:ro,z`) for security so the container cannot tamper with git history, commit, or push.
* **Fix**: Inspection commands (`git status`, `git diff`, `git log`, `git rev-parse`) work inside the container. Direct the user to review, commit, and push from their host terminal outside the container.

### 5. Nested Podman Errors (`/dev/fuse: No such file or directory` or `mount proc: Operation not permitted`)
* **Cause**: Sandbox was launched without the nested container flags enabled.
* **Fix**: Exit the sandbox and relaunch from the host terminal with `pi-launch -C` (or `pi-launch --nested-containers`). This passes `--device /dev/fuse` and `--security-opt unmask=/proc/*` into the sandbox.
