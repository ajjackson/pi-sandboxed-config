---
name: python-code-style
description: Essential guidelines for Python coding style, modern standard library idioms, Pathlib conventions, typing, and architectural patterns.
---
# Python Code Style & Architectural Guidelines

Use this guide when writing, refactoring, or reviewing Python code in this codebase.

## 1. Class Design & Abstract Interfaces
* **Abstract Base Classes**: Subclass `abc.ABC` and decorate abstract interface methods with `@abstractmethod`.
* **Docstrings in Abstract Methods**: Omit `pass`, `...`, or `raise NotImplementedError` in abstract methods when a docstring is present.
* **Decorator Ordering**: Place `@classmethod` on the outside and `@abstractmethod` on the inside when combining them (`@classmethod` / `@abstractmethod`).
* **Factory Constructors**: Prefer simple `__init__` methods paired with descriptive `@classmethod` factory constructors (`from_dict`, `from_json_file`) for complex parsing or conversions.

## 2. Receiver Parameters & Return Types
* **Unannotated Receivers**: Leave `self` and `cls` unannotated (`def from_dict(cls, data_dict: Any) -> Self:`), as their types are implicitly handled by type checkers.
* **`Self` Return Types**: Annotate factory methods and constructors returning `cls` instances with `Self` (`from typing import Self`).

## 3. Package Versioning
* **Package Versioning**: Avoid exporting `__version__` in `__init__.py`; encourage querying `importlib.metadata.version()` directly.

## 4. Data Flow & Exception Handling
* **Factored Validation**: Factor out validation and precondition checks into private helper methods (e.g., `_validate_class()`) to keep the main data flow of public methods flat and readable.
* **Propagate Domain Exceptions**: Allow domain and parsing exceptions to propagate naturally rather than catching and suppressing them with broad `except: pass` blocks.

## 5. User-Facing Warnings & Call Stack
* **Explicit `stacklevel`**: Always specify an explicit `stacklevel` parameter in `warnings.warn()` (e.g., `stacklevel=3` inside internal helper or mixin methods) so the warning points directly to the user's calling code rather than internal library lines.

## 6. Flatter Control Flow & Pathlib Conventions
* **Flatter Control Flow**: Use `itertools.chain(path.glob(...), path.glob(...))` instead of nested double generator comprehensions.
* **Pathlib Methods & File Handles**: Prefer `path.read_text()` (or `path.read_bytes()`) over open/read context managers for reading file contents, or `with path.open() as fd:` when streaming or writing files.
* **Multi-Segment Path Joining**: Prefer `path / "sub/dir/file.txt"` over chaining multiple divisions (`path / "sub" / "dir" / "file.txt"`).
* **Path Derivation**: Use `path.with_name()` or `path.with_suffix()` for path derivation.
* **Avoid Single-Character Variables**: Avoid single-character variable names (e.g., `d`, `a`, `b`, `x`, `f`) except for standard loop indices (`i`, `j`, `k`), coordinates (`x`, `y`, `z`), or one-liners.

## 7. Test Architecture & Dependency Injection
* **Configurable Defaults over Mocking**: Prefer exposing implementation details or lookup paths as configurable keyword arguments (with sensible defaults) as a clean alternative to monkeypatching in unit tests.
* **Targeted Mocking**: When mocking is necessary, mock specific methods on real objects rather than replacing entire classes with fakes.

## 8. CLI Scripts & Argparse Conventions
* **Dedicated Parser Construction**: Define argument parsers in a `get_parser() -> argparse.ArgumentParser` helper function.
* **Direct Parsing in `main()`**: Parse arguments inside `main()` using `args = get_parser().parse_args()`.
* **Parameterless `main()`**: Keep `def main() -> None:` parameterless unless unit tests specifically invoke `main(args=...)`.
* **Path Arguments**: Pass `type=Path` in `parser.add_argument()` when accepting filenames or directory paths.
* **Avoid Unnecessary Variable Reassignment**: Access `args.argument_name` directly unless alias variables add genuine clarity.
