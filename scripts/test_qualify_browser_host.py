"""Offline tests of Codex-owned browser-host cleanup glue; no AWS/native probes.

Run: python -m unittest discover -s scripts -p test_qualify_browser_host.py -v
AWS, time and sleeping are injected. The only subprocess tests replace Popen.
"""

import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import uuid


SCRIPT = Path(__file__).with_name("qualify-browser-host.py")
SPEC = importlib.util.spec_from_file_location("qualify_browser_host", SCRIPT)
q = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = q
SPEC.loader.exec_module(q)


class FakeClock:
    def __init__(self):
        self.base = dt.datetime.now(q.UTC)
        self.elapsed = 0.0
        self.lock = threading.Lock()

    def now(self):
        with self.lock:
            return self.base + dt.timedelta(seconds=self.elapsed)

    def monotonic(self):
        with self.lock:
            return self.elapsed

    def advance(self, seconds):
        with self.lock:
            self.elapsed += seconds

    def sleep(self, seconds):
        self.advance(seconds)

    def wait(self, event, seconds):
        # Let the actual independent watchdog thread observe manually advanced time.
        return event.wait(min(seconds, 0.001))


def fixtures(clock, parameters=True):
    stack = f"arn:aws:cloudformation:{q.REGION}:{q.ACCOUNT}:stack/{q.STACK_NAME}/{uuid.uuid4()}"
    change = f"arn:aws:cloudformation:{q.REGION}:{q.ACCOUNT}:changeSet/owner-reviewed-{uuid.uuid4().hex[:8]}/{uuid.uuid4()}"
    run = str(uuid.uuid4())
    template = {
        "AWSTemplateFormatVersion": "2010-09-09",
        "Parameters": {
            "QualificationRun": {"Type": "String"},
            "VpcId": {"Type": "AWS::EC2::VPC::Id", "Default": q.VPC},
            "SubnetId": {"Type": "AWS::EC2::Subnet::Id"},
            "ImageId": {"Type": "AWS::EC2::Image::Id"},
        },
        "Resources": {
            "HostGroup": {"Type": "AWS::EC2::SecurityGroup", "Properties": {"VpcId": {"Ref": "VpcId"}}},
            "Host": {"Type": "AWS::EC2::Instance", "Properties": {
                "ImageId": {"Ref": "ImageId"},
                "NetworkInterfaces": [{"DeviceIndex": "0", "SubnetId": {"Ref": "SubnetId"}, "AssociatePublicIpAddress": False, "GroupSet": [{"Ref": "HostGroup"}]}],
                "Tags": [{"Key": q.RUN_KEY, "Value": {"Ref": "QualificationRun"}}],
            }},
        },
    }
    cs = {
        "ChangeSetId": change, "ChangeSetName": change.split("/")[1],
        "StackId": stack, "StackName": q.STACK_NAME,
        "CreationTime": (clock.now() - dt.timedelta(minutes=3)).isoformat(),
        "Status": "CREATE_COMPLETE", "ExecutionStatus": "AVAILABLE",
        "ImportExistingResources": False, "IncludeNestedStacks": False,
        "Capabilities": ["CAPABILITY_NAMED_IAM"],
        "Tags": [{"Key": q.RUN_KEY, "Value": run}],
        "Parameters": [{"ParameterKey": key, "ParameterValue": value} for key, value in {"QualificationRun": run, "SubnetId": q.SUBNET, "ImageId": q.AMI}.items()],
        "Changes": [{"Type": "Resource", "ResourceChange": {"Action": "Add", "LogicalResourceId": key, "ResourceType": value["Type"]}} for key, value in template["Resources"].items()],
    }
    if not parameters:
        template.pop("Parameters")
        cs["Parameters"] = []
        template["Resources"]["HostGroup"]["Properties"]["VpcId"] = q.VPC
        props = template["Resources"]["Host"]["Properties"]
        props["ImageId"] = q.AMI
        props["NetworkInterfaces"][0]["SubnetId"] = q.SUBNET
        props["Tags"][0]["Value"] = run
    manifest = {
        "schemaVersion": 1, "owner": q.OWNER, "reviewed": True,
        "reviewedAt": (clock.now() - dt.timedelta(minutes=2)).isoformat(),
        "account": q.ACCOUNT, "region": q.REGION, "profile": q.PROFILE, "callerArn": q.CALLER,
        "stackName": q.STACK_NAME, "stackId": stack, "changeSetId": change, "changeSetType": "CREATE",
        "changeSetSha256": q.sha256(cs), "templateSha256": q.sha256(template),
        "runTag": {"key": q.RUN_KEY, "value": run},
    }
    return manifest, cs, template


