"""Genuine native-auth route sequence behind externally pinned owner activation.

Importing this module reads no mounts and imports no LiteLLM/Prisma/native package.
Without --run the CLI only validates nonsecret configuration and returns HOLD.
"""
import argparse
import asyncio
import contextlib
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import sys
import stat
import time
import types

# Fixed adjacent source only: -I omits script-directory module lookup, and -B
# alone would still read an unlisted .pyc. Never add this directory to sys.path.
_CONFIG_NAME = "_meri_native_auth_fixture_config"
if _CONFIG_NAME in sys.modules:
    raise RuntimeError("PRELOADED_CONFIG_MODULE")
_config_path = Path(__file__).with_name("fixture_config.py")
_config_stat = _config_path.lstat()
if not stat.S_ISREG(_config_stat.st_mode) or _config_stat.st_nlink != 1 or _config_stat.st_size > 32768 or getattr(_config_stat, "st_file_attributes", 0) & 0x400:
    raise RuntimeError("CONFIG_SOURCE_FILE")
with _config_path.open("rb") as _stream:
    _config_raw = _stream.read(32769)
if len(_config_raw) != _config_stat.st_size or len(_config_raw) > 32768:
    raise RuntimeError("CONFIG_SOURCE_BOUND")
_config = types.ModuleType(_CONFIG_NAME)
_config.__file__ = str(_config_path)
sys.modules[_CONFIG_NAME] = _config
exec(compile(_config_raw, str(_config_path), "exec"), _config.__dict__)
from _meri_native_auth_fixture_config import NativeFixture, Refused, MOUNT_NAMES, SOURCE_NAMES, parse_config, read_mounted, require, sha256, validate_activation, validate_mounts

ACTIVATION = "NATIVE_TLS_AND_RUNTIME_ACTIVATION_HOLD"
ROUTES = (("GET", "/health/liveliness"), ("GET", "/health/readiness"),
          ("POST", "/key/generate"), ("GET", "/key/info"),
          ("POST", "/key/delete"), ("GET", "/key/info"))


def activation_status(config):
    require(type(config) is NativeFixture, "TYPED_CONFIG")
    return {"status": ACTIVATION, "runtimeAdmitted": False, "providerCalls": 0}


class _DiscardUpstreamOutput:
    """Never retain upstream text: exceptions/logs may contain credentials."""
    def __init__(self, descriptor, counter):
        require(type(descriptor) is int and descriptor in (1, 2), "FIXED_OUTPUT_DESCRIPTOR")
        self._descriptor = descriptor
        self._counter = counter

    def fileno(self):
        # Prisma passes these streams to Popen; the outer context has already
        # redirected the fixed descriptors to devnull before any native import.
        return self._descriptor

    def write(self, text):
        self._counter[0] += len(text)
        require(self._counter[0] <= 2 * 1024 * 1024, "UPSTREAM_LOG_BOUND")
        return len(text)

    def flush(self):
        pass


@contextlib.contextmanager
def _discard_native_output():
    # Include native child file descriptors and asyncio's final task cleanup, not
    # just Python logging while the route coroutine is running. Borrowed standard
    # descriptors are restored; only our duplicates/null descriptor are closed.
    saved_out = os.dup(1)
    try:
        saved_err = os.dup(2)
    except BaseException:
        os.close(saved_out)
        raise
    null = None
    try:
        null = os.open(os.devnull, os.O_WRONLY)
        os.dup2(null, 1)
        os.dup2(null, 2)
        counter = [0]
        with contextlib.redirect_stdout(_DiscardUpstreamOutput(1, counter)), contextlib.redirect_stderr(_DiscardUpstreamOutput(2, counter)):
            yield
    finally:
        try:
            os.dup2(saved_out, 1)
            os.dup2(saved_err, 2)
        finally:
            os.close(saved_out)
            os.close(saved_err)
            if null is not None:
                os.close(null)


