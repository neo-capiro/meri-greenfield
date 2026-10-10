"""One-run, owner-only emergency cleanup. Never establishes qualification PASS.

This separate fallback is for the fixed newly registered sleep canary only.
It verifies fresh positive ownership before one StopTask, without changing the
managed workflow's stricter ownership rule or reusing its role.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / '.task-inputs/CODEX-G1-canary-runtime-1'
RUN = '13af432b-3e3a-42fc-a916-223fd6fd2eff'
CLUSTER = 'arn:aws:ecs:us-east-1:967807252336:cluster/meri-greenfield-qualification'
DEFINITION = 'arn:aws:ecs:us-east-1:967807252336:task-definition/meri-greenfield-qualification-canary:1'
TASK_PREFIX = CLUSTER.replace('cluster/', 'task/') + '/'
AWS = r'C:\Program Files\Amazon\AWSCLIV2\aws.exe'


def require(value, message):
    if not value:
        raise ValueError(message)


def encode(value):
    return (json.dumps(value, ensure_ascii=True, indent=2) + '\n').encode('ascii')


def save(path, raw):
    with path.open('xb') as stream:
        stream.write(raw)


def strict_pairs(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, 'duplicate JSON key')
        out[key] = value
    return out


def parse(raw):
    require(len(raw) <= 1024 * 1024, 'evidence body exceeds bound')
    return json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=strict_pairs)


def owned_task(response, arn, t0_ms, now_ms):
    """Fresh CLI readback identity; image/health cannot erase stop ownership."""
    require(type(t0_ms) is int and type(now_ms) is int and t0_ms <= now_ms, 'original owner times')
    require(type(arn) is str and re.fullmatch(re.escape(TASK_PREFIX) + '[a-f0-9]{32}', arn), 'foreign task namespace')
    require(type(response) is dict and set(response) == {'tasks', 'failures'} and response['failures'] == [], 'full singleton task readback')
    tasks = response['tasks']
    require(type(tasks) is list and len(tasks) == 1 and type(tasks[0]) is dict, 'singleton task required')
    task = tasks[0]
    require(task.get('taskArn') == arn and task.get('clusterArn') == CLUSTER
            and task.get('taskDefinitionArn') == DEFINITION and task.get('startedBy') == RUN
            and task.get('group') == 'meri-greenfield-qualification:canary', 'fixed run/definition binding')
    tags = task.get('tags')
    require(type(tags) is list and len(tags) == 3
            and all(type(t) is dict and set(t) == {'key', 'value'} for t in tags), 'exact ownership tags')
    require(sorted((t['key'], t['value']) for t in tags) == sorted([
        ('QualificationRun', RUN), ('QualificationProbe', 'canary'), ('MeriComponent', 'native-enforcement')]), 'current ownership tags mismatch')
    created = task.get('createdAt')
    require(type(created) is str, 'actual CLI ISO timestamp required')
    try:
        stamp = dt.datetime.fromisoformat(created.replace('Z', '+00:00'))
        require(stamp.tzinfo is not None, 'timezone required')
        created_ms = int(stamp.timestamp() * 1000)
    except (ValueError, OverflowError, OSError):
        raise ValueError('invalid creation timestamp') from None
    require(t0_ms - 1000 <= created_ms <= min(now_ms + 1000, t0_ms + 900000), 'creation outside original run window')
    require(task.get('lastStatus') in {'PROVISIONING', 'PENDING', 'ACTIVATING', 'RUNNING', 'DEACTIVATING', 'STOPPING', 'DEPROVISIONING', 'STOPPED'}, 'unknown task state')
    return task


def capture(out, label, args):
    """Only this module's three fixed calls; no general CLI passthrough."""
    dest = out / label
    dest.mkdir(exist_ok=False)
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith('AWS_') and k.upper() not in {
        'BOTO_CONFIG', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'REQUESTS_CA_BUNDLE',
        'CURL_CA_BUNDLE', 'SSL_CERT_FILE', 'SSL_CERT_DIR'}}
    env.update(AWS_MAX_ATTEMPTS='1', AWS_RETRY_MODE='standard', AWS_PAGER='', AWS_IGNORE_CONFIGURED_ENDPOINT_URLS='true',
               AWS_CONFIG_FILE=str(Path.home() / '.aws/config'), AWS_SHARED_CREDENTIALS_FILE=str(Path.home() / '.aws/credentials'))
    argv = [AWS, *args, '--profile', 'capiro-dev', '--region', 'us-east-1', '--output', 'json', '--no-cli-pager', '--cli-connect-timeout', '10', '--cli-read-timeout', '30']
    start = dt.datetime.now(dt.timezone.utc)
    try:
        result = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False, env=env, timeout=45)
        stdout, stderr, code, timed_out = result.stdout, result.stderr, result.returncode, False
    except subprocess.TimeoutExpired as error:
        stdout, stderr, code, timed_out = error.stdout or b'', error.stderr or b'', None, True
    for name, raw in [('stdout.bin', stdout), ('stderr.bin', stderr)]:
        save(dest / name, raw)
    save(dest / 'process.json', encode({'argv': argv, 'startedAt': start.isoformat(), 'endedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'exitCode': code, 'timedOut': timed_out, 'timeoutSeconds': 45, 'automaticRetries': 0,
        'stdoutSha256': hashlib.sha256(stdout).hexdigest(), 'stderrSha256': hashlib.sha256(stderr).hexdigest()}))
    require(code == 0 and not timed_out, 'cleanup operation uncertain; reconcile read-only without mutation retry')
    return parse(stdout)