class FakeAWS:
    def __init__(self, manifest, cs, template, clock):
        self.manifest, self.cs, self.template, self.clock = manifest, cs, template, clock
        self.calls = []
        self.lock = threading.RLock()
        self.executed = False
        self.stack_status = "CREATE_FAILED"
        self.instance_state = "running"
        self.volume_present = False
        self.omit_root = False
        self.no_host = False
        self.extra_instances = []
        self.bad_identity_at = None
        self.sts_count = 0
        self.post_stack_count = 0
        self.fail_main_status = None
        self.execute_error = None
        self.after_call = None
        self.terminated = threading.Event()
        self.expected_evidence = None

    def instance(self):
        return {
            "InstanceId": "i-0123456789abcdef0", "ImageId": q.AMI, "VpcId": q.VPC, "SubnetId": q.SUBNET,
            "LaunchTime": self.launched.isoformat(), "State": {"Name": self.instance_state},
            "RootDeviceName": "/dev/xvda", "BlockDeviceMappings": [] if self.omit_root else [{"DeviceName": "/dev/xvda", "Ebs": {"VolumeId": "vol-0123456789abcdef0", "DeleteOnTermination": True}}],
            "Tags": [{"Key": key, "Value": value} for key, value in {
                "aws:cloudformation:stack-id": self.manifest["stackId"], "aws:cloudformation:stack-name": q.STACK_NAME,
                "aws:cloudformation:logical-id": "Host", q.RUN_KEY: self.manifest["runTag"]["value"],
            }.items()],
        }

    def call(self, service, operation, arguments, timeout):
        with self.lock:
            self.calls.append((service, operation, list(arguments), timeout, threading.current_thread().name))
        if self.after_call:
            self.after_call(service, operation, arguments)
        with self.lock:
            if service == "sts":
                self.sts_count += 1
                return {"Account": q.ACCOUNT, "Arn": q.CALLER if self.sts_count != self.bad_identity_at else f"arn:aws:iam::{q.ACCOUNT}:user/wrong"}
            if operation == "describe-change-set":
                return copy.deepcopy(self.cs)
            if operation == "get-template":
                return {"TemplateBody": copy.deepcopy(self.template)}
            if operation == "execute-change-set":
                assert self.calls[-2][1] == "get-caller-identity", "STS must immediately precede execution"
                armed = json.loads((self.expected_evidence / "controller.json").read_text())
                assert armed["status"] == "execute-attempted" and armed["absoluteDeadline"] and armed["armedAt"]
                self.executed = True
                self.launched = self.clock.now()
                if self.execute_error:
                    raise self.execute_error
                return {}
            if operation == "describe-stacks":
                if self.executed:
                    self.post_stack_count += 1
                    if self.post_stack_count == 1 and self.fail_main_status:
                        raise self.fail_main_status
                return {"Stacks": [{"StackId": self.manifest["stackId"], "StackName": q.STACK_NAME, "StackStatus": self.stack_status if self.executed else "REVIEW_IN_PROGRESS", "Tags": [{"Key": q.RUN_KEY, "Value": self.manifest["runTag"]["value"]}]}]}
            if operation == "describe-stack-resources":
                return {"StackResources": [] if not self.executed or self.no_host else [{"StackId": self.manifest["stackId"], "LogicalResourceId": "Host", "ResourceType": "AWS::EC2::Instance", "PhysicalResourceId": "i-0123456789abcdef0"}]}
            if operation == "describe-instances":
                assert arguments[:2] == ["--filters", f"Name=tag:aws:cloudformation:stack-id,Values={self.manifest['stackId']}"]
                hosts = [] if self.no_host else [self.instance()]
                return {"Reservations": [{"OwnerId": q.ACCOUNT, "Instances": copy.deepcopy(hosts + self.extra_instances)}]}
            if operation == "terminate-instances":
                assert self.calls[-2][1] == "get-caller-identity", "STS must immediately precede termination"
                identifiers = arguments[1:]
                self.instance_state = "terminated"
                for extra in self.extra_instances:
                    if extra["InstanceId"] in identifiers:
                        extra["State"]["Name"] = "terminated"
                self.terminated.set()
                return {"TerminatingInstances": [{"InstanceId": identifier, "CurrentState": {"Name": "shutting-down"}} for identifier in identifiers]}
            if operation == "describe-volumes":
                if self.volume_present:
                    return {"Volumes": [{"VolumeId": arguments[1], "State": "available"}]}
                raise q.AwsError("Volume missing", "InvalidVolume.NotFound")
        raise AssertionError(f"Unexpected fake AWS call {service}/{operation}")


