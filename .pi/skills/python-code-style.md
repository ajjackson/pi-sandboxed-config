---
name: python-code-style
description: Essential guidelines for Python coding style, modern standard library idioms, Pathlib conventions, typing, and architectural patterns.
---
# Python Code Style & Architectural Guidelines

Use this guide when writing, refactoring, or reviewing Python code in this codebase.

## 1. Class Design & Constructors
* **Simple `__init__` Methods**: Keep `__init__` methods simple and direct. Avoid putting complex transformation or file I/O logic in `__init__`, as clean `__init__` methods make unit testing and mocking far easier. Avoid redundant, conflicting or otherwise highly interactive `__init__` arguments.
* **Alternate `@classmethod` Constructors**: Provide descriptive `@classmethod` constructors (e.g., `from_modes()`, `from_json_file()`, `from_castep()`) to handle complex initialization, parsing, or conversion logic. Conflicting or redundant `__init__` arguments can instead be implemented as multiple `@classmethod`s with different function signatures.
* **Immutable Domain Objects (Optional Pattern)**:
  When designing data structures holding NumPy arrays or fixed datasets, consider `@dataclass(frozen=True)` and setting numpy array flags to read-only (`self.array.setflags(write=False)`) in `__post_init__`.
* **Caching on Immutable Types**: For immutable domain objects, consider `@cached_property` or `@lru_cache` to compute derived data lazily and safely without risking cache invalidation.

## 2. Structural Pattern Matching (`match / case`)
* **Enum Dispatch**: Prefer Python 3.10+ `match / case` syntax over `if / elif` chains or dictionary lookups when handling `Enum` variants or state dispatch:
  ```python
  match occupation:
      case BoseOccupation.N_PLUS_ONE:
          return bose_factor + 1.0
      case BoseOccupation.ONE:
          return np.ones_like(bose_factor)
      case other:
          raise TypeError(f"Invalid occupation variant: {other}")
  ```
* **Explicit Fallbacks**: Always include a default `case _:` or `case other:` to catch unhandled states and raise descriptive `ValueError` or `TypeError` exceptions.

## 3. Pathlib & Resource Handling
* **Method Invocation on Path Objects**: Prefer calling methods directly on `Path` instances (e.g., `path.open("r") as fd`, `path.read_text()`, `path.write_text()`) over global built-ins like `open(path)`.
* **File Handle Naming**: Use `fd` for context-managed file handles:
  ```python
  with path.open("r") as fd:
      data = fd.read()
  ```
* **Path Derivation**: Use `path.with_name("new_filename.txt")` or `path.with_suffix(".json")` rather than manual string or parent manipulation (`path.parent / "new_filename.txt"`).
* **Package Data via `importlib.resources`**: Use `importlib.resources.files("package.subpackage").joinpath("file.txt")` to access package-bundled data files rather than relying on relative `__file__` paths.

## 4. Iteration & Control Flow
* **Flatter Control Flow**: Prefer `itertools.chain` or `itertools.chain.from_iterable` over nested generator comprehensions (e.g., `p for a in x for p in a.glob(...)`) to improve readability:
  ```python
  from itertools import chain

  json_files = sorted(
      chain(
          dir_path.glob("results/*.json"),
          dir_path.glob("data/*.json"),
      )
  )
  ```
* **Strict Iteration with `zip()`**: Use `strict=True` when zipping sequences expected to have identical lengths (`zip(a, b, strict=True)`) to catch sequence mismatch bugs early.

## 5. Type Annotations & Import Hygiene
* **Deferred Evaluation**: Include `from __future__ import annotations` at the top of modules that use forward references, deferred type evaluation, or `if TYPE_CHECKING:` guards.
* **`TYPE_CHECKING` Guards**: Wrap heavy or circular type-only imports inside `if TYPE_CHECKING:`.
* **Strict Parameter Types**: Specify precise parameter types (e.g., `filename: Path` instead of `Path | str`) when internal callers control the types being passed.
* **Modern Generics**: Use built-in generic types (`list[str]`, `tuple[Path, ...]`, `dict[str, Any]`, `Iterable[Path]`) rather than legacy `typing` constructs (`typing.List`, `typing.Tuple`). Use `Self` from `typing` for constructor type hints.
