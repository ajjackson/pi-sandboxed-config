---
name: pytest-testing
description: Crucial guide for writing and executing Python tests using Pytest. Covers test execution, output capture, debugging, and coverage.
---
# Python Testing with Pytest

Use this guide to run, write, and debug tests using `pytest` to validate Python code changes.

## File Detection & Conventions
Identify test configurations and files by looking for:
- `pyproject.toml` containing a `[tool.pytest.ini_options]` section.
- `pytest.ini` or `tox.ini` files.
- A `tests/` directory.
- Test files matching `test_*.py` or `*_test.py`.
- Test functions matching `test_*()`.

## Best Practices for Test Writing
* **Re-use Existing Project Fixtures**: Always use project-provided fixtures (e.g., `rng` from `conftest.py`) rather than instantiating local random number generators (`Generator(PCG64(...))`) or custom setup boilerplate.

## Activation Scenarios
Run Pytest:
- After modifying any business logic or adding new features.
- Before declaring any code modification complete.
- To diagnose buggy behaviors using existing reproduction tests.

## Common Commands
Always run Pytest via `uv run` to ensure all declared project dependencies are loaded into the test environment:

### 1. Running the Test Suite
- **Run All Tests**: Execute all discovered tests in the workspace.
  ```bash
  uv run pytest
  ```
- **Run Specific Test File**:
  ```bash
  uv run pytest tests/test_my_feature.py
  ```
- **Run Specific Test Name**: Run tests matching a specific substring.
  ```bash
  uv run pytest -k "test_some_specific_function_name"
  ```

### 2. Output & Debugging Flags
- **Disable Output Capturing (`-s`)**: Allow `print()` statements and logs to output directly to the terminal during test runs.
  ```bash
  uv run pytest -s
  ```
- **Stop on First Failure (`-x`)**: Stop the test suite immediately when a test fails. Useful for fast debugging.
  ```bash
  uv run pytest -x
  ```
- **Verbose Output (`-v`)**: Show exact test names and outcomes instead of just dots.
  ```bash
  uv run pytest -v
  ```

### 3. Coverage Analysis
If `pytest-cov` is configured in the environment, run tests with coverage reporting:
```bash
uv run pytest --cov=my_package tests/
```

## Advanced Topics & Reference Links
Consult the official Pytest documentation for advanced configurations:
- [Official Pytest Documentation](https://docs.pytest.org/)
- [Pytest Fixtures (Setup and Teardown)](https://docs.pytest.org/en/stable/explanation/fixtures.html)
- [How to Parametrize Tests (Data-driven testing)](https://docs.pytest.org/en/stable/how-to/parametrize.html)
- [Pytest Command-Line Options Reference](https://docs.pytest.org/en/stable/reference/reference.html#command-line-flags)
