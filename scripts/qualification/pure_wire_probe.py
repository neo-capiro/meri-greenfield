"""Owner-only fixed pure Choice probes. No service Task or workflow execution exists."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
GRAPH = ROOT / '.task-inputs/CODEX-G1-wire-repair-1/sdk-v2-native-graph.json'
GRAPH_SHA = '9a4109b1230e4ff7a14a0f74bea858d94804d7ed459461b2001d5959e4c73ff2'
ROLE = 'arn:aws:iam::967807252336:role/MeriGreenfield-TestStateReadOnly-20261010'
AWS = r'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
TASK = 'arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/' + '0' * 32
CASES = {
    'list-empty': ('ListShape', {'TaskArns': []}, 'RetainPage'),
    'list-mixed': ('ListShape', {'TaskArns': [], 'taskArns': []}, 'DiscoveryError'),
    'task-missing': ('CandidateCoverage', {'Tasks': [], 'Failures': []}, 'CandidateError'),
    'task-single': ('CandidateCoverage', {'Tasks': [{'TaskArn': TASK}], 'Failures': []}, 'RetainCandidate'),
    'task-collision': ('CandidateCoverage', {'Tasks': [{'TaskArn': TASK, 'TaskARN': TASK}], 'Failures': []}, 'CandidateError'),
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def save(path, raw):
    with path.open('xb') as stream:
        stream.write(raw)


def encode(value):
    return (json.dumps(value, indent=2, ensure_ascii=True) + '\n').encode('ascii')


def request_for(case):
    raw = GRAPH.read_bytes()
    if digest(raw) != GRAPH_SHA:
        raise ValueError('reviewed synthetic graph drift')
    original = json.loads(raw)
    state_name, result, expected = CASES[case]
    choice = original['States'][state_name]
    if choice['Type'] != 'Choice' or len(choice['Choices']) != 1:
        raise ValueError('fixed pure Choice shape drift')
    # Retain the exact compiler expression, replace every possible destination
    # with Succeed. The submitted definition contains no Task, Resource, Wait,
    # callback, activity, service action or executable workflow mutation.
    targets = {choice['Default'], choice['Choices'][0]['Next']}
    graph = {'QueryLanguage': 'JSONata', 'StartAt': state_name,
             'States': {state_name: choice, **{name: {'Type': 'Succeed'} for name in sorted(targets)}}}
    if expected not in targets or any(v['Type'] not in ('Choice', 'Succeed') for v in graph['States'].values()):
        raise ValueError('pure graph boundary drift')
    variables = {'raw': result, 'ctx': {'currentArn': TASK, 'tokens': [], 'allArns': []}}
    return {'definition': json.dumps(graph, separators=(',', ':')), 'stateName': state_name,
            'roleArn': ROLE, 'input': '{}', 'variables': json.dumps(variables, separators=(',', ':')),
            'inspectionLevel': 'DEBUG', 'revealSecrets': False}, expected


def execute(output):
    output = Path(output).resolve()
    if output.parent != ROOT / '.task-inputs' or output.name != 'CODEX-G1-wire-owner-pure-1':
        raise ValueError('fixed exclusive owner evidence path required')
    output.mkdir(exist_ok=False)
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith('AWS_') and k.upper() not in {
        'BOTO_CONFIG', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'REQUESTS_CA_BUNDLE',
        'CURL_CA_BUNDLE', 'SSL_CERT_FILE', 'SSL_CERT_DIR'}}
    env.update(AWS_MAX_ATTEMPTS='1', AWS_RETRY_MODE='standard', AWS_PAGER='',
               AWS_IGNORE_CONFIGURED_ENDPOINT_URLS='true',
               AWS_CONFIG_FILE=str(Path.home() / '.aws/config'),
               AWS_SHARED_CREDENTIALS_FILE=str(Path.home() / '.aws/credentials'))
    results = []
    for case in CASES:
        request, expected = request_for(case)
        request_path = output / (case + '-request.json')
        request_bytes = encode(request)
        save(request_path, request_bytes)
        if request_path.read_bytes() != encode(request_for(case)[0]):
            raise ValueError('fixed request changed before dispatch')
        argv = [AWS, 'stepfunctions', 'test-state', '--cli-input-json', 'file://' + str(request_path),
                '--profile', 'capiro-dev', '--region', 'us-east-1', '--output', 'json', '--no-cli-pager',
                '--cli-connect-timeout', '10', '--cli-read-timeout', '30']
        start = dt.datetime.now(dt.timezone.utc)
        try:
            child = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, env=env, timeout=45, shell=False)
            stdout, stderr, code, timed_out = child.stdout, child.stderr, child.returncode, False
        except subprocess.TimeoutExpired as error:
            stdout, stderr, code, timed_out = error.stdout or b'', error.stderr or b'', None, True
        save(output / (case + '.stdout.bin'), stdout)
        save(output / (case + '.stderr.bin'), stderr)
        save(output / (case + '.process.json'), encode({
            'argv': argv, 'startedAt': start.isoformat(), 'endedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'timeoutSeconds': 45, 'exitCode': code, 'timedOut': timed_out, 'automaticRetries': 0,
            'requestSha256': digest(request_bytes), 'stdoutBytes': len(stdout), 'stdoutSha256': digest(stdout),
            'stderrBytes': len(stderr), 'stderrSha256': digest(stderr),
            'scope': 'PURE_CHOICE_ONLY_NO_SERVICE_TASK', 'graphSourceSha256': GRAPH_SHA}))
        if code != 0 or timed_out:
            raise RuntimeError('pure TestState call failed; evidence retained: ' + case)
        actual = json.loads(stdout)
        results.append({'case': case, 'expectedNext': expected, 'actualNext': actual.get('nextState'),
                        'status': actual.get('status'), 'pass': actual.get('status') == 'SUCCEEDED' and actual.get('nextState') == expected})
    summary = {'schema': 'meri-owner-pure-wire/1', 'results': results,
               'allPass': all(row['pass'] for row in results), 'taskLaunches': 0, 'providerCalls': 0}
    save(output / 'summary.json', encode(summary))
    return summary


if __name__ == '__main__':
    print(json.dumps(execute(ROOT / '.task-inputs/CODEX-G1-wire-owner-pure-1'), indent=2))
