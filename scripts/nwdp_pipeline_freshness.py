"""Fingerprint, lock, validate, and cache coordination for NWDP derived outputs."""
from __future__ import annotations

import hashlib
import json
import os
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

_PROCESS_LOCK = threading.Lock()


class PipelineLockedError(RuntimeError):
    pass


class PipelineValidationError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@contextmanager
def exclusive_pipeline_lock(path: Path):
    """Nonblocking process + OS file lock; OS releases automatically on crash."""
    if not _PROCESS_LOCK.acquire(blocking=False):
        raise PipelineLockedError("nwdp_pipeline_already_running")
    handle = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        handle = path.open("a+b")
        if os.name == "nt":
            import msvcrt

            handle.seek(0, os.SEEK_END)
            if handle.tell() == 0:
                handle.write(b"\0")
                handle.flush()
            handle.seek(0)
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise PipelineLockedError("nwdp_pipeline_already_running") from exc
        else:
            import fcntl

            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as exc:
                raise PipelineLockedError("nwdp_pipeline_already_running") from exc
        yield
    finally:
        if handle is not None:
            try:
                if os.name == "nt":
                    import msvcrt

                    handle.seek(0)
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass
            handle.close()
        _PROCESS_LOCK.release()


def output_hashes(root: Path, outputs: list[str]) -> dict[str, str]:
    result = {}
    for relative in outputs:
        path = root / relative
        if not path.is_file():
            raise FileNotFoundError(f"nwdp_pipeline_output_missing:{relative}")
        result[relative] = sha256_file(path)
    return result


def _write_marker(path: Path, payload: dict[str, Any]) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temporary.replace(path)


def execute_freshness_pipeline(
    *,
    root: Path,
    marker_path: Path,
    lock_path: Path,
    fingerprint: str,
    outputs: list[str],
    rebuild: Callable[[], Any],
    validate: Callable[[], dict[str, Any]],
    adopt_existing_if: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    """Rebuild on incompatible/missing outputs, validate every run, mark only success."""
    with exclusive_pipeline_lock(lock_path):
        previous: dict[str, Any] = {}
        try:
            previous = json.loads(marker_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass

        current_hashes = None
        try:
            current_hashes = output_hashes(root, outputs)
        except FileNotFoundError:
            pass
        compatible = (
            previous.get("status") == "complete"
            and previous.get("input_fingerprint") == fingerprint
            and current_hashes is not None
            and previous.get("output_hashes") == current_hashes
            and previous.get("validation", {}).get("status") == "VERIFIED"
        )
        # If the prior process died or validation failed after producing an
        # unchanged output set, retry validation only. This is safe because the
        # hashes and input fingerprint are checked again under the lock.
        resume_validation = (
            previous.get("status") in {"running", "failed"}
            and previous.get("stage") == "validate"
            and previous.get("input_fingerprint") == fingerprint
            and current_hashes is not None
            and previous.get("output_hashes") == current_hashes
        )
        adopt_existing = (
            not marker_path.exists()
            and current_hashes is not None
            and adopt_existing_if is not None
            and adopt_existing_if()
        )

        skip_rebuild = compatible or resume_validation or adopt_existing
        stage = "validate" if skip_rebuild else "rebuild"
        marker_state = {
            "status": "running",
            "stage": stage,
            "input_fingerprint": fingerprint,
        }
        if stage == "validate" and current_hashes is not None:
            marker_state["output_hashes"] = current_hashes
        # This marker makes an interrupted rebuild explicitly non-successful.
        marker_path.parent.mkdir(parents=True, exist_ok=True)
        _write_marker(marker_path, marker_state)

        rebuilt = False
        try:
            if not skip_rebuild:
                rebuild()
                rebuilt = True
                current_hashes = output_hashes(root, outputs)
            # Persist a validation-stage checkpoint. On interruption, the
            # next run can retry validation without rescanning/rebuilding raw.
            _write_marker(marker_path, {
                "status": "running",
                "stage": "validate",
                "input_fingerprint": fingerprint,
                "output_hashes": current_hashes,
            })
            stage = "validate"
            validation = validate()
            if not isinstance(validation, dict) or validation.get("status") != "VERIFIED":
                raise PipelineValidationError("nwdp_pipeline_validation_failed")
            hashes = output_hashes(root, outputs)
        except Exception as exc:
            _write_marker(marker_path, {
                "status": "failed",
                "stage": stage,
                "input_fingerprint": fingerprint,
                **({"output_hashes": current_hashes} if stage == "validate" else {}),
                "error_type": type(exc).__name__,
                "error": str(exc),
            })
            raise
        completed = {
            "status": "complete",
            "stage": "complete",
            "pipeline_version": "nwdp-pipeline-v1",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "input_fingerprint": fingerprint,
            "rebuilt": rebuilt,
            "output_hashes": hashes,
            "validation": validation,
        }
        _write_marker(marker_path, completed)
        return completed
