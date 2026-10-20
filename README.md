# Pi Sandboxed Configuration

**This is mostly written by LLM agents. Hopefully it will give me a sane environment to do agentic coding. I don't promise that it is reasonable. As my configuration evolves, hopefully the writing style will also improve. Please don't take things in this repo as representative of my usual writing or coding style...**

A secure, sandboxed, and easily replicable configuration for the [`pi-coding-agent`](https://github.com/earendil-works/pi-mono/tree/main/packages/coding-agent). Designed to be kept in a public GitHub repository, this setup allows convenient, instant deployment on fresh x86/ARM Linux VMs/VPS instances as well as smooth sync-backs of custom extensions/skills to an ARM Mac laptop.

## Design Highlights

1. **Host-Workspace Isolation**: The agent runs inside a secure Podman container as a standard non-root user (`pi`), ensuring that it has no write-access to any directory outside the mounted workspace.
2. **Git Worktrees**: Each session checks out an isolated Git worktree of this configuration project at a workspace directory on the host. You can work with multiple workspaces simultaneously.
3. **No Private Keys Exposed**: The container does not have your Git or SSH keys. If the agent needs to check file diffs, it can do so locally inside the container, but you make commits and pushes safely from the host.
4. **Instant Key Refreshes**: Google Vertex credentials are bind-mounted read-only. When your credentials refresh on the host, the container sees the updated credentials in real-time.
5. **Persistent Workspace Sessions**: Sessions are written directly to `.pi/sessions/` within each workspace, ensuring your chat history persists across container restarts but is never leaked to your global home directory.
6. **Pre-installed Package Managers**: The environment includes `uv` and `pixi` pre-installed natively using multi-stage container builds. This empowers the agent to instantly create, solve, and test projects with their own complex Python/Conda dependencies.

---

## Directory Structure

This project uses the native `pi-coding-agent` structure which is automatically discovered when the workspace project is trusted:

```text
pi-sandboxed-config/
├── Containerfile         # Sandboxed environment builder
├── justfile              # Automation tasks (build, install, root commands)
├── pi-launch             # Python launcher CLI (argparse-based wrapper)
├── dotenv.example        # Env configuration template (GCP project, region)
├── README.md
└── .pi/                  # The native project configuration directory
    ├── settings.json     # Custom agent settings and model parameters
    ├── SYSTEM.md         # Custom preamble loaded on startup
    ├── prompts/          # Put your custom prompts (*.md) here
    ├── skills/           # Put your custom skills (directories or *.md) here
    └── extensions/       # Put your custom TypeScript/JS extensions here
```

### Why we use `.pi/` instead of `pi-config/` (Complexity Trade-off)
While dot-folders are hidden by default under normal shell commands (like `ls`), `pi-coding-agent` natively auto-discovers settings, prompts, skills, and extensions from a project's `.pi/` directory. 
By maintaining this standard directory layout, **zero manual configuration or mapping is required**, and the agent loads your preambles, custom prompt templates, skills, and TypeScript extensions natively out of the box.

---

## Installation

### 1. Prerequisites
Ensure you have the following installed on your host system:
* [Podman](https://podman.io/) (used for secure container execution)
* [Just](https://github.com/casey/just) (command runner)
* Python 3

#### Apple Silicon Mac Configuration (Recommended)
Starting in Podman 5.6+, Podman on macOS defaults to the `libkrun` provider and disables Rosetta (`rosetta = false`). If you plan to build or run `amd64` containers under near-native emulation using Rosetta, configure Podman **before** initializing your machine:

1. Ensure Rosetta 2 is installed on your Mac:
   ```bash
   softwareupdate --install-rosetta --agree-to-license
   ```
2. Create or edit `~/.config/containers/containers.conf`:
   ```toml
   [machine]
   provider = "applehv"
   rosetta = true
   memory = 8192      # In MiB (8 GB; default 2048 MB is insufficient for heavy builds/uv)
   cpus = 4           # Recommended: 4 vCPUs
   ```
3. Initialize and start the machine:
   ```bash
   podman machine init
   podman machine start
   ```
*(Note: Podman will now automatically configure the Apple Virtualization Framework with Rosetta directory sharing enabled).*

### 2. Setup Configuration
Clone this repository to your machine, navigate to the folder, and install:

```bash
# Build the sandboxed Podman container image
just build

# Install the pi-launch script to ~/.local/bin and generate configurations
# Replace /path/to/credentials.json with your actual GCP service account JSON key file
just install /path/to/credentials.json
```

The installer will:
1. Copy the python script `pi-launch` to `~/.local/bin/pi-launch`.
2. Generate global configuration settings inside `~/.config/pi-launcher/config.json`.
3. Create a `.env` variable template at `~/.config/pi-launcher/.env`.

Ensure that `~/.local/bin` is in your system `PATH`.

### 3. Add Google Vertex Settings
Open your global config env file:
```bash
nano ~/.config/pi-launcher/.env
```
Fill in your Google Cloud Project ID and Region:
```bash
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```

---

### Support for Anthropic Claude Models on Google Vertex AI

Our sandboxed environment includes pre-baked, first-class support for running Anthropic Claude models on Google Vertex AI via the popular [`@twogiants/pi-anthropic-vertex`](https://github.com/twoGiants/pi-anthropic-vertex) extension!

No complex TypeScript code copying or repository bloat is needed. The extension is installed globally when the container is built and loaded instantly on startup using a simple 2-line wrapper shim (`.pi/extensions/anthropic-vertex.ts`).

#### 1. Authenticate & Configure Google Vertex
Make sure your Google Vertex API is enabled and that you have configured your environment in `~/.config/pi-launcher/.env`:
```bash
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
# Region where Claude models are enabled in your Vertex AI Model Garden (e.g., us-east5 or us-central1)
GOOGLE_CLOUD_LOCATION=us-central1
```

#### 2. Set Default Model and Provider
To make Anthropic Claude your default model, open `.pi/settings.json` and update the defaults:
```json
{
  "sessionDir": ".pi/sessions",
  "defaultProvider": "anthropic-vertex",
  "defaultModel": "claude-sonnet-4-6",
  "defaultThinkingLevel": "medium"
}
```

#### 3. Usage
You can run any Anthropic Claude models on Google Vertex AI. To check the list of available Vertex models:
```bash
pi-launch -- --list-models anthropic-vertex
```

Or start a session directly specifying the model:
```bash
pi-launch -- --provider anthropic-vertex --model claude-sonnet-4-6
```

---

## Usage

To start a new sandboxed agent session, run `pi-launch` with the path to the writeable workspace. 

```bash
# Start in the current directory (defaults to current directory if -p is omitted)
pi-launch

# Or start in a specific folder path (creates a worktree if not already present)
pi-launch -p ~/projects/my-new-task
```

### Options:
* `-p`, `--project-dir`: The path to the writeable workspace. Defaults to the current working directory.
* `-a`, `--amd64`: Launch using the amd64 container image (`pi-sandbox:amd64`) under Rosetta emulation on Apple Silicon.
* `-r`, `--resume`: Direct first-class flag to resume a previous Pi session inside this workspace.
* `-C`, `--nested-containers`, `--podman`: Enable nested rootless Podman inside the sandbox (mounts `/dev/fuse` and unmasks `/proc`) for running containerized unit tests.
* `-n`, `--name`: Custom container name. Defaults to `pi-{project_name}` (or `pi-{project_name}-amd64` when using `-a`), auto-incrementing (`-2`, `-3`) if already running.
* `-i`, `--inspect`: Path to a read-only directory on the host to mount under `/inspect/<basename>` inside the sandbox (can be specified multiple times).
* `-c`, `--gcp-creds`: Override path to Google Vertex credentials JSON.

### What happens behind the scenes:
1. `pi-launch` checks if your selected directory exists. If not, it creates it.
2. If the directory is empty, it runs `git worktree add --detach <path> HEAD` on the host to check out a clean copy of your config repo.
3. It spawns the Podman sandbox, mounting the workspace to `/workspace` and your Google key read-only.
4. It passes `--approve` to Pi, making it automatically trust the workspace and load the custom preambles, custom prompt commands, extensions, and skills from `.pi/`.
5. Any additional arguments you pass to `pi-launch` (such as `pi-launch -- --offline`) are forwarded directly to Pi.

---

## Advanced Workflows

### Running amd64 Containers on ARM Mac (Rosetta Emulation)
When working with software or binary dependencies only available for x86-64 / amd64 on Apple Silicon Macs, you can build and run an amd64 container using Podman and Rosetta:

1. **Build the amd64 container image**:
   ```bash
   just build-amd64
   ```
2. **Launch with the `-a` / `--amd64` flag**:
   ```bash
   pi-launch -a
   # or in a specific directory:
   pi-launch -a -p ~/projects/my-x86-work
   ```
   The container will automatically be named `pi-{project_name}-amd64` to prevent naming collisions with native ARM containers running against the same workspace.

3. **Verifying and Troubleshooting Rosetta**:
   Verify Rosetta is active on your Podman machine:
   ```bash
   # Check configuration (should return 'true')
   podman machine inspect --format '{{.Rosetta}}'

   # Verify active kernel binfmt registration inside the VM
   podman machine ssh "test -f /proc/sys/fs/binfmt_misc/rosetta && echo 'Rosetta active' || echo 'Falling back to QEMU'"
   ```

   **Enabling Rosetta on an Existing Podman Machine**:
   Whether you can enable Rosetta in-place without image loss depends on your existing machine's provider:

   * **Case A: Existing machine was created with `applehv`** (e.g. via older Podman or `--provider applehv`):
     You can enable Rosetta **in-place without losing images**. `podman machine start` dynamically checks `containers.conf` on boot and configures the hypervisor:
     1. Add to `~/.config/containers/containers.conf`:
        ```toml
        [machine]
        provider = "applehv"
        rosetta = true
        memory = 8192
        cpus = 4
        ```
     2. Restart the machine:
        ```bash
        podman machine stop
        podman machine start
        ```
     3. If `inspect` returns `true` but the kernel test still reports QEMU fallback, create the trigger file inside the VM and restart:
        ```bash
        podman machine ssh "sudo touch /etc/containers/enable-rosetta"
        podman machine stop && podman machine start
        ```

   * **Case B: Existing machine was created with `libkrun`** (Podman 5.6+ / 6 default):
     Podman cannot change an existing VM's hypervisor provider in-place. You must recreate the machine (note that this deletes any existing local images):
     1. Add the `containers.conf` file as shown above. (Once set in `containers.conf`, no `--provider` CLI argument is needed on init).
     2. Recreate the machine:
        ```bash
        podman machine stop
        podman machine rm
        podman machine init
        podman machine start
        ```

### Spawning a Root Shell to Install Dependencies
By default, the agent runs as the standard non-root `pi` user, which prevents it from writing to system files. 

If the agent needs a system dependency (like `curl` or a global npm package), **you** can install it on the fly from another host terminal window:

```bash
# Get a root terminal inside the running container (replace with your active container name)
just root pi-my-new-task

# Or directly install a package from the host:
just root-install pi-my-new-task python3-pip
```

### Running Containerized Tests (Nested Podman)
If your project test suite runs containers (e.g. testcontainers, isolated database fixtures, or Docker-based CI steps), launch the sandbox with `-C`:

```bash
pi-launch -C
# or: pi-launch -p ~/projects/my-task -C
```

Inside the sandbox, the agent can run rootless Podman commands directly:
```bash
podman run --rm alpine uname -a
```

### Merging Customizations Back into GitHub
If you ask the agent to help you design a new **skill** or **prompt template** inside a sandbox, it can write those files directly into `/workspace/.pi/skills/` or `/workspace/.pi/prompts/`.

Since your workspace is a standard Git worktree, you can easily review and commit these files from your host terminal:
```bash
cd ~/projects/my-new-task

# Inspect changes
git status

# Create a branch or cherry-pick changes to your main configuration repository
git checkout -b new-skill
git add .pi/skills/my-new-skill/
git commit -m "feat: add my new skill discovered during sandbox run"
```

### Cleaning Up Workspaces
To delete a workspace on the host when you are finished with it:
```bash
just clean-worktree ~/projects/my-new-task
```
This safely deletes the directory and prunes Git's internal references.

### Recovering a Closed or Killed Session
If your terminal is closed, your VPS reboots, or Podman is restarted, **none of your progress is lost**.

Since your session histories are persisted inside `/workspace/.pi/sessions/` (which maps back to your workspace on the host), you can easily resume exactly where you left off using the first-class `-r` parameter:

```bash
# Resume the last session in the current directory workspace:
pi-launch -r

# Or resume inside a specific workspace directory:
pi-launch -p ~/projects/my-new-task -r
```

1. Pi will display an interactive terminal list of your previous sessions in that workspace.
2. Select the session you want to restore and hit **Enter** to resume!

