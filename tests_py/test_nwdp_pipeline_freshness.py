import json
import hashlib
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

import pytest

from scripts.nwdp_pipeline_freshness import (
    PipelineLockedError,
    PipelineValidationError,
    execute_freshness_pipeline,
)
from scripts.nwdp_pipeline import ACTIVE_STATES, source_fingerprint


OUTPUTS = ["data/derived/normalized.json"]


@pytest.fixture
def case():
    with tempfile.TemporaryDirectory(prefix="nwdp-pipeline-test-", dir=Path.cwd()) as directory:
        yield setup_case(Path(directory))


def setup_case(tmp_path: Path):
    root = tmp_path / "repo"
    root.mkdir()
    marker = root / "data/derived/completion.json"
    lock = root / "data/derived/.pipeline.lock"
    output = root / OUTPUTS[0]
    output.parent.mkdir(parents=True)
    calls = {"rebuild": 0, "validate": 0}

    def rebuild():
        calls["rebuild"] += 1
        output.write_text(f"build-{calls['rebuild']}", encoding="utf-8")

    def validate():
        calls["validate"] += 1
        assert output.is_file()
        return {"status": "VERIFIED", "records": 3}

    def run(fingerprint="input-v1", rebuild_fn=rebuild, validate_fn=validate):
        return execute_freshness_pipeline(
            root=root,
            marker_path=marker,
            lock_path=lock,
            fingerprint=fingerprint,
            outputs=OUTPUTS,
            rebuild=rebuild_fn,
            validate=validate_fn,
        )

    return root, marker, lock, output, calls, run


def test_first_run_builds_and_second_run_reuses_but_validates_again(case):
    _, _, _, _, calls, run = case
    first = run()
    second = run()
    assert first["rebuilt"] is True
    assert second["rebuilt"] is False
    assert calls == {"rebuild": 1, "validate": 2}


@pytest.mark.parametrize("new_fingerprint", ["changed-file-hashes", "changed-processing-version"])
def test_fingerprint_changes_invalidate_outputs(case, new_fingerprint):
    _, _, _, _, calls, run = case
    run("source-or-code-v1")
    result = run(new_fingerprint)
    assert result["rebuilt"] is True
    assert calls["rebuild"] == 2


def test_failed_or_interrupted_marker_is_never_accepted_as_complete(case):
    root, marker, _, output, calls, run = case
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(json.dumps({"status": "running", "input_fingerprint": "input-v1"}), encoding="utf-8")
    result = run()
    assert result["rebuilt"] is True
    assert calls["rebuild"] == 1

    # A crash after artifacts were prepared but before validation completed is
    # not success, but it can safely retry only validation when hashes match.
    output_hash = hashlib.sha256(output.read_bytes()).hexdigest()
    marker.write_text(json.dumps({
        "status": "running", "stage": "validate", "input_fingerprint": "input-v1",
        "output_hashes": {OUTPUTS[0]: output_hash},
    }), encoding="utf-8")
    resumed = run()
    assert resumed["rebuilt"] is False
    assert calls == {"rebuild": 1, "validate": 2}

    def bad_validation():
        return {"status": "FAILED"}

    with pytest.raises(PipelineValidationError):
        run("input-v2", validate_fn=bad_validation)
    failed = json.loads(marker.read_text(encoding="utf-8"))
    assert failed["status"] == "failed"
    assert failed["stage"] == "validate"
    assert failed["input_fingerprint"] == "input-v2"
    before_retry = calls["rebuild"]
    assert run("input-v2")["rebuilt"] is False
    assert calls["rebuild"] == before_retry


def test_failed_rebuild_is_marked_failed_and_retried(case):
    _, marker, _, _, calls, run = case

    def fail_rebuild():
        calls["rebuild"] += 1
        raise RuntimeError("simulated_rebuild_failure")

    with pytest.raises(RuntimeError, match="simulated_rebuild_failure"):
        run(rebuild_fn=fail_rebuild)
    failed = json.loads(marker.read_text(encoding="utf-8"))
    assert failed["status"] == "failed"
    assert failed["stage"] == "rebuild"

    completed = run()
    assert completed["status"] == "complete"
    assert completed["rebuilt"] is True
    assert calls["rebuild"] == 2


