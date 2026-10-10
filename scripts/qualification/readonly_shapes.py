"""Closed, metadata-only AWS SDK shape probes for the independent qualification VPC."""
import hashlib
import json
from pathlib import Path
import time

ROLE = "arn:aws:iam::967807252336:role/MeriGreenfield-TestStateReadOnly-20261010"
CLUSTER = "arn:aws:ecs:us-east-1:967807252336:cluster/meri-greenfield-qualification"
CASES = {
    "ecs-describe-synthetic": ("ecs:describeTasks", {
        "Cluster": CLUSTER, "Tasks": [CLUSTER.replace("cluster/", "task/") + "/" + "0" * 32],
        "Include": ["TAGS"],
    }),
    "ec2-describe-qualification": ("ec2:describeNetworkInterfaces", {
        "Filters": [{"Name": "vpc-id", "Values": ["vpc-06e1941747e798f0a"]},
                    {"Name": "owner-id", "Values": ["967807252336"]}],
        "MaxResults": 5,
    }),
}


def request_for(case):
    resource, arguments = CASES[case]
    graph = {"QueryLanguage": "JSONata", "StartAt": "Probe", "TimeoutSeconds": 20,
             "States": {"Probe": {"Type": "Task", "Resource": "arn:aws:states:::aws-sdk:" + resource,
                                  "Arguments": arguments, "TimeoutSeconds": 10, "End": True}}}
    return {"definition": json.dumps(graph, separators=(",", ":")), "stateName": "Probe",
            "roleArn": ROLE, "input": "{}", "variables": "{}",
            "inspectionLevel": "DEBUG", "revealSecrets": False}


def validate_shape_request(path, raw, request, plan):
    case = path.name.removesuffix("-request.json")
    if case not in CASES or path.name != case + "-request.json":
        raise ValueError("unknown shape case")
    if set(plan) != {"schema", "case", "t0Ms", "deadlineMs", "requestSha256"}:
        raise ValueError("unexpected shape plan")
    now = int(time.time() * 1000)
    t0, deadline = plan["t0Ms"], plan["deadlineMs"]
    if (plan["schema"] != "meri-readonly-shape-plan/1" or plan["case"] != case
            or type(t0) is not int or type(deadline) is not int
            or t0 > now or deadline != t0 + 120000 or not 1000 <= deadline - now <= 120000
            or plan["requestSha256"] != hashlib.sha256(raw).hexdigest()
            or request != request_for(case)):
        raise ValueError("shape request differs from the closed metadata-only case")
    # JSON equality alone must not admit bool/number substitutions.
    if json.dumps(request, sort_keys=True) != json.dumps(request_for(case), sort_keys=True):
        raise ValueError("shape request types differ")
    return {"requestSha256": plan["requestSha256"], "stateName": "Probe", "case": case,
            "validatedAtMs": now, "deadlineMs": deadline, "scope": "NEW_QUALIFICATION_METADATA_ONLY"}


def prepare(output):
    output = Path(output).resolve()
    output.mkdir(exist_ok=False)
    t0 = int(time.time() * 1000)
    for case in CASES:
        raw = (json.dumps(request_for(case), indent=2) + "\n").encode("utf-8")
        plan = {"schema": "meri-readonly-shape-plan/1", "case": case,
                "t0Ms": t0, "deadlineMs": t0 + 120000, "requestSha256": hashlib.sha256(raw).hexdigest()}
        for suffix, data in (("request", raw), ("plan", (json.dumps(plan, indent=2) + "\n").encode("utf-8"))):
            with (output / f"{case}-{suffix}.json").open("xb") as stream:
                stream.write(data)
    return {"status": "PREPARED_LOCAL_ONLY", "directory": str(output), "deadlineMs": t0 + 120000}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output")
    print(json.dumps(prepare(parser.parse_args().output)))
