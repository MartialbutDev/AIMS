"""Report temporary storage failures and avoid publishing incomplete uploads."""
from contextlib import contextmanager, suppress
from pathlib import Path
import logging
import os

from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)
STORAGE_UNAVAILABLE = "File storage is temporarily unavailable. Please try again shortly."


def storage_root() -> Path:
    try:
        root = Path(settings.ASSET_DIR).resolve(strict=True)
        if not root.is_dir() or not os.access(root, os.R_OK | os.X_OK):
            raise OSError("Asset root is inaccessible")
        return root
    except (OSError, RuntimeError) as exc:
        raise HTTPException(503, STORAGE_UNAVAILABLE) from exc


def stored_file(relative_path: str, directory: str | None = None) -> Path:
    root = storage_root()
    try:
        path = (root / relative_path).resolve()
        expected_root = root / directory if directory else root
        if not path.is_relative_to(expected_root):
            raise HTTPException(404, "File not found")
        if not path.parent.is_dir():
            raise HTTPException(503, STORAGE_UNAVAILABLE)
        if not path.is_file():
            raise HTTPException(404, "File not found")
        with path.open("rb"):
            pass
        return path
    except FileNotFoundError:
        storage_root()
        raise HTTPException(404, "File not found") from None
    except (OSError, RuntimeError) as exc:
        raise HTTPException(503, STORAGE_UNAVAILABLE) from exc


@contextmanager
def staged_file(path: Path):
    root = storage_root()
    try:
        if not path.resolve().is_relative_to(root):
            raise HTTPException(503, STORAGE_UNAVAILABLE)
    except (OSError, RuntimeError) as exc:
        raise HTTPException(503, STORAGE_UNAVAILABLE) from exc
    partial = path.with_name(path.name + ".part")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with partial.open("xb") as output:
            yield output
        partial.replace(path)
    except OSError as exc:
        logger.warning("Document storage write failed", exc_info=True)
        raise HTTPException(503, STORAGE_UNAVAILABLE) from exc
    finally:
        with suppress(OSError):
            partial.unlink(missing_ok=True)
