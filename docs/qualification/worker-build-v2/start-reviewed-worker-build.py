"""Owner-invoked D006 worker build transaction. Default prepare is LOCAL ONLY.

Prepare after fixed worker/inventory sources are independently accepted and committed:
  python .task-inputs/start-reviewed-worker-build.py --source-commit <40SHA>
Execute once only after independent review:
  ... --execute --source-commit <40SHA> --evidence <prepared-directory>
      --review-file <approval.json> --review-sha256 <approval-file-64SHA256>

Review schema: decision APPROVE_ONE_WORKER_BUILD, reviewRequestSha256,
sourceCommit, archiveSha256, buildspecSha256, helperSha256, reviewer, notes.
The reviewer hashes the exact review-request.json and this helper. No polling, mutation retry, deployment or model call is implemented. The subprocess
stdout cap is checked after capture; it is an acceptance cap, not a streaming
memory bound. Native Docker
exists only in the reviewed remote buildspec, never in this helper. Preparation
requires a future clean independently accepted commit; the override is ignored
owner tooling and is hash-bound separately from the source archive.
"""
from pathlib import Path
import argparse, ast, base64, datetime as dt, hashlib, io, json, os, re, stat, subprocess, sys, time, uuid, zipfile

ROOT = Path(r'C:\dev\main\meri-greenfield-kickoff-20261009')
EVIDENCE_ROOT = ROOT / 'docs/coordination/private-evidence'
AWS = r'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
ACCOUNT, REGION, PROFILE = '967807252336', 'us-east-1', 'capiro-dev'
PRINCIPAL = 'arn:aws:iam::967807252336:user/capirocli'
PROJECT = 'meri-greenfield-qualification-build'
BUCKET = 'meri-greenfield-qual-build-967807252336-us-east-1'
KMS = 'arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042'
REPOSITORY = 'meri-greenfield/qualification-worker'
REPOSITORY_URI = ACCOUNT + '.dkr.ecr.' + REGION + '.amazonaws.com/' + REPOSITORY
ACCEPTED_D006 = '6d20bb4a2fbe5c9431fa0c8131639d290f5febc8'
DOCKERFILE = 'apps/worker/qualification/Dockerfile'
BUILDSPEC = '.task-inputs/worker-buildspec.json'
CONTEXT = 'apps/worker/qualification'
INVENTORY_SOURCE = CONTEXT + '/probes/image-inventory.py'
INVENTORY_OUTPUT = '/opt/meri-worker/image-inventory.json'
DISPATCH_DEADLINE_SECONDS = 1200
INLINE_BUILDSPEC_MAX_BYTES = 25600
REJECTED_INVENTORY_SHA256 = '01b673c02faf67ce8de2a3b3dd3a6739956e4f527207abd0a5621cf12e245d02'
BUILDER_INFRA = 'infra/qualification/app.mjs'
BUILDER_INFRA_SHA256 = 'a866b68fda76cf3bf09636909d62d7dbee646ed396a7879052be63ee60a0442f'
# Previously approved live configuration, not the current app's worker buildspec.
# Its legacy configured buildspec MUST NEVER execute in this reviewed worker override build.
PROJECT_EVIDENCE = ROOT / 'docs/coordination/private-evidence/qualification-build-context/project.json'
PROJECT_EVIDENCE_SHA256 = '4a4279a20d8a9b4c3dff4088c560b2f1e340ce0fdbac66966e719d684b7788e6'
CONFIGURED_WORKER_BUILDSPEC_SHA256 = 'f2b85ee04a9bf77c71d1c5032e0b6152f1ac0fbb1bc161f08ce64c146ef97433'
BUILDER_ROLE = 'arn:aws:iam::967807252336:role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H'
TARGET = dict(account=ACCOUNT, region=REGION, profile=PROFILE, principal=PRINCIPAL,
              project=PROJECT, bucket=BUCKET, kmsKeyArn=KMS,
              repository=REPOSITORY, repositoryUri=REPOSITORY_URI)
