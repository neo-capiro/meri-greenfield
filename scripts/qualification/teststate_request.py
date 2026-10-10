"""Validate the exact accepted read-only TestState request immediately before dispatch."""
import hashlib
import json
from pathlib import Path
import time
from readonly_shapes import CASES as SHAPE_CASES, validate_shape_request

ROLE = "arn:aws:iam::967807252336:role/MeriGreenfield-TestStateReadOnly-20261010"
GRAPH_SHA256 = "2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3"
RESOURCES = {
    "DispatchIdentity": "arn:aws:states:::aws-sdk:sts:getCallerIdentity",
    "ListFirst": "arn:aws:states:::aws-sdk:ecs:listTasks",
}
RUN_UUID = "87890e41-3f88-4b4d-b1d3-aaa9b85aaa9b"
CASES = {
    "identity": ("DispatchIdentity", "D", 720000),
    "list-started-by": ("ListFirst", "C", 900000),
    "list-running": ("ListFirst", "C", 900000),
    "list-stopped": ("ListFirst", "C", 900000),
}


def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def parse(data):
    return json.loads(data, object_pairs_hook=strict_object)


def validate_readonly_request(arguments):
    if len(arguments) != 4 or arguments[:3] != ["stepfunctions", "test-state", "--cli-input-json"]:
        raise ValueError("TestState requires one reviewed request file")
    if not arguments[3].startswith("file://"):
        raise ValueError("request must use a local file")
    path = Path(arguments[3][7:]).resolve()
    if not path.name.endswith("-request.json"):
        raise ValueError("request filename must identify a prepared case")
    raw = path.read_bytes()
    if len(raw) > 1048576:
        raise ValueError("request exceeds bound")
    plan_path = path.with_name(path.name.replace("-request.json", "-plan.json"))
    plan_raw = plan_path.read_bytes()
    if len(plan_raw) > 2097152:
        raise ValueError("plan exceeds bound")
    request, plan = parse(raw), parse(plan_raw)
    if path.name.removesuffix("-request.json") in SHAPE_CASES:
        return validate_shape_request(path, raw, request, plan)
    case = plan.get("case")
    if case not in CASES or path.name != f"{case}-request.json":
        raise ValueError("unknown or mismatched prepared case")
    if (hashlib.sha256(raw).hexdigest() != plan["requestSha256"]
            or raw.decode("utf-8") != plan["requestBytes"] or request != plan["request"]):
        raise ValueError("request/plan raw binding mismatch")
    if set(request) != {"definition", "stateName", "roleArn", "input", "variables", "inspectionLevel", "revealSecrets"}:
        raise ValueError("unexpected TestState request fields")
    if request["roleArn"] != ROLE or request["inspectionLevel"] != "DEBUG" or request["revealSecrets"] is not False:
        raise ValueError("role or inspection authority mismatch")
    graph_bytes = request["definition"].encode("utf-8")
    if hashlib.sha256(graph_bytes).hexdigest() != GRAPH_SHA256:
        raise ValueError("graph differs from the accepted immutable graph")
    graph = parse(graph_bytes)
    state_name = request["stateName"]
    if state_name not in RESOURCES or graph["States"][state_name]["Resource"] != RESOURCES[state_name]:
        raise ValueError("selected state is not one of the two admitted read-only states")
    deadline = plan["selectedDeadlineMs"]
    now = int(time.time() * 1000)
    t0 = plan["seed"]["originalTimes"]["t0Ms"]
    expected_state, deadline_key, offset = CASES[case]
    if (state_name != expected_state or plan["selectedDeadline"] != deadline_key
            or plan["seed"]["runUuid"] != RUN_UUID or deadline != t0 + offset
            or request["input"] != "{}"):
        raise ValueError("case/input/deadline differs from the closed read-only fixture")
    if (type(deadline) is not int or type(t0) is not int or t0 > now
            or not 1000 <= deadline - now <= 900000):
        raise ValueError("read-only request deadline is expired or invalid")
    variables = parse(request["variables"])
    context = {deadline_key: deadline}
    if case != "identity":
        if type(variables.get("ctx", {}).get("mode")) is not int:
            raise ValueError("list mode must be an integer")
        context["mode"] = {"list-started-by": 0, "list-running": 1, "list-stopped": 2}[case]
        if case == "list-started-by":
            context["run"] = {"uuid": RUN_UUID}
    if variables != {"ctx": context}:
        raise ValueError("variables differ from the closed case-specific fixture")
    return {"requestSha256": plan["requestSha256"], "stateName": state_name,
            "validatedAtMs": now, "deadlineMs": deadline}
