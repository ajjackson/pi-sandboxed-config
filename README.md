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
* `-r`, `--resume`: Direct first-class flag to resume a previous Pi session inside this workspace.
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

### Spawning a Root Shell to Install Dependencies
By default, the agent runs as the standard non-root `pi` user, which prevents it from writing to system files. 

If the agent needs a system dependency (like `curl` or a global npm package), **you** can install it on the fly from another host terminal window:

```bash
# Get a root terminal inside the running container (replace with your active container name)
just root pi-my-new-task

# Or directly install a package from the host:
just root-install pi-my-new-task python3-pip
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