DENIED_PARTS = {'.git', '.task-inputs', '.runtime', 'private-evidence', 'node_modules'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=True, sort_keys=True) + '\n').encode()

def checked_inline_buildspec(raw):
    require(isinstance(raw, bytes) and 0 < len(raw) <= INLINE_BUILDSPEC_MAX_BYTES,
            'Inline buildspec must contain 1..25600 bytes before preparation/dispatch')
    try:
        text = raw.decode('ascii')
    except UnicodeDecodeError as error:
        raise ValueError('Inline buildspec must be ASCII; character and byte limits must agree') from error
    require(len(text) <= INLINE_BUILDSPEC_MAX_BYTES, 'Inline buildspec exceeds 25600 characters')
    value = json.loads(text)
    canonical = (json.dumps(value, ensure_ascii=True, separators=(',', ':')) + '\n').encode('ascii')
    require(raw == canonical, 'Inline buildspec must use canonical compact ASCII JSON with final LF')
    return text


def ordered_records(records, key, fields):
    require(isinstance(records, list) and all(isinstance(r, dict) and set(r) == fields for r in records), 'Unexpected configuration record fields')
    require(all(isinstance(r[key], str) for r in records) and len({r[key] for r in records}) == len(records), 'Duplicate/invalid configuration names')
    return sorted(records, key=lambda r: r[key])

def project_configuration(project):
    require(isinstance(project, dict), 'Builder project must be an object')
    configuration = json.loads(json.dumps(project))
    for key in ('created', 'lastModified'):
        configuration.pop(key, None)  # Observational timestamps are not authority.
    environment = configuration.get('environment')
    require(isinstance(environment, dict), 'Missing builder environment')
    variables = ordered_records(environment.get('environmentVariables'), 'name', {'name', 'value', 'type'})
    require(all(v['type'] == 'PLAINTEXT' and isinstance(v['value'], str) for v in variables), 'Secret/parameter/nonstring builder environment forbidden')
    environment['environmentVariables'] = variables
    configuration['tags'] = ordered_records(configuration.get('tags'), 'key', {'key', 'value'})
    return configuration

def reviewed_builder():
    raw = PROJECT_EVIDENCE.read_bytes()
    require(sha(raw) == PROJECT_EVIDENCE_SHA256, 'Reviewed builder evidence bytes changed')
    evidence = json.loads(raw)
    require(evidence.get('projectsNotFound') == [] and len(evidence.get('projects', [])) == 1, 'Reviewed builder evidence incomplete')
    project = project_configuration(evidence['projects'][0])
    require(project['arn'] == 'arn:aws:codebuild:' + REGION + ':' + ACCOUNT + ':project/' + PROJECT
            and project['serviceRole'] == BUILDER_ROLE and project['encryptionKey'] == KMS,
            'Reviewed builder resource identity mismatch')
    require(sha(project['source']['buildspec'].encode()) == CONFIGURED_WORKER_BUILDSPEC_SHA256, 'Reviewed legacy worker buildspec changed')
    return project

def validate_builder(project, expected):
    require(project_configuration(project) == expected, 'Builder full reviewed configuration drift; no build dispatch allowed')

def save(path, value, exclusive=False):
    with path.open('xb' if exclusive else 'wb') as handle:
        handle.write(json_bytes(value))

def git(*args, binary=False):
    data = subprocess.check_output(['git', '-C', str(ROOT), *args], timeout=90)
    return data if binary else data.decode('utf-8').strip()

def validate_commit(commit):
    require(isinstance(commit, str) and re.fullmatch(r'[a-f0-9]{40}', commit), 'Exact lowercase 40-character source commit required')

def clean_head(commit):
    validate_commit(commit)
    require(git('rev-parse', 'HEAD') == commit, 'Source commit must equal current HEAD')
    require(not git('status', '--porcelain'), 'Root worktree must be clean, including untracked files')
    require(subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor', ACCEPTED_D006, commit], timeout=30).returncode == 0,
            'Source must descend from the accepted D006 integration decision')

