"""Closed startup data and read-only reviewed-file custody; no native imports."""
from dataclasses import dataclass
import hashlib
import ipaddress
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import time
from ..qualification.state.pricing import PRICING_REVISION, StateDenied
from .owner_channel import OwnerPeerPolicy

_SHA = re.compile(r"[0-9a-f]{64}\Z")

def _deny():
    raise StateDenied("PRODUCT_PROXY_STARTUP_DENIED")


def _sha(value):
    if type(value) is not str or not _SHA.fullmatch(value):
        _deny()
    return value


def _closed(value, keys):
    if type(value) is not dict or set(value) != set(keys):
        _deny()
    return value


def _pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            _deny()
        result[key] = value
    return result


@dataclass(frozen=True)
class ProductProxyConfiguration:
    raw: bytes

    @property
    def value(self):
        # No caller can change the admitted configuration after parsing it.
        return json.loads(self.raw)


def parse_product_proxy_startup(raw, expected_sha256, *, now_ms=None):
    if (type(raw) is not bytes or not 1 <= len(raw) <= 128*1024
            or hashlib.sha256(raw).hexdigest() != _sha(expected_sha256)):
        _deny()
    try:
        value = json.loads(raw.decode("utf-8", "strict"), object_pairs_hook=_pairs,
                           parse_constant=lambda _value: _deny())
        _closed(value, ("schemaVersion", "enabled", "deploymentRevision", "expiresAtMs",
                        "pricingRevision", "serverTls", "ownerPeer", "ownerTls",
                        "ownerIpv4", "proxyIpv4"))
        at = (now_ms or (lambda: time.time_ns()//1000000))()
        if (type(value["schemaVersion"]) is not int or value["schemaVersion"] != 1
                or value["enabled"] is not True
                or type(value["expiresAtMs"]) is not int or not at < value["expiresAtMs"] <= 9007199254740991
                or type(value["deploymentRevision"]) is not str
                or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value["deploymentRevision"])
                or value["pricingRevision"] != PRICING_REVISION):
            _deny()
        _closed(value["serverTls"], ("certificateFile", "privateKeyFile", "certificateSha256"))
        _sha(value["serverTls"]["certificateSha256"])
        _closed(value["ownerTls"], ("caFile", "certificateFile", "privateKeyFile"))
        for section in ("serverTls", "ownerTls"):
            for key, ref in value[section].items():
                if key.endswith("File"):
                    _closed(ref, ("path", "sha256")); _sha(ref["sha256"])
                    path = ref["path"]
                    if (type(path) is not str or not path.isascii()
                            or not PurePosixPath(path).is_absolute()
                            or ".." in PurePosixPath(path).parts or "\x00" in path
                            or str(PurePosixPath(path)) != path):
                        _deny()
        fields = set(OwnerPeerPolicy.__dataclass_fields__)
        _closed(value["ownerPeer"], fields)
        policy = OwnerPeerPolicy(**value["ownerPeer"])
        if policy.max_exchange_ms > 3000:
            _deny()
        addresses = []
        for key in ("ownerIpv4", "proxyIpv4"):
            addr = ipaddress.IPv4Address(value[key])
            if str(addr) != value[key] or not any(addr in ipaddress.IPv4Network(network)
                    for network in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")):
                _deny()
            addresses.append(addr)
        if addresses[0] == addresses[1]:
            _deny()
    except StateDenied:
        raise
    except Exception:
        _deny()
    return ProductProxyConfiguration(bytes(raw))


def read_reviewed_file(path, expected_sha256, *, secret=False, maximum=128*1024):
    """Read explicit files only; never discover credentials or change modes."""
    descriptor = None
    try:
        location = Path(path)
        if not location.is_absolute() or location.is_symlink():
            _deny()
        for parent in location.parents:
            if parent.is_symlink():
                _deny()
        descriptor = os.open(location, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
                             | getattr(os, "O_NONBLOCK", 0))
        before = os.fstat(descriptor)
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1
                or not 0 < before.st_size <= maximum
                or getattr(before, "st_file_attributes", 0) & 0x400):
            _deny()
        if os.name == "posix":
            if (before.st_uid not in (0, os.geteuid()) or before.st_mode & 0o022
                    or (secret and before.st_mode & 0o077)):
                _deny()
        raw = os.read(descriptor, maximum+1)
        after = os.fstat(descriptor)
        stable = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns", "st_mode", "st_nlink")
        if (any(getattr(before, key) != getattr(after, key) for key in stable)
                or len(raw) != before.st_size or hashlib.sha256(raw).hexdigest() != _sha(expected_sha256)):
            _deny()
        return raw
    except StateDenied:
        raise
    except Exception:
        _deny()
    finally:
        if descriptor is not None:
            os.close(descriptor)


def _environment():
    if os.environ.get("MERI_PRODUCT_PROXY_REQUIRED") != "1":
        _deny()
    allowed_aws = {"AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", "AWS_REGION", "AWS_DEFAULT_REGION"}
    for key in os.environ:
        upper = key.upper()
        if key == "LITELLM_LOCAL_MODEL_COST_MAP" and os.environ[key] == "True":
            continue  # The unchanged pinned Linux assembly's offline-cost setting.
        if ((upper.startswith("AWS_") and key not in allowed_aws)
                or upper.startswith(("ANTHROPIC_", "OPENAI_", "AZURE_", "LITELLM_"))
                or upper in {"DATABASE_URL", "LITELLM_DATABASE_URL", "CONFIG_FILE_PATH", "WORKER_CONFIG",
                             "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"}):
            _deny()
    uri = os.environ.get("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", "")
    if not re.fullmatch(r"/v2/credentials/[A-Za-z0-9_-]{1,128}", uri):
        _deny()
    if any(os.environ.get(key, "us-east-1") != "us-east-1" for key in ("AWS_REGION", "AWS_DEFAULT_REGION")):
        _deny()
