"""Read-only evidence for one fixed third canary; never starts or stops resources."""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import time

RUN = "cbfce523-4807-4ebc-865c-b319e4807e22"
BINDING = "94d71251b3f10c0bc3ba6fd0cdab8f74f9a5373db6ade5beec814629ba89a917"
NAME = "meri-canary-" + RUN
MACHINE = "arn:aws:states:us-east-1:967807252336:stateMachine:meri-greenfield-native-enforcement-canary-20261010"
VERSION = MACHINE + ":3"
EXECUTION = MACHINE.replace(":stateMachine:", ":execution:") + ":" + NAME
CLUSTER = "arn:aws:ecs:us-east-1:967807252336:cluster/meri-greenfield-qualification"
DEFINITION = "arn:aws:ecs:us-east-1:967807252336:task-definition/meri-greenfield-qualification-canary:1"
DIGEST = "sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c"
IMAGE = "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@" + DIGEST
TASK_PATTERN = re.compile(re.escape(CLUSTER.replace(":cluster/", ":task/") + "/") + "[0-9a-f]{32}")
TAGS = {"QualificationRun": RUN, "QualificationProbe": "canary", "MeriComponent": "native-enforcement"}
AWS = r"C:\Program Files\Amazon\AWSCLIV2\aws.exe"
TERMINAL = {"SUCCEEDED": "ExecutionSucceeded", "FAILED": "ExecutionFailed",
            "TIMED_OUT": "ExecutionTimedOut", "ABORTED": "ExecutionAborted"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def json_value(raw):
    def pairs(rows):
        result = {}
        for key, value in rows:
            require(key not in result, "duplicate JSON key")
            result[key] = value
        return result
    def invalid(value):
        raise ValueError("nonfinite JSON constant: " + value)
    def finite(value):
        number = float(value)
        require(math.isfinite(number), "nonfinite JSON number")
        return number
    require(len(raw) <= 32 * 1024 * 1024, "JSON exceeds32MiB (raw capture retained)")
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid, parse_float=finite)


def write_json(path, value):
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=True, indent=2, allow_nan=False)
        stream.write("\n")


def read_pinned(path, expected):
    require(path.is_absolute() and re.fullmatch("[0-9a-f]{64}", expected), "absolute input path and SHA256 required")
    require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 1024 * 1024,
            "input must be a regular file <=1MiB")
    raw = path.read_bytes()
    require(sha(raw) == expected, "input pin mismatch")
    return raw, json_value(raw)


def original_inputs(reservation, start, admission):
    require(type(reservation) is dict and type(start) is dict and type(admission) is dict, "input objects required")
    t0 = reservation.get("t0Ms")
    require(type(t0) is int and 0 < t0 < 2**53, "invalid original t0")
    expected = {"runUuid": RUN, "probeKind": "canary", "executionName": NAME,
                "staticBindingId": BINDING, "t0Ms": t0}
    require(start == expected, "start input identity/shape mismatch")
    require(reservation.get("status") == "CONSUMED_ONE_START_NO_RETRY"
            and reservation.get("runUuid") == RUN and reservation.get("staticBindingId") == BINDING
            and reservation.get("executionName") == NAME and reservation.get("stateMachineVersionArn") == VERSION,
            "reservation identity mismatch")
    require(type(reservation.get("D")) is int and type(reservation.get("C")) is int
            and reservation["D"] == t0 + 720000 and reservation["C"] == t0 + 900000, "original deadlines mismatch")
    require(admission.get("decision") == "ADMIT_EXACT_ONE_SYNTHETIC_SLEEP_CANARY_ONLY"
            and admission.get("runUuid") == RUN and admission.get("staticBindingId") == BINDING
            and admission.get("stateMachineVersionArn") == VERSION
            and admission.get("workerImageDigest") == DIGEST
            and admission.get("taskDefinition") == "meri-greenfield-qualification-canary:1"
            and admission.get("command") == ["/usr/bin/sleep", "1200"]
            and type(admission.get("deadlineSeconds")) is int and admission["deadlineSeconds"] == 720
            and type(admission.get("cleanupAllowanceSeconds")) is int and admission["cleanupAllowanceSeconds"] == 180,
            "owner admission mismatch")
    return expected


