"""Unmounted direct-TLS, task-bearer and fresh ECS/ENI ingress adapter.

The TLS server, persisted capability lookup and bounded AWS clients are
trusted ports. No HTTP header supplies a task ARN, run, grant or peer IP.
"""
import asyncio
from dataclasses import dataclass
from datetime import datetime
import hashlib
import ipaddress
import json
import math
import re
import time

from ..qualification.runtime.ingress import IngressAdmission, PeerLease
from ..qualification.runtime.server import TrustedRequest
from ..qualification.state.admission import GrantAdmission
from ..qualification.state.grants import RunBinding, identifier
from ..qualification.state.pricing import StateDenied


_PRIVATE = tuple(ipaddress.ip_network(value) for value in
                 ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))
_AWS_ID = re.compile(r"^(?:eni|subnet|vpc|sg)-[a-f0-9]{8,17}$")
_HEX64 = re.compile(r"^[a-f0-9]{64}$")
_EXECUTION_KEYS = frozenset(("tenantId", "actorId", "conversationId", "runId",
                             "attemptId", "workerId", "writerFence"))


def _deny():
    raise StateDenied("PRODUCT_DIRECT_PEER_DENIED")


def _private_ipv4(value):
    try:
        address = ipaddress.IPv4Address(value)
    except (ValueError, TypeError):
        _deny()
    if type(value) is not str or str(address) != value or not any(address in net for net in _PRIVATE):
        _deny()
    return value


def _execution_binding_sha256(value, budget_binding):
    """Canonical JSON SHA of the seven-field original execution RunBinding."""
    if type(value) is not dict or set(value) != _EXECUTION_KEYS:
        _deny()
    for key in ("tenantId", "actorId"):
        item = value[key]
        if type(item) is not str or not 1 <= len(item) <= 128:
            _deny()
        try:
            if len(item.encode("utf-8", "strict")) > 512:
                _deny()
        except UnicodeError:
            _deny()
    for key in ("conversationId", "runId", "attemptId", "workerId"):
        identifier(value[key])
    fence = value["writerFence"]
    if (type(fence) is not int or not 1 <= fence <= 9007199254740991
            or value["runId"] != budget_binding.run_id or fence != budget_binding.fence):
        _deny()
    try:
        encoded = json.dumps(value, sort_keys=True, ensure_ascii=False,
                             separators=(",", ":"), allow_nan=False).encode("utf-8", "strict")
    except (TypeError, ValueError, UnicodeError):
        _deny()
    return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True)
class DirectTlsSocketPeer:
    """From a reviewed direct TLS server's actual socket, never an ASGI header."""

    ipv4: str
    port: int
    tls_version: str

    def __post_init__(self):
        _private_ipv4(self.ipv4)
        if (type(self.port) is not int or not 1 <= self.port <= 65535
                or self.tls_version not in ("TLSv1.2", "TLSv1.3")):
            _deny()


@dataclass(frozen=True)
class IssuedTaskNetwork:
    """Control-owned persisted issuance and placement, never a caller claim."""

    binding: RunBinding
    grant_id: str
    cluster_arn: str
    task_definition_arn: str
    container_name: str
    image_digest: str
    execution_binding: dict
    started_by: str
    group: str
    created_at_ms: int
    expires_at_ms: int
    vpc_id: str
    subnet_id: str
    security_group_ids: tuple
    tags: tuple

    def __post_init__(self):
        if type(self.binding) is not RunBinding:
            _deny()
        identifier(self.grant_id)
        prefix = "arn:aws:ecs:us-east-1:967807252336:"
        cluster = self.cluster_arn.removeprefix(prefix + "cluster/") if type(self.cluster_arn) is str else ""
        if (not self.cluster_arn.startswith(prefix + "cluster/")
                or not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", cluster)
                or self.binding.worker_arn != prefix + "task/" + cluster + "/" + self.binding.worker_arn.rsplit("/", 1)[-1]
                or type(self.task_definition_arn) is not str
                or not re.fullmatch(re.escape(prefix) + r"task-definition/[A-Za-z0-9_-]+:[1-9][0-9]*", self.task_definition_arn)
                or type(self.container_name) is not str
                or not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", self.container_name)
                or type(self.image_digest) is not str or not re.fullmatch(r"sha256:[a-f0-9]{64}", self.image_digest)
                or type(self.started_by) is not str or not _HEX64.fullmatch(self.started_by)
                or self.group != "meri:" + self.started_by
                or type(self.created_at_ms) is not int or type(self.expires_at_ms) is not int
                or not 0 < self.created_at_ms < self.expires_at_ms
                or type(self.security_group_ids) is not tuple
                or not 1 <= len(self.security_group_ids) <= 5
                or len(set(self.security_group_ids)) != len(self.security_group_ids)
                or type(self.tags) is not tuple or len(self.tags) < 4):
            _deny()
        for value, kind in ((self.vpc_id, "vpc"), (self.subnet_id, "subnet")):
            if type(value) is not str or not _AWS_ID.fullmatch(value) or not value.startswith(kind + "-"):
                _deny()
        if any(type(value) is not str or not _AWS_ID.fullmatch(value) or not value.startswith("sg-")
               for value in self.security_group_ids):
            _deny()
        if (any(type(item) is not tuple or len(item) != 2
                or type(item[0]) is not str or type(item[1]) is not str for item in self.tags)
                or len({item[0] for item in self.tags}) != len(self.tags)
                or not {"meri:execution-id", "meri:binding-sha256", "meri:plan-sha256",
                        "meri:expires-at-ms"}.issubset({key for key, _ in self.tags})):
            _deny()
        required = dict(self.tags)
        execution_sha = _execution_binding_sha256(self.execution_binding, self.binding)
        if (self.started_by != execution_sha
                or required["meri:execution-id"] != execution_sha
                or required["meri:expires-at-ms"] != str(self.expires_at_ms)
                or required["meri:binding-sha256"] != execution_sha
                or not _HEX64.fullmatch(required["meri:plan-sha256"])):
            _deny()
        object.__setattr__(self, "execution_binding", self.execution_binding.copy())


