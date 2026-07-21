---
name: podman-container-management
description: Guide to using Podman for container management, with detailed coverage of tmpfs mounts and their default copy-up behavior that preserves build-time content, as well as user namespaces.
---

# Podman Container Management Skill

## Overview

Podman is a daemonless container engine used in this environment. It's configured with specific tmpfs mounts and user namespace settings for security and performance.

## Key Concepts

### Tmpfs Mounts
In this environment, Podman uses tmpfs mounts for:
- `/tmp` - Temporary files
- `/home/pi` - User directory (mounted with `:U` flag for user namespace mapping)

These mounts provide:
- Faster I/O operations (RAM vs disk)
- Automatic cleanup on container stop
- Enhanced security (no persistent storage for temporary data)

**Important Copy-Up Behavior**: Podman's `--tmpfs` mounts perform copy-up operations by default, including when using the `:U` flag. This means the initial contents of the directory from the container image are automatically copied into the tmpfs mount at container startup. This is crucial because it allows build-time installed packages and configurations to persist in what would otherwise be an empty tmpfs. However, any changes made during container runtime are lost when the container stops, as tmpfs is memory-based.

The `:U` flag (equivalent to `chown=true`) sets the UID and GID of the tmpfs filesystem to match the container's user, ensuring proper ownership of the copied files. This behavior can be confusing because one might expect a tmpfs mount to completely overwrite directory contents, but Podman's default implementation preserves the existing content through copy-up.

To disable this behavior and mount a completely empty tmpfs, you would need to explicitly use the `notmpcopyup` option.

### Common Tmpfs Pitfalls and Misconceptions

1. **Assuming Complete Overwrite**: Many developers expect tmpfs mounts to completely overwrite directory contents, but the default copy-up behavior preserves build-time content.

2. **Confusing :U Flag**: The `:U` flag is often misunderstood as simply setting ownership, but in Podman it also enables the copy-up mechanism.

3. **Docker vs Podman Differences**: Docker's tmpfs implementation does not perform copy-up by default, which can cause confusion when moving between container engines.

4. **Hidden Files**: Global packages are often installed in hidden directories (like `.npm-global`). When shelling into the container, use `ls -la` to see these hidden files.

5. **Runtime Changes Are Ephemeral**: Any changes made to files in a tmpfs mount during container runtime are lost when the container stops.

### User Namespace Configuration
Podman is configured with rootless containers by default using:
- `--userns=keep-id` flag in `pi-launch` to maintain consistent UIDs
- User namespace mapping to prevent privilege escalation

## Common Podman Commands

### Building Images
```bash
# Build an image from Containerfile
podman build -t my-image .

# Build with specific context
podman build -t my-image -f Containerfile .
```

### Running Containers
```bash
# Run a basic container
podman run -it ubuntu:latest /bin/bash

# Run with tmpfs mount
podman run --tmpfs /tmp:rw,noexec,nosuid,size=100m my-image

# Run with user namespace
podman run --userns=keep-id my-image
```

### Managing Containers
```bash
# List running containers
podman ps

# List all containers
podman ps -a

# Stop a container
podman stop container_name

# Remove a container
podman rm container_name

# View container logs
podman logs container_name
```

### Executing Commands
```bash
# Execute command in running container
podman exec -it container_name /bin/bash

# Execute single command
podman exec container_name ls -la
```

### Inspecting Resources
```bash
# Inspect container details
podman inspect container_name

# View resource usage
podman stats container_name

# List images
podman images
```

## Environment-Specific Configuration

This environment uses specific Podman configurations:

1. **pi-launch script** handles container startup with:
   - `--tmpfs /home/pi:U` for user namespace mapping
   - `--userns=keep-id:uid=1000,gid=1000` for consistent UID/GID
   - Volume mounts for workspace and credentials

2. **Security Features**:
   - SELinux labels (`:Z`) on volume mounts
   - Rootless container execution
   - User namespace isolation

## Debugging Copy-Up Issues

When troubleshooting copy-up behavior:

1. **Check Mount Configuration**: Verify the exact tmpfs mount options in your container startup script
2. **Verify File Presence**: Use `ls -la` to check if build-time files are present in the mounted directory
3. **Test Runtime Changes**: Make a temporary change to a file and restart the container to confirm ephemeral nature
4. **Check Podman Version**: Different versions may have slightly different copy-up behaviors

## Best Practices

1. Always use `--rm` for temporary containers to avoid accumulation
2. Use specific tags for images rather than `latest`
3. Limit resource usage with `--memory` and `--cpus` flags
4. Use volume mounts with `:Z` flag for SELinux compatibility
5. Prefer rootless containers for security

## Troubleshooting

1. **Permission Issues**: Check user namespace mapping and volume mount labels
2. **Network Problems**: Verify port mappings and network mode
3. **Resource Constraints**: Monitor with `podman stats` and adjust limits
4. **Image Pull Failures**: Check registry configuration and network access

## References

- Podman Documentation: https://docs.podman.io/
- Rootless Podman Guide: https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
- Podman Troubleshooting: https://github.com/containers/podman/blob/main/troubleshooting.md