def capture(out, label, operation, arguments, deadline):
    """Fixed read-only adapter; explicit service paging, canonical capture bounds."""
    require(operation in {("stepfunctions", "describe-execution"), ("stepfunctions", "get-execution-history"),
                          ("ecs", "describe-tasks")}, "read-only operation required")
    remaining = math.floor(deadline - time.monotonic())
    require(remaining >= 1, "observer300s budget exhausted")
    timeout = min(45, remaining)
    destination = out / label
    destination.mkdir(exist_ok=False)
    argv = [AWS, *operation, *arguments, "--no-paginate", "--profile", "capiro-dev", "--region", "us-east-1",
            "--output", "json", "--no-cli-pager", "--cli-connect-timeout", "10", "--cli-read-timeout", "30"]
    blocked = {"BOTO_CONFIG", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "REQUESTS_CA_BUNDLE",
               "CURL_CA_BUNDLE", "SSL_CERT_FILE", "SSL_CERT_DIR"}
    environment = {k: v for k, v in os.environ.items() if not k.upper().startswith("AWS_") and k.upper() not in blocked}
    environment.update(AWS_MAX_ATTEMPTS="1", AWS_RETRY_MODE="standard", AWS_PAGER="",
                       AWS_IGNORE_CONFIGURED_ENDPOINT_URLS="true", AWS_CONFIG_FILE=str(Path.home() / ".aws/config"),
                       AWS_SHARED_CREDENTIALS_FILE=str(Path.home() / ".aws/credentials"))
    began = dt.datetime.now(dt.timezone.utc)
    timed_out, failure, code, stdout, stderr = False, None, None, b"", b""
    try:
        result = subprocess.run(argv, shell=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout, env=environment)
        stdout, stderr, code = result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired as error:
        stdout, stderr, timed_out = error.stdout or b"", error.stderr or b"", True
    except OSError as error:
        failure = type(error).__name__
    for name, raw in (("stdout", stdout), ("stderr", stderr)):
        with (destination / (name + ".bin")).open("xb") as stream:
            stream.write(raw)
    write_json(destination / "process.json", {
        "schema": "meri-codex-aws-capture/1", "argv": argv, "cwd": str(Path.cwd()),
        "startedAt": began.isoformat(), "endedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "timeoutSeconds": timeout, "timedOut": timed_out, "exitCode": code, "automaticRetries": 0,
        "launchError": failure, "stdout": {"bytes": len(stdout), "sha256": sha(stdout)},
        "stderr": {"bytes": len(stderr), "sha256": sha(stderr)}})
    require(code == 0 and not timed_out and failure is None, label + ": capture failed; raw evidence retained")
    return json_value(stdout), len(stdout)


def execution_identity(value, expected):
    require(type(value) is dict and value.get("executionArn") == EXECUTION and value.get("name") == NAME
            and value.get("stateMachineArn") == MACHINE and value.get("stateMachineVersionArn") == VERSION,
            "foreign execution/version")
    require(value.get("status") in {"RUNNING", *TERMINAL} and type(value.get("redriveCount", 0)) is int
            and value.get("redriveCount", 0) == 0,
            "unknown status or redriven execution")
    require(value.get("inputDetails", {}).get("included") is True
            and json_value(value["input"].encode()) == expected, "execution input not fully bound")


def timestamp_ms(value):
    require(type(value) is str, "timestamp must be an ISO string")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.utcoffset() is not None, "timestamp timezone missing")
    return int(parsed.timestamp() * 1000)