async def _fixed_route_sequence(client, server, master, deadline):
    # This is the genuine route sequence used by the future fixed app binding below.
    # It accepts no arbitrary route, model request, user identity or auth substitute.
    require(server.master_key == master and server.prisma_client is not None, "NATIVE_AUTH_NOT_INITIALIZED")
    async def request(method, path, *, key=None, body=None):
        remaining = deadline - time.monotonic()
        require(remaining > 0, "ORIGINAL_DEADLINE")
        headers = {"Authorization": "Bearer " + key} if key is not None else {}
        async with asyncio.timeout(remaining):
            response = await client.request(method, path, headers=headers, json=body)
            require(len(response.content) <= 65536, "NATIVE_RESPONSE_BOUND")
            return response

    live = await request(*ROUTES[0])
    require(live.status_code == 200 and live.json() == "I'm alive!", "LIVELINESS_FAILED")
    ready = await request(*ROUTES[1])
    require(ready.status_code == 200 and ready.json() == {"status": "healthy", "db": "connected"}, "NATIVE_DATABASE_NOT_READY")
    generated = await request(*ROUTES[2], key=master,
        body={"duration": "5m", "key_type": "read_only", "models": []})
    require(generated.status_code == 200, "KEY_GENERATION_FAILED")
    value = generated.json()
    token = value.get("key") if type(value) is dict else None
    require(type(token) is str and token.startswith("sk-") and 16 <= len(token) <= 256 and token != master, "NATIVE_KEY_SHAPE")
    info = await request(*ROUTES[3], key=token)
    require(info.status_code == 200 and type(info.json()) is dict and type(info.json().get("info")) is dict, "NATIVE_KEY_NOT_AUTHENTICATED")
    # Exactly one delete attempt. On any failure root destroys disposable state;
    # an uncertain ACK never triggers a second delete or a cleanup success claim.
    removed = await request(*ROUTES[4], key=master, body={"keys": [token]})
    require(removed.status_code == 200 and removed.json() == {"deleted_keys": [token]}, "NATIVE_KEY_DELETE_FAILED")
    rejected = await request(*ROUTES[5], key=token)
    require(rejected.status_code in (401, 403), "DELETED_KEY_STILL_AUTHENTICATED")
    return {"nativeKeyAuthenticated": True, "postDeleteDenied": True,
            "databaseReady": True, "providerCalls": 0, "runtimeAdmitted": False}


def _read_data(path, cap):
    # Fixed finite DATA read; Linux secret mounts use the stricter canonical reader.
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and 0 < before.st_size <= cap and not getattr(before, "st_file_attributes", 0) & 0x400, "DATA_FILE")
    def identity(s):
        return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(descriptor, "rb") as stream:
        opened = os.fstat(stream.fileno())
        require((opened.st_dev, opened.st_ino, opened.st_nlink, opened.st_size) == (before.st_dev, before.st_ino, before.st_nlink, before.st_size), "DATA_OPEN_DRIFT")
        raw = stream.read(cap + 1)
        require(identity(os.fstat(stream.fileno())) == identity(opened), "DATA_READ_DRIFT")
    require(identity(path.lstat()) == identity(before) and len(raw) == before.st_size, "DATA_POST_DRIFT")
    return raw


def source_pins():
    folder = Path(__file__).resolve().parent
    values = {name: sha256(_read_data(folder / name, 32768)) for name in SOURCE_NAMES}
    require(values["fixture_config.py"] == sha256(_config_raw), "LOADED_CONFIG_SOURCE_DRIFT")
    return values


def validate_environment(environment):
    for name, value in environment.items():
        if name.startswith(("AWS_", "ANTHROPIC_", "OPENAI_", "AZURE_", "GOOGLE_", "LITELLM_", "BEDROCK_", "PG")):
            require(name == "LITELLM_LOCAL_MODEL_COST_MAP" and value == "True", "AMBIENT_AUTHORITY_OR_HOOK")
        require(name not in ("DATABASE_URL", "CONFIG_FILE_PATH", "WORKER_CONFIG", "PRISMA_DATABASE_URL", "SSL_CERT_FILE", "SSL_CERT_DIR", "CURL_CA_BUNDLE", "REQUESTS_CA_BUNDLE"), "AMBIENT_DATABASE_CONFIG")


@dataclass(frozen=True)
class _PreparedProbe:
    config: NativeFixture
    deadline: float
    cleanup_deadline: float
    database_url: str = field(repr=False)
    master: str = field(repr=False)
    salt: str = field(repr=False)
    sources: tuple


