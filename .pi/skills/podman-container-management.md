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

### 6. Nested Podman Namespace Errors (`newuidmap: write to uid_map failed: Operation not permitted`)
* **Cause**: Inside the container, `/etc/subuid` requests subordinate UIDs outside the range mapped into the outer container by the Linux host's rootless user namespace (typically limited to 65536 IDs).
* **Fix**: Ensure `/etc/subuid` and `/etc/subgid` in `Containerfile` are configured to allocate within the parent namespace (`pi:1001:64535`). If larger ranges are required, expand subordinate IDs on the host (`sudo usermod --add-subuids 100000-265535 $USER` and `podman system migrate`).

### 7. Slow Execution with `amd64` Containers on Apple Silicon
* **Cause**: Podman machine was initialized with Rosetta disabled. In Podman 5.6+ and Podman 6, the default provider changed to `libkrun` and Rosetta defaults to `false`, causing amd64 emulation to fall back to slow QEMU user-mode emulation.
* **Diagnosis**: Run `podman machine inspect --format '{{.Rosetta}}'` and verify VM kernel support with `podman machine ssh "test -f /proc/sys/fs/binfmt_misc/rosetta"`.
* **Important Warning**: Do **not** run `podman machine rm` unless necessary; removing the machine destroys the virtual disk and deletes all downloaded or built container images.
* **Fix**:
  * **If existing machine uses `applehv` (In-Place, No Image Loss)**:
    1. `podman machine start` dynamically reads `containers.conf` on boot. Add to `~/.config/containers/containers.conf` on the Mac host:
       ```toml
       [machine]
       provider = "applehv"
       rosetta = true
       memory = 8192
       cpus = 4
       ```
    2. Restart the machine: `podman machine stop && podman machine start`.
    3. If `inspect` returns `true` but the kernel test still reports QEMU fallback, run `podman machine ssh "sudo touch /etc/containers/enable-rosetta"` and restart again.
  * **If existing machine uses `libkrun` (Podman 5.6+/6 default)**:
    Provider cannot be changed in-place. Create the `containers.conf` file as above, then recreate the machine (this deletes local container images):
    `podman machine stop && podman machine rm && podman machine init && podman machine start`. (No CLI flags needed on init once `containers.conf` is configured).

### 8. Out of Memory (OOM) / Process Killed During Builds or Dependency Resolution
* **Cause**: Podman machines on macOS default to only 2048 MB (2.0 GiB) of RAM and no swap. Concurrently resolving or downloading large packages (e.g., PyTorch/CUDA wheels via `uv`) or compiling packages causes the Linux kernel inside the VM to OOM-kill processes.
* **Fix for Existing Machine (In-Place, No Image Loss)**:
  Run from the host macOS terminal:
  ```bash
  podman machine stop
  podman machine set --memory 8192 --cpus 4
  podman machine start
  ```
* **Persistent Default for New Machines**:
  Set `memory = 8192` (in MiB) and `cpus = 4` under `[machine]` in `~/.config/containers/containers.conf`.
