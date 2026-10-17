"""Portable authenticated metadata/evidence retrieval. No AWS writes or credential reads.

Exit 0: selected reads retained privately; 2: input/read/verification failure.
Use the receiving machine's existing authorized profile. No profile is assumed.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ACCOUNT = "967807252336"
REGION = "us-east-1"
PROJECT = "meri-greenfield-qualification-build"
ROLE = "MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H"
POLICY = "BuilderRoleDefaultPolicy8E4A45D4"
BUCKET = "meri-greenfield-qual-build-967807252336-us-east-1"
KMS = f"arn:aws:kms:{REGION}:{ACCOUNT}:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042"
REPOSITORY = "meri-greenfield/qualification-worker"
BUILD = PROJECT + ":5b67476a-5b30-43a7-9957-d83c72525aa2"
DIGEST = "sha256:e318ab002a9f1dfb86245c352d2f521f09c66086f31d9ffd92f08cbf39f0b236"
SOURCE = "38f52df94b1738649776792b2a28aac743801c19"
ATTEMPT = "f238e6f45da84885bd2e3c0b6a0fa92f"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("resources", "evidence"))
    parser.add_argument("--profile", required=True, help="An existing profile on this machine")
    parser.add_argument("--aws", default="aws", help="AWS CLI executable")
    parser.add_argument("--output-directory", required=True, type=Path,
                        help="New PRIVATE directory outside any Git checkout")
    args = parser.parse_args()
    if not args.profile or args.profile.startswith("-") or any(ord(c) < 32 for c in args.profile):
        raise ValueError("PROFILE_REFUSED")
    args.output_directory = args.output_directory.resolve()
    if any((parent / ".git").exists() for parent in args.output_directory.parents):
        raise ValueError("PRIVATE_OUTPUT_MUST_BE_OUTSIDE_GIT")
    env = dict(os.environ, AWS_MAX_ATTEMPTS="1", AWS_PAGER="", AWS_CLI_AUTO_PROMPT="off")
    prefix = [args.aws, "--profile", args.profile, "--region", REGION, "--no-cli-pager",
              "--cli-connect-timeout", "10", "--cli-read-timeout", "30"]

    def read(*command):
        result = subprocess.run(prefix + list(command) + ["--output", "json"],
                                capture_output=True, timeout=65, env=env, check=False)
        if result.returncode != 0 or len(result.stdout) + len(result.stderr) > 16 * 1024**2:
            raise ValueError("AWS_READ_FAILED_RECONCILE_PRIVATE_OUTPUTS")
        return json.loads(result.stdout)

    caller = read("sts", "get-caller-identity", "--query", "{Account:Account,Arn:Arn}")
    if caller.get("Account") != ACCOUNT:
        raise ValueError("ACCOUNT_REFUSED")
    # A different authorized receiving principal is expected. Never pin jump-cli.
    # Only the newly owned output directory is created; never chmod existing paths.
    args.output_directory.mkdir(mode=0o700, parents=False, exist_ok=False)
    def save(name, value):
        with (args.output_directory / name).open("x", encoding="utf-8", newline="\n") as file:
            json.dump(value, file, indent=2)
            file.write("\n")
    save("caller.json", caller)
    if args.mode == "resources":
        save("project.json", read("codebuild", "batch-get-projects", "--names", PROJECT, "--query",
             "{projects:projects[].{name:name,arn:arn,serviceRole:serviceRole,environment:environment.{type:type,image:image,computeType:computeType,privilegedMode:privilegedMode,variableMetadata:environmentVariables[].{name:name,type:type}},timeout:timeoutInMinutes,queueTimeout:queuedTimeoutInMinutes,vpcConfig:vpcConfig,cache:cache,artifacts:artifacts,encryptionKey:encryptionKey},missing:projectsNotFound}"))
        ids = read("codebuild", "list-builds-for-project", "--project-name", PROJECT,
                   "--sort-order", "DESCENDING", "--max-items", "20").get("ids", [])
        save("recent-builds.json", read("codebuild", "batch-get-builds", "--ids", *ids, "--query",
             "{builds:builds[].{id:id,status:buildStatus,phase:currentPhase,complete:buildComplete,sourceVersion:sourceVersion,start:startTime,end:endTime,autoRetryConfig:autoRetryConfig},missing:buildsNotFound}") if ids else {"builds": []})
        save("role-policy.json", read("iam", "get-role-policy", "--role-name", ROLE, "--policy-name", POLICY))
        save("role-trust.json", read("iam", "get-role", "--role-name", ROLE, "--query",
             "Role.{Arn:Arn,AssumeRolePolicyDocument:AssumeRolePolicyDocument,PermissionsBoundary:PermissionsBoundary,MaxSessionDuration:MaxSessionDuration}"))
        save("attached-policies.json", read("iam", "list-attached-role-policies", "--role-name", ROLE))
        save("inline-policy-names.json", read("iam", "list-role-policies", "--role-name", ROLE))
        save("repository.json", read("ecr", "describe-repositories", "--repository-names", REPOSITORY))
        save("kms.json", read("kms", "describe-key", "--key-id", KMS))
        save("bucket-versioning.json", read("s3api", "get-bucket-versioning", "--bucket", BUCKET))
        save("bucket-encryption.json", read("s3api", "get-bucket-encryption", "--bucket", BUCKET))
    else:
        build = read("codebuild", "batch-get-builds", "--ids", BUILD, "--query",
             "{builds:builds[].{id:id,status:buildStatus,phase:currentPhase,complete:buildComplete,sourceVersion:sourceVersion,start:startTime,end:endTime,autoRetryConfig:autoRetryConfig,logs:logs.{groupName:groupName,streamName:streamName}},missing:buildsNotFound}")
        save("consumed-build.json", build)
        save("image.json", read("ecr", "describe-images", "--repository-name", REPOSITORY,
                                "--image-ids", "imageDigest=" + DIGEST))
        save("scan.json", read("ecr", "describe-image-scan-findings", "--repository-name", REPOSITORY,
                               "--image-id", "imageDigest=" + DIGEST))
        artifact = ("results/product-image/" + SOURCE + "/" + ATTEMPT + "/product-image-failure.json",
                    "ExfjxJQcgwvC4FBYNd9Hw4ycuCH39iLQ", 406,
                    "9af48e591eadb2f12c65ac1e8c07ceab37f2f9e9abcf016eb3e287637cf94c0c")
        key, version, size, expected = artifact
        head = read("s3api", "head-object", "--bucket", BUCKET, "--key", key,
                    "--version-id", version, "--checksum-mode", "ENABLED")
        expected_b64 = base64.b64encode(bytes.fromhex(expected)).decode()
        if not (head.get("VersionId") == version and head.get("ContentLength") == size
                and head.get("ChecksumSHA256") == expected_b64
                and head.get("ServerSideEncryption") == "aws:kms" and head.get("SSEKMSKeyId") == KMS):
            raise ValueError("ARTIFACT_HEAD_REFUSED")
        save("failure-head.json", head)
        target = args.output_directory / "product-image-failure.json"
        read("s3api", "get-object", "--bucket", BUCKET, "--key", key, "--version-id", version,
             "--checksum-mode", "ENABLED", str(target))
        if target.stat().st_size != size or hashlib.sha256(target.read_bytes()).hexdigest() != expected:
            raise ValueError("ARTIFACT_BYTES_REFUSED")
        save("log-retrieval.json", {"instruction": "Use the returned exact log group/stream with logs get-log-events; paginate all pages and retain raw output privately. Do not commit raw logs or scans."})
    save("completion.json", {"status": "SELECTED_READS_ONLY_NOT_BUILD_OR_ACTIVATION_APPROVAL",
                              "mode": args.mode, "account": ACCOUNT, "region": REGION,
                              "newBuildStarted": False, "awsWrites": False})
    print("SELECTED_PRIVATE_READS_RETAINED; no build or activation authorized")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError, json.JSONDecodeError):
        print("READ_ONLY_CHECKPOINT_INCOMPLETE; reconcile retained private files", file=sys.stderr)
        sys.exit(2)
