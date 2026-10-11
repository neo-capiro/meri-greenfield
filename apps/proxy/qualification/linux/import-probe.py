"""Guarded genuine community app import only; no lifespan, DB, listener or model."""
import argparse
import contextlib
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import signal
import sys
import time

DENIED = []
SENSITIVE_PREFIXES = ("AWS_", "ANTHROPIC_", "OPENAI_", "AZURE_", "GOOGLE_", "LITELLM_MASTER", "DATABASE_URL")
REFUSAL_REASONS = {"EXPECTED_LINUX_PYTHON313_UID10001", "SENSITIVE_AMBIENT_ENVIRONMENT",
                   "FIXED_VENV_REQUIRED", "IMPORT_DEADLINE", "PINNED_PACKAGE_VERSION_MISMATCH",
                   "ENTERPRISE_PACKAGE_PRESENT", "GENUINE_APP_OR_GENERATED_CLIENT_MISSING", "ROUTE_COUNT_BOUND"}


def audit(event, args):
    if (event.startswith("socket.") or event in {"subprocess.Popen", "os.system", "os.posix_spawn",
            "os.posix_spawnp", "os.fork", "os.forkpty", "os.exec", "os.spawn"}):
        if len(DENIED) < 64:
            DENIED.append(event)  # No addresses, arguments, credentials or payloads.
        raise PermissionError("QUALIFICATION_EXTERNAL_EFFECT_DENIED")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)  # --help precedes runtime/config/IO.
    result = {"schema": "meri.proxy.community-import/1", "status": "IMPORT_REFUSED",
              "importCompleted": False, "generatedPrismaPresent": False, "appCallable": False,
              "routeCount": None, "deniedAuditEvents": DENIED, "runtimeAdmitted": False,
              "lifespanStarted": False, "databaseConnected": False, "providerCalls": 0}
    started = time.monotonic()
    try:
        if sys.platform != "linux" or sys.version_info[:2] != (3, 13) or os.getuid() != 10001:
            raise RuntimeError("EXPECTED_LINUX_PYTHON313_UID10001")
        if any(k.upper().startswith(SENSITIVE_PREFIXES) for k in os.environ):
            raise RuntimeError("SENSITIVE_AMBIENT_ENVIRONMENT")
        if Path(sys.prefix) != Path("/opt/meri-proxy-venv"):
            raise RuntimeError("FIXED_VENV_REQUIRED")
        sys.addaudithook(audit)
        signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError("IMPORT_DEADLINE")))
        signal.alarm(45)  # External container deadline is also required.
        # Preserve upstream diagnostics on stderr; stdout is the final record.
        with contextlib.redirect_stdout(sys.stderr):
            import litellm.proxy.proxy_server as upstream
            from prisma.client import BINARY_PATHS, Prisma
        versions = {name: importlib.metadata.version(name) for name in ("litellm", "litellm-proxy-extras", "prisma")}
        if versions != {"litellm": "1.104.2", "litellm-proxy-extras": "0.4.102.post1", "prisma": "0.11.0"}:
            raise RuntimeError("PINNED_PACKAGE_VERSION_MISMATCH")
        if importlib.util.find_spec("litellm_enterprise") is not None:
            raise RuntimeError("ENTERPRISE_PACKAGE_PRESENT")
        app = upstream.app
        if not callable(app) or not isinstance(Prisma, type) or not BINARY_PATHS.query_engine:
            raise RuntimeError("GENUINE_APP_OR_GENERATED_CLIENT_MISSING")
        # Routes are observed without invoking handlers or startup/lifespan.
        routes = [{"path": r.path, "methods": sorted(r.methods or [])}
                  for r in app.routes if hasattr(r, "path") and hasattr(r, "methods")]
        if not 1 <= len(routes) <= 2000:
            raise RuntimeError("ROUTE_COUNT_BOUND")
        raw = json.dumps(routes, sort_keys=True, separators=(",", ":")).encode()
        result.update(status="GENUINE_IMPORT_OBSERVED_NOT_AUTHENTICATION", importCompleted=True,
                      generatedPrismaPresent=True, appCallable=True, routeCount=len(routes),
                      routeSha256=hashlib.sha256(raw).hexdigest(), packageVersions=versions,
                      auditDenialsRequireReview=bool(DENIED))
        return_code = 0
    except BaseException as error:
        result.update(errorType=type(error).__name__)
        if isinstance(error, ModuleNotFoundError) and error.name and all(c.isalnum() or c in "._" for c in error.name):
            result["missingModule"] = error.name[:200]
        # Fixed exception text only, because arbitrary upstream messages may contain environment values.
        if isinstance(error, (RuntimeError, TimeoutError)) and str(error) in REFUSAL_REASONS:
            result["reason"] = str(error)
        import traceback
        frames = traceback.extract_tb(error.__traceback__)[-12:]
        result["trace"] = [{"moduleFile": Path(f.filename).name, "function": f.name, "line": f.lineno} for f in frames]
        return_code = 1
    finally:
        if sys.platform == "linux":
            signal.alarm(0)
        result["seconds"] = time.monotonic() - started
        print(json.dumps(result, sort_keys=True))
    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
