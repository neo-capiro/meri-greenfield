"""Owner-only AWS qualification capture; never used by conversation workers."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from teststate_request import validate_readonly_request

AWS = r"C:\Program Files\Amazon\AWSCLIV2\aws.exe"
REGION = "us-east-1"
PROFILE = "capiro-dev"
OPTIONS = {
    "sts": set(),
    "cloudformation": {"--stack-name", "--change-set-name", "--change-set-type", "--capabilities",
                       "--template-body", "--description", "--template-stage", "--parameters"},
    "iam": {"--role-name", "--policy-name", "--policy-source-arn", "--action-names",
            "--resource-arns", "--context-entries"},
    "stepfunctions": {"--cli-input-json", "--definition", "--type", "--severity", "--state-machine-arn",
                      "--execution-arn", "--name", "--input", "--description", "--max-results", "--next-token"},
    "ecs": {"--cluster", "--tasks", "--task-definition", "--include", "--desired-status", "--started-by"},
    "ec2": {"--network-interface-ids", "--subnet-ids", "--group-ids", "--filters", "--vpc-id", "--attribute"},
    "logs": {"--log-group-name", "--log-group-name-prefix", "--log-stream-name", "--log-stream-name-prefix",
             "--start-time", "--end-time", "--start-from-head", "--next-token", "--limit"},
    "kms": {"--key-id", "--policy-name"},
    "route53resolver": {"--firewall-rule-group-id", "--firewall-domain-list-id", "--max-results", "--next-token"},
    "codebuild": {"--names", "--project-name", "--sort-order", "--ids", "--cli-input-json"},
    "ecr": {"--repository-names", "--repository-name", "--image-ids", "--accepted-media-types"},
    "s3api": {"--bucket", "--key", "--body", "--if-none-match", "--server-side-encryption",
              "--ssekms-key-id", "--checksum-algorithm", "--checksum-sha256", "--metadata",
              "--version-id", "--checksum-mode"},
}
ALLOWED = {
    "sts": {"get-caller-identity"},
    "cloudformation": {"validate-template", "create-change-set", "describe-change-set",
                       "execute-change-set", "describe-stacks", "describe-stack-events", "get-template"},
    "iam": {"get-role", "list-role-policies", "get-role-policy", "list-attached-role-policies",
            "simulate-principal-policy"},
    "stepfunctions": {"test-state", "validate-state-machine-definition", "describe-state-machine",
                      "publish-state-machine-version", "start-execution", "describe-execution",
                      "get-execution-history", "list-executions"},
    "ecs": {"describe-task-definition", "list-tasks", "describe-tasks", "describe-clusters"},
    "ec2": {"describe-network-interfaces", "describe-subnets", "describe-security-groups",
            "describe-route-tables", "describe-vpc-endpoints", "describe-vpc-attribute"},
    "logs": {"describe-log-groups", "describe-log-streams", "get-log-events"},
    "kms": {"describe-key", "get-key-policy"},
    "route53resolver": {"list-resolver-query-log-config-associations", "list-firewall-rule-group-associations",
                        "list-firewall-rules", "list-firewall-domain-lists", "list-firewall-domains"},
    "codebuild": {"batch-get-projects", "list-builds-for-project", "batch-get-builds", "start-build"},
    "ecr": {"describe-repositories", "describe-images", "batch-get-image", "describe-image-scan-findings"},
    "s3api": {"put-object", "head-object", "get-object"},
}


def capture(out, label, arguments, timeout=45):
    """Run one admitted operation once and retain binary stdout/stderr and envelope."""
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", label):
        raise ValueError("invalid evidence label")
    if len(arguments) < 2 or arguments[1] not in ALLOWED.get(arguments[0], set()):
        raise ValueError("operation is outside the owner qualification allowlist")
    if any(arg.startswith("-") and arg not in OPTIONS[arguments[0]] for arg in arguments):
        raise ValueError("unrecognized, abbreviated or global CLI option")
    request_validation = (validate_readonly_request(arguments)
                          if arguments[:2] == ["stepfunctions", "test-state"] else None)
    if not 1 <= timeout <= 60:
        raise ValueError("capture timeout must be within 1..60 seconds")
    destination = Path(out).resolve() / label
    destination.mkdir(parents=True, exist_ok=False)
    argv = [AWS, *arguments, "--profile", PROFILE, "--region", REGION, "--output", "json", "--no-cli-pager",
            "--cli-connect-timeout", "10", "--cli-read-timeout", "30"]
    # Only the trusted named local profile supplies identity; ambient endpoint,
    # config-file, credential and transport-proxy overrides are removed.
    environment = {key: value for key, value in os.environ.items()
                   if not key.upper().startswith("AWS_")
                   and key.upper() not in {"BOTO_CONFIG", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
                                           "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "SSL_CERT_FILE", "SSL_CERT_DIR"}}
    environment.update(AWS_MAX_ATTEMPTS="1", AWS_RETRY_MODE="standard", AWS_PAGER="",
                       AWS_IGNORE_CONFIGURED_ENDPOINT_URLS="true",
                       AWS_CONFIG_FILE=str(Path.home() / ".aws" / "config"),
                       AWS_SHARED_CREDENTIALS_FILE=str(Path.home() / ".aws" / "credentials"))
    started = datetime.datetime.now(datetime.timezone.utc)
    timed_out = False
    try:
        result = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, shell=False, timeout=timeout, env=environment)
        stdout, stderr, code = result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired as error:
        stdout, stderr, code = error.stdout or b"", error.stderr or b"", None
        timed_out = True
    ended = datetime.datetime.now(datetime.timezone.utc)
    for name, data in (("stdout.bin", stdout), ("stderr.bin", stderr)):
        with (destination / name).open("xb") as stream:
            stream.write(data)
    envelope = {
        "schema": "meri-codex-aws-capture/1", "argv": argv, "cwd": str(Path.cwd()),
        "startedAt": started.isoformat(), "endedAt": ended.isoformat(), "timeoutSeconds": timeout,
        "timedOut": timed_out, "exitCode": code, "automaticRetries": 0,
        "stdout": {"bytes": len(stdout), "sha256": hashlib.sha256(stdout).hexdigest()},
        "stderr": {"bytes": len(stderr), "sha256": hashlib.sha256(stderr).hexdigest()},
        "readonlyRequestValidation": request_validation,
    }
    with (destination / "process.json").open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(envelope, stream, indent=2)
        stream.write("\n")
    if code != 0 or timed_out:
        raise RuntimeError(f"{label}: AWS operation failed; inspect retained raw evidence")
    return json.loads(stdout) if stdout.strip() else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    arguments = args.arguments[1:] if args.arguments[:1] == ["--"] else args.arguments
    result = capture(args.out, args.label, arguments)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
