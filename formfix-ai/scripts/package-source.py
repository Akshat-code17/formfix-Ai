"""Create a source-only distribution; exclude secrets, dependencies and scratch data."""
import os
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root.parent / "formfix-ai-source.zip"
excluded = {"node_modules", "dist", "work", ".venv", "__pycache__", ".pytest_cache", ".git", "uploads", "coverage"}
count = 0
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for folder, directories, files in os.walk(root):
        directories[:] = [name for name in directories if name not in excluded]
        for name in sorted(files):
            if name == ".env" or name.startswith(".env.") and name != ".env.example":
                continue
            path = Path(folder) / name
            archive.write(path, Path(root.name) / path.relative_to(root))
            count += 1
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert not any(name.endswith("/.env") for name in archive.namelist())
print(f"Packaged {count} source/fixture/documentation files; archive verified ({target.stat().st_size} bytes).")
