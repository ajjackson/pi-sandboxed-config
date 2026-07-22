---
name: python-uv-management
description: Crucial guide for Python projects, package development, standalone scripts (PEP 723), or uv environment management (handling virtual environments, dependencies, and running tools).
---
# Python UV Dependency & Script Management

Use this guide to initialize Python projects, manage dependencies, and run tools efficiently using `uv`.

## Key Concepts & File Detection
Identify existing `uv` setups by looking for these files in the project root:
- `pyproject.toml`: Project configuration and dependency declarations.
- `uv.lock`: Precise cross-platform dependency lockfile. Do not edit manually.
- `.python-version`: Pin of the target Python version (e.g., `3.12`).
- `.venv/`: The local virtual environment containing installed packages.

## Managing Projects & Dependencies

### 1. Initialize a Project
- **New Project**: Run `uv init` inside the target directory. This generates a standard `pyproject.toml`, `.python-version`, and a template source file.
- **Existing Project**: 
  - If a `pyproject.toml` exists but no lockfile: Run `uv lock` to generate `uv.lock`.
  - If only `requirements.txt` exists: Run `uv init` then migrate dependencies using `uv add -r requirements.txt`.

### 2. Add or Update Dependencies
- **Add Production Dependency**: Run `uv add <package>` (updates `pyproject.toml` and lockfile).
- **Add Dev/Test Dependency**: Run `uv add --dev <package>` (adds to the `dev` dependency group).
- **Update Dependency**:
  - Upgrade a specific package: `uv add <package>@latest` or `uv lock --upgrade-package <package>`.
  - Sync local virtual environment to match lockfile: `uv sync`.

## Running Scripts & Shells (The `uv run` Launcher)
`uv run` is a shim/wrapper that automatically syncs the virtual environment and runs the target command within it.
- **Execution**: Always run scripts via `uv run` instead of executing them directly (e.g., `./script.py` or `python script.py`) or trying to pip-install packages into a global python environment.
  ```bash
  uv run script.py
  ```
- **Interactive Shell**: To launch a Python REPL with all project dependencies pre-loaded, run from the project root:
  ```bash
  uv run python
  ```

## Single-File Scripts (PEP 723 Metadata)
For simple utilities or single-task scripts, **do not create a full package project or pyproject.toml**. Instead, use a standalone Python script declaring inline PEP 723 dependency metadata. Only create a package for complex, multi-file scenarios.
- **Script Template**:
  ```python
  #!/usr/bin/env -S uv run
  # /// script
  # dependencies = [
  #   "requests",
  #   "rich",
  # ]
  # ///

  import requests
  from rich import print

  response = requests.get("https://api.github.com")
  print(response.json())
  ```
- **Execution**: Execute the script using `uv run script.py`. If marked executable (`chmod +x script.py`), the `#!/usr/bin/env -S uv run` shebang allows direct shell execution: `./script.py`.

## Running Development & CLI Tools
**CRITICAL**: Do not install tools globally using `uv tool install`. Since `/home/pi` is a transient `tmpfs`, global tool installations are lost when the container restarts.

Instead, use one of the following persistent workflows:

### A. Project-Specific Tools (Recommended)
Add the CLI tools as development dependencies within the project and run them via the project's virtual environment.
1. Add the tool to the dev group:
   ```bash
   uv add --dev ruff pytest
   ```
2. Run the tool via `uv run`:
   ```bash
   uv run ruff check .
   ```

### B. Ephemeral Tool Execution (No Install)
Run CLI tools inside a temporary environment without adding them to your project's dependencies or installing them globally:
```bash
uv run --with <package> <command>
# Example: Run ruff check without installing it to pyproject.toml
uv run --with ruff ruff check .
```

## Advanced Topics & Reference Links
For advanced use cases, consult the official Astral `uv` documentation:
- [Astral uv Official Docs](https://docs.astral.sh/uv/)
- [Managing Projects with uv](https://docs.astral.sh/uv/concepts/projects/)
- [uv Workspaces (Multi-Package Projects)](https://docs.astral.sh/uv/concepts/workspaces/)
- [uv Pip Compatibility Layer](https://docs.astral.sh/uv/pip/)
- [uv Configuration Guide](https://docs.astral.sh/uv/configuration/)