def task_identity(task, upper, expected, container_arn=None):
    """Same identity checks for AWS SDK history and lower-cased ECS CLI records."""
    def key(name):
        return name[0].upper() + name[1:] if upper else name
    def get(name):
        return task.get(key(name))
    require(type(task) is dict and type(get("taskArn")) is str and TASK_PATTERN.fullmatch(get("taskArn")), "invalid task ARN")
    require(get("clusterArn") == CLUSTER and get("taskDefinitionArn") == DEFINITION
            and get("startedBy") == RUN and get("group") == "meri-greenfield-qualification:canary", "foreign task identity")
    tags = get("tags")
    require(type(tags) is list and len(tags) == 3 and all(type(row) is dict for row in tags), "missing/extra task tags")
    require({row.get(key("key")): row.get(key("value")) for row in tags} == TAGS, "foreign/duplicate task tags")
    require(get("launchType") == "FARGATE" and get("platformVersion") == "1.4.0"
            and get("platformFamily") == "Linux" and get("enableExecuteCommand") is False, "runtime identity mismatch")
    require(get("cpu") == "2048" and get("memory") == "8192", "task resource mismatch")
    created = timestamp_ms(get("createdAt"))
    require(expected["t0Ms"] <= created < expected["t0Ms"] + 720000, "task creation outside original dispatch interval")
    containers = get("containers")
    require(type(containers) is list and len(containers) == 1 and type(containers[0]) is dict, "worker singleton required")
    worker = containers[0]
    require(worker.get(key("name")) == "worker" and worker.get(key("taskArn")) == get("taskArn")
            and worker.get(key("image")) == IMAGE, "worker/image identity mismatch")
    actual = worker.get(key("containerArn"))
    prefix = get("taskArn").replace(":task/", ":container/") + "/"
    require(type(actual) is str and actual.startswith(prefix) and len(actual) > len(prefix), "container ARN not task-bound")
    require(container_arn is None or actual == container_arn, "container identity changed")
    if not upper:
        require(worker.get("imageDigest") == DIGEST, "actual image digest mismatch")
    return get("taskArn"), actual, created, worker


def history_task(events, expected, final):
    require([row.get("id") for row in events] == list(range(1, len(events) + 1)), "history gap/duplicate/order")
    launches, scheduled, identities = [], 0, {}
    for event in events:
        require(type(event.get("previousEventId")) is int and 0 <= event["previousEventId"] < event["id"], "invalid history lineage")
        for detail in (value for key, value in event.items() if key.endswith("EventDetails") and type(value) is dict):
            for key in ("inputDetails", "outputDetails"):
                require(detail.get(key, {}).get("truncated", False) is False, "truncated history data")
        detail = event.get("taskScheduledEventDetails", {})
        if detail.get("resourceType") == "aws-sdk:ecs" and detail.get("resource") == "runTask":
            scheduled += 1
            parameters = json_value(detail["parameters"].encode())
            require(parameters.get("Cluster") == CLUSTER and parameters.get("TaskDefinition") == DEFINITION
                    and parameters.get("StartedBy") == RUN and parameters.get("Group") == "meri-greenfield-qualification:canary"
                    and parameters.get("Count") == 1, "RunTask scheduled identity mismatch")
        detail = event.get("taskSucceededEventDetails", {})
        if detail.get("resourceType") == "aws-sdk:ecs" and detail.get("resource") == "runTask":
            value = json_value(detail["output"].encode())
            require(type(value.get("Failures")) is list and type(value.get("Tasks")) is list and len(value["Tasks"]) <= 1,
                    "ambiguous RunTask result")
            for task in value["Tasks"]:
                arn, container, created, _ = task_identity(task, True, expected)
                identities[arn] = (container, created)
            launches.append(event["id"])
    require(scheduled <= 1 and len(launches) <= 1 and len(launches) <= scheduled, "multiple/orphan RunTask attempts")
    output = None
    if "output" in final:
        require(final.get("outputDetails", {}).get("included") is True, "execution output excluded")
        output = json_value(final["output"].encode())
        require(type(output) is dict and output.get("staticBindingId") == BINDING
                and output.get("run") == {"uuid": RUN, "probeKind": "canary", "executionName": NAME, "t0Ms": expected["t0Ms"]}
                and output.get("D") == expected["t0Ms"] + 720000 and output.get("C") == expected["t0Ms"] + 900000,
                "terminal receipt run/deadline mismatch")
        require(not output.get("overflowLedger") and output.get("overflowExhausted", False) is False, "extra/unknown task ledger")
        ledger = output.get("ledger")
        rows = [] if ledger == [] else ledger if type(ledger) is list else [ledger]
        require(len(rows) <= 1 and all(type(row) is dict for row in rows), "ambiguous task ledger")
        for row in rows:
            arn = row.get("arn")
            require(type(arn) is str and TASK_PATTERN.fullmatch(arn) and row.get("definition") == DEFINITION
                    and type(row.get("createdMs")) is int and expected["t0Ms"] <= row["createdMs"] < expected["t0Ms"] + 720000,
                    "foreign ledger identity")
            container = row.get("containerArn")
            require(type(container) is str and container.startswith(arn.replace(":task/", ":container/") + "/"), "ledger container binding missing")
            require(arn not in identities or identities[arn] == (container, row["createdMs"]), "history/ledger identity conflict")
            identities[arn] = (container, row["createdMs"])
    require(len(identities) <= 1, "multiple owned task identities")
    if final["status"] in TERMINAL:
        require(events and events[-1]["type"] == TERMINAL[final["status"]], "terminal history event missing")
        if final["status"] == "SUCCEEDED":
            require(json_value(events[-1]["executionSucceededEventDetails"]["output"].encode()) == output,
                    "history/final execution receipt conflict")
    return identities, output