class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.clock = FakeClock()
        self.manifest, self.cs, self.template = fixtures(self.clock)
        self.aws = FakeAWS(self.manifest, self.cs, self.template, self.clock)
        self.evidence = q.Evidence(Path(self.temp.name) / "evidence")
        self.aws.expected_evidence = self.evidence.directory
        self.limits = q.Limits(lifetime=1200, cleanup=30, poll=1, api_timeout=2)

    def controller(self):
        return q.Controller(self.manifest, self.aws, self.evidence, self.clock, self.limits)

    def mutations(self):
        return [call for call in self.aws.calls if (call[0], call[1]) in q.MUTATIONS]

    def refresh_hashes(self):
        self.manifest["changeSetSha256"] = q.sha256(self.cs)
        self.manifest["templateSha256"] = q.sha256(self.template)

    def test_import_is_side_effect_free_and_default_is_read_only(self):
        with patch.object(q.subprocess, "Popen", side_effect=AssertionError("native execution forbidden")):
            result = self.controller().run()
        self.assertEqual(result["status"], "inspected-no-mutations")
        self.assertEqual(self.mutations(), [])
        self.assertEqual(result["applicationQualification"], "NOT_ASSESSED")

    def test_main_default_never_enables_mutations(self):
        manifest_file = Path(self.temp.name) / "reviewed.json"
        manifest_file.write_text(json.dumps(self.manifest))
        modes = []
        def client(**kwargs):
            modes.append(kwargs["execute"])
            return self.aws
        with patch.object(q, "AwsCLI", side_effect=client):
            code = q.main(["--manifest", str(manifest_file), "--evidence", str(Path(self.temp.name) / "default-inspection")])
        self.assertEqual(code, 0)
        self.assertEqual(modes, [False])
        self.assertEqual(self.mutations(), [])

    def test_failed_creation_without_outputs_still_discovers_terminates_and_confirms_volume(self):
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertTrue(result["cleanup"]["confirmed"])
        self.assertEqual(result["deletedRootVolumeIds"], ["vol-0123456789abcdef0"])
        self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set", "terminate-instances"])
        self.assertFalse(any("output" in str(call).lower() for call in self.aws.calls))

    def test_guest_termination_is_not_browser_pass(self):
        self.aws.stack_status = "CREATE_COMPLETE"
        self.aws.instance_state = "terminated"
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "cleanup-confirmed-application-unassessed")
        self.assertEqual(result["applicationQualification"], "NOT_ASSESSED")
        self.assertTrue(result["cleanup"]["confirmed"])
        self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set"])

    def test_unknown_execute_timeout_still_cleans_without_retry(self):
        self.aws.execute_error = q.AwsError("synthetic API timeout", "Timeout")
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertTrue(result["cleanup"]["confirmed"])
        self.assertEqual([call[1] for call in self.mutations()].count("execute-change-set"), 1)

    def test_timeout_and_keyboard_interrupt_in_status_both_cleanup(self):
        for failure in (q.AwsError("synthetic status timeout", "Timeout"), KeyboardInterrupt()):
            with self.subTest(failure=type(failure).__name__):
                self.setUp()
                self.aws.fail_main_status = failure
                result = self.controller().run(execute=True)
                self.assertEqual(result["status"], "FAILED")
                self.assertTrue(result["cleanup"]["confirmed"])
                self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set", "terminate-instances"])

    def test_wrong_preflight_identity_prevents_execution(self):
        self.aws.bad_identity_at = 1
        with self.assertRaisesRegex(q.QualificationError, "Fresh STS"):
            self.controller().run(execute=True)
        self.assertEqual(self.mutations(), [])

    def test_wrong_identity_before_execute_or_terminate_never_mutates_under_it(self):
        for count, expected in ((2, []), (3, ["execute-change-set"])):
            with self.subTest(sts=count):
                self.setUp()
                self.aws.bad_identity_at = count
                result = self.controller().run(execute=True)
                self.assertEqual(result["status"], "FAILED")
                self.assertEqual([call[1] for call in self.mutations()], expected)
                if count == 3:
                    self.assertFalse(result["cleanup"]["confirmed"])

    def test_changed_review_fingerprint_template_or_non_add_prevents_execution(self):
        cases = ("fingerprint", "template", "non-add", "import", "old-stack", "role")
        for case in cases:
            with self.subTest(case=case):
                self.setUp()
                if case == "fingerprint": self.cs["Description"] = "changed after review"
                elif case == "template": self.template["Description"] = "changed after review"
                elif case == "non-add":
                    self.cs["Changes"][0]["ResourceChange"]["Action"] = "Modify"
                    self.refresh_hashes()
                elif case == "import":
                    self.cs["ImportExistingResources"] = True
                    self.refresh_hashes()
                elif case == "old-stack":
                    original = self.aws.call
                    def with_existing(service, operation, arguments, timeout):
                        response = original(service, operation, arguments, timeout)
                        if operation == "describe-stacks": response["Stacks"][0]["StackStatus"] = "CREATE_COMPLETE"
                        return response
                    self.aws.call = with_existing
                elif case == "role":
                    self.cs["RoleARN"] = f"arn:aws:iam::{q.ACCOUNT}:role/existing-service"
                    self.refresh_hashes()
                with self.assertRaises(q.QualificationError): self.controller().run(execute=True)
                self.assertEqual(self.mutations(), [])

    def test_literal_or_simple_parameter_refs_only_and_no_secret_parameters(self):
        self.manifest, self.cs, self.template = fixtures(self.clock, parameters=False)
        self.aws = FakeAWS(self.manifest, self.cs, self.template, self.clock)
        self.assertEqual(self.controller().run()["status"], "inspected-no-mutations")
        for bad in ({"Fn::Sub": q.AMI}, "{{resolve:ssm:some-ami}}", {"Ref": "Missing"}):
            with self.subTest(value=bad):
                self.setUp()
                self.template["Resources"]["Host"]["Properties"]["ImageId"] = bad
                self.refresh_hashes()
                with self.assertRaises(q.QualificationError): self.controller().run(execute=True)
                self.assertEqual(self.mutations(), [])
        self.setUp()
        self.template["Parameters"]["QualificationRun"]["NoEcho"] = True
        self.refresh_hashes()
        with self.assertRaisesRegex(q.QualificationError, "Secret"):
            self.controller().run(execute=True)

    def test_run_stack_ami_network_and_launch_mismatches_are_never_terminated(self):
        for mismatch in ("stack", "run", "ami", "vpc", "subnet", "launch"):
            with self.subTest(mismatch=mismatch):
                self.setUp()
                original = self.aws.instance
                def wrong_instance():
                    instance = original()
                    if mismatch in {"stack", "run"}:
                        key = "aws:cloudformation:stack-id" if mismatch == "stack" else q.RUN_KEY
                        next(tag for tag in instance["Tags"] if tag["Key"] == key)["Value"] = "current-resource-wrong-tag"
                    elif mismatch == "ami": instance["ImageId"] = "ami-current-resource"
                    elif mismatch == "vpc": instance["VpcId"] = "vpc-current-resource"
                    elif mismatch == "subnet": instance["SubnetId"] = "subnet-current-resource"
                    elif mismatch == "launch": instance["LaunchTime"] = (self.clock.now() - dt.timedelta(days=1)).isoformat()
                    return instance
                self.aws.instance = wrong_instance
                result = self.controller().run(execute=True)
                self.assertEqual(result["status"], "FAILED")
                self.assertFalse(result["cleanup"]["confirmed"])
                self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set"])

    def test_changed_current_scope_does_not_reuse_old_admission_for_termination(self):
        self.aws.stack_status = "CREATE_COMPLETE"
        observations = 0
        original = self.aws.instance
        def changing_instance():
            nonlocal observations
            observations += 1
            instance = original()
            if observations >= 2:
                instance["VpcId"] = "vpc-current-resource"
            return instance
        self.aws.instance = changing_instance
        self.aws.fail_main_status = q.AwsError("start cleanup", "Timeout")
        # Seed one valid earlier observation, then cleanup must revalidate current data.
        controller = self.controller()
        controller.preflight()
        controller.armed_at = self.clock.now()
        self.aws.launched = self.clock.now()
        controller.observe([self.aws.instance()])
        self.aws.executed = True
        controller.attempted = True
        result = controller.cleanup()
        self.assertFalse(result["confirmed"])
        self.assertFalse(any(call[1] == "terminate-instances" for call in self.mutations()))

    def test_extra_matching_hosts_fail_validation_but_only_safe_matches_are_cleaned(self):
        def extras_on_execute(service, operation, arguments):
            if operation == "describe-stacks" and self.aws.executed and not self.aws.extra_instances:
                valid = self.aws.instance()
                valid["InstanceId"] = "i-1123456789abcdef0"
                valid["BlockDeviceMappings"][0]["Ebs"]["VolumeId"] = "vol-1123456789abcdef0"
                foreign = copy.deepcopy(valid)
                foreign["InstanceId"] = "i-2123456789abcdef0"
                foreign["VpcId"] = "vpc-current-resource"
                self.aws.extra_instances = [valid, foreign]
        self.aws.after_call = extras_on_execute
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        terminated = next(call[2][1:] for call in self.mutations() if call[1] == "terminate-instances")
        self.assertEqual(terminated, ["i-0123456789abcdef0", "i-1123456789abcdef0"])
        self.assertNotIn("i-2123456789abcdef0", terminated)
        self.assertFalse(result["cleanup"]["confirmed"])

    def test_missing_root_volume_or_retained_volume_never_claims_cleanup(self):
        for failure in ("missing", "retained"):
            with self.subTest(failure=failure):
                self.setUp()
                self.aws.omit_root = failure == "missing"
                self.aws.volume_present = failure == "retained"
                result = self.controller().run(execute=True)
                self.assertEqual(result["status"], "FAILED")
                self.assertFalse(result["cleanup"]["confirmed"])

    def test_no_positive_host_observation_never_claims_empty_cleanup(self):
        self.aws.no_host = True
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertFalse(result["cleanup"]["confirmed"])
        self.assertEqual(result["cleanup"]["status"], "UNKNOWN-or-incomplete")
        self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set"])

    def test_persistent_cfn_outages_cannot_block_scoped_ec2_containment(self):
        for unavailable in ("describe-stacks", "describe-stack-resources"):
            with self.subTest(unavailable=unavailable):
                self.setUp()
                original = self.aws.call
                def cfn_outage(service, operation, arguments, timeout):
                    if self.aws.executed and operation == unavailable:
                        raise q.AwsError("persistent synthetic CFN outage", "Timeout")
                    return original(service, operation, arguments, timeout)
                self.aws.call = cfn_outage
                result = self.controller().run(execute=True)
                self.assertEqual(result["status"], "FAILED")
                self.assertEqual(self.aws.instance_state, "terminated")
                self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set", "terminate-instances"])
                self.assertFalse(result["cleanup"]["confirmed"], "CFN completeness remains unknown")
                self.assertEqual(result["deletedRootVolumeIds"], ["vol-0123456789abcdef0"])

    def test_rollback_and_delayed_tag_visibility_continue_until_host_is_contained(self):
        self.aws.stack_status = "ROLLBACK_COMPLETE"
        original = self.aws.call
        def delayed(service, operation, arguments, timeout):
            if self.aws.executed and self.clock.monotonic() < 10:
                if operation == "describe-instances":
                    return {"Reservations": []}
                if operation == "describe-stack-resources":
                    return {"StackResources": []}
            return original(service, operation, arguments, timeout)
        self.aws.call = delayed
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertGreaterEqual(self.clock.monotonic(), 10)
        self.assertEqual(self.aws.instance_state, "terminated")
        self.assertTrue(result["cleanup"]["confirmed"])
        self.assertEqual(result["cleanup"]["instanceIds"], ["i-0123456789abcdef0"])

    def test_persistent_disk_failure_after_execute_does_not_disable_containment(self):
        original = self.evidence.save
        def unavailable_disk(name, value):
            if self.aws.executed:
                raise OSError("synthetic disk full")
            return original(name, value)
        with patch.object(self.evidence, "save", side_effect=unavailable_disk):
            result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(self.aws.instance_state, "terminated")
        self.assertTrue(result["cleanup"]["confirmed"])
        self.assertTrue(result["evidenceFailures"])
        self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set", "terminate-instances"])

    def test_persistence_failure_before_execute_prevents_mutation(self):
        self.aws.no_host = True
        original = self.evidence.save
        def unavailable_disk(name, value):
            if name == "controller.json" and value.get("status") == "execute-attempted":
                raise OSError("synthetic persistence unavailable before request")
            return original(name, value)
        with patch.object(self.evidence, "save", side_effect=unavailable_disk):
            result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertFalse(self.aws.executed)
        self.assertEqual(self.mutations(), [])

    def test_declared_run_parameter_must_match_even_if_literal_instance_tag_matches(self):
        self.template["Resources"]["Host"]["Properties"]["Tags"][0]["Value"] = self.manifest["runTag"]["value"]
        next(item for item in self.cs["Parameters"] if item["ParameterKey"] == q.RUN_KEY)["ParameterValue"] = str(uuid.uuid4())
        self.refresh_hashes()
        with self.assertRaisesRegex(q.QualificationError, "Effective QualificationRun parameter"):
            self.controller().run(execute=True)
        self.assertEqual(self.mutations(), [])

    def test_actual_stack_run_conflicts_fail_gate_but_not_post_execute_containment(self):
        for stage in ("preflight", "after-execute"):
            with self.subTest(stage=stage):
                self.setUp()
                original = self.aws.call
                def conflicting_stack(service, operation, arguments, timeout):
                    result = original(service, operation, arguments, timeout)
                    if operation == "describe-stacks" and (stage == "preflight" or self.aws.executed):
                        result["Stacks"][0]["Tags"][0]["Value"] = str(uuid.uuid4())
                    return result
                self.aws.call = conflicting_stack
                if stage == "preflight":
                    with self.assertRaisesRegex(q.QualificationError, "Actual stack QualificationRun"):
                        self.controller().run(execute=True)
                    self.assertEqual(self.mutations(), [])
                else:
                    result = self.controller().run(execute=True)
                    self.assertEqual(result["status"], "FAILED")
                    self.assertEqual(self.aws.instance_state, "terminated")
                    self.assertFalse(result["cleanup"]["confirmed"])

    def test_temporarily_missing_instance_tags_are_inconclusive_then_readmitted(self):
        self.aws.stack_status = "ROLLBACK_COMPLETE"
        original = self.aws.instance
        observations = 0
        def temporary_tags():
            nonlocal observations
            observations += 1
            value = original()
            if observations <= 3:
                value["Tags"] = []
            return value
        self.aws.instance = temporary_tags
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED", "CFN rollback is still a failed qualification")
        self.assertEqual(self.aws.instance_state, "terminated")
        self.assertTrue(result["cleanup"]["confirmed"])
        self.assertFalse(any(problem.startswith("Rejected scoped EC2 observation") for problem in result["problems"]))

    def test_permanently_missing_instance_tags_remain_unknown_and_never_admit(self):
        original = self.aws.instance
        def missing_tags():
            value = original()
            value.pop("Tags")
            return value
        self.aws.instance = missing_tags
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertFalse(result["cleanup"]["confirmed"])
        self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set"])

    def test_missing_inventory_is_inconclusive_even_when_creation_failed(self):
        self.aws.no_host = True
        original = self.aws.call
        def missing_inventory(service, operation, arguments, timeout):
            result = original(service, operation, arguments, timeout)
            return {} if operation == "describe-instances" else result
        self.aws.call = missing_inventory
        result = self.controller().run(execute=True)
        self.assertEqual(result["status"], "FAILED")
        self.assertFalse(result["cleanup"]["confirmed"])
        self.assertEqual([call[1] for call in self.mutations()], ["execute-change-set"])

    def test_independent_watchdog_terminates_while_main_status_call_is_blocked(self):
        self.aws.stack_status = "CREATE_COMPLETE"
        blocked = threading.Event()
        cleanup_while_blocked = []
        def slow_status(service, operation, arguments):
            if operation == "describe-stacks" and self.aws.executed and threading.current_thread().name == "MainThread" and not blocked.is_set():
                blocked.set()
                self.clock.advance(1201)
                cleanup_while_blocked.append(self.aws.terminated.wait(2))
        self.aws.after_call = slow_status
        result = self.controller().run(execute=True)
        self.assertEqual(cleanup_while_blocked, [True])
        self.assertEqual(result["status"], "FAILED")
        self.assertTrue(result["cleanup"]["confirmed"])
        self.assertTrue(any(call[1] == "terminate-instances" and call[4] == "browser-host-absolute-deadline" for call in self.aws.calls))
        armed = json.loads((self.evidence.directory / "controller.json").read_text())
        self.assertEqual(q.timestamp(armed["absoluteDeadline"]) - q.timestamp(armed["armedAt"]), dt.timedelta(minutes=20))

    def test_readbacks_are_scrubbed_and_existing_evidence_is_not_overwritten(self):
        self.evidence.save("test.json", {"TemplateBody": json.dumps({"UserData": "base64-do-not-store"}), "Parameters": [{"ParameterValue": "do-not-store"}], "error": "password=bad sk-ant-private"})
        text = (self.evidence.directory / "test.json").read_text()
        for secret in ("base64-do-not-store", "do-not-store", "password=bad", "sk-ant-private"):
            self.assertNotIn(secret, text)
        with self.assertRaises(FileExistsError): q.Evidence(self.evidence.directory)


