"""Codex-owner pure offline regressions; fake AWS and in-memory evidence only."""
import ast
import base64
import copy
import datetime as dt
import hashlib
import io
import json
import pathlib
import re
import stat
import subprocess
import types
import tarfile
import os
import unittest
import uuid
import zipfile
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
HELPER = ROOT / '.task-inputs/start-reviewed-worker-build.py'
HELPER_BYTES = HELPER.read_bytes()
SPEC_BYTES = (ROOT / '.task-inputs/worker-buildspec.json').read_bytes()
PROJECT_BYTES = (ROOT / 'docs/coordination/private-evidence/qualification-build-context/project.json').read_bytes()
BASE_PROJECT = json.loads(PROJECT_BYTES)['projects'][0]
BASE_BUILD = json.loads((ROOT / 'docs/coordination/private-evidence/W02-build-8785118/start-build.json').read_bytes())
BASE_BUILD = BASE_BUILD.get('build', BASE_BUILD)
SCRIPT = json.loads(SPEC_BYTES)['phases']['build']['commands'][0]
PYTHON_BLOCKS = re.findall(r"<<'PY'\n(.*?)\nPY(?:\n|$)", SCRIPT, re.S)
IDENTITY_CODES = re.findall(r"^bound 15 python3 -I -c '([^'\n]*)'$", SCRIPT, re.M)


def subject():
    module = types.ModuleType('worker_offline_subject')
    module.__file__ = str(HELPER)
    exec(compile(HELPER_BYTES, str(HELPER), 'exec'), module.__dict__)
    return module


class Memory:
    def __init__(self):
        self.files, self.dirs, self.metadata = {}, set(), {}
        memory = self

        class Sink(io.BytesIO):
            def __init__(self, key):
                super().__init__()
                self.key = key

            def close(self):
                if not self.closed:
                    memory.files[self.key] = self.getvalue()
                super().close()

        class Path(pathlib.PureWindowsPath):
            def resolve(self, strict=False):
                if strict and str(self) not in memory.files and str(self) not in memory.dirs:
                    raise FileNotFoundError(str(self))
                return self

            def is_symlink(self):
                return stat.S_ISLNK(self.lstat().st_mode)

            def is_file(self):
                return str(self) in memory.files

            def lstat(self):
                return types.SimpleNamespace(**memory.metadata.get(str(self), dict(st_mode=stat.S_IFREG | 0o600, st_nlink=1)))

            def read_bytes(self):
                return memory.files[str(self)]

            def read_text(self, encoding='utf-8'):
                return self.read_bytes().decode(encoding)

            def write_text(self,value,encoding='utf-8'):
                memory.files[str(self)]=value.encode(encoding)
                return len(value)

            def open(self, mode):
                if mode == 'xb' and str(self) in memory.files:
                    raise FileExistsError(str(self))
                if mode not in ('wb', 'xb'):
                    raise AssertionError('Unexpected physical-like file mode')
                return Sink(str(self))

        self.Path = Path


class Transaction:
    commit = 'a' * 40
    archive = b'pure fake reviewed source zip'

    def __init__(self, project_change=None, late_change=None, response_change=None, operation_error=None, tamper_start=False, wrong_identity=False):
        self.module, self.memory = subject(), Memory()
        m, mem = self.module, self.memory
        m.Path, m.ROOT, m.EVIDENCE_ROOT = mem.Path, mem.Path(m.ROOT), mem.Path(m.EVIDENCE_ROOT)
        m.PROJECT_EVIDENCE = mem.Path(m.PROJECT_EVIDENCE)
        mem.files[str(mem.Path(HELPER))] = HELPER_BYTES
        mem.files[str(m.ROOT / m.BUILDSPEC)] = SPEC_BYTES
        mem.files[str(m.PROJECT_EVIDENCE)] = PROJECT_BYTES
        mem.dirs.add(str(m.EVIDENCE_ROOT))
        self.content = dict(sourceCommit=self.commit, sourceFiles=[], inventorySource={'path':m.INVENTORY_SOURCE,'bytes':1,'sha256':'d'*64},
                            inventoryContract=m.inventory_contract(),
                            buildspec={'path':m.BUILDSPEC,'bytes':len(SPEC_BYTES),'sha256':m.sha(SPEC_BYTES),'placement':'OWNER_OVERRIDE_NOT_IN_ARCHIVE'},
                            builderAuthority={'path':m.BUILDER_INFRA,'bytes':1,'sha256':m.BUILDER_INFRA_SHA256})
        m.clean_head = lambda c: m.require(c == self.commit, 'bad fake commit')
        m.expected_content = lambda c: self.content
        m.archive_bytes = lambda c, content: (self.archive, 7)
        token = str(uuid.uuid4())
        self.evidence = m.EVIDENCE_ROOT / ('W02-worker-build-' + self.commit[:7] + '-' + token)
        mem.dirs.add(str(self.evidence))
        self.request = m.request_for(self.commit, self.content, self.archive, 7, token, dt.datetime.now(dt.timezone.utc).isoformat())
        raw = m.json_bytes(self.request)
        mem.files[str(self.evidence / 'review-request.json')] = raw
        mem.files[str(self.evidence / self.request['archive']['name'])] = self.archive
        review = dict(decision='APPROVE_ONE_WORKER_BUILD', reviewRequestSha256=m.sha(raw), sourceCommit=self.commit,
                      archiveSha256=self.request['archive']['sha256'], buildspecSha256=self.request['buildspecOverrideSha256'],
                      helperSha256=self.request['helperSha256'], reviewer='independent offline fake', notes='No AWS/runtime acceptance')
        self.review_path = m.ROOT / 'offline-fake-review.json'
        self.review_raw = m.json_bytes(review)
        mem.files[str(self.review_path)] = self.review_raw
        self.project_change, self.late_change, self.response_change = project_change, late_change, response_change
        self.operation_error, self.tamper_start = operation_error, tamper_start
        self.wrong_identity = wrong_identity
        self.calls, self.project_reads, self.sts_reads = [], 0, 0

    @property
    def mutations(self):
        return [op for op in self.calls if op in [('s3api', 'put-object'), ('codebuild', 'start-build')]]

    def aws(self, args, **kwargs):
        m = self.module
        assert args[0] == m.AWS and kwargs['timeout'] == 90
        assert '--profile' in args and args[args.index('--profile') + 1] == m.PROFILE
        assert kwargs['env']['AWS_MAX_ATTEMPTS'] == '1'
        service, operation = args[1:3]
        self.calls.append((service, operation))
        if self.operation_error == (service, operation):
            raise subprocess.TimeoutExpired(args, 90)
        if (service, operation) == ('sts', 'get-caller-identity'):
            self.sts_reads += 1
            result = dict(Account=m.ACCOUNT, Arn=m.PRINCIPAL)
            if self.wrong_identity:
                result['Arn'] = 'arn:aws:iam::967807252336:user/other'
            if self.tamper_start and self.sts_reads == 3:
                key = str(self.evidence / 'start-build-input.json')
                data = json.loads(self.memory.files[key])
                data['serviceRoleOverride'] = 'arn:aws:iam::967807252336:role/current-Meri'
                self.memory.files[key] = m.json_bytes(data)
        elif (service, operation) == ('ecr', 'describe-repositories'):
            result = {'repositories': [dict(repositoryArn='arn:aws:ecr:us-east-1:967807252336:repository/' + m.REPOSITORY,
                       repositoryUri=m.REPOSITORY_URI, imageTagMutability='IMMUTABLE', encryptionConfiguration=dict(encryptionType='KMS', kmsKey=m.KMS))]}
        elif (service, operation) == ('codebuild', 'batch-get-projects'):
            self.project_reads += 1
            project = copy.deepcopy(BASE_PROJECT)
            if self.project_change:
                self.project_change(project)
            if self.late_change and self.project_reads == 2:
                self.late_change(project)
            result = dict(projects=[project], projectsNotFound=[])
        elif (service, operation) == ('codebuild', 'list-builds-for-project'):
            result = {'ids': []}
        elif (service, operation) == ('s3api', 'put-object'):
            result = dict(VersionId='version-1', ChecksumSHA256=base64.b64encode(hashlib.sha256(self.archive).digest()).decode(),
                          ServerSideEncryption='aws:kms', SSEKMSKeyId=m.KMS)
        elif (service, operation) == ('s3api', 'head-object'):
            result = dict(VersionId='version-1', ChecksumSHA256=base64.b64encode(hashlib.sha256(self.archive).digest()).decode(),
                          ContentLength=len(self.archive), ServerSideEncryption='aws:kms', SSEKMSKeyId=m.KMS,
                          Metadata=dict(sourcecommit=self.commit, archivesha256=m.sha(self.archive)))
        elif (service, operation) == ('codebuild', 'start-build'):
            start = json.loads(self.memory.files[str(self.memory.Path(args[args.index('--cli-input-json') + 1][7:]))])
            build = copy.deepcopy(BASE_BUILD)
            build.update(sourceVersion=start['sourceVersion'], timeoutInMinutes=15, queuedTimeoutInMinutes=5)
            build['source'].update(location=start['sourceLocationOverride'], buildspec=start['buildspecOverride'])
            variables = {v['name']: v for v in BASE_PROJECT['environment']['environmentVariables']}
            variables.update({v['name']: v for v in start['environmentVariablesOverride']})
            build['environment']['environmentVariables'] = list(variables.values())
            if self.response_change:
                self.response_change(build)
            result = {'build': build}
        else:
            raise AssertionError((service, operation))
        return types.SimpleNamespace(returncode=0, stdout=json.dumps(result), stderr='')

    def execute(self):
        with patch.object(self.module.subprocess, 'run', side_effect=self.aws), patch.object(self.module.subprocess, 'check_output', side_effect=AssertionError('Unexpected subprocess')):
            return self.module.execute(self.commit, str(self.evidence), str(self.review_path), self.module.sha(self.review_raw))


