# Workspace Context & Environment Rules (AGENTS.md)

This workspace is a secure, sandboxed environment running inside a Podman container. Every fresh Pi session loads this file automatically on startup. Read and adhere to the guidelines below to avoid common environment traps.

---

## 1. Directory & Storage Persistence
The filesystem structure uses a mix of persistent host mounts and transient in-memory filesystems:

* **`/workspace` (Persistent)**: This is a persistent volume mount mapped directly to the host's project directory (`-v {project_path}:/workspace:rw,Z`). All files created, modified, or deleted here survive container restarts, session resumes, and host reboots.
* **`/home/pi` (Transient `tmpfs`)**: This directory is mounted as a transient in-memory filesystem (`--tmpfs /home/pi:U`). 
  * *How it works*: Podman copies the image's default home directory files into `/home/pi` on startup. 
  * *Trap*: Any files or packages written to `/home/pi` (such as global npm packages via `npm install -g`, updates to `.bashrc`, `.profile`, or files under `/home/pi/.npm-global`) **are temporary and will be completely lost** when the container stops/exits.
  * *Workaround*: If you need to install persistent extension dependencies, install them locally in the persistent workspace directory (e.g. run `npm install` inside `/workspace/.pi/extensions/` to create a local `node_modules` directory).
  * *Python/Conda Trap*: Global python installations via standard `pip install` are disabled/blocked under PEP 668 and would be lost on reset anyway. **Always use the pre-installed `uv` or `pixi`** to manage virtualized, local, and persistent dependencies inside `/workspace` (e.g., `uv venv` or `pixi init`).

---

## 2. GCP / Google Vertex AI Environment & Auth
* **Pre-Authenticated**: You do not need to run `gcloud auth login` or set up Google Cloud SDK auth credentials. 
* **Credentials Path**: The environment variable `GOOGLE_APPLICATION_CREDENTIALS` is automatically set to `/secrets/gcp-credentials.json` (a read-only bind mount from the host).
* **Environment variables**: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `CLOUD_ML_REGION` are automatically injected into the container environment from the host launcher config. Use them directly.

---

## 3. Podman Namespace & Root Constraints
* **Non-Root User (`pi`)**: You run as the standard `pi` user (UID 1000) inside the container. 
* **No `sudo`**: You do not have `sudo` access, and standard root-access commands will fail.
* **Installing System Packages**: If you require system-level software (like `apt-get` packages), do not attempt to install them yourself. Instead, **ask the user** to run the following command in their host terminal:
  ```bash
  just root-install <container-name> <package-name>
  ```
  *(Or they can run `just root <container-name>` to get a root shell and configure things for you.)*
* **Active Container Name**: The active container name typically follows the pattern `pi-{project-directory-name}` (e.g., `pi-sort-out-models`).

---

## 4. Git Worktree Isolation & Credentials
* **Worktree Mapping**: The `/workspace` directory on the host is checked out as a detached Git worktree of the main config project.
* **No Git Access**: The file `/workspace/.git` is a git link pointing to a host path (e.g., `/home/prg49555/src/pi-sandboxed-config/.git/worktrees/...`). Because the host's `.git` directory is not mounted inside the container, **all Git commands (e.g., `git status`, `git diff`) will fail inside the container** with:
  `fatal: not a git repository`
* **Commit & Push**: Do not attempt to run Git operations. Always instruct the user to review, commit, and push changes from their host terminal (outside the container).

---

## 5. Rebuilding the Container Image
* If you modify the `Containerfile` (such as updating preinstalled packages or modifying global setup/environment variables), these changes **will not take effect** in the current or subsequent runs unless the image is rebuilt on the host.
* Advise the user to run:
  ```bash
  just build
  ```
  from their host terminal to build the updated `pi-sandbox` image.
