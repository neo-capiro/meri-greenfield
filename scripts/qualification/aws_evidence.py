"""Owner-only AWS qualification capture; never used by conversation workers."""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
from teststate_request import strict_object, validate_readonly_request

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
                      "--execution-arn", "--name", "--input", "--description", "--max-results", "--next-token",
                      "--revision-id"},
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
                      "publish-state-machine-version", "update-state-machine", "start-execution", "describe-execution",
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

UPLOAD_BUCKET = "meri-greenfield-qual-build-967807252336-us-east-1"
UPLOAD_KMS = "arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042"


def validate_timeout(arguments, timeout):
    """Long deadlines belong only to a fully bound conditional qualification ZIP."""
    if type(timeout) is not int or not 1 <= timeout <= 180:
        raise ValueError("capture timeout must be an integer within 1..180 seconds")
    if timeout <= 60:
        return
    required = {"--bucket", "--key", "--body", "--if-none-match", "--server-side-encryption",
                "--ssekms-key-id", "--checksum-algorithm", "--checksum-sha256", "--metadata"}
    if arguments[:2] != ["s3api", "put-object"] or len(arguments) != 2 + 2 * len(required):
        raise ValueError("long timeout requires an exact qualification upload")
    pairs = list(zip(arguments[2::2], arguments[3::2]))
    if any(type(key) is not str or type(value) is not str for key, value in pairs):
        raise ValueError("upload options and values must be strings")
    options = dict(pairs)
    if len(options) != len(pairs) or set(options) != required:
        raise ValueError("upload options must be exact and unique")
    key = re.fullmatch(r"inputs/proxy-linux-import-([0-9a-f]{40})/"
                       r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.zip",
                       options["--key"])
    if (key is None or options["--bucket"] != UPLOAD_BUCKET
            or options["--if-none-match"] != "*"
            or options["--server-side-encryption"] != "aws:kms"
            or options["--ssekms-key-id"] != UPLOAD_KMS
            or options["--checksum-algorithm"] != "SHA256"):
        raise ValueError("upload target, conditional create, KMS or checksum differs")
    metadata = json.loads(options["--metadata"], object_pairs_hook=strict_object)
    if (type(metadata) is not dict or set(metadata) != {"sourcecommit", "archivesha256"}
            or metadata["sourcecommit"] != key[1]
            or type(metadata["archivesha256"]) is not str
            or not re.fullmatch(r"[0-9a-f]{64}", metadata["archivesha256"])):
        raise ValueError("upload metadata must bind source commit and archive hash")
    body = Path(options["--body"])
    if not body.is_absolute():
        raise ValueError("upload body must be an absolute regular file")
    for ancestor in [body.parent, *body.parent.parents]:
        info = ancestor.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError("upload ancestor is a link or reparse point")
    before = body.lstat()
    if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1
            or getattr(before, "st_file_attributes", 0) & 0x400
            or not 0 < before.st_size <= 512 * 1024 * 1024):
        raise ValueError("upload body must be a bounded single-link regular file")
    identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns)
    digest, count = hashlib.sha256(), 0
    with body.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        if identity(before) != identity(opened):
            raise ValueError("upload body identity changed before read")
        while block := stream.read(1024 * 1024):
            count += len(block)
            if count > 512 * 1024 * 1024:
                raise ValueError("upload body exceeds bound")
            digest.update(block)
        closed = os.fstat(stream.fileno())
    after = body.lstat()
    stable = lambda value: (value.st_dev, value.st_ino, value.st_mode, value.st_nlink,
                            value.st_size, value.st_mtime_ns, value.st_ctime_ns)
    if (stable(before) != stable(after) or stable(opened) != stable(closed)
            or count != before.st_size or digest.hexdigest() != metadata["archivesha256"]
            or options["--checksum-sha256"] != base64.b64encode(digest.digest()).decode("ascii")):
        raise ValueError("upload body drift or checksum mismatch")


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
    validate_timeout(arguments, timeout)
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