def source_record(commit, path):
    mode = git('ls-tree', commit, '--', path).split()
    require(len(mode) >= 3 and mode[0] in ('100644', '100755') and mode[1] == 'blob', 'Missing/unaccepted/nonregular committed file: ' + path)
    data = git('show', commit + ':' + path, binary=True)
    require(0 < len(data) <= 1024 * 1024, 'Source file is empty or exceeds bounded packaging size: ' + path)
    return dict(path=path, bytes=len(data), sha256=sha(data))

def inventory_contract():
    browser = '/opt/meri-browsers/chromium-1247/chrome-linux64/'
    helper = dict(sha256='be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314', mode='4755', uid=0, gid=0)
    return dict(schema='meri.qualification.image-inventory/1', outputPath=INVENTORY_OUTPUT,
        roots=['/opt/meri-worker', '/opt/meri-venv', '/opt/meri-browsers', '/usr', '/etc', '/var/lib/dpkg',
               '/bin', '/sbin', '/lib', '/lib64', '/root', '/home'],
        aliases={'/bin': '/usr/bin', '/sbin': '/usr/sbin', '/lib': '/usr/lib', '/lib64': '/usr/lib64'},
        exclusions=['/proc', '/sys', '/dev', '/run', INVENTORY_OUTPUT],
        pins={'/opt/meri-worker/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude':
                  dict(sha256='4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358'),
              browser+'chrome': dict(sha256='adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0'),
              browser+'chrome_sandbox': dict(helper), browser+'chrome-sandbox': dict(helper)},
        maxBytes=33554432, maxEntries=300000,
        imageConfig=dict(User='10001:10001', WorkingDir='/workspace/conversation',
                         Entrypoint=['node', '/opt/meri-worker/probes/runtime.mjs'],
                         Volumes={'/workspace': {}, '/tmp': {}},
                         requiredEnv={'HOME':'/workspace/home','TMPDIR':'/tmp','CLAUDE_CONFIG_DIR':'/workspace/config',
                             'PLAYWRIGHT_BROWSERS_PATH':'/opt/meri-browsers','NODE_ENV':'production',
                             'MERI_QUALIFICATION_ONLY':'true','MERI_SOURCES_ENABLED':'false','CHROMIUM_SANDBOX_REQUIRED':'true'}))


def literal_constants(source):
    # Parse data only; never import/execute the accepted inventory program.
    values = {}
    def read(node):
        if isinstance(node, ast.Constant): return node.value
        if isinstance(node, (ast.Tuple, ast.List)): return [read(n) for n in node.elts]
        if isinstance(node, ast.Dict): return {read(k): read(v) for k,v in zip(node.keys,node.values)}
        if isinstance(node, ast.Name) and node.id in values: return values[node.id]
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            left,right=read(node.left),read(node.right)
            require(isinstance(left,str) and isinstance(right,str), 'Only literal string joins accepted')
            return left+right
        raise ValueError('Unsupported inventory constant expression')
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name):
            try: values[node.targets[0].id]=read(node.value)
            except ValueError: pass
    return values


