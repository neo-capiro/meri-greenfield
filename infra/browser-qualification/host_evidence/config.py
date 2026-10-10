"""W02-17 collector extraction: immutable pins, compiled patterns and bounds.

Extracted verbatim from the reviewed host-evidence.py candidate; every value is
unchanged. Import is inert: no mutable lifecycle state and no host IO live here.
`_CANCEL` and `_EXE_HASH_CACHE` are mutable lifecycle state and live in
`collection`.
"""
import re

BROWSER_ROOT = "/opt/meri-browsers"
PINNED_BROWSER_EXE = "/opt/meri-browsers/chromium-1247/chrome-linux64/chrome"
PINNED_BROWSER_SHA256 = "adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0"
BROWSER_EXE_PATTERN = re.compile(r"^/opt/meri-browsers/chromium-[0-9]+/chrome-linux64/chrome$")
NODE_EXE = re.compile(r"(^|[\\/])node(\.exe)?$", re.IGNORECASE)
PINNED_IMAGE = ("967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/"
                "qualification-worker@sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c")
# W02-16: the new accepted worker tuple also binds the image configuration ID and
# the OCI source revision. All are pinned literals; none is caller-supplied. The
# previous digest sha256:7327f045... is retained only as historical provenance.
PINNED_WORKER_CONFIG_ID = "sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471"
PINNED_WORKER_REVISION = "0be04d0799c9c527e300b47c19176cddb0eaa231"
PINNED_WORKER_KIND = "worker-inventory-only"
DISABLING_FLAGS = ("--no-sandbox", "--disable-setuid-sandbox", "--disable-seccomp-filter-sandbox",
                   "--disable-namespace-sandbox", "--no-zygote", "--disable-gpu-sandbox", "--disable-sandbox")
CHROMIUM_SAFE_KINDS = ("browser", "renderer")
NS_KEYS = ("user", "mnt", "pid", "net", "ipc", "uts", "cgroup")
CAP_KEYS = ("capInhHex", "capPrmHex", "capEffHex", "capBndHex", "capAmbHex")
MAX_PIDS, MAX_THREADS, MAX_FIELD = 4096, 4096, 512
MAX_EXE_BYTES = 512 * 1024 * 1024
MAX_COMMAND_BYTES = 65536
MAX_OBSERVATION_BYTES = 2 * 1024 * 1024
MAX_POLL_SECONDS = 300
MAX_EXPORT_BYTES, MAX_EXPORT_EVENTS, MAX_EXPORT_CALLS = 8192, 40, 12
_HEX64 = re.compile(r"^[0-9a-f]{64}$")
