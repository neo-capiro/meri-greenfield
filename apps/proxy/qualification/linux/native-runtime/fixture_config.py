"""Inert disposable native-auth fixture configuration; never establishes authority."""
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import stat
from urllib.parse import urlsplit, unquote, parse_qsl
import uuid

PG_IMAGE = "docker.io/library/postgres@sha256:3cec7eb015ba8adb28139fa5c83b8489cdf0e666e53dfdf20f598ae0cc8739e3"
PROXY_IMAGE = "sha256:73ae63e6e2a6db5371f8b6754546830a3208cb1efc47b7065e7223f90b431aaa"
HOST = "meri-native-auth-pg"
NATIVE_USER = "meri_native_auth_app"
MOUNT = Path("/run/meri-native-auth")
MAX_WORK_SECONDS = 300
MAX_CLEANUP_SECONDS = 30

class Refused(ValueError):
    """Fixed content-free refusal; never include credentials/upstream messages."""

def require(ok, reason):
    if not ok:
        raise Refused(reason)

def pairs(rows):
    value = {}
    for key, item in rows:
        require(key not in value, "DUPLICATE_CONFIG_KEY")
        value[key] = item
    return value

@dataclass(frozen=True)
class NativeFixture:
    run_id: str
    native_url_sha256: str
    work_seconds: int
    cleanup_seconds: int
    proxy_image: str = PROXY_IMAGE

    def __post_init__(self):
        try:
            require(type(self.run_id) is str and str(uuid.UUID(self.run_id)) == self.run_id, "RUN_ID")
        except (ValueError, AttributeError, TypeError):
            raise Refused("RUN_ID") from None
        require(type(self.native_url_sha256) is str and re.fullmatch("[0-9a-f]{64}", self.native_url_sha256) is not None, "URL_PIN")
        for value, cap in ((self.work_seconds, MAX_WORK_SECONDS), (self.cleanup_seconds, MAX_CLEANUP_SECONDS)):
            require(type(value) is int and 0 < value <= cap, "FINITE_BUDGET")
        require(type(self.proxy_image) is str and re.fullmatch("sha256:[0-9a-f]{64}", self.proxy_image) is not None, "IMAGE_DIGEST")

    @property
    def root(self):
        return MOUNT / self.run_id

    @property
    def native_database(self):
        return "meri_native_auth_" + self.run_id.replace("-", "")

    @property
    def state_database(self):
        return "meri_qualification_" + self.run_id.replace("-", "")

    def path(self, name):
        require(name in ("database-url", "master-key", "salt-key", "ca.pem", "config.yaml"), "FIXED_MOUNT_MEMBER")
        return self.root / name

def parse_config(raw):
    require(type(raw) is bytes and len(raw) <= 4096, "CONFIG_BOUND")
    try:
        v = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs,
                       parse_constant=lambda _: require(False, "NONFINITE_CONFIG"))
        require(type(v) is dict and set(v) == {"schema", "runId", "postgresImage", "proxyImage", "nativeUrlSha256", "workSeconds", "cleanupSeconds"}, "CONFIG_SHAPE")
        require(v["schema"] == "meri.native-auth.fixture/1" and v["postgresImage"] == PG_IMAGE, "FIXED_ARTIFACTS")
        require(type(v["runId"]) is str and str(uuid.UUID(v["runId"])) == v["runId"], "RUN_ID")
        require(type(v["nativeUrlSha256"]) is str and re.fullmatch("[0-9a-f]{64}", v["nativeUrlSha256"]) is not None, "URL_PIN")
        for field, cap in (("workSeconds", MAX_WORK_SECONDS), ("cleanupSeconds", MAX_CLEANUP_SECONDS)):
            require(type(v[field]) is int and 0 < v[field] <= cap, "FINITE_BUDGET")
        return NativeFixture(v["runId"], v["nativeUrlSha256"], v["workSeconds"], v["cleanupSeconds"], v["proxyImage"])
    except (UnicodeError, json.JSONDecodeError, TypeError, AttributeError, ValueError) as error:
        if isinstance(error, Refused):
            raise
        raise Refused("INVALID_CONFIG") from None

