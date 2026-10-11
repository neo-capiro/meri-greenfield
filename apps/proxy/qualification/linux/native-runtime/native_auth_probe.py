"""Prepared genuine native-auth route sequence. Operational activation is HOLD.

Importing this module reads no mounts and imports no LiteLLM/Prisma/native package.
The CLI only validates nonsecret configuration; it cannot run the private sequence.
"""
import argparse
import asyncio
import contextlib
import json
import os
from pathlib import Path
import time

from fixture_config import NativeFixture, Refused, bind_native_url, parse_config, proxy_config, read_mounted, require

ACTIVATION = "NATIVE_TLS_AND_RUNTIME_ACTIVATION_HOLD"
ROUTES = (("GET", "/health/liveliness"), ("GET", "/health/readiness"),
          ("POST", "/key/generate"), ("GET", "/key/info"),
          ("POST", "/key/delete"), ("GET", "/key/info"))


def activation_status(config):
    require(type(config) is NativeFixture, "TYPED_CONFIG")
    return {"status": ACTIVATION, "runtimeAdmitted": False, "providerCalls": 0}


class _DiscardUpstreamOutput:
    """Never retain upstream text: exceptions/logs may contain credentials."""
    def __init__(self):
        self.count = 0

    def write(self, text):
        self.count += len(text)
        require(self.count <= 2 * 1024 * 1024, "UPSTREAM_LOG_BOUND")
        return len(text)

    def flush(self):
        pass


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
    token = None
    deleted = False
    try:
        generated = await request(*ROUTES[2], key=master,
            body={"duration": "5m", "key_type": "read_only", "models": []})
        require(generated.status_code == 200, "KEY_GENERATION_FAILED")
        value = generated.json()
        token = value.get("key") if type(value) is dict else None
        require(type(token) is str and token.startswith("sk-") and 16 <= len(token) <= 256 and token != master, "NATIVE_KEY_SHAPE")
        info = await request(*ROUTES[3], key=token)
        require(info.status_code == 200 and type(info.json()) is dict and type(info.json().get("info")) is dict, "NATIVE_KEY_NOT_AUTHENTICATED")
        removed = await request(*ROUTES[4], key=master, body={"keys": [token]})
        require(removed.status_code == 200 and removed.json() == {"deleted_keys": [token]}, "NATIVE_KEY_DELETE_FAILED")
        deleted = True
        rejected = await request(*ROUTES[5], key=token)
        require(rejected.status_code in (401, 403), "DELETED_KEY_STILL_AUTHENTICATED")
        return {"nativeKeyAuthenticated": True, "postDeleteDenied": True,
                "databaseReady": True, "providerCalls": 0, "runtimeAdmitted": False}
    finally:
        # A failure does not earn cleanup success. Root owns DB/volume destruction.
        # Do not silently retry an uncertain delete; its ACK may have been lost.
        if token is not None and not deleted:
            # No secret or credential-derived value is emitted in this outcome.
            pass


async def _genuine_native_probe(config):
    """Source-only fixed composition. No entrypoint currently admits this call.

    Removing HOLD requires a separate reviewed native TLS/runtime allocation. The
    body below records exact public lifespan/ASGI semantics, never a fake app.
    """
    raise Refused(ACTIVATION)
    # Intentionally unreachable until that separate allocation; no --run option.
    mounted_url = read_mounted(config, "database-url")
    database_url = bind_native_url(mounted_url, config)
    master = read_mounted(config, "master-key").decode("ascii")
    salt = read_mounted(config, "salt-key").decode("ascii")
    require(master.startswith("sk-") and 32 <= len(master) <= 256 and len(salt) >= 32 and master != salt, "MOUNTED_KEYS_INVALID")
    settings = read_mounted(config, "config.yaml", secret=False)
    require(settings == (json.dumps(proxy_config(), sort_keys=True, separators=(",", ":")) + "\n").encode(), "FIXED_UPSTREAM_CONFIG")
    environment = {"DATABASE_URL": database_url, "LITELLM_MASTER_KEY": master,
        "LITELLM_SALT_KEY": salt, "CONFIG_FILE_PATH": str(config.path("config.yaml")),
        "LITELLM_LOCAL_MODEL_COST_MAP": "True"}
    old = {name: os.environ.get(name) for name in environment}
    deadline = time.monotonic() + config.work_seconds
    sink = _DiscardUpstreamOutput()
    try:
        os.environ.update(environment)
        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            # Fixed genuine upstream imports only, after root verifies full runtime.
            import httpx
            from litellm.proxy import proxy_server as server
            lifespan = server.app.router.lifespan_context(server.app)
            entered = False
            try:
                remaining = deadline - time.monotonic()
                require(remaining > 0, "ORIGINAL_DEADLINE")
                async with asyncio.timeout(remaining):
                    await lifespan.__aenter__()
                    entered = True
                    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app, raise_app_exceptions=False), base_url="http://native-auth.invalid", trust_env=False) as client:
                        return await _fixed_route_sequence(client, server, master, deadline)
            finally:
                if entered:
                    async with asyncio.timeout(config.cleanup_seconds):
                        await lifespan.__aexit__(None, None, None)
    finally:
        for name, value in old.items():
            if value is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = value


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate native-auth fixture DATA; execution remains HOLD.")
    parser.add_argument("--config", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        with args.config.open("rb") as stream:
            config = parse_config(stream.read(4097))
        print(json.dumps(activation_status(config), sort_keys=True))
        return 2
    except (OSError, Refused):
        print(json.dumps({"status": "CONFIG_REFUSED", "runtimeAdmitted": False}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