def verification_fixture():
    m=subject();contract=m.inventory_contract();commit='a'*40;iid='sha256:'+'b'*64;cid='c'*64
    entries={}
    def entry(path,kind='dir',**extra):
        entries[path]=dict(path=path,type=kind,mode='0755',uid=0,gid=0,size=0,**extra)
    for root in contract['roots']:
        if root in contract['aliases']:entry(root,'symlink',target=contract['aliases'][root])
        else:entry(root)
    for target in contract['aliases'].values():entry(target)
    for path,pin in contract['pins'].items():
        entry(path,'file',sha256=pin['sha256']);entries[path].update(pin)
    entry('/opt/meri-worker/probes/image-inventory.py','file',sha256='d'*64)
    ordered=sorted(entries.values(),key=lambda e:e['path'])
    privilege=[e for e in ordered if int(e['mode'],8)&0o6000]
    inv=dict(schema=contract['schema'],ok=True,refused=False,platform='linux',coverage=dict(complete=True,scope='declared roots/aliases; names do not prove renamed features absent'),
      truncated=False,errors=[],entries=ordered,candidates=[],privilegeFiles=privilege,unexpectedPrivilegeFiles=[],
      expectations=[dict(path=p,status='match',expected=pin,observed=entries[p]) for p,pin in sorted(contract['pins'].items())],
      summary=dict(roots=sorted(contract['roots']),exclusions=sorted(contract['exclusions']),entries=len(ordered),files=sum(e['type']=='file' for e in ordered),symlinks=sum(e['type']=='symlink' for e in ordered),
       candidates=0,privilegeEntries=len(privilege),unexpectedPrivilegeEntries=0,expectations=4,expectationFailures=0,errors=0,limitsExceeded=None,elapsedMs=12))
    cfg=copy.deepcopy(contract['imageConfig']);cfg.pop('requiredEnv')
    cfg.update(Cmd=None,Labels={'org.opencontainers.image.revision':commit,'meri.qualification.kind':'worker-inventory-only'},
      Env=[k+'='+v for k,v in contract['imageConfig']['requiredEnv'].items()]+['PATH=/opt/meri-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','NODE_VERSION=24.21.0','YARN_VERSION=1.22.22'])
    state=dict(Status='created',Running=False,Pid=0,Paused=False,Restarting=False,Dead=False,OOMKilled=False,ExitCode=0,Error='',StartedAt='0001-01-01T00:00:00Z',FinishedAt='0001-01-01T00:00:00Z')
    host=dict(ReadonlyRootfs=True,Privileged=False,NetworkMode='none',CapDrop=['ALL'],CapAdd=None,SecurityOpt=['no-new-privileges=true'],PidMode='',IpcMode='private',UTSMode='',RestartPolicy={'Name':'no','MaximumRetryCount':0},
      Tmpfs={'/workspace':'rw,nosuid,nodev,size=64m,uid=10001,gid=10001','/tmp':'rw,nosuid,nodev,size=64m,uid=10001,gid=10001'})
    container=dict(Id=cid,Image=iid,Config=dict(Image=iid,User='10001:10001',Entrypoint=['/meri-never-execute-worker'],Cmd=None,Env=copy.deepcopy(cfg['Env'])),HostConfig=host,State=state,RestartCount=0)
    files={'worker-expected.json':{'inventoryContract':contract,'inventorySource':{'sha256':'d'*64}},'worker-image-inspect.json':[dict(Id=iid,Os='linux',Architecture='amd64',Config=cfg)],
      'worker-container-before.json':[copy.deepcopy(container)],'worker-container-after.json':[copy.deepcopy(container)]}
    return inv,files,{'SOURCE_COMMIT':commit,'IID':iid,'CID':cid}


