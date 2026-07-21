---
name: troubleshooting-tmpfs-issues
description: Guide to troubleshooting tmpfs mount issues in this pi coding agent environment, including copy-up behavior, package persistence, and user namespace configuration problems.
---

# Troubleshooting Tmpfs Issues

## Overview

This skill provides guidance on troubleshooting specific issues related to tmpfs mounts in this pi coding agent environment, particularly those involving copy-up behavior, package persistence, and user namespace configuration.

## Common Tmpfs Issues and Solutions

### 1. Build-Time Packages Seem to Disappear

**Problem**: Packages installed during the container build process appear to be missing when the container runs.

**Root Cause**: 
- Using Docker instead of Podman (Docker doesn't perform tmpfs copy-up)
- Files are in hidden directories (use `ls -la` to see them)
- Runtime changes are ephemeral (tmpfs is memory-based)

**Solution**:
1. Ensure you're using Podman via the `pi-launch` script
2. Check for hidden files with `ls -la`
3. Install packages during build time, not runtime
4. Verify tmpfs mount configuration in `pi-launch`

### 2. Tmpfs Copy-Up Not Working

**Problem**: Build-time content is not being copied to the tmpfs mount.

**Root Cause**:
- Incorrect mount configuration
- Permission issues with user namespace mapping
- Podman version compatibility issues

**Solution**:
1. Verify the mount uses `-v /home/pi:O` (ephemeral overlay) instead of `--tmpfs /home/pi:U`
2. Check user namespace configuration (`--userns=keep-id:uid=1000,gid=1000`)
3. Ensure Podman version supports the required features

### 3. Permission Denied with Tmpfs

**Problem**: Getting permission errors when accessing files in tmpfs-mounted directories.

**Root Cause**:
- User namespace mapping issues
- Incorrect file ownership after copy-up
- SELinux context problems

**Solution**:
1. Verify `--userns=keep-id` flag is correctly configured
2. Check file permissions with `ls -la`
3. Ensure SELinux labels (`:Z`) are applied to volume mounts

### 4. Runtime Changes Not Persisting

**Problem**: Changes made to files during container runtime are lost after container restart.

**Root Cause**: 
- Tmpfs is memory-based and ephemeral by design
- Expected persistent storage but using tmpfs

**Solution**:
1. Understand that tmpfs is intentionally ephemeral
2. Use volume mounts for persistent data
3. Install permanent changes during build time, not runtime

## Debugging Techniques

### Verifying Tmpfs Configuration
```bash
# Check current mounts
mount | grep tmpfs

# Verify overlay volume configuration
podman inspect container_name | grep -A 5 -B 5 "Mounts"
```

### Checking File Presence and Permissions
```bash
# List all files including hidden ones
ls -la /home/pi/

# Check specific package directories
ls -la /home/pi/.npm-global/lib/node_modules/

# Verify file ownership
ls -la /home/pi/.npm-global/bin/
```

### Testing Copy-Up Behavior
```bash
# Make a temporary change
echo "test" > /home/pi/test-file.txt

# Stop and restart container
# Check if file persists (it shouldn't with tmpfs)

# Check if build-time files are still present
ls -la /home/pi/.npm-global/bin/pi
```

## Environment-Specific Considerations

### Current Configuration
This environment uses:
- `-v /home/pi:O` for ephemeral overlay volume (not `--tmpfs`)
- `--userns=keep-id:uid=1000,gid=1000` for user namespace mapping
- SELinux labels (`:Z`) on volume mounts

### Why Overlay Volume Instead of Tmpfs
The current configuration uses an ephemeral overlay volume (`:O`) instead of standard tmpfs because:
1. It automatically handles copy-up of build-time content
2. It avoids permission issues with the `:U` flag in rootless containers
3. It provides the same ephemeral benefits as tmpfs

## Best Practices

1. **Always use `ls -la`** to see hidden files in tmpfs-mounted directories
2. **Verify mount configuration** in `pi-launch` script
3. **Install packages during build time** for persistence
4. **Use volume mounts with `:Z`** for SELinux compatibility
5. **Test changes incrementally** to isolate issues

## When to Seek Help

If you're experiencing tmpfs issues that:
- Persist after verifying the overlay volume configuration
- Involve complex user namespace permission problems
- Require changes to the container image build process

Consider reaching out for additional support or consulting the official Podman documentation on overlay volumes and tmpfs mounts.