def read_mounted(config, name, *, secret=True):
    require(type(config) is NativeFixture, "TYPED_CONFIG")
    path = config.path(name)
    for p in (path, *path.parents):
        info = p.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info, "st_file_attributes", 0) & 0x400, "LINKED_MOUNT")
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and 1 <= before.st_size <= 16384, "MOUNT_FILE_BOUND")
    require(os.name == "posix" and before.st_uid == os.getuid(), "LINUX_OWNED_MOUNT")
    require(stat.S_IMODE(before.st_mode) in ((0o400, 0o600) if secret else (0o400, 0o600, 0o444, 0o644)), "MOUNT_MODE")
    def identity(s):
        return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    with os.fdopen(descriptor, "rb") as stream:
        opened = os.fstat(stream.fileno())
        require(identity(opened) == identity(before), "MOUNT_OPEN_DRIFT")
        raw = stream.read(16385)
        require(identity(os.fstat(stream.fileno())) == identity(opened), "MOUNT_READ_DRIFT")
    require(identity(path.lstat()) == identity(before) and len(raw) == before.st_size, "MOUNT_POST_DRIFT")
    return raw

def bind_native_url(raw, config):
    """Bind bytes/identity only. Does NOT qualify Prisma TLS query semantics."""
    require(type(config) is NativeFixture and type(raw) is bytes and len(raw) <= 4096, "URL_BOUND")
    require(hashlib.sha256(raw).hexdigest() == config.native_url_sha256, "URL_DRIFT")
    try:
        value = raw.decode("ascii")
        require(value == value.strip() and not any(ord(c) < 33 or ord(c) > 126 for c in value), "URL_ENCODING")
        parsed = urlsplit(value)
        require(parsed.scheme == "postgresql" and parsed.hostname == HOST and parsed.port == 5432 and not parsed.fragment, "NATIVE_ENDPOINT")
        require(unquote(parsed.username or "") == NATIVE_USER and bool(parsed.password), "NONOWNER_NATIVE_ROLE")
        require(parsed.path == "/" + config.native_database, "NATIVE_DATABASE")
        query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
        require(len(query) <= 8 and len({k for k, _ in query}) == len(query), "AMBIGUOUS_NATIVE_QUERY")
        require(all(k != "host" for k, _ in query), "EFFECTIVE_HOST_OVERRIDE")
        # No libpq-to-Prisma equivalence or accepted query-key allowlist is invented.
        # The operational probe remains disabled until exact native TLS is reviewed.
        return value
    except (UnicodeError, ValueError) as error:
        if isinstance(error, Refused):
            raise
        raise Refused("INVALID_NATIVE_URL") from None

def proxy_config():
    """Fixed supported config; root writes the exact mounted YAML/JSON file."""
    return {"model_list": [], "router_settings": {"num_retries": 0, "fallbacks": []},
            "general_settings": {"master_key": "os.environ/LITELLM_MASTER_KEY",
                "database_url": "os.environ/DATABASE_URL", "background_health_checks": False,
                "disable_model_info_refresh": True, "allow_public_health_readiness_details": False},
            "litellm_settings": {"callbacks": [], "turn_off_message_logging": True,
                "redact_messages_in_exceptions": True, "redact_user_api_key_info": True}}


SOURCE_NAMES = ("fixture_config.py", "native_auth_probe.py")
MOUNT_NAMES = ("database-url", "master-key", "salt-key", "ca.pem", "config.yaml")
PREREQUISITES = ("positiveEncryptedPrismaQuery", "wrongCaDenied", "wrongSanDenied",
                "plaintextDenied", "wrongPasswordScramDenied", "nonownerRole",
                "nativeSchemaInitialized", "ownedCleanupPlan")
ENGINE = "ac9d7041ed77bcc8a8dbd2ab6616b39013829574"
TLS_DISCOVERY = "4fa4672b51d80d83caa27e3dddfb26e40fd0bad1"


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def _hash_map(value, names, reason):
    require(type(value) is dict and set(value) == set(names), reason)
    require(all(type(v) is str and re.fullmatch("[0-9a-f]{64}", v) for v in value.values()), reason)