def run_verifier(test,inv,files,environment,good,mode='good'):
    memory=Memory();raw=json.dumps(inv).encode()
    if mode=='duplicate-json':raw=raw[:-1]+b',"ok":true}'
    copied=memory.Path('worker-extracted/image-inventory.json');memory.files[str(copied)]=raw
    memory.files['worker-image-id.txt']=(environment['IID']+'\n').encode()
    memory.files['worker-container-id.txt']=(environment['CID']+'\n').encode()
    facts=dict(st_mode=stat.S_IFREG|0o600,st_nlink=1,st_dev=1,st_ino=1,st_uid=0,st_gid=0,st_size=len(raw),st_mtime_ns=1,st_ctime_ns=1)
    if mode=='symlink':facts['st_mode']=stat.S_IFLNK|0o777
    if mode=='hardlink':facts['st_nlink']=2
    if mode=='oversized':facts['st_size']=33554433
    memory.metadata[str(copied)]=facts
    opened=types.SimpleNamespace(**facts)
    if mode=='fd-changed':opened.st_ino=2
    if mode=='path-changed':
        class ChangingPath(memory.Path):
            count=0
            def lstat(self):
                result=super().lstat()
                if str(self)==str(copied):
                    ChangingPath.count+=1
                    if ChangingPath.count>=3:result.st_ino=2
                return result
        memory.Path=ChangingPath
    chunks=[raw,b''] if mode!='short-read' else [raw[:-1],b'']
    with patch.object(pathlib,'Path',memory.Path),patch('builtins.open',side_effect=lambda path,*a,**k:io.StringIO(json.dumps(files[path]))), \
         patch.dict('os.environ',{'SOURCE_COMMIT':environment['SOURCE_COMMIT']}),patch('os.open',return_value=100),patch('os.fstat',return_value=opened), \
         patch('os.read',side_effect=lambda *a:chunks.pop(0)),patch('os.close'),patch('os.O_NOFOLLOW',getattr(__import__('os'),'O_NOFOLLOW',0),create=True),patch('os.O_NONBLOCK',getattr(__import__('os'),'O_NONBLOCK',0),create=True):
        if good:
            exec(compile(PYTHON_BLOCKS[2],'actual-worker-inventory-verifier','exec'),{})
            test.assertIn('worker-inventory-validation.json',memory.files)
        else:
            with test.assertRaises((AssertionError,KeyError,ValueError)):
                exec(compile(PYTHON_BLOCKS[2],'actual-worker-inventory-verifier','exec'),{})


