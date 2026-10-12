"""Regenerate SDK fixture source pins from the fixed worker context; no build."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
if __package__:
    from . import worker_context
else:
    import worker_context


def selected(source):
    return (source.startswith("packages/contracts/qualification-sdk/")
            or source in {"packages/contracts/validate.mjs", "packages/contracts/meri.schema.json",
                          "packages/contracts/test/sdk-fixture-wire.test.mjs"}
            or source.startswith(worker_context.QUALIFICATION + "checkpoint/fixture-")
            or source in {worker_context.QUALIFICATION + "checkpoint/resume-admission.mjs",
                          worker_context.QUALIFICATION + "checkpoint/resume-admission.test.mjs"}
            or source.startswith(worker_context.QUALIFICATION + "probes/native-"))


def image_path(member):
    prefix = "build-dependencies/contracts/"
    return ("/packages/contracts/" + member.removeprefix(prefix)
            if member.startswith(prefix) else "/opt/meri-worker/" + member)


def refresh(*, check):
    """Only sdkFixturePackaging.records may change; all other metadata is kept."""
    deadline = time.monotonic() + worker_context.DEADLINE_SECONDS
    target = worker_context.ROOT / worker_context.QUALIFICATION / "component-pins.json"
    raw, original_identity = worker_context._read(target, deadline)
    pins = json.loads(raw.decode("utf-8"))
    packaging = pins["sdkFixturePackaging"]
    if packaging["status"] != "SOURCE_ONLY" or packaging["contextAssembler"] != "scripts/qualification/worker_context.py":
        raise ValueError("source-only fixture packaging required")
    records, identities = [], []
    for source, member in worker_context.MEMBERS:
        if not selected(source):
            continue
        content, identity = worker_context._read(worker_context.ROOT / source, deadline)
        identities.append((worker_context.ROOT / source, identity))
        records.append({"sourcePath": source, "contextPath": member, "imagePath": image_path(member),
                        "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    def unchanged():
        for path, identity in [(target, original_identity), *identities]:
            worker_context._check_deadline(deadline)
            worker_context._ancestors(path.parent)
            if worker_context._identity(worker_context._plain(path)) != identity:
                raise ValueError("source changed during pin generation")
    unchanged()
    if check:
        if packaging["records"] != records:
            raise ValueError("SDK fixture source pins are stale; run --write")
        return len(records)
    packaging["records"] = records
    output = (json.dumps(pins, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".source-pins-", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(output)
            handle.flush()
            os.fsync(handle.fileno())
        unchanged()
        os.chmod(temporary, 0o644)
        os.replace(temporary, target)
        temporary = None
        return len(records)
    finally:
        if temporary is not None:
            temporary.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, epilog="Exit 0: verified/generated. Exit 2: invalid input or stale pins.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Refuse stale pins without writing.")
    mode.add_argument("--write", action="store_true", help="Regenerate only fixed SDK fixture source records.")
    args = parser.parse_args(argv)
    try:
        count = refresh(check=args.check)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(2, f"Source pin verification failed: {error}\n")
    print(f"SOURCE_ONLY: {count} SDK fixture records {'verified' if args.check else 'generated'}; no build or admission.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
