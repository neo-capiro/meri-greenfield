"""Codex integration-owner tooling for ONE reviewed browser-host CREATE change set.

Default is read-only inspection. This does not create/select a change set or decide
whether a browser is qualified. The owner supplies an explicitly reviewed v1 JSON
manifest; hashes are SHA-256 of UTF-8 canonical JSON (sorted keys, compact separators,
ensure_ascii=False, allow_nan=False). changeSetSha256 covers the FULL combined
DescribeChangeSet response, omitting only pagination NextToken; TemplateBody is
parsed JSON before templateSha256 is calculated. No manifest is generated here.

Required manifest keys (no others): schemaVersion=1, owner="Codex integration owner",
reviewed=true, reviewedAt (UTC ISO8601), account, region, profile, callerArn,
stackName, stackId, changeSetId, changeSetType="CREATE", changeSetSha256,
templateSha256, runTag={"key":"QualificationRun","value":<canonical UUID>}.

Execution arms a 20-minute independent watchdog BEFORE ExecuteChangeSet. Cleanup
uses only immutable CloudFormation stack-id tags, then checks run/network/AMI/time
and logical-resource identity before termination. A separate bounded cleanup window
confirms EC2 termination AND disappearance of observed root EBS volumes. Guest
shutdown is supplementary; CFN completion is never application qualification.
Only ExecuteChangeSet and narrowly scoped TerminateInstances can mutate AWS. The
owner separately reviews evidence and deletes this NEW stack after host cleanup.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any


ACCOUNT = "967807252336"
REGION = "us-east-1"
PROFILE = "capiro-dev"
CALLER = f"arn:aws:iam::{ACCOUNT}:user/capirocli"
STACK_NAME = "MeriGreenfield-BrowserQualification"
VPC = "vpc-06e1941747e798f0a"
SUBNET = "subnet-0864c000b771df32c"
AMI = "ami-0fb0f484b75566814"
RUN_KEY = "QualificationRun"
OWNER = "Codex integration owner"
UTC = dt.timezone.utc
MUTATIONS = {("cloudformation", "execute-change-set"), ("ec2", "terminate-instances")}
READS = {
    ("sts", "get-caller-identity"), ("cloudformation", "describe-change-set"),
    ("cloudformation", "get-template"), ("cloudformation", "describe-stacks"),
    ("cloudformation", "describe-stack-resources"), ("ec2", "describe-instances"),
    ("ec2", "describe-volumes"),
}
TERMINAL_STACKS = {"CREATE_COMPLETE", "CREATE_FAILED", "ROLLBACK_COMPLETE", "ROLLBACK_FAILED", "DELETE_COMPLETE", "DELETE_FAILED"}
ALLOWED_RESOURCES = {
    "AWS::EC2::Instance", "AWS::EC2::SecurityGroup", "AWS::EC2::SecurityGroupIngress",
    "AWS::EC2::SecurityGroupEgress", "AWS::IAM::Role", "AWS::IAM::Policy",
    "AWS::IAM::InstanceProfile", "AWS::KMS::Key", "AWS::KMS::Alias", "AWS::Logs::LogGroup",
}


class QualificationError(Exception):
    pass


class AwsError(QualificationError):
    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.code = code


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def sha256(value: Any) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def timestamp(value: Any) -> dt.datetime:
    if not isinstance(value, str):
        raise QualificationError("Expected an explicit timestamp")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise QualificationError("Invalid timestamp") from error
    if parsed.tzinfo is None:
        raise QualificationError("Timestamp must include timezone")
    return parsed.astimezone(UTC)


def tags(value: Any) -> dict[str, str]:
    if not isinstance(value, list):
        raise QualificationError("Expected tag list")
    result: dict[str, str] = {}
    for tag in value:
        if not isinstance(tag, dict) or set(tag) != {"Key", "Value"} or not isinstance(tag["Key"], str) or not isinstance(tag["Value"], str) or tag["Key"] in result:
            raise QualificationError("Malformed or duplicate tag")
        result[tag["Key"]] = tag["Value"]
    return result


def scrub(value: Any, key: str = "") -> Any:
    """Preserve scrubbed readbacks; never write credential-shaped text/user-data."""
    if key == "TemplateBody" and isinstance(value, str):
        try:
            return scrub(json.loads(value))
        except ValueError:
            return {"redacted": True, "sha256": sha256(value)}
    if key.lower() in {"userdata", "parametervalue", "default", "secretaccesskey", "sessiontoken", "authorization", "password", "credentials"}:
        return {"redacted": True, "sha256": sha256(value)}
    if isinstance(value, dict):
        return {k: scrub(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [scrub(v) for v in value]
    if isinstance(value, str):
        value = re.sub(r"(?i)(bearer\s+)[^\s\"']+", r"\1[REDACTED]", value)
        value = re.sub(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b(?:sk-ant-|sk-or-v1-|ghp_|gho_)[A-Za-z0-9_-]+", "[REDACTED]", value)
        value = re.sub(r"(?i)((?:secret|password|session_token|access_token)\s*[=:]\s*)[^\s\"',;]+", r"\1[REDACTED]", value)
    return value


class Evidence:
    def __init__(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=False)
        self.directory = directory
        self.lock = threading.RLock()
        self.serial = 0

    def save(self, name: str, value: Any) -> None:
        with self.lock:
            target = self.directory / name
            temporary = target.with_suffix(target.suffix + ".tmp")
            temporary.write_text(json.dumps(scrub(value), indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
            temporary.replace(target)

    def readback(self, service: str, operation: str, value: Any) -> None:
        with self.lock:
            self.serial += 1
            self.save(f"{self.serial:04d}-{service}-{operation}.json", value)


@dataclass(frozen=True)
class Limits:
    lifetime: float = 1200
    cleanup: float = 300
    poll: float = 5
    api_timeout: float = 20
    max_pages: int = 10
    max_instances: int = 10


class Clock:
    def now(self) -> dt.datetime:
        return dt.datetime.now(UTC)

    def monotonic(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        time.sleep(seconds)

    def wait(self, event: threading.Event, seconds: float) -> bool:
        return event.wait(seconds)


class AwsCLI:
    """Explicit fixed-profile CLI calls, one SDK attempt and reaped timeout exits."""
    def __init__(self, execute: bool = False, executable: str = "aws"):
        self.execute = execute
        self.executable = executable

    def call(self, service: str, operation: str, arguments: list[str], timeout: float) -> dict[str, Any]:
        if (service, operation) not in READS | MUTATIONS:
            raise QualificationError("AWS operation outside the fixed controller allowlist")
        if (service, operation) in MUTATIONS and not self.execute:
            raise QualificationError("AWS mutation disabled")
        command = [self.executable, "--profile", PROFILE, "--region", REGION, "--no-cli-pager", "--no-paginate", "--output", "json", "--cli-connect-timeout", "5", "--cli-read-timeout", "10", service, operation, *arguments]
        # Use the explicit existing profile, never inherited bearer/access credentials.
        env = {k: v for k, v in os.environ.items() if not k.upper().startswith("AWS_")}
        env.update(AWS_MAX_ATTEMPTS="1", AWS_RETRY_MODE="standard", AWS_EC2_METADATA_DISABLED="true", AWS_PAGER="", AWS_CLI_AUTO_PROMPT="off")
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", env=env, shell=False)
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired as error:
            process.kill()
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired as reap_error:
                raise AwsError("AWS CLI timeout; process exit UNCONFIRMED", "ProcessExitUnknown") from reap_error
            if process.returncode is None:
                raise AwsError("AWS CLI timeout; process exit UNCONFIRMED", "ProcessExitUnknown") from error
            raise AwsError("AWS CLI timeout; direct CLI process exit confirmed", "Timeout") from error
        if len(stdout) > 8_000_000 or len(stderr) > 100_000:
            raise AwsError("AWS CLI response exceeded capture bound", "CaptureBound")
        if process.returncode:
            code_match = re.search(r"An error occurred \(([^)]+)\)", stderr)
            raise AwsError(str(scrub(stderr[:4000])) or "AWS CLI failed", code_match[1] if code_match else None)
        try:
            result = json.loads(stdout or "{}")
        except (ValueError, TypeError) as error:
            raise AwsError("AWS CLI returned non-JSON output") from error
        if not isinstance(result, dict):
            raise AwsError("AWS CLI returned a non-object response")
        return result


def validate_manifest(manifest: Any, now: dt.datetime) -> dict[str, Any]:
    required = {"schemaVersion", "owner", "reviewed", "reviewedAt", "account", "region", "profile", "callerArn", "stackName", "stackId", "changeSetId", "changeSetType", "changeSetSha256", "templateSha256", "runTag"}
    if not isinstance(manifest, dict) or set(manifest) != required:
        raise QualificationError("Explicit reviewed manifest v1 with exact fields is required")
    fixed = {"schemaVersion": 1, "owner": OWNER, "reviewed": True, "account": ACCOUNT, "region": REGION, "profile": PROFILE, "callerArn": CALLER, "stackName": STACK_NAME, "changeSetType": "CREATE"}
    for key, value in fixed.items():
        if type(manifest[key]) is not type(value) or manifest[key] != value:
            raise QualificationError(f"Manifest {key} mismatch")
    if timestamp(manifest["reviewedAt"]) > now + dt.timedelta(seconds=5):
        raise QualificationError("Review timestamp is in the future")
    for key in ("templateSha256", "changeSetSha256"):
        if not isinstance(manifest[key], str) or not re.fullmatch(r"[0-9a-f]{64}", manifest[key]):
            raise QualificationError(f"Invalid {key}")
    if not re.fullmatch(rf"arn:aws:cloudformation:{REGION}:{ACCOUNT}:stack/{STACK_NAME}/[0-9a-f-]{{36}}", str(manifest["stackId"])):
        raise QualificationError("Exact new stack ARN required")
    if not re.fullmatch(rf"arn:aws:cloudformation:{REGION}:{ACCOUNT}:changeSet/[A-Za-z][-A-Za-z0-9]{{0,127}}/[0-9a-f-]{{36}}", str(manifest["changeSetId"])):
        raise QualificationError("Exact reviewed change set ARN required")
    run = manifest["runTag"]
    try:
        if not isinstance(run, dict) or set(run) != {"key", "value"} or run["key"] != RUN_KEY or str(uuid.UUID(run["value"])) != run["value"]:
            raise ValueError()
    except (ValueError, TypeError, AttributeError) as error:
        raise QualificationError("QualificationRun must be an explicit canonical UUID") from error
    return json.loads(canonical(manifest))


def resolve_parameters(template: dict[str, Any], change_set: dict[str, Any]):
    declarations = template.get("Parameters", {})
    supplied: dict[str, str] = {}
    for item in change_set.get("Parameters", []):
        key = item.get("ParameterKey")
        if key in supplied or key not in declarations or item.get("UsePreviousValue") or "ResolvedValue" in item:
            raise QualificationError("Unsupported or duplicate change-set parameter")
        value = item.get("ParameterValue", declarations[key].get("Default"))
        if not isinstance(value, str):
            raise QualificationError("Only explicit string parameter values are supported")
        supplied[key] = value
    for key, declaration in declarations.items():
        kind = declaration.get("Type", "")
        if declaration.get("NoEcho") or not (kind == "String" or (kind.startswith("AWS::EC2::") and kind.endswith("::Id"))):
            raise QualificationError("Secret/dynamic/non-string parameters are unsupported")
        if key not in supplied and isinstance(declaration.get("Default"), str):
            supplied[key] = declaration["Default"]

    def resolve(value: Any) -> str:
        if isinstance(value, str) and "{{resolve:" not in value:
            return value
        if isinstance(value, dict) and set(value) == {"Ref"} and value["Ref"] in supplied:
            return supplied[value["Ref"]]
        raise QualificationError("Unsupported identity/network expression; only exact literal or declared Ref is allowed")
    return resolve


class Controller:
    def __init__(self, manifest: dict[str, Any], aws: Any, evidence: Evidence, clock: Any = None, limits: Limits = Limits()):
        self.clock = clock or Clock()
        self.manifest = validate_manifest(manifest, self.clock.now())
        self.aws, self.evidence, self.limits = aws, evidence, limits
        self.lock = threading.RLock()
        self.trigger = threading.Event()
        self.done = threading.Event()
        self.cleanup_started = threading.Event()
        self.attempted = False
        self.deadline_hit = False
        self.hosts: dict[str, dict[str, Any]] = {}
        self.volumes: set[str] = set()
        self.termination_requested: set[str] = set()
        self.problems: list[str] = []
        self.evidence_failures: list[str] = []
        self.cleanup_result: dict[str, Any] = {"confirmed": False, "status": "not-started"}
        self.record: dict[str, Any] = {"owner": OWNER, "reviewedManifest": self.manifest, "status": "preflight", "applicationQualification": "NOT_ASSESSED", "cleanup": self.cleanup_result}
        self.evidence.save("controller.json", self.record)

    def evidence_failure(self, operation: str, error: OSError) -> None:
        # After an attempted mutation, losing local disk must never disable containment.
        with self.lock:
            message = f"Evidence persistence failed: {operation}: {type(error).__name__}"
            if message not in self.evidence_failures:
                self.evidence_failures.append(message)
                self.problems.append(message)
            self.record["evidenceFailures"] = self.evidence_failures

    def save(self, required: bool = False) -> None:
        with self.lock:
            self.record.update(hosts=self.hosts, rootVolumeIds=sorted(self.volumes), problems=self.problems, cleanup=self.cleanup_result)
            try:
                self.evidence.save("controller.json", self.record)
            except OSError as error:
                if required or not self.attempted:
                    raise
                self.evidence_failure("controller.json", error)

    def journal(self, service: str, operation: str, value: Any) -> None:
        try:
            self.evidence.readback(service, operation, value)
        except OSError as error:
            if not self.attempted:
                raise
            self.evidence_failure(f"{service}/{operation}", error)

    def problem(self, message: str) -> None:
        with self.lock:
            if message not in self.problems:
                self.problems.append(message)
            self.save()

    def update(self, *, required: bool = False, **values: Any) -> None:
        with self.lock:
            self.record.update(values)
            self.save(required=required)

    def call(self, service: str, operation: str, arguments: list[str], until: float | None = None) -> dict[str, Any]:
        timeout = self.limits.api_timeout
        if until is not None:
            timeout = min(timeout, until - self.clock.monotonic())
            if timeout <= 0:
                raise QualificationError("Bounded API window expired")
        try:
            response = self.aws.call(service, operation, arguments, timeout)
            self.journal(service, operation, {"arguments": arguments, "response": response})
            return response
        except BaseException as error:
            self.journal(service, operation, {"arguments": arguments, "errorType": type(error).__name__, "code": getattr(error, "code", None), "message": str(scrub(str(error)))})
            raise

    def identity(self, until: float | None = None) -> None:
        identity = self.call("sts", "get-caller-identity", [], until)
        if identity.get("Account") != ACCOUNT or identity.get("Arn") != CALLER:
            raise QualificationError("Fresh STS identity is not the approved exact IAM user")

    def stack(self, until: float | None = None) -> dict[str, Any]:
        result = self.call("cloudformation", "describe-stacks", ["--stack-name", self.manifest["stackId"]], until)
        values = result.get("Stacks", [])
        if len(values) != 1 or values[0].get("StackId") != self.manifest["stackId"] or values[0].get("StackName") != STACK_NAME:
            raise QualificationError("Stack identity readback mismatch")
        if tags(values[0].get("Tags", [])).get(RUN_KEY) != self.manifest["runTag"]["value"]:
            raise QualificationError("Actual stack QualificationRun tag missing or conflicting")
        return values[0]

    def resources(self, until: float | None = None) -> list[dict[str, Any]]:
        result = self.call("cloudformation", "describe-stack-resources", ["--stack-name", self.manifest["stackId"]], until)
        values = result.get("StackResources")
        if not isinstance(values, list) or any(item.get("StackId") != self.manifest["stackId"] for item in values):
            raise QualificationError("Stack resource inventory missing or cross-stack")
        return values

    def preflight(self) -> dict[str, Any]:
        self.identity()
        combined: dict[str, Any] | None = None
        token = None
        seen_tokens: set[str] = set()
        for _ in range(self.limits.max_pages):
            arguments = ["--stack-name", self.manifest["stackId"], "--change-set-name", self.manifest["changeSetId"], "--include-property-values"]
            if token:
                arguments += ["--next-token", token]
            page = self.call("cloudformation", "describe-change-set", arguments)
            base = {k: v for k, v in page.items() if k not in {"Changes", "NextToken"}}
            if combined is None:
                combined = {**base, "Changes": []}
            elif base != {k: v for k, v in combined.items() if k != "Changes"}:
                raise QualificationError("Change-set metadata changed between pages")
            combined["Changes"].extend(page.get("Changes", []))
            token = page.get("NextToken")
            if not token:
                break
            if token in seen_tokens:
                raise QualificationError("Repeated change-set pagination token")
            seen_tokens.add(token)
        else:
            raise QualificationError("Change-set pagination bound exceeded")
        assert combined is not None
        if combined.get("StackId") != self.manifest["stackId"] or combined.get("StackName") != STACK_NAME or combined.get("ChangeSetId") != self.manifest["changeSetId"] or combined.get("Status") != "CREATE_COMPLETE" or combined.get("ExecutionStatus") != "AVAILABLE":
            raise QualificationError("Reviewed change set is not available for this exact new stack")
        if combined.get("ImportExistingResources") or combined.get("IncludeNestedStacks") or combined.get("ParentChangeSetId") or combined.get("RootChangeSetId") or combined.get("RoleARN") or combined.get("DeploymentMode"):
            raise QualificationError("Imports/nested stacks/deployment roles are outside this CREATE scope")
        if sha256(combined) != self.manifest["changeSetSha256"]:
            raise QualificationError("Full reviewed change-set fingerprint mismatch")
        if timestamp(combined.get("CreationTime")) > timestamp(self.manifest["reviewedAt"]):
            raise QualificationError("Change set was created after recorded review")
        raw = self.call("cloudformation", "get-template", ["--stack-name", self.manifest["stackId"], "--change-set-name", self.manifest["changeSetId"], "--template-stage", "Original"])
        template = raw.get("TemplateBody")
        if isinstance(template, str):
            try:
                template = json.loads(template)
            except ValueError as error:
                raise QualificationError("Only a reviewed JSON template is supported") from error
        if not isinstance(template, dict) or sha256(template) != self.manifest["templateSha256"]:
            raise QualificationError("Reviewed JSON template fingerprint mismatch")
        if template.get("Transform"):
            raise QualificationError("Template transforms are unsupported")
        resources = template.get("Resources", {})
        if not resources or any(item.get("Type") not in ALLOWED_RESOURCES for item in resources.values()):
            raise QualificationError("Template contains a resource outside the dedicated new host scope")
        changes = combined["Changes"]
        logical_ids: list[str] = []
        for change in changes:
            item = change.get("ResourceChange", {})
            logical = item.get("LogicalResourceId")
            if change.get("Type") != "Resource" or item.get("Action") != "Add" or item.get("PhysicalResourceId") or logical not in resources or item.get("ResourceType") != resources[logical].get("Type"):
                raise QualificationError("Only new-resource Add changes are admitted")
            logical_ids.append(logical)
        if len(set(logical_ids)) != len(logical_ids) or set(logical_ids) != set(resources):
            raise QualificationError("Change-set additions do not exactly cover the reviewed template")
        instances = [key for key, value in resources.items() if value.get("Type") == "AWS::EC2::Instance"]
        if len(instances) != 1:
            raise QualificationError("Exactly one new EC2 instance is required")
        self.logical_id = instances[0]
        resolve = resolve_parameters(template, combined)
        if RUN_KEY in template.get("Parameters", {}) and resolve({"Ref": RUN_KEY}) != self.manifest["runTag"]["value"]:
            raise QualificationError("Effective QualificationRun parameter conflicts with the reviewed run UUID")
        properties = resources[self.logical_id].get("Properties", {})
        if resolve(properties.get("ImageId")) != AMI:
            raise QualificationError("Template AMI is not the reviewed pinned AMI")
        interfaces = properties.get("NetworkInterfaces")
        if interfaces is not None:
            if len(interfaces) != 1 or interfaces[0].get("AssociatePublicIpAddress") is not False or properties.get("SubnetId"):
                raise QualificationError("Only one explicit private network interface is supported")
            subnet = resolve(interfaces[0].get("SubnetId"))
        else:
            subnet = resolve(properties.get("SubnetId"))
        if subnet != SUBNET or properties.get("KeyName") or properties.get("LaunchTemplate"):
            raise QualificationError("Template subnet/key/launch-template scope mismatch")
        group_vpcs = [resolve(item.get("Properties", {}).get("VpcId")) for item in resources.values() if item.get("Type") == "AWS::EC2::SecurityGroup"]
        if not group_vpcs or any(value != VPC for value in group_vpcs):
            raise QualificationError("Host security groups must use the exact new qualification VPC")
        expected_run = self.manifest["runTag"]["value"]
        instance_run_tags = [item for item in properties.get("Tags", []) if item.get("Key") == RUN_KEY]
        if len(instance_run_tags) != 1 or resolve(instance_run_tags[0].get("Value")) != expected_run or tags(combined.get("Tags", [])).get(RUN_KEY) != expected_run:
            raise QualificationError("Reviewed stack and instance QualificationRun tags must match")
        stack = self.stack()
        if stack.get("StackStatus") != "REVIEW_IN_PROGRESS" or stack.get("RoleARN") or stack.get("ParentId") or self.resources():
            raise QualificationError("Stack already has resources or is not a new CREATE review placeholder")
        self.update(status="inspected", changeSetSha256=sha256(combined), templateSha256=sha256(template), instanceLogicalId=self.logical_id)
        return self.record

    def discover(self, until: float | None = None) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = []
        token = None
        seen_tokens: set[str] = set()
        for _ in range(self.limits.max_pages):
            # NEVER discover by stack name, run tag alone, VPC, outputs or broad EC2 list.
            arguments = ["--filters", f"Name=tag:aws:cloudformation:stack-id,Values={self.manifest['stackId']}"]
            if token:
                arguments += ["--next-token", token]
            page = self.call("ec2", "describe-instances", arguments, until)
            reservations = page.get("Reservations")
            if not isinstance(reservations, list):
                raise QualificationError("EC2 inventory missing; absence is not proof of empty cleanup")
            for reservation in reservations:
                if not isinstance(reservation, dict) or reservation.get("OwnerId") != ACCOUNT or not isinstance(reservation.get("Instances"), list):
                    raise QualificationError("EC2 reservation owner mismatch")
                if any(not isinstance(instance, dict) for instance in reservation["Instances"]):
                    raise QualificationError("Malformed scoped EC2 instance inventory")
                found.extend(reservation["Instances"])
            if len(found) > self.limits.max_instances:
                raise QualificationError("Scoped instance inventory bound exceeded")
            token = page.get("NextToken")
            if not token:
                return found
            if token in seen_tokens:
                raise QualificationError("Repeated instance pagination token")
            seen_tokens.add(token)
        raise QualificationError("Instance pagination bound exceeded")

    def observe(self, instances: list[dict[str, Any]]) -> set[str]:
        with self.lock:
            seen: set[str] = set()
            admitted: set[str] = set()
            inconclusive: list[dict[str, Any]] = []
            for instance in instances:
                identifier = instance.get("InstanceId", "")
                try:
                    if not re.fullmatch(r"i-[0-9a-f]{17}", identifier) or identifier in seen:
                        raise QualificationError("malformed/duplicate instance ID")
                    seen.add(identifier)
                    actual_tags = tags(instance.get("Tags", []))
                    expected_tags = {"aws:cloudformation:stack-id": self.manifest["stackId"], "aws:cloudformation:stack-name": STACK_NAME, "aws:cloudformation:logical-id": self.logical_id, RUN_KEY: self.manifest["runTag"]["value"]}
                    if any(key in actual_tags and actual_tags[key] != value for key, value in expected_tags.items()):
                        raise QualificationError("stack/logical/run tag mismatch")
                    missing = sorted(set(expected_tags) - set(actual_tags))
                    if missing:
                        inconclusive.append({"instanceId": identifier, "missingTags": missing})
                        continue  # eventual tag visibility is re-observed, never an admission or sticky conflict
                    if instance.get("VpcId") != VPC or instance.get("SubnetId") != SUBNET or instance.get("ImageId") != AMI:
                        raise QualificationError("network/AMI mismatch")
                    launch = timestamp(instance.get("LaunchTime"))
                    if launch < self.armed_at - dt.timedelta(seconds=5) or launch > self.clock.now() + dt.timedelta(seconds=5):
                        raise QualificationError("launch outside this newly armed run")
                    state = instance.get("State", {}).get("Name")
                    if state not in {"pending", "running", "stopping", "stopped", "shutting-down", "terminated"}:
                        raise QualificationError("missing/unknown instance state")
                    root = instance.get("RootDeviceName")
                    root_ids: list[str] = []
                    if not isinstance(root, str) or not root.startswith("/dev/"):
                        root = None
                        self.problem(f"{identifier}: root device identity missing")
                    for mapping in instance.get("BlockDeviceMappings", []):
                        if root is not None and mapping.get("DeviceName") == root:
                            ebs = mapping.get("Ebs", {})
                            volume = ebs.get("VolumeId", "")
                            if not re.fullmatch(r"vol-[0-9a-f]{17}", volume):
                                raise QualificationError("malformed root volume ID")
                            root_ids.append(volume)
                            self.volumes.add(volume)
                            if ebs.get("DeleteOnTermination") is not True:
                                self.problem(f"{identifier}: root volume is not delete-on-termination")
                    previous = self.hosts.get(identifier, {})
                    if previous.get("rootVolumeIds") and root_ids and previous["rootVolumeIds"] != root_ids:
                        self.problem(f"{identifier}: root volume identity changed")
                    self.hosts[identifier] = {"state": state, "launchTime": launch.isoformat(), "rootVolumeIds": root_ids or previous.get("rootVolumeIds", []), "lastObservedAt": self.clock.now().isoformat()}
                    admitted.add(identifier)
                except (QualificationError, TypeError, ValueError) as error:
                    self.problem(f"Rejected scoped EC2 observation: {identifier or 'unknown'}: {error}")
            if len(self.hosts) > 1 or len(seen) > 1:
                self.problem("More than one expected host observed; clean only independently admitted matching hosts")
            self.record["lastInconclusiveInstances"] = inconclusive
            self.save()
            return admitted

    def root_volumes_deleted(self, until: float) -> bool:
        with self.lock:
            hosts = dict(self.hosts)
            volumes = sorted(self.volumes)
        if not hosts or not volumes or any(host["state"] != "terminated" or len(host["rootVolumeIds"]) != 1 for host in hosts.values()):
            return False
        deleted = []
        for volume in volumes:
            try:
                result = self.call("ec2", "describe-volumes", ["--volume-ids", volume], until)
            except AwsError as error:
                if error.code == "InvalidVolume.NotFound":
                    deleted.append(volume)
                    continue
                raise
            values = result.get("Volumes")
            if not isinstance(values, list) or len(values) != 1 or values[0].get("VolumeId") != volume:
                raise QualificationError("Root volume readback inconclusive")
        self.update(deletedRootVolumeIds=deleted)
        return len(deleted) == len(volumes)

    def cleanup(self) -> dict[str, Any]:
        if not self.attempted:
            return {"confirmed": True, "status": "not-required-no-execute-attempt"}
        until = self.clock.monotonic() + self.limits.cleanup
        stable = 0
        for _ in range(math.ceil(self.limits.cleanup / max(self.limits.poll, 0.001)) + 2):
            if self.clock.monotonic() >= until:
                break
            current: set[str] = set()
            try:
                # Containment depends only on freshly scoped EC2 and STS, never CFN availability.
                current = self.observe(self.discover(until))
                with self.lock:
                    active = sorted(identifier for identifier, host in self.hosts.items() if identifier in current and host["state"] not in {"terminated", "shutting-down"} and identifier not in self.termination_requested)
                if active:
                    self.identity(until)  # immediately precedes EACH scoped mutation
                    with self.lock:
                        self.termination_requested.update(active)  # no automatic mutation retry after uncertain response
                    result = self.call("ec2", "terminate-instances", ["--instance-ids", *active], until)
                    returned = [item.get("InstanceId") for item in result.get("TerminatingInstances", [])]
                    if sorted(returned) != active:
                        self.problem("Termination response identity mismatch; readbacks still required")
            except QualificationError as error:
                self.problem(f"Cleanup containment observation/mutation failure: {error}")
                if "Fresh STS identity" in str(error) or getattr(error, "code", None) == "ProcessExitUnknown":
                    break
            volumes_complete = False
            try:
                volumes_complete = self.root_volumes_deleted(until)
            except QualificationError as error:
                self.problem(f"Root volume confirmation failure: {error}")
            try:
                # CFN/tag failures prevent confirmation, but occur AFTER safe containment.
                stack = self.stack(until)
                inventory = self.resources(until)
                physical = {item["PhysicalResourceId"] for item in inventory if item.get("ResourceType") == "AWS::EC2::Instance" and item.get("PhysicalResourceId")}
                with self.lock:
                    observed = set(self.hosts)
                    all_terminated = all(host["state"] == "terminated" for host in self.hosts.values())
                # Empty tag-filter results after an uncertain Execute are never positive no-launch proof.
                # Continue the full bounded discovery window; no host/root observation means UNKNOWN.
                complete = bool(observed and self.volumes) and stack.get("StackStatus") in TERMINAL_STACKS and physical <= observed and observed <= current and all_terminated and volumes_complete
                if any(problem.startswith("Rejected scoped EC2 observation") for problem in self.problems):
                    complete = False
                stable = stable + 1 if complete else 0
                if stable >= 2:
                    return {"confirmed": True, "status": "terminated-and-root-volumes-deleted", "instanceIds": sorted(observed), "rootVolumeIds": sorted(self.volumes), "stackStatus": stack.get("StackStatus")}
            except QualificationError as error:
                self.problem(f"Cleanup confirmation failure: {error}")
                stable = 0
                if getattr(error, "code", None) == "ProcessExitUnknown":
                    break
            self.clock.sleep(min(self.limits.poll, max(0, until - self.clock.monotonic())))
        return {"confirmed": False, "status": "UNKNOWN-or-incomplete", "instanceIds": sorted(self.hosts), "rootVolumeIds": sorted(self.volumes)}

    def watchdog(self) -> None:
        try:
            while not self.trigger.is_set():
                remaining = self.deadline - self.clock.monotonic()
                if remaining <= 0:
                    self.deadline_hit = True
                    self.problem("Absolute 20-minute execution deadline reached")
                    break
                self.clock.wait(self.trigger, min(remaining, 1))
            with self.lock:
                self.cleanup_started.set()
                self.update(cleanupStartedAt=self.clock.now().isoformat())
            self.cleanup_result = self.cleanup()
        except BaseException as error:
            self.problem(f"Watchdog failed: {type(error).__name__}: {error}")
            self.cleanup_result = {"confirmed": False, "status": "UNKNOWN-watchdog-failure"}
        finally:
            self.save()
            self.done.set()

    def run(self, execute: bool = False) -> dict[str, Any]:
        self.preflight()
        if not execute:
            self.update(status="inspected-no-mutations")
            return self.record
        self.armed_at = self.clock.now()
        self.deadline = self.clock.monotonic() + self.limits.lifetime
        self.update(status="armed-before-execute", armedAt=self.armed_at.isoformat(), absoluteDeadline=(self.armed_at + dt.timedelta(seconds=self.limits.lifetime)).isoformat(), cleanupWindowSeconds=self.limits.cleanup)
        # Durable manifest MUST precede thread start and ExecuteChangeSet.
        thread = threading.Thread(target=self.watchdog, name="browser-host-absolute-deadline", daemon=True)
        thread.start()
        try:
            self.identity(self.deadline)
            with self.lock:
                if self.done.is_set() or self.trigger.is_set() or self.cleanup_started.is_set() or self.clock.monotonic() >= self.deadline:
                    raise QualificationError("Deadline/cleanup already started; ExecuteChangeSet forbidden")
                self.attempted = True
                self.update(required=True, status="execute-attempted", executeAttemptedAt=self.clock.now().isoformat())
            self.call("cloudformation", "execute-change-set", ["--stack-name", self.manifest["stackId"], "--change-set-name", self.manifest["changeSetId"], "--client-request-token", self.manifest["runTag"]["value"]], self.deadline)
            self.update(status="observing-host-not-application-qualification")
            for _ in range(math.ceil(self.limits.lifetime / max(self.limits.poll, 0.001)) + 2):
                if self.done.is_set() or self.cleanup_started.is_set() or self.clock.monotonic() >= self.deadline:
                    break
                stack = self.stack(self.deadline)
                self.update(lastStackStatus=stack.get("StackStatus"))
                self.observe(self.discover(self.deadline))
                if stack.get("StackStatus") in TERMINAL_STACKS and stack.get("StackStatus") != "CREATE_COMPLETE":
                    self.problem(f"CloudFormation creation failed: {stack.get('StackStatus')}")
                    break
                if self.problems:
                    break
                if self.hosts and all(host["state"] == "terminated" for host in self.hosts.values()):
                    break
                self.clock.sleep(min(self.limits.poll, max(0, self.deadline - self.clock.monotonic())))
            if self.clock.monotonic() >= self.deadline:
                self.deadline_hit = True
                self.problem("Absolute 20-minute execution deadline reached")
        except BaseException as error:
            self.problem(f"Execution interrupted/failed: {type(error).__name__}: {error}")
        finally:
            self.trigger.set()
            # A second Ctrl-C cannot silently abandon an already admitted host.
            join_until = time.monotonic() + self.limits.cleanup + 2 * self.limits.api_timeout + 10
            while thread.is_alive() and time.monotonic() < join_until:
                try:
                    thread.join(timeout=min(1, max(0, join_until - time.monotonic())))
                except KeyboardInterrupt:
                    self.problem("Repeated interrupt while awaiting bounded cleanup; continuing confirmation")
            if thread.is_alive() or not self.done.is_set():
                self.problem("Watchdog/thread exit UNCONFIRMED; cleanup cannot be claimed")
                self.cleanup_result = {"confirmed": False, "status": "UNKNOWN-thread-exit"}
            self.update(status="cleanup-confirmed-application-unassessed" if self.cleanup_result.get("confirmed") and not self.problems and not self.deadline_hit else "FAILED", finishedAt=self.clock.now().isoformat())
        return self.record


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", required=True, type=Path, help="Explicit owner-reviewed input; never auto-selected or generated")
    parser.add_argument("--evidence", required=True, type=Path, help="NEW local evidence directory; must not already exist")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--inspect", action="store_true", help="Read-only (default)")
    mode.add_argument("--execute", action="store_true", help="Execute exactly the reviewed CREATE and scope cleanup")
    args = parser.parse_args(argv)
    evidence = None
    try:
        if args.manifest.stat().st_size > 32_768:
            raise QualificationError("Manifest exceeds bound")
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        validate_manifest(manifest, dt.datetime.now(UTC))
        evidence = Evidence(args.evidence.resolve())
        controller = Controller(manifest, AwsCLI(execute=args.execute), evidence)
        result = controller.run(execute=args.execute)
        print(json.dumps({"status": result["status"], "cleanup": result.get("cleanup"), "evidenceFailures": result.get("evidenceFailures", []), "applicationQualification": "NOT_ASSESSED", "evidence": str(evidence.directory)}))
        return 1 if result["status"] == "FAILED" else 0
    except (QualificationError, OSError, ValueError) as error:
        if evidence:
            evidence.save("entrypoint-error.json", {"type": type(error).__name__, "message": str(error)})
        print(json.dumps({"status": "FAILED", "errorType": type(error).__name__, "message": str(scrub(str(error))), "applicationQualification": "NOT_ASSESSED"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
