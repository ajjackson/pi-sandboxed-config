# Agent Guidelines & Sandbox Operational Rules (AGENTS.md)

This file contains critical context about your runtime environment, persistence rules, and tool constraints. Read and follow these guidelines to ensure successful execution.

---

## PART 1: Operating in this Sandbox (FOR ALL SESSIONS)
*Every session running inside this container must adhere to these environmental rules, regardless of the target task.*

### 1. Storage & Persistence (`/workspace` vs. `/home/pi`)
* **`/workspace` (Persistent)**: This is a persistent volume mount mapped directly to the host's project directory. All files created, modified, or deleted here survive container restarts, session resumes, and host reboots.
* **`/home/pi` (Transient `tmpfs`)**: This directory is mounted as a transient in-memory filesystem (`--tmpfs /home/pi:U`). 
  * *Trap*: Any files or packages written to `/home/pi` (such as global npm packages via `npm install -g`, updates to `.bashrc`, `.profile`, or files under `/home/pi/.npm-global`) **are temporary and will be completely lost** when the container stops/exits.
  * *Extension Workaround*: If you need to install persistent extension dependencies, install them locally in the persistent workspace directory (e.g., run `npm install` inside `/workspace/.pi/extensions/` to create a local `node_modules` directory).
  * *Python/Conda Trap*: Global python installations via standard `pip install` are disabled/blocked under PEP 668 and would be lost on reset anyway. **Always use the pre-installed `uv` or `pixi`** to manage virtualized, local, and persistent dependencies inside `/workspace` (e.g., run `uv venv` or `pixi init`).

### 2. GCP / Google Vertex AI Environment & Auth
* **Pre-Authenticated**: You do not need to run `gcloud auth login` or set up Google Cloud SDK auth credentials. 
* **Credentials Path**: The environment variable `GOOGLE_APPLICATION_CREDENTIALS` is automatically set to `/secrets/gcp-credentials.json` (a read-only bind mount from the host).
* **Environment variables**: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `CLOUD_ML_REGION` are automatically injected into the container environment. Use them directly.

### 3. Podman Namespace & Root Constraints
* **Non-Root User (`pi`)**: You run as the standard `pi` user (UID 1000) inside the container. 
* **No `sudo`**: You do not have `sudo` access, and standard root-access commands will fail.
* **Installing System Packages**: If you require system-level software (like `apt-get` packages), do not attempt to install them yourself. Instead, **ask the user** to run the following command in their host terminal:
  ```bash
  just root-install <container-name> <package-name>
  ```
* **Active Container Name**: The active container name typically follows the pattern `pi-{project-directory-name}` (e.g., `pi-sort-out-models`).

### 4. Git Worktree Isolation & Credentials
* **No Git Access**: The file `/workspace/.git` is a git link pointing to a host path. Because the host's `.git` directory is not mounted inside the container for security, **all Git commands (e.g., `git status`, `git diff`) will fail inside the container** with `fatal: not a git repository`.
* **Commit & Push**: Do not attempt to run Git operations inside the container. Always instruct the user to review, commit, and push changes from their host terminal (outside the container).

### 5. Targeted Validation & Testing
* **Context-Aware Verification**: Only execute project test suites (e.g., `pytest`, `make html`) when modifying executable Python code, tests, or build configurations.
* **Avoid Unnecessary Runs**: Do not execute project test suites when editing skill files (`.pi/skills/`), documentation, configuration text, or non-executable markdown files.

---

## PART 2: Developing / Modifying this Config (META-DEVELOPMENT)
*ATTENTION: Only follow this section if the user's specific prompt is to maintain, develop, or modify the `pi-sandboxed-config` project itself (e.g., updating the Containerfile, modifying the launcher script, or changing global settings).*

If you are developing or maintaining this configuration repository:

### 1. Rebuilding and Testing the Container Environment
If you make changes to the `Containerfile`, they will not be active until the container image is rebuilt on the host.
1. **Modify `Containerfile`**: Edit packages or configurations in `Containerfile`.
2. **Rebuild**: Instruct the user to run the build command in their host terminal:
   ```bash
   just build
   ```
3. **Test Local Run**: Run a fresh sandbox to verify the changes took effect.

### 2. Deploying the Launcher Script
When you make updates to the `pi-launch` python wrapper:
1. Instruct the user to redeploy the launcher to their local bin by running the install target on their host terminal:
   ```bash
   just install
   ```
2. The installer will copy `pi-launch` to `~/.local/bin/pi-launch` on their host.

### 3. Cleanups & Git Guidelines
1. **Keep the tree clean**: Verify that workspace-local files (like temporary `node_modules` or sessions) are properly ignored in `.gitignore`.
2. **Delegate git work**: Explain to the user what changes were made and instruct them to run Git commands (like `git add`, `git commit`, `git status`, or `git push`) from their host terminal outside the container.
