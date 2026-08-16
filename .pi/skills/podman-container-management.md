---
name: podman-container-management
description: Podman sandbox architecture, tmpfs copy-up behavior, user namespaces, and troubleshooting.
---

# Podman Container Management & Sandbox Architecture

## Sandbox Storage Architecture

1. **`/workspace` (Persistent Host Worktree)**:
   - Volume-mounted with SELinux label (`-v <host_path>:/workspace:rw,Z`).
   - Changes survive container restarts and persist directly on the host repository.

2. **`/home/pi` (In-Memory Transient `tmpfs`)**:
   - Mounted as `--tmpfs /home/pi:U`.
   - **Default Copy-Up Behavior**: Podman automatically copies build-time files from the image layer into the tmpfs mount at container startup. This allows globally installed tools (under `/home/pi/.npm-global/`) and configurations (`/home/pi/.pi/agent/`) to exist in userspace.
   - **Ephemeral Runtime**: Any files created, installed, or modified in `/home/pi` *during container execution* are stored only in RAM and are lost when the container exits.

3. **User Namespace & Permissions**:
   - Runs with `--userns=keep-id:uid=1000,gid=1000` to map host user UID/GID to container `pi` user (UID 1000).
   - Provides identical file ownership between container and host worktree without requiring root.

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

### 4. Git Commands Inside Container Fail (`fatal: not a git repository`)
* **Cause**: `/workspace/.git` is a git link pointing to the host's `.git` storage, which is intentionally unmounted for security.
* **Fix**: Direct the user to review, commit, and push from their host terminal outside the container.