def execute(arn):
    require(EVIDENCE.is_dir(), 'original runtime evidence required')
    reservation = parse((EVIDENCE / 'execution-reserved.json').read_bytes())
    require(reservation.get('runUuid') == RUN and reservation.get('staticBindingId') == '03735688327d41c6bad35e86ef4f8f1cc93d3cbfd3eb8844433fab5be2bdd8f0', 'original reservation binding')
    require(type(arn) is str and re.fullmatch(re.escape(TASK_PREFIX) + '[a-f0-9]{32}', arn), 'foreign namespace')
    out = EVIDENCE / ('fallback-' + arn.rsplit('/', 1)[1])
    out.mkdir(exist_ok=False)  # One permanently consumed fallback attempt per identity.
    save(out / 'cleanup-reserved.json', encode({'runUuid': RUN, 'taskArn': arn, 'status': 'CONSUMED_NOT_QUALIFICATION_PASS'}))
    caller = capture(out, 'caller', ['sts', 'get-caller-identity'])
    require(caller == {'UserId': 'AIDA6CVOOW5YCNOGMSALQ', 'Account': '967807252336', 'Arn': 'arn:aws:iam::967807252336:user/capirocli'}, 'owner identity changed')
    observed = capture(out, 'task-before', ['ecs', 'describe-tasks', '--cluster', CLUSTER, '--tasks', arn, '--include', 'TAGS'])
    task = owned_task(observed, arn, reservation.get('t0Ms'), int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000))
    if task['lastStatus'] == 'STOPPED':
        result = {'status': 'ALREADY_STOPPED_NO_MUTATION', 'qualification': 'FAILED_OR_UNKNOWN', 'taskArn': arn}
    else:
        save(out / 'stop-attempted.json', encode({'taskArn': arn, 'currentOwnershipVerified': True, 'qualification': 'FAILED_OR_UNKNOWN'}))
        capture(out, 'stop-task', ['ecs', 'stop-task', '--cluster', CLUSTER, '--task', arn, '--reason', 'Codex exact-owned canary failure cleanup; never qualification PASS'])
        result = {'status': 'STOP_REQUESTED_NOT_TERMINAL_CONFIRMED', 'qualification': 'FAILED_OR_UNKNOWN', 'taskArn': arn}
    save(out / 'outcome.json', encode(result))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', required=True)
    parser.add_argument('--task-arn', required=True)
    args = parser.parse_args()
    print(encode(execute(args.task_arn)).decode('ascii'), end='')
