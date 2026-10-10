"""W02-17/20 config: immutable pins, compiled patterns and bounds.

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

BROWSER_VERSION = "155.0.8059.12"
PROBE_CMD = "/opt/meri-worker/probes/browser.mjs"
EXPECTED_SECCOMP_PATH = "/opt/meri-browser-host/seccomp.json"
EXPECTED_SECCOMP_SHA256 = "e62f4c3e3e7ce6de099ba7a0e3df0881b7b407b74dc664aef70f76f6316385c6"
WORKSPACE_SOURCE = "/workspace/browser-host"
RESOURCE_CAPS = {"PidsLimit": 512, "Memory": 4 * 1024 ** 3, "NanoCpus": 2 * 10 ** 9, "ShmSize": 1 * 1024 ** 3}
EXPORT_CHUNK_RAW_MAX, EXPORT_CHUNK_B64_MAX, EXPORT_EVENT_MAX = 6144, 8192, 12 * 1024
EXPORT_TOTAL_RAW_MAX, EXPORT_MAX_EVENTS, EXPORT_MAX_CALLS = 8 * 1024 * 1024, 1500, 32
EXPORT_BATCH_BYTES, EXPORT_BATCH_EVENTS, EXPORT_EVENT_OVERHEAD = 900 * 1024, 100, 26
CAPTURE_FILE_MAX = 2 * 1024 * 1024
REQUIRED_SUBSTEPS = ("get_config", "nav-fixture", "snapshot", "download-nav", "download-bytes",
                     "version-nav", "version-eval", "sandbox-nav", "sandbox-eval")
SHA256_PREFIXED = re.compile(r"^sha256:[0-9a-f]{64}$")
SUPPORT_PATTERN = re.compile(r"^" + re.escape(PINNED_IMAGE.split("@")[0]) + r"@sha256:[0-9a-f]{64}$")
SAFE_IMAGE_ENV = {
    "PATH": "/opt/meri-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "NODE_VERSION": "24.21.0", "YARN_VERSION": "1.22.22",
    "HOME": "/workspace/home", "TMPDIR": "/tmp", "CLAUDE_CONFIG_DIR": "/workspace/config",
    "PLAYWRIGHT_BROWSERS_PATH": "/opt/meri-browsers", "NODE_ENV": "production",
    "MERI_QUALIFICATION_ONLY": "true", "MERI_SOURCES_ENABLED": "false", "CHROMIUM_SANDBOX_REQUIRED": "true",
}
CONTEXT_KEYS = {"run", "supportImage", "workerImage", "profileSha", "source"}
RECORD_NAMES = {"run-record", "observer", "browser", "inspect", "versions", "preflight", "browserStdout", "browserStderr", "capture", "exit", "timer"}

# W02-23A v2 source protocol: NEW separately inventoried finite constants only.
# No existing binding above is overwritten; these are additive rows/names.
SOURCE_SCHEMA_V2 = "meri-browser-source/2"
SOURCE_MANIFEST_NAME = "source-manifest.v2.json"
SOURCE_MANIFEST_MAX = 32768
SOURCE_ASSET_MAX = 2097152
SOURCE_AGGREGATE_MAX = 14 * 2097152
SOURCE_PACKAGE_DIR = "host_evidence"
SOURCE_MANIFEST_KEYS = ("assets", "schema")
SOURCE_RECORD_KEYS = ("bytes", "path", "sha256")
SOURCE_ASSET_PATHS = (
    "bootstrap.sh",
    "host-evidence.py",
    "host_evidence/__init__.py",
    "host_evidence/admission.py",
    "host_evidence/browser_capture.py",
    "host_evidence/classification.py",
    "host_evidence/cli.py",
    "host_evidence/collection.py",
    "host_evidence/config.py",
    "host_evidence/evidence_io.py",
    "host_evidence/export_protocol.py",
    "host_evidence/poll.py",
    "host_evidence/source_binding.py",
    "seccomp.json",
)
SOURCE_PROFILE_ASSET = "seccomp.json"