class CliTests(unittest.TestCase):
    def test_explicit_arguments_environment_and_no_default_mutation(self):
        process = unittest.mock.Mock(returncode=0)
        process.communicate.return_value = ('{"Account":"967807252336"}', "")
        with patch.object(q.subprocess, "Popen", return_value=process) as popen:
            q.AwsCLI().call("sts", "get-caller-identity", [], 2)
        args, kwargs = popen.call_args
        self.assertIsInstance(args[0], list)
        self.assertFalse(kwargs["shell"])
        self.assertEqual(kwargs["env"]["AWS_MAX_ATTEMPTS"], "1")
        self.assertIn("--profile", args[0])
        self.assertIn(q.PROFILE, args[0])
        self.assertIn("--no-paginate", args[0])
        self.assertNotIn("--debug", args[0])
        with patch.object(q.subprocess, "Popen", side_effect=AssertionError("must not launch")):
            with self.assertRaisesRegex(q.QualificationError, "mutation disabled"):
                q.AwsCLI().call("ec2", "terminate-instances", ["--instance-ids", "i-0123456789abcdef0"], 2)
            with self.assertRaisesRegex(q.QualificationError, "allowlist"):
                q.AwsCLI(execute=True).call("ec2", "delete-vpc", ["--vpc-id", q.VPC], 2)

    def test_timeout_requires_confirmed_direct_cli_exit(self):
        process = unittest.mock.Mock(returncode=-9)
        process.communicate.side_effect = [subprocess.TimeoutExpired("aws", 2), ("", "")]
        with patch.object(q.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(q.AwsError, "exit confirmed"):
                q.AwsCLI().call("sts", "get-caller-identity", [], 2)
        process.kill.assert_called_once()
        self.assertEqual(process.communicate.call_count, 2)
        process = unittest.mock.Mock(returncode=None)
        process.communicate.side_effect = subprocess.TimeoutExpired("aws", 2)
        with patch.object(q.subprocess, "Popen", return_value=process):
            with self.assertRaisesRegex(q.AwsError, "UNCONFIRMED"):
                q.AwsCLI().call("sts", "get-caller-identity", [], 2)


if __name__ == "__main__":
    unittest.main()
