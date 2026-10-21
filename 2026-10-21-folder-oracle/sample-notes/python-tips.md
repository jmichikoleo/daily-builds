# Python Programming Tips

Small habits that make Python code cleaner and faster to write.

## Everyday idioms

- Use `enumerate(items)` instead of `range(len(items))` when you need the index.
- Use `zip(a, b)` to loop over two lists together.
- `collections.Counter` counts things in one line: `Counter(words).most_common(5)`.
- `collections.defaultdict(list)` removes the "if key not in dict" boilerplate.
- f-strings are the clearest way to format text: `f"{name}: {score:.2f}"`.

## Files and paths

Prefer `pathlib.Path` over string paths. `Path("notes").rglob("*.md")` finds every Markdown file recursively, and `path.read_text(encoding="utf-8")` reads it. Always open files with a `with` block so they close automatically.

## Writing better functions

Add type hints to function signatures. They document intent and let editors catch mistakes early. Keep functions short and give them names that describe what they return. Use `dataclasses` for simple records instead of plain dictionaries.

## Command line tools

The standard library's `argparse` gives you help text, type checking and error messages for free. Put the entry point under `if __name__ == "__main__":` so the module can also be imported.

## Debugging and speed

`breakpoint()` drops you into the debugger. `python -m cProfile script.py` shows where time goes. List comprehensions and generator expressions are usually faster and easier to read than manual loops with append.

## Environments

Create a virtual environment per project with `python3 -m venv .venv` so dependencies do not collide.