def observe(out, expected, reservation):
    deadline = time.monotonic() + 300
    before, _ = capture(out, "execution-before", ("stepfunctions", "describe-execution"), ["--execution-arn", EXECUTION], deadline)
    execution_identity(before, expected)
    token, seen, events, pages, total_bytes = None, set(), [], [], 0
    for number in range(1, 33):
        arguments = ["--execution-arn", EXECUTION, "--max-results", "1000"]
        if token is not None:
            arguments += ["--next-token", token]
        value, size = capture(out, "history-%02d" % number, ("stepfunctions", "get-execution-history"), arguments, deadline)
        require(type(value) is dict and type(value.get("events")) is list and len(value["events"]) <= 1000, "malformed history page")
        total_bytes += size
        require(total_bytes <= 128 * 1024 * 1024, "history128MiB bound exceeded")
        require(all(type(row) is dict for row in value["events"]), "invalid history event")
        events.extend(value["events"])
        pages.append({"label": "history-%02d" % number, "events": len(value["events"]), "bytes": size})
        token = value.get("nextToken")
        if token is None:
            break
        require(type(token) is str and 0 < len(token) <= 16384 and token not in seen, "malformed/repeated history token")
        seen.add(token)
    else:
        raise ValueError("32page bound exceeded; history incomplete")
    final, _ = capture(out, "execution-after", ("stepfunctions", "describe-execution"), ["--execution-arn", EXECUTION], deadline)
    execution_identity(final, expected)
    require(before.get("startDate") == final.get("startDate"), "execution start identity changed")
    if before["status"] in TERMINAL:
        require(before == final, "terminal execution changed during observation")
    identities, output = history_task(events, expected, final)
    receipt = None
    if identities:
        arn, (container, created) = next(iter(identities.items()))
        value, _ = capture(out, "task", ("ecs", "describe-tasks"),
                           ["--cluster", CLUSTER, "--tasks", arn, "--include", "TAGS"], deadline)
        require(type(value) is dict and value.get("failures") == [] and type(value.get("tasks")) is list
                and len(value["tasks"]) == 1, "singleton task read unavailable")
        task = value["tasks"][0]
        actual, _, actual_created, worker = task_identity(task, False, expected, container)
        require(actual == arn and actual_created == created, "task creation/ARN changed")
        terminal = task.get("lastStatus") == "STOPPED" and task.get("desiredStatus") == "STOPPED" and worker.get("lastStatus") == "STOPPED" and type(worker.get("exitCode")) is int
        stopped = timestamp_ms(task["stoppedAt"]) if terminal else None
        require(stopped is None or created <= stopped <= int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000), "invalid STOPPED timestamp")
        receipt = {"taskArn": arn, "containerArn": container, "taskStatus": task.get("lastStatus"),
                   "workerStatus": worker.get("lastStatus"), "workerExitCode": worker.get("exitCode"),
                   "createdAt": task.get("createdAt"), "startedAt": task.get("startedAt"), "stoppingAt": task.get("stoppingAt"),
                   "stoppedAt": task.get("stoppedAt"), "stopCode": task.get("stopCode"), "stoppedReason": task.get("stoppedReason"),
                   "taskAndWorkerTerminal": terminal, "stoppedBeforeD": stopped is not None and stopped < reservation["D"],
                   "stoppedBeforeC": stopped is not None and stopped < reservation["C"]}
    return {"status": "READ_ONLY_OBSERVATION_NOT_QUALIFICATION_ACCEPTANCE", "executionArn": EXECUTION,
            "stateMachineVersionArn": VERSION, "awsExecutionStatus": final["status"], "managedOutput": output,
            "executionError": final.get("error"), "executionCause": final.get("cause"), "runUuid": RUN,
            "staticBindingId": BINDING, "t0Ms": expected["t0Ms"], "D": reservation["D"], "C": reservation["C"],
            "historyPages": pages, "historyEvents": len(events), "historyPaginationExhausted": True,
            "historyTerminalEventPresent": bool(events and events[-1]["type"] in TERMINAL.values()),
            "taskReceipt": receipt, "noOwnedTaskObserved": not bool(identities), "mutations": 0,
            "limits": "One observation; running history may grow. No admission/security/survival decision or cleanup action."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("reservation", "start-input", "admission"):
        parser.add_argument("--" + name, type=Path, required=True)
        parser.add_argument("--" + name + "-sha256", required=True)
    parser.add_argument("--out", type=Path, required=True, help="NEW absolute observation directory")
    args = parser.parse_args()
    records, inputs = {}, {}
    for name in ("reservation", "start_input", "admission"):
        path, expected = getattr(args, name), getattr(args, name + "_sha256")
        raw, value = read_pinned(path, expected)
        records[name] = {"path": str(path), "bytes": len(raw), "sha256": sha(raw)}
        inputs[name] = value
    require(sha(args.start_input.read_bytes()) == inputs["reservation"].get("inputSha256"), "reservation start-input raw hash mismatch")
    expected = original_inputs(inputs["reservation"], inputs["start_input"], inputs["admission"])
    require(args.out.is_absolute() and not args.out.exists() and args.out.parent.is_dir(), "NEW absolute output with existing parent required")
    args.out.mkdir(exist_ok=False)
    write_json(args.out / "observation-inputs.json", records)
    try:
        result = observe(args.out, expected, inputs["reservation"])
        for name, record in records.items():
            read_pinned(Path(record["path"]), record["sha256"])
        write_json(args.out / "summary.json", result)
        print(json.dumps({"status": result["status"], "summary": str(args.out / "summary.json")}, ensure_ascii=True))
        return 0
    except Exception as error:
        write_json(args.out / "observer-failure.json", {"status": "OBSERVATION_INCOMPLETE_NOT_ADMITTED", "errorType": type(error).__name__,
                   "message": str(error), "executionArn": EXECUTION, "runUuid": RUN, "mutations": 0})
        print("Observation incomplete; retained raw evidence at " + str(args.out))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