def validate_activation(config_raw, raw, expected_sha, *, sources, now_ms, uid, platform):
    """Validate reviewed DATA only. The external SHA is supplied by trusted owner.

    Evidence references do not manufacture successful TLS/bootstrap observations.
    The root supervisor must bind the actually launched image to this descriptor.
    """
    config = parse_config(config_raw)
    require(type(raw) is bytes and 0 < len(raw) <= 16384, "ACTIVATION_BOUND")
    require(type(expected_sha) is str and re.fullmatch("[0-9a-f]{64}", expected_sha) is not None and sha256(raw) == expected_sha, "ACTIVATION_SHA")
    try:
        v = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs,
                       parse_constant=lambda _: require(False, "NONFINITE_ACTIVATION"))
    except (UnicodeError, json.JSONDecodeError):
        raise Refused("ACTIVATION_JSON") from None
    require(type(v) is dict and set(v) == {"schema", "decision", "runId", "configSha256", "imageSha256", "sourceSha256", "linuxUid", "notBeforeUnixMs", "startDeadlineUnixMs", "workDeadlineUnixMs", "cleanupDeadlineUnixMs", "mountedSha256", "tls", "prerequisiteEvidenceSha256"}, "ACTIVATION_SHAPE")
    require(v["schema"] == "meri.native-auth.activation/1" and v["decision"] == "ADMIT_ONE_SYNTHETIC_NATIVE_AUTH_PROBE", "ACTIVATION_DECISION")
    require(v["runId"] == config.run_id and v["configSha256"] == sha256(config_raw) and v["imageSha256"] == config.proxy_image, "ACTIVATION_BINDING")
    _hash_map(v["sourceSha256"], SOURCE_NAMES, "SOURCE_PINS")
    require(type(sources) is dict and sources == v["sourceSha256"], "SOURCE_DRIFT")
    require(type(v["linuxUid"]) is int and v["linuxUid"] == 10001 and type(uid) is int and uid == 10001 and platform == "linux", "LINUX_UID")
    clocks = [v[name] for name in ("notBeforeUnixMs", "startDeadlineUnixMs", "workDeadlineUnixMs", "cleanupDeadlineUnixMs")]
    require(all(type(n) is int and 0 < n < 2**53 for n in clocks) and type(now_ms) is int, "ACTIVATION_CLOCK")
    start, latest, work, total = clocks
    require(start <= now_ms <= latest <= start + 60000 and latest < work and work == start + config.work_seconds * 1000 and total == work + config.cleanup_seconds * 1000, "ORIGINAL_DEADLINES")
    _hash_map(v["mountedSha256"], MOUNT_NAMES, "MOUNT_PINS")
    require(v["mountedSha256"]["database-url"] == config.native_url_sha256, "URL_PIN")
    require(v["tls"] == {"engineCommit": ENGINE, "discoveryCommit": TLS_DISCOVERY,
        "sslmode": "require", "sslaccept": "strict", "sslcert": config.path("ca.pem").as_posix(),
        "host": HOST, "serverMinimumProtocol": "TLSv1.2"}, "PINNED_NATIVE_TLS")
    _hash_map(v["prerequisiteEvidenceSha256"], PREREQUISITES, "PREREQUISITE_EVIDENCE")
    return config, v


def validate_mounts(config, activation, mounted):
    require(type(mounted) is dict and set(mounted) == set(MOUNT_NAMES) and all(type(v) is bytes for v in mounted.values()), "MOUNT_SHAPE")
    require({k: sha256(v) for k, v in mounted.items()} == activation["mountedSha256"], "MOUNT_DRIFT")
    value = bind_native_url(mounted["database-url"], config)
    require(parse_qsl(urlsplit(value).query, keep_blank_values=True, strict_parsing=True) == [
        ("sslmode", "require"), ("sslaccept", "strict"), ("sslcert", config.path("ca.pem").as_posix())], "NATIVE_TLS_URL")
    for name in ("master-key", "salt-key"):
        raw = mounted[name]
        require(32 <= len(raw) <= 256 and all(33 <= b <= 126 for b in raw), "MOUNTED_KEYS_INVALID")
    require(mounted["master-key"].startswith(b"sk-") and mounted["master-key"] != mounted["salt-key"], "MOUNTED_KEYS_INVALID")
    require(mounted["ca.pem"].startswith(b"-----BEGIN CERTIFICATE-----\n") and mounted["ca.pem"].rstrip().endswith(b"-----END CERTIFICATE-----"), "CA_PEM_SHAPE")
    expected = (json.dumps(proxy_config(), sort_keys=True, separators=(",", ":")) + "\n").encode()
    require(mounted["config.yaml"] == expected, "FIXED_UPSTREAM_CONFIG")
    return value, mounted["master-key"].decode("ascii"), mounted["salt-key"].decode("ascii")