def expected_content(commit):
    contract = inventory_contract()
    paths = git('ls-tree','-r','--name-only',commit,'--',CONTEXT).splitlines()
    require(0 < len(paths) <= 5000 and len(paths)==len(set(paths)), 'Worker context file set missing/oversized')
    require(DOCKERFILE in paths and INVENTORY_SOURCE in paths, 'Required worker recipe/inventory source absent')
    require(all(p.startswith(CONTEXT+'/') and re.fullmatch(r'[A-Za-z0-9._/-]+',p) and '..' not in p.split('/') and '' not in p.split('/') and not DENIED_PARTS.intersection(p.split('/')) for p in paths), 'Unsafe worker context path')
    files = [source_record(commit,p) for p in sorted(paths)]
    require(next(f for f in files if f['path']==INVENTORY_SOURCE)['sha256'] != REJECTED_INVENTORY_SHA256, 'Known rejected c769 inventory is not eligible; fixed independently reviewed source required')
    require(sum(f['bytes'] for f in files)<=64*1024*1024, 'Worker context exceeds bounded 64MiB source size')
    authority = source_record(commit,BUILDER_INFRA)
    require(authority['sha256']==BUILDER_INFRA_SHA256, 'Builder infrastructure authority changed; owner review required')
    constants = literal_constants(git('show',commit+':'+INVENTORY_SOURCE))
    for name,wanted in [('SCHEMA',contract['schema']),('OUTPUT_PATH',contract['outputPath']),
                        ('REQUIRED_ROOTS',contract['roots']),('ROOT_ALIASES',contract['aliases']),('PINNED_FILES',contract['pins'])]:
        require(constants.get(name)==wanted, 'Inventory compiled contract changed: '+name)
    raw = (ROOT/BUILDSPEC).read_bytes()
    require(0<len(raw)<=128*1024, 'Reviewed override missing/oversized')
    spec=json.loads(checked_inline_buildspec(raw))
    require(set(spec)=={'version','env','phases'} and spec['version']=='0.2' and spec['env']=={'shell':'bash'}
            and set(spec['phases'])=={'build'} and set(spec['phases']['build'])=={'commands'}
            and len(spec['phases']['build']['commands'])==1 and isinstance(spec['phases']['build']['commands'][0],str), 'Unexpected worker override shape')
    return dict(sourceCommit=commit,sourceFiles=files,builderAuthority=authority,inventoryContract=contract,
                inventorySource=next(f for f in files if f['path']==INVENTORY_SOURCE),
                buildspec=dict(path=BUILDSPEC,bytes=len(raw),sha256=sha(raw),placement='OWNER_OVERRIDE_NOT_IN_ARCHIVE'))


def archive_bytes(commit, content):
    data=git('archive','--format=zip',commit,binary=True)
    require(0<len(data)<=64*1024*1024, 'Archive exceeds 64MiB preparation bound')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names=archive.namelist()
        require(len(names)<=20000 and len(names)==len(set(names)) and sum(i.file_size for i in archive.infolist())<=128*1024*1024, 'Archive entries/expanded bytes excessive or duplicate')
        for item in archive.infolist():
            parts=item.filename.rstrip('/').split('/')
            mode=item.external_attr>>16
            require(not item.filename.startswith('/') and '\\' not in item.filename and '..' not in parts
                    and not DENIED_PARTS.intersection(parts) and stat.S_IFMT(mode) in (0,stat.S_IFREG,stat.S_IFDIR)
                    and item.file_size<=8*1024*1024, 'Unsafe/private/nonregular/oversized archive entry')
        records=content['sourceFiles']+[content['builderAuthority']]
        expected_paths={r['path'] for r in content['sourceFiles']}
        require({n for n in names if n.startswith(CONTEXT+'/') and not n.endswith('/')}==expected_paths,
                'Archive worker context file set differs from accepted Git tree')
        for record in records:
            require(record['path'] in names, 'Archive missing accepted source')
            payload=archive.read(record['path'])
            require(len(payload)==record['bytes'] and sha(payload)==record['sha256'], 'Archive/Git source byte mismatch: '+record['path'])
    return data,len(names)


def request_for(commit, content, archive, count, token, created):
    digest = sha(archive)
    key = 'inputs/worker-' + commit + '/' + digest + '.zip'
    return dict(schema='meri-worker-build-review/1', createdAt=created, idempotencyToken=token,
                target=TARGET, sourceCommit=commit, imageTag='worker-' + commit + '-' + token,
                resultKey='results/worker-' + commit + '-' + token + '/manifest.json',
                archive=dict(name='worker-source.zip', sha256=digest, bytes=len(archive), entries=count, key=key),
                content=content, helperSha256=sha(Path(__file__).read_bytes()),
                builderProjectConfiguration=reviewed_builder(),
                builderProjectEvidenceSha256=PROJECT_EVIDENCE_SHA256,
                configuredWorkerBuildspecSha256=CONFIGURED_WORKER_BUILDSPEC_SHA256,
                configuredWorkerBuildspecExecution='FORBIDDEN; mandatory exact reviewed worker buildspec override only',
                buildspecOverrideSha256=content['buildspec']['sha256'],
                startBuild=dict(projectName=PROJECT, sourceTypeOverride='S3', sourceLocationOverride=BUCKET + '/' + key,
                                timeoutInMinutesOverride=15, queuedTimeoutInMinutesOverride=5),
                admission='ONE worker image build/inert inventory copy only; no runtime/deployment/security/G1 acceptance')