def test_missing_output_or_output_hash_change_rebuilds(case):
    _, _, _, output, calls, run = case
    run()
    output.write_text("tampered", encoding="utf-8")
    assert run()["rebuilt"] is True
    assert calls["rebuild"] == 2


def test_concurrent_invocations_do_not_duplicate_rebuild(case):
    root, _, _, _, calls, _ = case
    marker = root / "data/derived/completion.json"
    lock = root / "data/derived/.pipeline.lock"
    output = root / OUTPUTS[0]
    entered = threading.Event()
    release = threading.Event()
    result_holder = []

    def slow_rebuild():
        calls["rebuild"] += 1
        entered.set()
        assert release.wait(5)
        output.write_text("one-build", encoding="utf-8")

    def validate():
        calls["validate"] += 1
        return {"status": "VERIFIED"}

    def first_run():
        result_holder.append(execute_freshness_pipeline(
            root=root, marker_path=marker, lock_path=lock, fingerprint="same",
            outputs=OUTPUTS, rebuild=slow_rebuild, validate=validate,
        ))

    thread = threading.Thread(target=first_run)
    thread.start()
    assert entered.wait(2)
    with pytest.raises(PipelineLockedError):
        execute_freshness_pipeline(
            root=root, marker_path=marker, lock_path=lock, fingerprint="same",
            outputs=OUTPUTS, rebuild=slow_rebuild, validate=validate,
        )
    release.set()
    thread.join(timeout=5)
    assert not thread.is_alive()
    assert len(result_holder) == 1
    assert calls["rebuild"] == 1


def test_os_file_lock_blocks_a_second_process(case):
    _, _, lock, _, calls, run = case
    # Keep the child command simple and import the actual lock implementation.
    code = (
        "import sys,time; from pathlib import Path; "
        "from scripts.nwdp_pipeline_freshness import exclusive_pipeline_lock; "
        "exec('with exclusive_pipeline_lock(Path(sys.argv[1])):\\n print(\"locked\", flush=True); time.sleep(2)')"
    )
    child = subprocess.Popen(
        [sys.executable, "-c", code, str(lock)], cwd=Path.cwd(),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        assert child.stdout is not None
        assert child.stdout.readline().strip() == "locked"
        with pytest.raises(PipelineLockedError):
            run()
        assert calls == {"rebuild": 0, "validate": 0}
    finally:
        child.wait(timeout=8)


def test_real_source_fingerprint_changes_with_raw_hash_or_processing_code(case):
    root = case[0]
    raw = root / "data/sources/nwdp_telemetry_raw"
    raw.mkdir(parents=True)
    resources = []
    for index, state in enumerate(sorted(ACTIVE_STATES)):
        for period in ("2021-2025", "2026-2030"):
            filename = f"resource-{index}-{period}.csv"
            content = f"{state},{period}\n".encode()
            (raw / filename).write_bytes(content)
            resources.append({
                "state": state,
                "period": period,
                "filename": filename,
                "byte_count": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "validation_outcome": "PASSED",
            })
    manifest = raw / "nwdp_telemetry_download_manifest.json"
    manifest.write_text(json.dumps({"resources": resources}), encoding="utf-8")
    scripts = root / "scripts"
    scripts.mkdir()
    rebuild_code = scripts / "rebuild_nwdp_authoritative.py"
    validator_code = scripts / "validate_nwdp_lineage.py"
    rebuild_code.write_text("processing-v1", encoding="utf-8")
    validator_code.write_text("validation-v1", encoding="utf-8")

    first, _ = source_fingerprint(root)
    resource = resources[0]
    changed_content = b"changed source bytes\n"
    (raw / resource["filename"]).write_bytes(changed_content)
    resource["byte_count"] = len(changed_content)
    resource["sha256"] = hashlib.sha256(changed_content).hexdigest()
    manifest.write_text(json.dumps({"resources": resources}), encoding="utf-8")
    changed_input, _ = source_fingerprint(root)
    assert changed_input != first

    rebuild_code.write_text("processing-v2", encoding="utf-8")
    changed_processing, _ = source_fingerprint(root)
    assert changed_processing != changed_input
