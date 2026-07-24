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
* **Pathlib Methods & File Handles**: Prefer `path.open(*args)` over `open(path, *args)`, and use `fd` for file context managers (`with path.open() as fd:`).
* **Path Derivation**: Use `path.with_name()` or `path.with_suffix()` for path derivation.
* **Avoid Single-Character Variables**: Avoid single-character variable names (e.g., `d`, `a`, `b`, `x`, `f`) except for standard loop indices (`i`, `j`, `k`), coordinates (`x`, `y`, `z`), or one-liners.

## 7. Test Architecture & Dependency Injection
* **Configurable Defaults over Mocking**: Prefer exposing implementation details or lookup paths as configurable keyword arguments (with sensible defaults) as a clean alternative to monkeypatching in unit tests.
* **Targeted Mocking**: When mocking is necessary, mock specific methods on real objects rather than replacing entire classes with fakes.