@dataclass(frozen=True)
class ProductBearerSource:
    authority: GrantAdmission
    issued: IssuedTaskNetwork

    def __post_init__(self):
        if (type(self.authority) is not GrantAdmission or self.authority.namespace != "product"
                or type(self.issued) is not IssuedTaskNetwork
                or self.authority.binding != self.issued.binding
                or self.authority.grant_id != self.issued.grant_id):
            _deny()


class FreshEcsEniReader:
    """Read exact issued task and attached ENI on every call with bounded clients.

    The injected ECS/EC2 clients must have separately reviewed short deadlines,
    retries disabled, and task-role read permissions. This class opens no client.
    Configured socket timeouts and the post-read elapsed check are not a hard
    bound on a synchronous callback or DNS stall before RequestLifetime starts.
    """

    def __init__(self, ecs_client, ec2_client):
        if not callable(getattr(ecs_client, "describe_tasks", None)) or not callable(
                getattr(ec2_client, "describe_network_interfaces", None)):
            _deny()
        for client, service in ((ecs_client, "ecs"), (ec2_client, "ec2")):
            meta = getattr(client, "meta", None)
            config = getattr(meta, "config", None)
            retries = getattr(config, "retries", None)
            if (getattr(meta, "region_name", None) != "us-east-1"
                    or getattr(meta, "endpoint_url", None) !=
                    f"https://{service}.us-east-1.amazonaws.com"
                    or type(getattr(config, "connect_timeout", None)) not in (int, float)
                    or not 0 < config.connect_timeout <= 1
                    or type(getattr(config, "read_timeout", None)) not in (int, float)
                    or not 0 < config.read_timeout <= 1
                    or type(retries) is not dict
                    or retries.get("total_max_attempts") != 1):
                _deny()
        self.ecs, self.ec2 = ecs_client, ec2_client

    def __call__(self, issued, expected_ip):
        if type(issued) is not IssuedTaskNetwork:
            _deny()
        _private_ipv4(expected_ip)
        started_at = time.monotonic()
        try:
            result = self.ecs.describe_tasks(cluster=issued.cluster_arn,
                                             tasks=[issued.binding.worker_arn], include=["TAGS"])
            if type(result) is not dict or result.get("failures") or len(result.get("tasks", [])) != 1:
                _deny()
            task = result["tasks"][0]
            if (task.get("taskArn") != issued.binding.worker_arn
                    or task.get("clusterArn") != issued.cluster_arn
                    or task.get("taskDefinitionArn") != issued.task_definition_arn
                    or task.get("startedBy") != issued.started_by
                    or task.get("group") != issued.group
                    or task.get("launchType") != "FARGATE"
                    or task.get("platformFamily") != "Linux"
                    or task.get("platformVersion") != "1.4.0"
                    or task.get("enableExecuteCommand") is not False
                    or task.get("lastStatus") != "RUNNING"
                    or task.get("desiredStatus") != "RUNNING"
                    or type(task.get("createdAt")) is not datetime
                    or int(task["createdAt"].timestamp() * 1000) != issued.created_at_ms):
                _deny()
            tags = task.get("tags")
            if type(tags) is not list or any(type(row) is not dict for row in tags):
                _deny()
            pairs = [(row.get("key"), row.get("value")) for row in tags]
            if len({key for key, _ in pairs}) != len(pairs) or not set(issued.tags).issubset(set(pairs)):
                _deny()
            containers = task.get("containers")
            task_id = issued.binding.worker_arn.rsplit("/", 1)[-1]
            container_prefix = issued.cluster_arn.replace("cluster/", "container/", 1) + "/" + task_id + "/"
            if (type(containers) is not list or len(containers) != 1
                    or containers[0].get("name") != issued.container_name
                    or containers[0].get("taskArn", issued.binding.worker_arn) != issued.binding.worker_arn
                    or type(containers[0].get("containerArn")) is not str
                    or not containers[0]["containerArn"].startswith(container_prefix)
                    or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}",
                                        containers[0]["containerArn"][len(container_prefix):])
                    or containers[0].get("lastStatus") != "RUNNING"
                    or containers[0].get("imageDigest") != issued.image_digest
                    or type(containers[0].get("image")) is not str
                    or not containers[0]["image"].endswith("@" + issued.image_digest)):
                _deny()
            attachments = [row for row in task.get("attachments", [])
                           if row.get("type") == "ElasticNetworkInterface"]
            if len(attachments) != 1 or attachments[0].get("status") != "ATTACHED":
                _deny()
            details = attachments[0].get("details")
            if type(details) is not list or any(type(row) is not dict for row in details):
                _deny()
            pairs = [(row.get("name"), row.get("value")) for row in details]
            if len({key for key, _ in pairs}) != len(pairs):
                _deny()
            fields = dict(pairs)
            eni = fields.get("networkInterfaceId")
            if (type(eni) is not str or not _AWS_ID.fullmatch(eni) or not eni.startswith("eni-")
                    or fields.get("subnetId") != issued.subnet_id
                    or fields.get("privateIPv4Address") != expected_ip):
                _deny()
            networks = self.ec2.describe_network_interfaces(NetworkInterfaceIds=[eni])
            if type(networks) is not dict or len(networks.get("NetworkInterfaces", [])) != 1:
                _deny()
            network = networks["NetworkInterfaces"][0]
            groups = network.get("Groups")
            if (network.get("NetworkInterfaceId") != eni
                    or network.get("VpcId") != issued.vpc_id
                    or network.get("SubnetId") != issued.subnet_id
                    or network.get("PrivateIpAddress") != expected_ip
                    or network.get("Status") != "in-use"
                    or network.get("Attachment", {}).get("Status") != "attached"
                    or network.get("Association", {}).get("PublicIp") is not None
                    or type(groups) is not list
                    or len(groups) != len(issued.security_group_ids)
                    or set(row.get("GroupId") for row in groups) != set(issued.security_group_ids)):
                _deny()
            if (time.monotonic() - started_at >= 5
                    or int(time.time() * 1000) >= issued.expires_at_ms):
                _deny()
            return PeerLease(expected_ip, time.monotonic(), issued.binding, issued.grant_id)
        except StateDenied:
            raise
        except Exception:
            _deny()


