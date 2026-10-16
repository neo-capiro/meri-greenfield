"""No socket, AWS, SQL or provider calls: exact bearer/ENI source controls."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import time
from types import SimpleNamespace
import unittest

from apps.proxy.product.bearer_eni_admission import (
    DirectTlsSocketPeer, FreshEcsEniReader, IssuedTaskNetwork,
    ProductBearerSource, create_bearer_eni_trusted_resolver,
)
from apps.proxy.qualification.runtime.ingress import PeerLease
from apps.proxy.qualification.state.admission import GrantAdmission
from apps.proxy.qualification.state.pricing import StateDenied
from apps.proxy.qualification.test.test_ingress import BINDING, GRANT, SHA, Store, fixture


class FakeAws:
    def __init__(self, issued):
        self.issued = issued
        self.created = datetime.now(timezone.utc).replace(microsecond=0)
        self.calls = 0
        self.task = {
            "taskArn": issued.binding.worker_arn, "clusterArn": issued.cluster_arn,
            "taskDefinitionArn": issued.task_definition_arn,
            "startedBy": issued.started_by, "group": issued.group,
            "launchType": "FARGATE", "platformFamily": "Linux",
            "platformVersion": "1.4.0", "enableExecuteCommand": False,
            "lastStatus": "RUNNING", "desiredStatus": "RUNNING",
            "createdAt": self.created,
            "tags": [{"key": key, "value": value} for key, value in issued.tags],
            "containers": [{"name": issued.container_name, "lastStatus": "RUNNING",
                "taskArn": issued.binding.worker_arn,
                "containerArn": issued.cluster_arn.replace("cluster/", "container/", 1)
                    + "/" + issued.binding.worker_arn.rsplit("/", 1)[-1]
                    + "/00000000-0000-4000-8000-000000000003",
                "imageDigest": issued.image_digest,
                "image": "reviewed.example/model-proxy@" + issued.image_digest}],
            "attachments": [{"type": "ElasticNetworkInterface", "status": "ATTACHED",
                "details": [{"name": "networkInterfaceId", "value": "eni-aaaaaaaaaaaaaaaaa"},
                    {"name": "subnetId", "value": issued.subnet_id},
                    {"name": "privateIPv4Address", "value": "10.77.0.9"}]}],
        }
        self.network = {"NetworkInterfaceId": "eni-aaaaaaaaaaaaaaaaa",
                        "VpcId": issued.vpc_id, "SubnetId": issued.subnet_id,
                        "PrivateIpAddress": "10.77.0.9", "Status": "in-use",
                        "Attachment": {"Status": "attached"},
                        "Groups": [{"GroupId": value} for value in issued.security_group_ids]}

    def describe_tasks(self, *, cluster, tasks, include):
        self.calls += 1
        assert cluster == self.issued.cluster_arn
        assert tasks == [self.issued.binding.worker_arn]
        assert include == ["TAGS"]
        return {"tasks": [self.task], "failures": []}

    def describe_network_interfaces(self, *, NetworkInterfaceIds):
        self.calls += 1
        assert NetworkInterfaceIds == ["eni-aaaaaaaaaaaaaaaaa"]
        return {"NetworkInterfaces": [self.network]}


def reader(aws, *, retries=1):
    def client(service):
        config = SimpleNamespace(connect_timeout=1, read_timeout=1,
                                 retries={"total_max_attempts": retries})
        meta = SimpleNamespace(config=config, region_name="us-east-1",
                               endpoint_url=f"https://{service}.us-east-1.amazonaws.com")
        return SimpleNamespace(meta=meta,
            describe_tasks=aws.describe_tasks,
            describe_network_interfaces=aws.describe_network_interfaces)
    return FreshEcsEniReader(client("ecs"), client("ec2"))


def source():
    created = datetime.now(timezone.utc).replace(microsecond=0)
    expiry = created + timedelta(minutes=5)
    execution_binding = {"tenantId": "tenant", "actorId": "actor",
        "conversationId": "11111111-1111-4111-8111-111111111111",
        "runId": BINDING.run_id,
        "attemptId": "22222222-2222-4222-8222-222222222222",
        "workerId": "33333333-3333-4333-8333-333333333333",
        "writerFence": BINDING.fence}
    execution = hashlib.sha256(json.dumps(execution_binding, sort_keys=True,
        ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()
    issued = IssuedTaskNetwork(
        BINDING, GRANT,
        "arn:aws:ecs:us-east-1:967807252336:cluster/independent",
        "arn:aws:ecs:us-east-1:967807252336:task-definition/reviewed-worker:1",
        "worker", "sha256:" + "a" * 64, execution_binding,
        execution, "meri:" + execution,
        int(created.timestamp() * 1000), int(expiry.timestamp() * 1000),
        "vpc-aaaaaaaaaaaaaaaaa", "subnet-bbbbbbbbbbbbbbbbb",
        ("sg-ccccccccccccccccc",),
        (("meri:execution-id", execution), ("meri:binding-sha256", execution),
         ("meri:plan-sha256", "d" * 64),
         ("meri:expires-at-ms", str(int(expiry.timestamp() * 1000)))),
    )
    store = Store()
    store.budget_namespace = "product"
    authority = GrantAdmission(store, GRANT, BINDING, SHA)
    return ProductBearerSource(authority, issued), created


class DirectBearerTests(unittest.IsolatedAsyncioTestCase):
    async def test_exact_task_bearer_socket_and_fresh_eni(self):
        grant, created = source()
        aws = FakeAws(grant.issued)
        aws.task["createdAt"] = created
        _, _, scope = fixture()
        resolver = create_bearer_eni_trusted_resolver(
            read_direct_tls_socket=lambda _scope: DirectTlsSocketPeer("10.77.0.9", 4321, "TLSv1.3"),
            resolve_bearer_sha256=lambda sha: grant if sha == SHA else None,
            observe_task_eni=reader(aws), max_request_seconds=60)
        trusted = resolver(scope)
        self.assertEqual(trusted.admission.peer.ipv4, "10.77.0.9")
        self.assertEqual(trusted.admission.authority.namespace, "product")
        self.assertLessEqual(trusted.deadline - time.monotonic(), 60)
        self.assertEqual(aws.calls, 2)
        renewed = await trusted.observer()
        self.assertIs(type(renewed), PeerLease)
        self.assertEqual(aws.calls, 4)

    async def test_wrong_socket_bearer_and_headers_fail_before_aws(self):
        grant, created = source()
        aws = FakeAws(grant.issued)
        aws.task["createdAt"] = created
        _, _, scope = fixture()

        def make(socket):
            return create_bearer_eni_trusted_resolver(
                read_direct_tls_socket=lambda _scope: socket,
                resolve_bearer_sha256=lambda sha: grant if sha == SHA else None,
                observe_task_eni=reader(aws))

        with self.assertRaises(StateDenied):
            make(DirectTlsSocketPeer("10.77.0.10", 4321, "TLSv1.3"))(scope)
        changed = dict(scope, headers=[(b"authorization", b"Bearer wrong")])
        with self.assertRaises(StateDenied):
            make(DirectTlsSocketPeer("10.77.0.9", 4321, "TLSv1.3"))(changed)
        self.assertEqual(aws.calls, 0)
        changed = dict(scope, headers=scope["headers"] + [(b"x-forwarded-for", b"10.77.0.9")])
        with self.assertRaises(StateDenied):
            make(DirectTlsSocketPeer("10.77.0.9", 4321, "TLSv1.3"))(changed)
        self.assertEqual(aws.calls, 2)  # exact ingress validation rejects after the fresh join

    async def test_revoked_task_or_eni_denies_and_cannot_be_cached(self):
        grant, created = source()
        aws = FakeAws(grant.issued)
        aws.task["createdAt"] = created
        observe = reader(aws)
        self.assertEqual(observe(grant.issued, "10.77.0.9").ipv4, "10.77.0.9")
        for change in (lambda: aws.task.update(lastStatus="STOPPED"),
                       lambda: aws.network.update(PrivateIpAddress="10.77.0.8")):
            with self.subTest(change=change):
                aws.task["lastStatus"] = "RUNNING"
                aws.network["PrivateIpAddress"] = "10.77.0.9"
                change()
                with self.assertRaises(StateDenied):
                    observe(grant.issued, "10.77.0.9")

    async def test_missing_trusted_ports_fail_closed(self):
        with self.assertRaises(StateDenied):
            create_bearer_eni_trusted_resolver(read_direct_tls_socket=None,
                resolve_bearer_sha256=lambda _: None, observe_task_eni=lambda *_: None)
        with self.assertRaises(StateDenied):
            DirectTlsSocketPeer("10.77.0.9", 4321, "TLSv1.1")
        with self.assertRaises(StateDenied):
            DirectTlsSocketPeer("8.8.8.8", 4321, "TLSv1.3")
        grant, _ = source()
        with self.assertRaises(StateDenied):
            reader(FakeAws(grant.issued), retries=2)

    async def test_persisted_execution_binding_hash_cannot_be_substituted(self):
        grant, _ = source()
        issued = grant.issued
        # Exact packages/contracts/validate.mjs canonicalSha256 fixture.
        self.assertEqual(issued.started_by,
            "8d8a21e7d7b5c5875db2168691c4c7e7a6f88e5449bcd2e8d61d422648a6dce5")
        changed = dict(issued.execution_binding, actorId="other")
        from dataclasses import replace
        with self.assertRaises(StateDenied):
            replace(issued, execution_binding=changed)
        with self.assertRaises(StateDenied):
            replace(issued, tags=tuple((key, "b" * 64 if key == "meri:binding-sha256" else value)
                                       for key, value in issued.tags))


if __name__ == "__main__":
    unittest.main()