def check_review(request, request_digest, review):
    fields = {'decision', 'reviewRequestSha256', 'sourceCommit', 'archiveSha256', 'buildspecSha256', 'helperSha256', 'reviewer', 'notes'}
    require(isinstance(review, dict) and set(review) == fields, 'Review must use the exact documented approval schema')
    require(review['decision'] == 'APPROVE_ONE_WORKER_BUILD', 'Explicit independent worker-build review required')
    for key, expected in dict(reviewRequestSha256=request_digest, sourceCommit=request['sourceCommit'],
                              archiveSha256=request['archive']['sha256'], buildspecSha256=request['buildspecOverrideSha256'],
                              helperSha256=request['helperSha256']).items():
        require(review[key] == expected, 'Review binding mismatch: ' + key)
    require(all(isinstance(review[key], str) and 0 < len(review[key]) <= 4000 for key in ('reviewer', 'notes')), 'Review attribution/notes required')

def build_input_for(request, version, buildspec):
    require(isinstance(buildspec, str), 'Inline buildspec dispatch input must be text')
    checked_inline_buildspec(buildspec.encode('utf-8'))
    variables = dict(IMAGE_TAG=request['imageTag'], SOURCE_COMMIT=request['sourceCommit'], SOURCE_S3_VERSION=version,
                     SOURCE_ARCHIVE_SHA256=request['archive']['sha256'], BUILD_RUN_UUID=request['idempotencyToken'],
                     WORKER_BUILDSPEC_SHA256=request['buildspecOverrideSha256'], RESULT_KEY=request['resultKey'],
                     WORKER_EXPECTED_B64=base64.b64encode(json_bytes(request['content'])).decode())
    return dict(request['startBuild'], sourceVersion=version, buildspecOverride=buildspec,
                environmentVariablesOverride=[dict(name=k, value=v, type='PLAINTEXT') for k, v in variables.items()],
                idempotencyToken=request['idempotencyToken'])

def validate_dispatched_build(build, request, start):
    project = request['builderProjectConfiguration']
    prefix = 'arn:aws:codebuild:' + REGION + ':' + ACCOUNT + ':build/' + PROJECT + ':'
    require(isinstance(build.get('arn'), str) and build['arn'].startswith(prefix), 'Returned build ARN prefix mismatch')
    build_uuid = build['arn'][len(prefix):]
    require(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', build_uuid)
            and build.get('id') == PROJECT + ':' + build_uuid and build.get('projectName') == PROJECT,
            'Returned build identity mismatch')
    require(build.get('sourceVersion') == start['sourceVersion']
            and build.get('timeoutInMinutes') == 15 and build.get('queuedTimeoutInMinutes') == 5,
            'Returned build source version/deadline mismatch')
    source = dict(project['source'], location=start['sourceLocationOverride'], buildspec=start['buildspecOverride'])
    environment = json.loads(json.dumps(project['environment']))
    variables = {v['name']: v for v in environment['environmentVariables']}
    variables.update({v['name']: v for v in start['environmentVariablesOverride']})
    environment['environmentVariables'] = ordered_records(list(variables.values()), 'name', {'name', 'value', 'type'})
    actual_environment = json.loads(json.dumps(build.get('environment', {})))
    actual_environment['environmentVariables'] = ordered_records(actual_environment.get('environmentVariables'), 'name', {'name', 'value', 'type'})
    require(build.get('source') == source and actual_environment == environment
            and build.get('serviceRole') == project['serviceRole'] and build.get('encryptionKey') == KMS
            and build.get('cache') == project['cache'], 'Returned build authority/environment/source/override drift')
    require(build.get('artifacts') == {'location': ''} and build.get('logs', {}).get('cloudWatchLogs') == project['logsConfig']['cloudWatchLogs'],
            'Returned build artifact/log configuration drift')
    require(build.get('vpcConfig') in (None, {}) and not build.get('secondarySources') and not build.get('secondarySourceVersions')
            and not build.get('secondaryArtifacts') and not build.get('fileSystemLocations') and not build.get('buildBatchArn')
            and not build.get('logs', {}).get('s3Logs'), 'Returned build network/secondary-source/artifact/batch override forbidden')