class OwnerGlueTests(unittest.TestCase):
    def test_import_and_default_cli_make_no_external_call(self):
        with patch.object(subprocess, 'run', side_effect=AssertionError('External call')), patch.object(subprocess, 'check_output', side_effect=AssertionError('External call')):
            m = subject()
            calls = []
            m.prepare = lambda c: calls.append(c) or {'status': 'FAKE_LOCAL_ONLY', 'awsCalls': 0}
            m.execute = lambda *a: self.fail('Default selected execute')
            with patch('builtins.print'):
                m.main(['--source-commit', 'a' * 40])
            self.assertEqual(calls, ['a' * 40])

    def test_full_transaction_and_separate_legacy_override(self):
        t = Transaction()
        self.assertEqual(t.execute()['status'], 'DISPATCHED_NOT_ACCEPTED')
        self.assertEqual(t.mutations, [('s3api', 'put-object'), ('codebuild', 'start-build')])
        start = json.loads(t.memory.files[str(t.evidence / 'start-build-input.json')])
        self.assertNotEqual(start['buildspecOverride'], t.request['builderProjectConfiguration']['source']['buildspec'])
        self.assertEqual(start['buildspecOverride'].encode(), SPEC_BYTES)
        self.assertEqual(t.project_reads, 2)

    def test_role_plus_secret_regression_fails_before_upload(self):
        def drift(p):
            p['serviceRole'] = 'arn:aws:iam::967807252336:role/current-Meri-SourceProviderRole'
            p['environment']['environmentVariables'].append(dict(name='CURRENT_MERI_SECRET', value='current-meri/provider', type='SECRETS_MANAGER'))
        t = Transaction(project_change=drift)
        with self.assertRaises(ValueError):
            t.execute()
        self.assertEqual(t.mutations, [])

    def test_wrong_identity_prevents_all_mutations(self):
        t = Transaction(wrong_identity=True)
        with self.assertRaises(ValueError):
            t.execute()
        self.assertEqual(t.mutations, [])

    def test_full_project_configuration_drift_rejected(self):
        changes = {
            'role': lambda p: p.update(serviceRole='other-role'),
            'secret': lambda p: p['environment']['environmentVariables'].append(dict(name='EXTRA', value='secret', type='SECRETS_MANAGER')),
            'parameter': lambda p: p['environment']['environmentVariables'].append(dict(name='EXTRA', value='parameter', type='PARAMETER_STORE')),
            'plaintext': lambda p: p['environment']['environmentVariables'].append(dict(name='BASH_ENV', value='/unreviewed', type='PLAINTEXT')),
            'duplicate': lambda p: p['environment']['environmentVariables'].append(copy.deepcopy(p['environment']['environmentVariables'][0])),
            'image': lambda p: p['environment'].update(image='other-image'),
            'type': lambda p: p['environment'].update(type='LINUX_GPU_CONTAINER'),
            'compute': lambda p: p['environment'].update(computeType='BUILD_GENERAL1_LARGE'),
            'privileged': lambda p: p['environment'].update(privilegedMode=False),
            'registry': lambda p: p['environment'].update(registryCredential={'credential': 'existing-secret'}),
            'certificate': lambda p: p['environment'].update(certificate='existing-source'),
            'concurrency': lambda p: p.update(concurrentBuildLimit=9),
            'vpc': lambda p: p.update(vpcConfig={'vpcId': 'current-vpc'}),
            'artifacts': lambda p: p.update(artifacts={'type': 'S3', 'location': 'current-bucket'}),
            'logs': lambda p: p['logsConfig']['cloudWatchLogs'].update(groupName='/current-meri'),
            'encryption': lambda p: p.update(encryptionKey='current-key'),
            'cache': lambda p: p.update(cache={'type': 'S3', 'location': 'current-bucket'}),
            'source-type': lambda p: p['source'].update(type='GITHUB'),
            'source-location': lambda p: p['source'].update(location='current-source'),
            'source-buildspec': lambda p: p['source'].update(buildspec='echo unreviewed'),
            'source-auth': lambda p: p['source'].update(auth={'type': 'CODECONNECTIONS', 'resource': 'current'}),
            'source-ssl': lambda p: p['source'].update(insecureSsl=True),
            'secondary-source': lambda p: p.update(secondarySources=[{'type': 'GITHUB', 'location': 'current'}]),
            'secondary-artifacts': lambda p: p.update(secondaryArtifacts=[{'type': 'S3', 'location': 'current'}]),
            'filesystem': lambda p: p.update(fileSystemLocations=[{'location': 'current'}]),
            'batch': lambda p: p.update(buildBatchConfig={'serviceRole': 'current'}),
            'visibility': lambda p: p.update(projectVisibility='PUBLIC_READ'),
            'tags': lambda p: p['tags'].append({'key': 'Unexpected', 'value': 'current'}),
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                t = Transaction(project_change=change)
                with self.assertRaises(ValueError):
                    t.execute()
                self.assertEqual(t.mutations, [])

    def test_benign_order_and_timestamps_preserve_authority(self):
        def reorder(p):
            p['environment']['environmentVariables'].reverse()
            p['tags'].reverse()
            p['created'], p['lastModified'] = 'new-observation', 'new-observation'
        self.assertEqual(Transaction(project_change=reorder).execute()['status'], 'DISPATCHED_NOT_ACCEPTED')

    def test_late_project_drift_prevents_start_after_upload(self):
        t = Transaction(late_change=lambda p: p.update(serviceRole='current-role'))
        with self.assertRaises(ValueError):
            t.execute()
        self.assertEqual(t.mutations, [('s3api', 'put-object')])

    def test_unreviewed_start_override_prevents_start(self):
        t = Transaction(tamper_start=True)
        with self.assertRaises(ValueError):
            t.execute()
        self.assertEqual(t.mutations, [('s3api', 'put-object')])

    def test_returned_authority_drift_stays_uncertain(self):
        changes = [lambda b: b.update(serviceRole='current-role'),
                   lambda b: b['environment']['environmentVariables'].append(dict(name='SECRET', type='SECRETS_MANAGER', value='current')),
                   lambda b: b['source'].update(buildspec=BASE_PROJECT['source']['buildspec']),
                   lambda b: b.update(vpcConfig={'vpcId': 'current'}),
                   lambda b: b.update(artifacts={'location': 'current-bucket'}),
                   lambda b: b.update(encryptionKey='current'),
                   lambda b: b.update(id='wrong-project:id'),
                   lambda b: b.update(arn=b['arn'].rsplit(':', 1)[1])]
        for change in changes:
            with self.subTest(change=change):
                t = Transaction(response_change=change)
                with self.assertRaises(ValueError):
                    t.execute()
                self.assertEqual(t.mutations, [('s3api', 'put-object'), ('codebuild', 'start-build')])
                manifest = json.loads(t.memory.files[str(t.evidence / 'manifest.json')])
                self.assertEqual(manifest['status'], 'STOPPED_OR_OUTCOME_UNCERTAIN')

    def test_failed_upload_and_uncertain_start_never_retry(self):
        for operation in [('s3api', 'put-object'), ('codebuild', 'start-build')]:
            with self.subTest(operation=operation):
                t = Transaction(operation_error=operation)
                with self.assertRaises(subprocess.TimeoutExpired):
                    t.execute()
                calls = list(t.calls)
                with self.assertRaises(FileExistsError):
                    t.execute()
                self.assertEqual(t.calls, calls)
                self.assertEqual(t.mutations.count(operation), 1)

    def test_archive_or_review_changes_fail_before_aws(self):
        for target in ('archive', 'review'):
            t = Transaction()
            if target == 'archive':
                t.memory.files[str(t.evidence / t.request['archive']['name'])] = b'changed'
            else:
                t.memory.files[str(t.review_path)] += b' '
            with self.assertRaises(ValueError):
                t.execute()
            self.assertEqual(t.calls, [])

    def test_python_blocks_parse_and_never_start_ordering(self):
        self.assertEqual(len(PYTHON_BLOCKS),5)
        for index,code in enumerate(PYTHON_BLOCKS):
            compile(code,'embedded-python-'+str(index),'exec')
        self.assertTrue(SCRIPT.startswith('set -euo pipefail\n'))
        self.assertNotRegex(SCRIPT,r'docker\s+(?:start|run|exec)\b')
        self.assertEqual(len(re.findall(r'docker cp ',SCRIPT)),1)
        self.assertIn('$worker_id:/opt/meri-worker/image-inventory.json',SCRIPT)
        self.assertIn(' - | bound 30 python3 -I worker-copy-inventory.py',SCRIPT)
        self.assertLess(SCRIPT.index('worker-container-removal-readback'),SCRIPT.index('docker push'))
        self.assertIn('worker_deadline=$((SECONDS+900))',SCRIPT)
        self.assertIn('bound 800 docker build --pull --platform linux/amd64',SCRIPT)
        self.assertNotIn('docker build --network none',SCRIPT)
        self.assertIn('bound 30 docker create',SCRIPT)
        self.assertIn('--entrypoint /meri-never-execute-worker',SCRIPT)
        self.assertEqual(subject().DISPATCH_DEADLINE_SECONDS,1200)

    def test_publication_sts_reads_and_actual_validator_placement(self):
        # Check actual shell sequence, not a second implementation of the gate.
        # No shell command body runs in this test.
        self.assertEqual(len(IDENTITY_CODES),3)
        for code in IDENTITY_CODES:compile(code,'actual-inline-sts-validator','exec')
        lines=SCRIPT.splitlines()
        push=lines.index('bound 120 docker push "$REPOSITORY_URI:$IMAGE_TAG"')
        self.assertEqual(lines[push-2],'bound 30 aws sts get-caller-identity --region us-east-1 --output json --no-cli-pager > worker-push-identity.json')
        self.assertEqual(lines[push-1],"bound 15 python3 -I -c '"+IDENTITY_CODES[1]+"'")
        upload=next(i for i,line in enumerate(lines) if line.startswith('bound 60 aws s3api put-object '))
        self.assertEqual(lines[upload-3],'bound 30 aws sts get-caller-identity --region us-east-1 --output json --no-cli-pager > worker-result-identity.json')
        self.assertEqual(lines[upload-2],"bound 15 python3 -I -c '"+IDENTITY_CODES[2]+"'")
        self.assertTrue(lines[upload-1].startswith('result_checksum=$(bound 15 python3 -I -c '))
        self.assertLess(SCRIPT.index('worker-container-removal-readback'),SCRIPT.index('> worker-push-identity.json'))
        self.assertIn('worker_deadline=$((SECONDS+900))',SCRIPT)
        self.assertEqual(SCRIPT.count('aws sts get-caller-identity'),3)

    def test_actual_publication_identity_rejects_wrong_or_malformed_principals(self):
        role='arn:aws:sts::967807252336:assumed-role/MeriGreenfield-QualificationBui-BuilderRoleBBEBFA71-8G97EeNmFM0H/'
        identity=dict(Account='967807252336',Arn=role+'AWSCodeBuild-fake',UserId='AROAFAKE:AWSCodeBuild-fake')
        cases={
          'good':lambda w:w,
          'wrong-account':lambda w:dict(w,Account='000000000000'),
          'wrong-role':lambda w:dict(w,Arn=w['Arn'].replace('BuilderRoleBBEBFA71-8G97EeNmFM0H','CurrentMeriRole')),
          'wrong-arn-account':lambda w:dict(w,Arn=w['Arn'].replace('::967807252336:', '::000000000000:')),
          'missing-arn':lambda w:{k:v for k,v in w.items() if k!='Arn'},
          'nonstring-arn':lambda w:dict(w,Arn=['invalid']),
          'nondict':lambda w:['invalid'],
          'newline-session':lambda w:dict(w,Arn=role+'fake\nname'),
          'empty-session':lambda w:dict(w,Arn=role),
          'extra-slash':lambda w:dict(w,Arn=role+'fake/name'),
          'overlong-session':lambda w:dict(w,Arn=role+'x'*65),
          'different-valid-session':lambda w:dict(w,Arn=role+'different-valid-session'),
          'malformed-json':lambda w:'{',
        }
        for stage,code,index_file in [('ecr-push',IDENTITY_CODES[1],'worker-push-identity.json'),('result-upload',IDENTITY_CODES[2],'worker-result-identity.json')]:
            for name,change in cases.items():
                with self.subTest(stage=stage,case=name):
                    memory=Memory()
                    manifest={'builderIdentities':{'preflight':copy.deepcopy(identity),'beforeEcrPush':copy.deepcopy(identity)}}
                    before=(json.dumps(manifest)+'\n').encode()
                    memory.files['worker-manifest.json']=before
                    observed=change(copy.deepcopy(identity))
                    files={'worker-builder-identity.json':copy.deepcopy(identity),'worker-push-identity.json':copy.deepcopy(identity),index_file:observed}
                    def opened(path,*a,**k):
                        value=files[path]
                        return io.StringIO(value if name=='malformed-json' and path==index_file else json.dumps(value))
                    with patch.object(pathlib,'Path',memory.Path),patch('builtins.open',side_effect=opened):
                        if name=='good':
                            exec(compile(code,'actual-publication-sts-'+stage,'exec'),{})
                            if stage=='result-upload':
                                result=json.loads(memory.files['worker-manifest.json'])
                                self.assertEqual(result['builderIdentities']['beforeResultUpload'],identity)
                        else:
                            with self.assertRaises((AssertionError,ValueError)):
                                exec(compile(code,'actual-publication-sts-'+stage,'exec'),{})
                            self.assertEqual(memory.files['worker-manifest.json'],before)

    def test_actual_inventory_container_verifier_adversarial_cases(self):
        good,files,environment=verification_fixture()
        changes={
            'good':lambda i,f:None,
            'coverage':lambda i,f:i['coverage'].update(complete=False),
            'truncated':lambda i,f:i.update(truncated=True),
            'errors':lambda i,f:i['errors'].append({'path':'/usr','error':'denied'}),
            'missing-root':lambda i,f:i['entries'].__setitem__(slice(None),[e for e in i['entries'] if e['path']!='/root']),
            'alias':lambda i,f:next(e for e in i['entries'] if e['path']=='/bin').update(target='/outside'),
            'bad-pin':lambda i,f:next(e for e in i['entries'] if e['path'].endswith('/chrome')).update(sha256='e'*64),
            'extra-privilege':lambda i,f:next(e for e in i['entries'] if e['path']=='/usr').update(mode='2755'),
            'wrong-helper-uid':lambda i,f:next(e for e in i['entries'] if e['path'].endswith('/chrome_sandbox')).update(uid=10001),
            'source-mismatch':lambda i,f:next(e for e in i['entries'] if e['path'].endswith('/image-inventory.py')).update(sha256='a'*64),
            'duplicate-path':lambda i,f:i['entries'].append(copy.deepcopy(i['entries'][0])),
            'output-entry':lambda i,f:i['entries'].append(dict(path='/opt/meri-worker/image-inventory.json',type='file',mode='0644',uid=10001,gid=10001,size=1,sha256='a'*64)),
            'summary-count':lambda i,f:i['summary'].update(entries=1),
            'running':lambda i,f:f['worker-container-after.json'][0]['State'].update(Status='running',Running=True,Pid=1),
            'ever-started':lambda i,f:f['worker-container-before.json'][0]['State'].update(StartedAt='2026-10-09T00:00:00Z'),
            'wrong-image':lambda i,f:f['worker-container-before.json'][0].update(Image='sha256:'+'e'*64),
            'wrong-entrypoint':lambda i,f:f['worker-image-inspect.json'][0]['Config'].update(Entrypoint=['sh']),
            'wrong-user':lambda i,f:f['worker-image-inspect.json'][0]['Config'].update(User='0'),
            'secret-env':lambda i,f:f['worker-image-inspect.json'][0]['Config']['Env'].append('AWS_SECRET_ACCESS_KEY=synthetic'),
            'network':lambda i,f:f['worker-container-after.json'][0]['HostConfig'].update(NetworkMode='host'),
            'writable-root':lambda i,f:f['worker-container-after.json'][0]['HostConfig'].update(ReadonlyRootfs=False),
            'caps':lambda i,f:f['worker-container-after.json'][0]['HostConfig'].update(CapAdd=['SYS_ADMIN']),
            'nnp':lambda i,f:f['worker-container-after.json'][0]['HostConfig'].update(SecurityOpt=[]),
        }
        for case,change in changes.items():
            with self.subTest(case=case):
                inv,contents=copy.deepcopy(good),copy.deepcopy(files);change(inv,contents)
                run_verifier(self,inv,contents,environment,good=(case=='good'))
        for case in ('symlink','hardlink','oversized','fd-changed','path-changed','short-read','duplicate-json'):
            with self.subTest(case=case):
                run_verifier(self,copy.deepcopy(good),copy.deepcopy(files),environment,good=False,mode=case)

    def test_actual_bounded_tar_copy_reader(self):
        def tar(case):
            stream=io.BytesIO()
            with tarfile.open(fileobj=stream,mode='w') as archive:
                member=tarfile.TarInfo('image-inventory.json' if case!='wrong-name' else '../outside')
                member.mode=0o600;member.size=3
                if case in ('symlink','hardlink'):
                    member.type=tarfile.SYMTYPE if case=='symlink' else tarfile.LNKTYPE;member.linkname='/outside';member.size=0
                if case=='oversized':member.size=33554433
                if case=='suid':member.mode=0o4600
                if case=='oversized':
                    stream.write(member.tobuf());return stream.getvalue()+b'\0'*1024
                archive.addfile(member,io.BytesIO(b'{}\n') if member.size else None)
                if case=='extra':
                    other=tarfile.TarInfo('other');other.size=1;archive.addfile(other,io.BytesIO(b'x'))
            value=stream.getvalue()
            if case=='trailing':value+=b'evil'
            if case=='stream-cap':value+=b'\0'*(33554432+65536)
            if case=='short':value=value[:513]
            return value
        for case in ('good','wrong-name','symlink','hardlink','suid','oversized','extra','trailing','stream-cap','short','exists'):
            with self.subTest(case=case):
                memory=Memory();written=bytearray();data=tar(case)
                fakein=types.SimpleNamespace(buffer=io.BytesIO(data))
                def mkdir(*a):
                    if case=='exists':raise FileExistsError('known exclusive directory already exists')
                facts=types.SimpleNamespace(st_mode=stat.S_IFREG|0o600,st_nlink=1)
                def write(fd,view):written.extend(view);return len(view)
                with patch.object(pathlib,'Path',memory.Path),patch('sys.stdin',fakein),patch('os.mkdir',side_effect=mkdir), \
                     patch('os.open',return_value=100),patch('os.fstat',return_value=facts),patch('os.write',side_effect=write),patch('os.fsync'),patch('os.close'), \
                     patch('os.O_NOFOLLOW',getattr(os,'O_NOFOLLOW',0),create=True):
                    if case=='good':
                        exec(compile(PYTHON_BLOCKS[1],'actual-bounded-copy','exec'),{})
                        self.assertEqual(written,b'{}\n')
                        proof=json.loads(memory.files['worker-copy-validation.json'])
                        self.assertEqual(proof['payloadBytes'],3)
                        self.assertLessEqual(proof['tarStreamBytes'],33554432+65536)
                    else:
                        with self.assertRaises((AssertionError,tarfile.TarError,FileExistsError)):
                            exec(compile(PYTHON_BLOCKS[1],'actual-bounded-copy','exec'),{})
                        if case in ('wrong-name','symlink','hardlink','suid','oversized','exists'):self.assertEqual(written,b'')

    def test_actual_build_source_archive_principal_and_hash_binding(self):
        m=subject();commit='a'*40;run='12345678-1234-4123-8123-123456789abc'
        data={m.DOCKERFILE:b'reviewed-recipe',m.INVENTORY_SOURCE:b'reviewed-inventory',m.BUILDER_INFRA:b'reviewed-authority'}
        record=lambda p:dict(path=p,bytes=len(data[p]),sha256=m.sha(data[p]))
        expected=dict(sourceCommit=commit,sourceFiles=[record(m.DOCKERFILE),record(m.INVENTORY_SOURCE)],builderAuthority=record(m.BUILDER_INFRA),
          inventoryContract=m.inventory_contract(),buildspec={'sha256':m.sha(SPEC_BYTES),'placement':'OWNER_OVERRIDE_NOT_IN_ARCHIVE'})
        buf=io.BytesIO()
        with zipfile.ZipFile(buf,'w') as out:
            for name,value in data.items():out.writestr(name,value)
        archive=buf.getvalue();archive_sha=m.sha(archive)
        base_env=dict(REPOSITORY_URI=m.REPOSITORY_URI,REPOSITORY_NAME=m.REPOSITORY,RESULT_BUCKET=m.BUCKET,SOURCE_COMMIT=commit,BUILD_RUN_UUID=run,
          IMAGE_TAG='worker-'+commit+'-'+run,RESULT_KEY='results/worker-'+commit+'-'+run+'/manifest.json',SOURCE_ARCHIVE_SHA256=archive_sha,
          WORKER_BUILDSPEC_SHA256=m.sha(SPEC_BYTES),SOURCE_S3_VERSION='version-1',CODEBUILD_BUILD_ID=m.PROJECT+':12345678-1234-4123-8123-123456789abc',
          WORKER_EXPECTED_B64=base64.b64encode(m.json_bytes(expected)).decode())
        base_files={'worker-builder-identity.json':{'Account':m.ACCOUNT,'Arn':'arn:aws:sts::967807252336:assumed-role/'+m.BUILDER_ROLE.rsplit('/',1)[1]+'/codebuild-fake'},
          'worker-source-download.json':{'VersionId':'version-1','ChecksumSHA256':base64.b64encode(hashlib.sha256(archive).digest()).decode(),
           'ServerSideEncryption':'aws:kms','SSEKMSKeyId':m.KMS,'Metadata':{'sourcecommit':commit,'archivesha256':archive_sha}}}
        changes={
         'good':lambda env,f,mem:None,
         'wrong-role':lambda env,f,mem:f['worker-builder-identity.json'].update(Arn='arn:aws:sts::967807252336:assumed-role/current-Meri/fake'),
         'wrong-account':lambda env,f,mem:f['worker-builder-identity.json'].update(Account='000000000000'),
         'wrong-version':lambda env,f,mem:f['worker-source-download.json'].update(VersionId='other'),
         'wrong-checksum':lambda env,f,mem:f['worker-source-download.json'].update(ChecksumSHA256='wrong'),
         'wrong-kms':lambda env,f,mem:f['worker-source-download.json'].update(SSEKMSKeyId='current-key'),
         'wrong-metadata':lambda env,f,mem:f['worker-source-download.json']['Metadata'].update(sourcecommit='b'*40),
         'wrong-tag':lambda env,f,mem:env.update(IMAGE_TAG='current:latest'),
         'wrong-result':lambda env,f,mem:env.update(RESULT_KEY='results/current.json'),
         'changed-checkout':lambda env,f,mem:mem.files.update({str(mem.Path(m.DOCKERFILE)):b'changed'}),
        }
        real_zip=zipfile.ZipFile
        for case,change in changes.items():
            with self.subTest(case=case):
                memory=Memory();environment=copy.deepcopy(base_env);files=copy.deepcopy(base_files)
                for name,value in data.items():memory.files[str(memory.Path(name))]=value
                memory.files['worker-source.zip']=archive
                memory.metadata['worker-source.zip']=dict(st_mode=stat.S_IFREG|0o600,st_nlink=1,st_size=len(archive))
                change(environment,files,memory)
                with patch.object(pathlib,'Path',memory.Path),patch('builtins.open',side_effect=lambda path,*a,**k:io.StringIO(json.dumps(files[path]))), \
                     patch.dict('os.environ',environment),patch.object(zipfile,'ZipFile',side_effect=lambda path:real_zip(io.BytesIO(memory.files[str(path)]))):
                    if case=='good':
                        exec(compile(PYTHON_BLOCKS[0],'actual-source-verifier','exec'),{})
                        self.assertIn('worker-expected.json',memory.files)
                    else:
                        with self.assertRaises(AssertionError):exec(compile(PYTHON_BLOCKS[0],'actual-source-verifier','exec'),{})

    def test_actual_result_manifest_iid_registry_and_inventory_binding(self):
        m=subject();inv,fixture,identity=verification_fixture();iid=identity['IID'];cid=identity['CID'];digest='sha256:'+'e'*64
        raw=json.dumps(inv).encode();commit=identity['SOURCE_COMMIT'];run='12345678-1234-4123-8123-123456789abc';tag='worker-'+commit+'-'+run
        environment=dict(REPOSITORY_URI=m.REPOSITORY_URI,IMAGE_TAG=tag,SOURCE_COMMIT=commit,SOURCE_ARCHIVE_SHA256='f'*64,SOURCE_S3_VERSION='version-1',
          WORKER_BUILDSPEC_SHA256=m.sha(SPEC_BYTES),BUILD_RUN_UUID=run,RESULT_KEY='results/'+tag+'/manifest.json',CODEBUILD_BUILD_ID=m.PROJECT+':'+run)
        files={'worker-expected.json':fixture['worker-expected.json'],'worker-inventory-validation.json':dict(ok=True,imageIid=iid,containerId=cid,inventoryBytes=len(raw),inventorySha256=m.sha(raw)),
          'worker-copy-validation.json':dict(sourcePath=m.INVENTORY_OUTPUT,singleRegularMember=True,payloadBytes=len(raw),payloadSha256=m.sha(raw)),
          'worker-ecr-image.json':{'imageDetails':[dict(registryId=m.ACCOUNT,repositoryName=m.REPOSITORY,imageTags=[tag],imageDigest=digest)]},
          'worker-image-after-push.json':[dict(Id=iid,RepoDigests=[m.REPOSITORY_URI+'@'+digest])],
          'worker-image-inspect.json':fixture['worker-image-inspect.json'],'worker-container-before.json':fixture['worker-container-before.json'],
          'worker-container-after.json':fixture['worker-container-after.json'],
          'worker-builder-identity.json':dict(Account=m.ACCOUNT,Arn='arn:aws:sts::967807252336:assumed-role/'+m.BUILDER_ROLE.rsplit('/',1)[1]+'/codebuild-fake'),
          'worker-push-identity.json':dict(Account=m.ACCOUNT,Arn='arn:aws:sts::967807252336:assumed-role/'+m.BUILDER_ROLE.rsplit('/',1)[1]+'/codebuild-fake')}
        changes={'good':lambda f,mem:None,
          'wrong-iid':lambda f,mem:f['worker-image-after-push.json'][0].update(Id='sha256:'+'a'*64),
          'wrong-digest':lambda f,mem:f['worker-ecr-image.json']['imageDetails'][0].update(imageDigest='sha256:'+'a'*64),
          'wrong-repo':lambda f,mem:f['worker-ecr-image.json']['imageDetails'][0].update(repositoryName='current-Meri'),
          'wrong-registry':lambda f,mem:f['worker-ecr-image.json']['imageDetails'][0].update(registryId='000000000000'),
          'changed-inventory':lambda f,mem:mem.files.update({'worker-extracted\\image-inventory.json':raw+b' '}),
          'not-removed':lambda f,mem:mem.files.update({'worker-container-removal-readback.txt':cid.encode()}),
          'copy-mismatch':lambda f,mem:f['worker-copy-validation.json'].update(payloadSha256='a'*64)}
        for case,change in changes.items():
            with self.subTest(case=case):
                memory=Memory();contents=copy.deepcopy(files)
                memory.files.update({'worker-image-id.txt':(iid+'\n').encode(),'worker-container-removed.txt':(cid+'\n').encode(),'worker-container-removal-readback.txt':b'',
                  str(memory.Path('worker-extracted/image-inventory.json')):raw})
                change(contents,memory)
                with patch.object(pathlib,'Path',memory.Path),patch('builtins.open',side_effect=lambda path,*a,**k:io.StringIO(json.dumps(contents[path]))),patch.dict('os.environ',environment):
                    if case=='good':
                        exec(compile(PYTHON_BLOCKS[3],'actual-result-binding','exec'),{})
                        result=json.loads(memory.files['worker-manifest.json'])
                        self.assertEqual(result['imageUri'],m.REPOSITORY_URI+'@'+digest)
                        self.assertEqual(result['inventory'],inv)
                        self.assertEqual(result['securityDisposition'],'NOT_GRANTED')
                        self.assertEqual(result['builderIdentities']['preflight'],contents['worker-builder-identity.json'])
                        self.assertEqual(result['builderIdentities']['beforeEcrPush'],contents['worker-push-identity.json'])
                    else:
                        with self.assertRaises(AssertionError):exec(compile(PYTHON_BLOCKS[3],'actual-result-binding','exec'),{})

    def test_actual_upload_receipt_checksum_version_kms(self):
        m=subject();payload=b'reviewed result'
        receipt=dict(VersionId='version-2',ChecksumSHA256=base64.b64encode(hashlib.sha256(payload).digest()).decode(),ServerSideEncryption='aws:kms',SSEKMSKeyId=m.KMS)
        for case in ('good','no-version','wrong-checksum','wrong-encryption','wrong-key'):
            with self.subTest(case=case):
                value=copy.deepcopy(receipt)
                if case=='no-version':value['VersionId']='null'
                if case=='wrong-checksum':value['ChecksumSHA256']='wrong'
                if case=='wrong-encryption':value['ServerSideEncryption']='AES256'
                if case=='wrong-key':value['SSEKMSKeyId']='current-key'
                def opened(path,*a,**k):return io.BytesIO(payload) if path=='worker-manifest.json' else io.StringIO(json.dumps(value))
                with patch('builtins.open',side_effect=opened):
                    if case=='good':exec(compile(PYTHON_BLOCKS[4],'actual-upload-receipt','exec'),{})
                    else:
                        with self.assertRaises(AssertionError):exec(compile(PYTHON_BLOCKS[4],'actual-upload-receipt','exec'),{})

    def test_prospective_source_contract_is_hash_bound_and_rejected_inventory_blocked(self):
        m=subject();memory=Memory();m.Path=memory.Path;m.ROOT=memory.Path(m.ROOT)
        memory.files[str(m.ROOT/m.BUILDSPEC)]=SPEC_BYTES
        contract=m.inventory_contract()
        source='\n'.join(k+'='+repr(v) for k,v in {'SCHEMA':contract['schema'],'OUTPUT_PATH':contract['outputPath'],'REQUIRED_ROOTS':tuple(contract['roots']),'ROOT_ALIASES':contract['aliases'],'PINNED_FILES':contract['pins']}.items())
        paths=[m.DOCKERFILE,m.INVENTORY_SOURCE]
        def fake_git(*args,**kwargs):
            if args[0]=='ls-tree':return '\n'.join(paths)
            if args[0]=='show':return source
            self.fail('Unexpected read')
        def record(commit,path):return dict(path=path,bytes=1,sha256=m.BUILDER_INFRA_SHA256 if path==m.BUILDER_INFRA else 'a'*64)
        with patch.object(m,'git',side_effect=fake_git),patch.object(m,'source_record',side_effect=record):
            result=m.expected_content('a'*40)
            self.assertEqual(result['inventoryContract'],contract)
            self.assertEqual(result['buildspec']['sha256'],m.sha(SPEC_BYTES))
        def rejected(commit,path):
            value=record(commit,path)
            if path==m.INVENTORY_SOURCE:value['sha256']=m.REJECTED_INVENTORY_SHA256
            return value
        with patch.object(m,'git',side_effect=fake_git),patch.object(m,'source_record',side_effect=rejected):
            with self.assertRaisesRegex(ValueError,'Known rejected'):m.expected_content('a'*40)
        wrong_source=source.replace('meri.qualification.image-inventory/1','other-schema')
        with patch.object(m,'git',side_effect=lambda *a,**k:'\n'.join(paths) if a[0]=='ls-tree' else wrong_source),patch.object(m,'source_record',side_effect=record):
            with self.assertRaisesRegex(ValueError,'compiled contract changed'):m.expected_content('a'*40)

    def test_dispatch_deadline_blocks_all_aws(self):
        t=Transaction();times=iter([0,1201])
        with patch.object(t.module.time,'monotonic',side_effect=lambda:next(times)):
            with self.assertRaises(ValueError):t.execute()
        self.assertEqual(t.calls,[])

    def test_exact_worker_override_and_run_binding(self):
        t=Transaction();t.execute()
        start=json.loads(t.memory.files[str(t.evidence/'start-build-input.json')])
        self.assertEqual(start['timeoutInMinutesOverride'],15)
        self.assertEqual(start['queuedTimeoutInMinutesOverride'],5)
        env={v['name']:v['value'] for v in start['environmentVariablesOverride']}
        self.assertEqual(env['BUILD_RUN_UUID'],t.request['idempotencyToken'])
        self.assertEqual(env['RESULT_KEY'],t.request['resultKey'])
        self.assertEqual(env['WORKER_BUILDSPEC_SHA256'],t.module.sha(SPEC_BYTES))
        self.assertIn(env['BUILD_RUN_UUID'],t.request['imageTag'])

    def test_reviewed_project_evidence_cannot_drift(self):
        t = Transaction()
        t.memory.files[str(t.module.PROJECT_EVIDENCE)] += b' '
        with self.assertRaises(ValueError):
            t.module.reviewed_builder()
        self.assertEqual(t.calls, [])

    def test_actual_archive_validator_rejects_context_and_private_drift(self):
        m=subject()
        data={p:('reviewed-'+p).encode() for p in [m.DOCKERFILE,m.INVENTORY_SOURCE,m.BUILDER_INFRA]}
        record=lambda p:dict(path=p,bytes=len(data[p]),sha256=m.sha(data[p]))
        content=dict(sourceFiles=[record(m.DOCKERFILE),record(m.INVENTORY_SOURCE)],builderAuthority=record(m.BUILDER_INFRA))
        def archive(case):
            stream=io.BytesIO()
            with zipfile.ZipFile(stream,'w') as out:
                for name,value in data.items():
                    if case=='missing' and name==m.INVENTORY_SOURCE:continue
                    entry=zipfile.ZipInfo(name)
                    entry.external_attr=((stat.S_IFLNK if case=='symlink' and name==m.INVENTORY_SOURCE else stat.S_IFREG)|0o644)<<16
                    out.writestr(entry,value+b'changed' if case=='changed' and name==m.BUILDER_INFRA else value)
                if case=='duplicate':out.writestr(m.DOCKERFILE,data[m.DOCKERFILE])
                if case=='private':out.writestr('docs/coordination/private-evidence/secret',b'synthetic')
                if case=='traversal':out.writestr('../outside',b'synthetic')
                if case=='extra-context':out.writestr(m.CONTEXT+'/unreviewed',b'synthetic')
            return stream.getvalue()
        for case in ('good','missing','changed','symlink','duplicate','private','traversal','extra-context'):
            with self.subTest(case=case),patch.object(m,'git',return_value=archive(case)):
                if case=='good':self.assertEqual(m.archive_bytes('a'*40,content)[1],3)
                else:
                    with self.assertRaises(ValueError):m.archive_bytes('a'*40,content)

    def test_inventory_constants_are_parsed_without_execution(self):
        m=subject();contract=m.inventory_contract()
        source='\n'.join(k+'='+repr(v) for k,v in {'SCHEMA':contract['schema'],'OUTPUT_PATH':contract['outputPath'],'REQUIRED_ROOTS':tuple(contract['roots']),'ROOT_ALIASES':contract['aliases'],'PINNED_FILES':contract['pins']}.items())
        source+='\nMALICIOUS=__import__("os").system("never execute")'
        values=m.literal_constants(source)
        self.assertEqual(values['PINNED_FILES'],contract['pins'])
        self.assertNotIn('MALICIOUS',values)



if __name__ == '__main__':
    unittest.main(verbosity=2)