def prepare_probe(config_raw, activation_raw, activation_sha):
    # Validate all fixed DATA and mounts before any genuine upstream import. The
    # descriptor's evidence is owner-reviewed input, never a measured result here.
    require(type(config_raw) is bytes and activation_raw is not None and activation_sha is not None, ACTIVATION)
    wall_ms = int(time.time() * 1000)
    mono = time.monotonic()
    config, activation = validate_activation(config_raw, activation_raw, activation_sha,
        sources=source_pins(), now_ms=wall_ms, uid=os.getuid() if hasattr(os, "getuid") else None, platform=sys.platform)
    deadline = mono + (activation["workDeadlineUnixMs"] - wall_ms) / 1000
    cleanup_deadline = mono + (activation["cleanupDeadlineUnixMs"] - wall_ms) / 1000
    validate_environment(os.environ)
    require(not any(name == "litellm" or name.startswith(("litellm.", "prisma")) for name in sys.modules), "PRELOADED_NATIVE_STATE")
    mounted = {name: read_mounted(config, name, secret=name not in ("ca.pem", "config.yaml")) for name in MOUNT_NAMES}
    database_url, master, salt = validate_mounts(config, activation, mounted)
    require(time.monotonic() < deadline, "ORIGINAL_DEADLINE")
    return _PreparedProbe(config, deadline, cleanup_deadline, database_url, master, salt, tuple(sorted(activation["sourceSha256"].items())))


async def _genuine_native_probe(prepared):
    require(type(prepared) is _PreparedProbe, ACTIVATION)
    config = prepared.config
    deadline, cleanup_deadline = prepared.deadline, prepared.cleanup_deadline
    database_url, master, salt = prepared.database_url, prepared.master, prepared.salt
    require(tuple(sorted(source_pins().items())) == prepared.sources and time.monotonic() < deadline, "SOURCE_OR_DEADLINE_DRIFT")
    environment = {"DATABASE_URL": database_url, "LITELLM_MASTER_KEY": master,
        "LITELLM_SALT_KEY": salt, "CONFIG_FILE_PATH": str(config.path("config.yaml")),
        "LITELLM_LOCAL_MODEL_COST_MAP": "True"}
    old = {name: os.environ.get(name) for name in environment}
    counter = [0]
    try:
        os.environ.update(environment)
        with contextlib.redirect_stdout(_DiscardUpstreamOutput(1, counter)), contextlib.redirect_stderr(_DiscardUpstreamOutput(2, counter)):
            # Fixed genuine upstream imports only, after root verifies full runtime.
            import httpx
            from litellm.proxy import proxy_server as server
            require(time.monotonic() < deadline, "ORIGINAL_DEADLINE")
            lifespan = server.app.router.lifespan_context(server.app)
            entered = False
            try:
                remaining = deadline - time.monotonic()
                require(remaining > 0, "ORIGINAL_DEADLINE")
                async with asyncio.timeout(remaining):
                    await lifespan.__aenter__()
                    entered = True
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app, raise_app_exceptions=False), base_url="http://native-auth.invalid", trust_env=False) as client:
                        result = await _fixed_route_sequence(client, server, master, deadline)
            finally:
                if entered:
                    remaining = cleanup_deadline - time.monotonic()
                    require(remaining > 0, "ORIGINAL_CLEANUP_DEADLINE")
                    async with asyncio.timeout(remaining):
                        await lifespan.__aexit__(None, None, None)
            require(time.monotonic() < cleanup_deadline, "ORIGINAL_CLEANUP_DEADLINE")
            return result
    finally:
        for name, value in old.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate native-auth DATA, or run one explicitly owner-activated genuine probe.", allow_abbrev=False)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--activation", type=Path)
    parser.add_argument("--activation-sha")
    args = parser.parse_args(argv)
    try:
        require(args.run == (args.activation is not None and args.activation_sha is not None), "ACTIVATION_ARGUMENTS")
        require(args.run or (args.activation is None and args.activation_sha is None), "ACTIVATION_ARGUMENTS")
        raw = _read_data(args.config, 4096)
        config = parse_config(raw)
        if not args.run:
            print(json.dumps(activation_status(config), sort_keys=True))
            return 2
        activation = _read_data(args.activation, 16384)
        # All DATA, source and secret-mount checks precede event loop allocation.
        prepared = prepare_probe(raw, activation, args.activation_sha)
        with _discard_native_output():
            result = asyncio.run(_genuine_native_probe(prepared))
        print(json.dumps({"status": "NATIVE_AUTH_FIXTURE_COMPLETED", **result}, sort_keys=True))
        return 0
    except (Exception, KeyboardInterrupt, asyncio.CancelledError):
        # Never stringify or chain upstream exceptions: they can contain secrets.
        print(json.dumps({"status": "NATIVE_AUTH_REFUSED_OR_UNKNOWN", "runtimeAdmitted": False, "cleanupPassed": False}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
