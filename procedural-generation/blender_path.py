#!/usr/bin/env python3
"""Portable Blender resolution for the procedural-generation tooling.

Where Blender is installed is a property of the host, not of this
repository, so no absolute path to one contributor's machine belongs in
version control. Resolution order:

1. ``BLENDER_BIN`` -- explicit override, always wins.
2. ``blender`` on ``PATH``.
3. Conventional install locations for the current platform, derived from
   ``Path.home()`` and the system application directories.

Resolution never invents a path. When nothing is found the caller gets
``None`` and reports UNAVAILABLE. An unavailable Blender is not a pass.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ENV_VAR = "BLENDER_BIN"

HINT = (
    f"Set {ENV_VAR} to the Blender executable, or put `blender` on PATH. "
    "On macOS the executable sits inside the bundle at "
    "Blender.app/Contents/MacOS/Blender."
)


def _macos_candidates():
    """Newest bundle first, so Blender-4.5.13.app wins over Blender-4.2.app."""
    home = Path.home()
    for root in (home / "tools", home / "Applications", Path("/Applications")):
        if not root.is_dir():
            continue
        for app in sorted(root.glob("Blender*.app"), reverse=True):
            yield app / "Contents" / "MacOS" / "Blender"


def _windows_candidates():
    for base in (
        Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")),
        Path(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")),
    ):
        root = base / "Blender Foundation"
        if not root.is_dir():
            continue
        for install in sorted(root.glob("Blender*"), reverse=True):
            yield install / "blender.exe"


def _linux_candidates():
    home = Path.home()
    for base in (
        Path("/usr/local/bin"),
        Path("/usr/bin"),
        Path("/snap/bin"),
        home / ".local" / "bin",
    ):
        yield base / "blender"


def candidate_paths():
    if sys.platform == "darwin":
        yield from _macos_candidates()
    elif sys.platform.startswith("win"):
        yield from _windows_candidates()
    else:
        yield from _linux_candidates()


def resolve_blender(explicit=None):
    """Return an executable path, or ``None`` when Blender is unavailable.

    ``explicit`` is a caller-supplied path (a CLI flag). It wins over the
    environment so a one-off run can target a specific build.
    """
    if explicit:
        return explicit

    env_value = os.environ.get(ENV_VAR)
    if env_value:
        return env_value

    on_path = shutil.which("blender")
    if on_path:
        return on_path

    for candidate in candidate_paths():
        if candidate.exists():
            return str(candidate)

    return None


def unavailable_reason(resolved):
    """The message a caller prints when it cannot run Blender."""
    if resolved is None:
        return f"UNAVAILABLE: no Blender found. {HINT}"
    return f"UNAVAILABLE: Blender at {resolved} did not answer --version. {HINT}"


def blender_available(resolved, timeout=10):
    """Run ``--version`` so availability is observed, not assumed."""
    if not resolved:
        return False
    try:
        run = subprocess.run(
            [resolved, "--version"], capture_output=True, text=True, timeout=timeout
        )
    except Exception:
        return False
    return run.returncode == 0 and "Blender" in run.stdout
