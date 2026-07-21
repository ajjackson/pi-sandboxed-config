# justfile for pi-sandboxed-config

# List all available tasks (default when running 'just' with no arguments)
default:
    @just --list

# Build the Podman container image
build:
    podman build -t pi-sandbox -f Containerfile .

# Install the launcher script, configure local paths, and create default environment templates
install default_credentials_path="":
    #!/usr/bin/env bash
    set -euo pipefail
    
    REPO_PATH="$(pwd)"
    CONFIG_DIR="$HOME/.config/pi-launcher"
    BIN_DIR="$HOME/.local/bin"
    
    echo "=========================================================="
    echo "Installing Pi-Sandbox Launcher..."
    echo "=========================================================="
    
    # Create configuration and bin directories
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$BIN_DIR"
    
    # Resolve GCP Credentials
    GCP_PATH="{{default_credentials_path}}"
    if [ -z "$GCP_PATH" ]; then
        if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
            GCP_PATH="$GOOGLE_APPLICATION_CREDENTIALS"
            echo "Using GOOGLE_APPLICATION_CREDENTIALS from host: $GCP_PATH"
        else
            GCP_PATH=""
            echo "Notice: No GCP service account JSON key specified."
            echo "You can set it later in $CONFIG_DIR/config.json"
        fi
    else
        GCP_PATH="$(realpath "$GCP_PATH")"
        echo "Resolved GCP credentials file path: $GCP_PATH"
    fi
    
    # Write global configuration file config.json
    printf '{\n  "repo_path": "%s",\n  "default_credentials_json": "%s"\n}\n' "$REPO_PATH" "$GCP_PATH" > "$CONFIG_DIR/config.json"
    echo "Wrote configuration to $CONFIG_DIR/config.json"
    
    # Copy template environment variable file if it doesn't exist
    if [ ! -f "$CONFIG_DIR/.env" ]; then
        cp dotenv.example "$CONFIG_DIR/.env"
        echo "Created user environment file template: $CONFIG_DIR/.env"
        echo "Please open this file and configure your GOOGLE_CLOUD_PROJECT ID."
    else
        echo "User environment file already exists, skipping: $CONFIG_DIR/.env"
    fi
    
    # Copy the python script to local bin and make executable
    cp pi-launch "$BIN_DIR/pi-launch"
    chmod +x "$BIN_DIR/pi-launch"
    echo "Installed pi-launch script to $BIN_DIR/pi-launch"
    
    echo "----------------------------------------------------------"
    echo "Setup complete!"
    echo "Make sure $BIN_DIR is in your system PATH."
    echo "You can run 'pi-launch -p <project-path>' to spawn a sandbox."
    echo "=========================================================="

# Spawn a root shell inside a running container to inspect or configure dependencies
root container_name:
    podman exec -u root -it {{container_name}} bash

# Install system software packages using apt-get in a running container as root
root-install container_name package_name:
    podman exec -u root -it {{container_name}} bash -c "apt-get update && apt-get install -y {{package_name}}"

# Safely remove a Git worktree directory on the host and prune Git's references
clean-worktree project_dir:
    #!/usr/bin/env bash
    set -euo pipefail
    DIR="{{project_dir}}"
    if [ -d "$DIR" ]; then
        echo "Removing worktree directory: $DIR"
        rm -rf "$DIR"
        git worktree prune
        echo "Worktree pruned successfully!"
    else
        echo "Error: Directory '$DIR' does not exist."
        exit 1
    fi
