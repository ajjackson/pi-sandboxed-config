---
name: ruff-linting-formatting
description: Crucial guide for Python linting, auto-formatting, and import sorting using Ruff in this sandbox environment.
---
# Python Code Quality with Ruff

Use this guide to run linting and code formatting checks using `Ruff` before declaring any Python task complete.

## File Detection & Configuration
Identify `Ruff` setups by looking for:
- `pyproject.toml` containing a `[tool.ruff]` section.
- `ruff.toml` in the project root.

## Activation Scenarios
Run Ruff whenever:
- You finish writing or modifying Python source code.
- You are preparing to run tests or declare a task complete.
- Imports need sorting, or unused imports/variables need pruning.

## Common Commands
Always execute Ruff via `uv run` to ensure it uses the project's virtual environment or downloads Ruff on the fly:

### 1. Code Linting
- **Lint Check**: Run static analysis on the entire workspace.
  ```bash
  uv run ruff check .
  ```
- **Auto-Fix Issues**: Fix all autofixable violations (e.g., removing unused imports, fixing simple style violations).
  ```bash
  uv run ruff check --fix .
  ```
- **Specific File Linting**:
  ```bash
  uv run ruff check path/to/file.py
  ```

### 2. Code Formatting
Ruff replaces tools like `black` and `isort` by handling formatting and import sorting in one pass:
- **Format Check**: Check if the codebase is formatted without modifying any files.
  ```bash
  uv run ruff format --check .
  ```
- **Apply Formatting**: Reformat all files and sort imports in-place.
  ```bash
  uv run ruff format .
  ```

### 3. One-Step Clean Up
To fully lint, auto-fix, and format the workspace in one command:
```bash
uv run ruff check --fix . && uv run ruff format .
```

## Advanced Topics & Reference Links
For advanced rules, rule exclusions, or pre-commit configuration, refer to the official docs:
- [Official Ruff Documentation](https://docs.astral.sh/ruff/)
- [Ruff Rules Reference](https://docs.astral.sh/ruff/rules/)
- [Ruff Configuration Guide](https://docs.astral.sh/ruff/configuration/)