def create_bearer_eni_trusted_resolver(*, read_direct_tls_socket, resolve_bearer_sha256,
                                       observe_task_eni, max_request_seconds=900):
    """Return InferenceApp's sync resolver; no socket, credential, or AWS discovery.

    Direct use as InferenceApp's synchronous resolver is forbidden; the product
    host wraps this in a bounded off-loop bootstrap before its watcher.
    `read_direct_tls_socket` must
    read the real accepted TLS socket, not scope
    client or forwarding metadata. `resolve_bearer_sha256` looks up durable
    current grant/issuance by bearer hash. `observe_task_eni` is a fresh bounded
    ECS+EC2 read such as FreshEcsEniReader, never a cache or header echo.
    """
    if (not callable(read_direct_tls_socket) or not callable(resolve_bearer_sha256)
            or not callable(observe_task_eni) or type(max_request_seconds) not in (int, float)
            or not math.isfinite(max_request_seconds) or not 0 < max_request_seconds <= 900):
        _deny()

    def resolver(scope):
        try:
            if type(scope) is not dict or scope.get("type") != "http" or scope.get("scheme") != "https":
                _deny()
            socket = read_direct_tls_socket(scope)
            if (type(socket) is not DirectTlsSocketPeer
                    or scope.get("client") != (socket.ipv4, socket.port)):
                _deny()
            headers = scope.get("headers")
            if type(headers) is not list or len(headers) > 64:
                _deny()
            credentials = [value for name, value in headers if name == b"authorization"]
            if len(credentials) != 1 or type(credentials[0]) is not bytes:
                _deny()
            value = credentials[0]
            token = value[7:] if value.startswith(b"Bearer ") else b""
            if not 32 <= len(token) <= 256 or any(char <= 32 or char > 126 for char in token):
                _deny()
            source = resolve_bearer_sha256(hashlib.sha256(token).hexdigest())
            if (type(source) is not ProductBearerSource
                    or source.authority.capability_sha256 != hashlib.sha256(token).hexdigest()):
                _deny()
            issued = source.issued
            peer = observe_task_eni(issued, socket.ipv4)
            if type(peer) is not PeerLease:
                _deny()
            admission = IngressAdmission(source.authority, peer)
            admission.validate_scope(scope)
            remaining = (issued.expires_at_ms - time.time_ns() // 1_000_000) / 1000
            if remaining <= 0:
                _deny()
            deadline = time.monotonic() + min(max_request_seconds, remaining)

            async def observer():
                return await asyncio.to_thread(observe_task_eni, issued, socket.ipv4)

            return TrustedRequest(admission, observer, deadline)
        except StateDenied:
            raise
        except Exception:
            _deny()

    return resolver