def prepare(commit):
    clean_head(commit)
    content = expected_content(commit)  # Fail before evidence creation until accepted sources exist.
    archive, count = archive_bytes(commit, content)
    token, created = str(uuid.uuid4()), dt.datetime.now(dt.timezone.utc).isoformat()
    request = request_for(commit, content, archive, count, token, created)
    evidence = EVIDENCE_ROOT / ('W02-worker-build-' + commit[:7] + '-' + token)
    evidence.mkdir(parents=False, exist_ok=False)
    (evidence / request['archive']['name']).write_bytes(archive)
    save(evidence / 'review-request.json', request, exclusive=True)
    save(evidence / 'manifest.json', dict(status='PREPARED_LOCAL_ONLY', reviewRequestSha256=sha(json_bytes(request)), request=request), exclusive=True)
    return dict(evidence=str(evidence), reviewRequestSha256=sha(json_bytes(request)), status='PREPARED_LOCAL_ONLY', awsCalls=0)

def execute(commit, evidence_path, review_path, review_digest):
    clean_head(commit)
    require(re.fullmatch(r'[a-f0-9]{64}', review_digest or ''), 'Exact review-file SHA256 required')
    evidence = Path(evidence_path).resolve(strict=True)
    require(evidence.parent == EVIDENCE_ROOT.resolve(strict=True) and evidence.name.startswith('W02-worker-build-' + commit[:7] + '-'), 'Evidence must be a new prepared worker directory under the fixed root')
    require(not evidence.is_symlink(), 'Evidence symlinks forbidden')
    request_raw = (evidence / 'review-request.json').read_bytes()
    request = json.loads(request_raw)
    require(request.get('schema') == 'meri-worker-build-review/1', 'Unknown preparation schema')
    token = request.get('idempotencyToken')
    require(str(uuid.UUID(token, version=4)) == token, 'Prepared UUID idempotency token invalid')
    require(evidence.name == 'W02-worker-build-' + commit[:7] + '-' + token, 'Evidence/token mismatch')
    content = expected_content(commit)
    archive, count = archive_bytes(commit, content)
    recomputed = request_for(commit, content, archive, count, token, request['createdAt'])
    require(request == recomputed and request_raw == json_bytes(request), 'Prepared request no longer matches exact HEAD/helper/archive/targets')
    archive_path = evidence / request['archive']['name']
    require(archive_path.is_file() and not archive_path.is_symlink() and archive_path.read_bytes() == archive, 'Prepared archive bytes changed')
    review_raw = Path(review_path).read_bytes()
    require(sha(review_raw) == review_digest, 'Review-file hash mismatch')
    check_review(request, sha(request_raw), json.loads(review_raw))
    # One-shot admission precedes any external action. Never reuse or remove it.
    save(evidence / 'execution-reserved.json', dict(idempotencyToken=token, reviewFileSha256=review_digest,
         reservedAt=dt.datetime.now(dt.timezone.utc).isoformat()), exclusive=True)
    deadline = time.monotonic() + DISPATCH_DEADLINE_SECONDS
    state = dict(status='EXECUTION_RESERVED', request=request, reviewFileSha256=review_digest, externalMutationAttempted=False)
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1', AWS_MAX_ATTEMPTS='1',
               AWS_RETRY_MODE='standard', AWS_PAGER='', AWS_CLI_AUTO_PROMPT='off')

    def record():
        save(evidence / 'manifest.json', state)

    def aws(name, *args, mutation=False):
        if mutation:
            state.update(status=name.upper() + '_ATTEMPTED', externalMutationAttempted=True)
            record()  # Persist uncertainty/idempotency BEFORE subprocess dispatch.
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'Dispatch transaction absolute deadline exhausted; no automatic retry')
        command = [AWS, *args, '--profile', PROFILE, '--region', REGION, '--output', 'json', '--no-cli-pager', '--no-cli-auto-prompt']
        save(evidence / (name + '-request.json'), {'args': command}, exclusive=True)
        res = subprocess.run(command, env=env, capture_output=True, text=True, encoding='utf-8', timeout=min(90, remaining))
        # subprocess.run already captured stdout/stderr. This is a readback
        # acceptance limit, not a preallocation or streaming memory bound.
        require(len(res.stdout.encode('utf-8')) <= 4 * 1024 * 1024, 'AWS readback exceeds bounded output size')
        if res.returncode != 0:
            save(evidence / (name + '-error.json'), dict(returnCode=res.returncode, stderr=res.stderr[:4000], stdoutSha256=sha(res.stdout.encode('utf-8'))), exclusive=True)
        require(res.returncode == 0, name + ' failed; inspect exact operation externally before any further mutation')
        data = json.loads(res.stdout)
        save(evidence / (name + '.json'), data, exclusive=True)
        return data

    def identity(name):
        who = aws(name, 'sts', 'get-caller-identity')
        require(who.get('Account') == ACCOUNT and who.get('Arn') == PRINCIPAL, 'Fresh STS principal mismatch')
        return who

    record()
    try:
        identity('preflight-identity')
        repo = aws('repository', 'ecr', 'describe-repositories', '--repository-names', REPOSITORY)['repositories']
        require(len(repo) == 1 and repo[0]['repositoryArn'] == 'arn:aws:ecr:' + REGION + ':' + ACCOUNT + ':repository/' + REPOSITORY
                and repo[0]['repositoryUri'] == REPOSITORY_URI and repo[0]['imageTagMutability'] == 'IMMUTABLE'
                and repo[0].get('encryptionConfiguration') == {'encryptionType': 'KMS', 'kmsKey': KMS}, 'New repository identity/immutability/KMS mismatch')
        projects = aws('project', 'codebuild', 'batch-get-projects', '--names', PROJECT)
        require(projects.get('projectsNotFound') == [] and len(projects.get('projects', [])) == 1, 'Builder project missing/ambiguous')
        validate_builder(projects['projects'][0], request['builderProjectConfiguration'])
        ids = aws('existing-builds', 'codebuild', 'list-builds-for-project', '--project-name', PROJECT, '--sort-order', 'DESCENDING')['ids']
        require(len(ids) <= 100, 'More than 100 existing builds; owner must review activity separately')
        if ids:
            readback = aws('existing-build-status', 'codebuild', 'batch-get-builds', '--ids', *ids)
            builds = readback['builds']
            require(readback.get('buildsNotFound',[])==[] and len(ids)==len(set(ids)) and len(builds)==len(ids)
                    and {b.get('id') for b in builds}==set(ids)
                    and all(b.get('buildStatus') in ('SUCCEEDED','FAILED','FAULT','STOPPED','TIMED_OUT') for b in builds),
                    'Existing builder activity/unknown/mismatched status')
        checksum = base64.b64encode(hashlib.sha256(archive).digest()).decode()
        identity('upload-identity')  # Fresh identity immediately before S3 mutation.
        upload = aws('upload', 's3api', 'put-object', '--bucket', BUCKET, '--key', request['archive']['key'], '--body', str(archive_path),
                     '--if-none-match', '*', '--server-side-encryption', 'aws:kms', '--ssekms-key-id', KMS,
                     '--checksum-algorithm', 'SHA256', '--checksum-sha256', checksum,
                     '--metadata', json.dumps(dict(sourcecommit=commit, archivesha256=sha(archive))), mutation=True)
        version = upload.get('VersionId')
        require(isinstance(version, str) and version not in ('', 'null') and upload.get('ChecksumSHA256') == checksum
                and upload.get('ServerSideEncryption') == 'aws:kms' and upload.get('SSEKMSKeyId') == KMS, 'Uploaded source version/checksum/KMS unconfirmed')
        head = aws('head-object', 's3api', 'head-object', '--bucket', BUCKET, '--key', request['archive']['key'], '--version-id', version, '--checksum-mode', 'ENABLED')
        require(head.get('VersionId') == version and head.get('ChecksumSHA256') == checksum and head.get('ContentLength') == len(archive)
                and head.get('ServerSideEncryption') == 'aws:kms' and head.get('SSEKMSKeyId') == KMS
                and head.get('Metadata') == dict(sourcecommit=commit, archivesha256=sha(archive)), 'Source HEAD immutable version/checksum/metadata mismatch')
        state.update(status='UPLOADED_VERIFIED', sourceVersion=version)
        record()
        clean_head(commit)
        require(archive_path.read_bytes() == archive and sha(Path(__file__).read_bytes()) == request['helperSha256']
                and sha((ROOT / BUILDSPEC).read_bytes()) == request['buildspecOverrideSha256'], 'Local reviewed inputs changed before dispatch')
        start = build_input_for(request, version, (ROOT / BUILDSPEC).read_text(encoding='utf-8'))
        save(evidence / 'start-build-input.json', start, exclusive=True)
        fresh = aws('start-project', 'codebuild', 'batch-get-projects', '--names', PROJECT)
        require(fresh.get('projectsNotFound') == [] and len(fresh.get('projects', [])) == 1, 'Builder project missing/ambiguous at dispatch')
        validate_builder(fresh['projects'][0], request['builderProjectConfiguration'])
        identity('start-identity')  # Fresh identity immediately before StartBuild.
        require((evidence / 'start-build-input.json').read_bytes() == json_bytes(start)
                and start == build_input_for(request, version, (ROOT / BUILDSPEC).read_text(encoding='utf-8')),
                'Reviewed start input changed/extra overrides; dispatch forbidden')
        build = aws('start-build', 'codebuild', 'start-build', '--cli-input-json', 'file://' + str(evidence / 'start-build-input.json'), mutation=True)['build']
        validate_dispatched_build(build, request, start)
        state.update(status='DISPATCHED_NOT_ACCEPTED', buildId=build['id'], buildArn=build['arn'], buildStatus=build['buildStatus'])
        record()
        return dict(evidence=str(evidence), buildId=build['id'], status=state['status'], sourceVersion=version)
    except BaseException as error:
        state.update(status='STOPPED_OR_OUTCOME_UNCERTAIN', errorType=type(error).__name__,
                     error=str(error)[:500], recovery='Read-only reconciliation required; do not retry mutation or reuse this preparation')
        record()
        raise

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--prepare', action='store_true', help='Default: local archive/review preparation only')
    mode.add_argument('--execute', action='store_true', help='One reviewed external worker build dispatch; NEVER an automatic retry')
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--evidence')
    parser.add_argument('--review-file')
    parser.add_argument('--review-sha256')
    args = parser.parse_args(argv)
    if args.execute:
        require(args.evidence and args.review_file and args.review_sha256, '--execute requires exact prepared evidence, review file and review SHA256')
        result = execute(args.source_commit, args.evidence, args.review_file, args.review_sha256)
    else:
        require(not (args.evidence or args.review_file or args.review_sha256), 'Prepare creates NEW evidence; execution-only options forbidden')
        result = prepare(args.source_commit)
    print(json.dumps(result, sort_keys=True))
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps(dict(status='STOPPED', errorType=type(error).__name__, error=str(error)[:500])), file=sys.stderr)
        raise SystemExit(1)
