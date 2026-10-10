"""W02-20 source binding: canonical checkout root, source manifest and context.

The two moved bodies are byte-identical except the ONE permitted value-node
change: the co-located source root is derived through _source_root() (abspath of
this module's two parent directories), preserving abspath semantics without
realpath/resolve normalisation. No cached mutable root, no module __file__
mutation. Import is inert.
"""
import hashlib
import os

from .classification import _hex64_ok
from .config import CAPTURE_FILE_MAX, CONTEXT_KEYS, EXPECTED_SECCOMP_SHA256, PINNED_IMAGE, SUPPORT_PATTERN
from .evidence_io import _bounded_text, _exact_keys


def _source_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def source_manifest():
    folder = _source_root()
    names = {"observer": "host-evidence.py", "bootstrap": "bootstrap.sh", "seccomp": "seccomp.json"}
    if not os.path.exists(os.path.join(folder, "seccomp.json")):
        names["seccomp"] = "seccomp.chromium-155-amd64.json"
    result = {}
    for key, name in names.items():
        raw = _bounded_text(os.path.join(folder, name), CAPTURE_FILE_MAX).encode("utf-8")
        result[key] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    return result

def _context_ok(ctx, run):
    return (_exact_keys(ctx, CONTEXT_KEYS) and ctx["run"] == run and ctx["workerImage"] == PINNED_IMAGE
            and isinstance(ctx["supportImage"], str) and SUPPORT_PATTERN.fullmatch(ctx["supportImage"]) is not None and ctx["supportImage"] != PINNED_IMAGE
            and ctx["profileSha"] == EXPECTED_SECCOMP_SHA256
            and isinstance(ctx["source"], dict) and set(ctx["source"]) == {"observer", "bootstrap", "seccomp"}
            and all(_exact_keys(v, {"bytes", "sha256"}) and type(v["bytes"]) is int and 0 < v["bytes"] <= CAPTURE_FILE_MAX
                    and _hex64_ok(v["sha256"]) for v in ctx["source"].values())
            and ctx["source"]["seccomp"]["sha256"] == EXPECTED_SECCOMP_SHA256)
