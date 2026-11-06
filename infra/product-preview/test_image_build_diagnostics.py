"""Closed shell behavior tests. Every AWS/Docker invocation resolves to a fixture executable."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / 'infra/product-preview/image-build.sh'
BASH = shutil.which('bash') if os.name != 'nt' else r'C:/Program Files/Git/bin/bash.exe'
COMMIT = 'a' * 40
DIGEST = 'sha256:' + 'b' * 64
IMAGE_ID = 'sha256:' + 'e' * 64
REPO = '967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker'


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8', newline='\n')
    path.chmod(0o755 if path.parent.name == 'bin' else 0o644)


def docker_fixture(args):
    """Closed Docker boundary, retaining actual argument-derived ownership/sandbox state."""
    root=Path(os.environ['FIXTURE']); scenario=os.environ['SCENARIO']
    state_path=root/'docker-state.json'
    state=json.loads(state_path.read_text()) if state_path.exists() else {'containers':{},'volumes':{}}
    def save(): state_path.write_text(json.dumps(state))
    def options(values, flags=()):
        parsed={}; index=0
        while index<len(values) and values[index].startswith('-'):
            key=values[index]; index+=1
            if key in flags: value=True
            else:
                assert key in ['--name','--label','--platform','--user','--network','--cap-drop','--security-opt',
                               '--pids-limit','--cpus','--memory','--tmpfs','--mount','--entrypoint']
                assert index<len(values); value=values[index]; index+=1
            parsed.setdefault(key,[]).append(value)
        return parsed,values[index:]
    def one(opts,key):
        assert len(opts.get(key,[]))==1, key
        return opts[key][0]
    def container(identity):
        rows=[v for name,v in state['containers'].items() if identity in [name,v['Id']]]
        assert len(rows)==1, 'unknown container'
        return rows[0]
    if args[:3]==['ps','-aq','--filter'] and len(args)==4:
        query=args[3]
        assert query.startswith('id=') or (query.startswith('name=^/') and query.endswith('$'))
        if scenario=='foreign-container': print('synthetic-foreign-container')
        elif (root/'container').exists(): print('synthetic-probe-container')
        for name,value in state['containers'].items():
            if query in ['id='+value['Id'],'name=^/'+name+'$']: print(value['Id'])
    elif args[:2]==['images','-q'] and len(args)==3:
        if scenario=='foreign-image' or (root/'image').exists(): print(IMAGE_ID)
    elif args and args[0]=='build':
        assert args.count('--iidfile')==1 and args[-1]=='.'
        (root/'image').touch()
        if scenario=='build-failure':
            print('private-fixture-error',file=sys.stderr); return 13
        iid=Path(args[args.index('--iidfile')+1]); assert iid==root/'image-evidence/image.id'
        iid.write_text(('sha256:'+'f'*64 if scenario=='wrong-iid' else IMAGE_ID)+'\n')
    elif args[:2]==['image','inspect'] and len(args)==3:
        assert (root/'image').exists(); print((root/'inspect.json').read_text())
    elif args and args[0]=='run':
        opts,command=options(args[1:],['--rm','--read-only'])
        assert command and one(opts,'--name').startswith('meri-image-')
        (root/'container').touch()
        if scenario=='probe-failure' and 'apps/runtime/build/runtime-base-probe.mjs' in command:
            print('private-fixture-error',file=sys.stderr); return 12
        if scenario=='ca-failure' and any('rds-global-bundle.lock.json' in v for v in command): return 12
        (root/'container').unlink()
    elif args[:3]==['volume','ls','-q'] and len(args)==5 and args[3]=='--filter':
        query=args[4]; assert query.startswith('name=^') and query.endswith('$')
        name=query[len('name=^'):-1]
        if name in state['volumes'] or scenario=='foreign-init-volume': print(name)
    elif args[:2]==['volume','create']:
        opts,rest=options(args[2:]); assert len(rest)==1 and rest[0] not in state['volumes']
        labels=dict(label.split('=',1) for label in opts['--label'])
        state['volumes'][rest[0]]={'Name':rest[0],'Labels':labels}; save(); print(rest[0])
    elif args[:2]==['volume','inspect'] and len(args)==3:
        assert args[2] in state['volumes']; print(json.dumps([state['volumes'][args[2]]]))
    elif args and args[0]=='create':
        opts,command=options(args[1:],['--read-only']); name=one(opts,'--name')
        assert name not in state['containers']
        assert len(command)==3 and command[:2]==[IMAGE_ID,'apps/runtime/build/material-init-image-probe.mjs']
        assert command[2] in ['control','temporal-worker','schedule-worker']
        mount=dict(part.split('=',1) for part in one(opts,'--mount').split(','))
        assert mount['type']=='volume' and mount['source'] in state['volumes']
        labels=dict(label.split('=',1) for label in opts['--label'])
        row={'Id':hashlib.sha256(name.encode()).hexdigest(),'Name':'/'+name,'Image':command[0],
             'Config':{'Labels':labels,'User':one(opts,'--user')},
             'HostConfig':{'ReadonlyRootfs':opts.get('--read-only')==[True],'NetworkMode':one(opts,'--network'),
                           'Privileged':False,'CapDrop':opts['--cap-drop'],
                           'Tmpfs':dict(value.split(':',1) for value in opts['--tmpfs'])},
             'Mounts':[{'Type':mount['type'],'Name':mount['source'],'Destination':mount['destination']}],
             'State':{'Status':'created'}}
        if scenario=='wrong-init-owner': row['Config']['Labels']['meri.init.invocation']='foreign'
        state['containers'][name]=row; save(); print(row['Id'])
    elif args and args[0]=='inspect' and len(args)==2:
        print(json.dumps([container(args[1])]))
    elif args[:2]==['start','-a'] and len(args)==3:
        row=container(args[2]); assert row['State']['Status']=='created'
        row['State']['Status']='exited'; save()
        if scenario=='init-start-failure': return 17
    elif args[:2]==['rm','-f'] and len(args)==3:
        if scenario in ['cleanup-failure','init-cleanup-failure']: return 15
        if args[2].startswith('meri-image-'): (root/'container').unlink(missing_ok=True)
        else:
            row=container(args[2]); del state['containers'][row['Name'][1:]]; save()
    elif args[:2]==['volume','rm'] and len(args)==3:
        assert args[2] in state['volumes']
        assert not any(m['Name']==args[2] for c in state['containers'].values() for m in c['Mounts'])
        del state['volumes'][args[2]]; save()
    elif args[:2]==['image','rm'] and len(args)==3:
        if scenario=='cleanup-failure': return 15
        (root/'image').unlink(missing_ok=True)
    elif args[:4]==['login','--username','AWS','--password-stdin'] and len(args)==5:
        assert sys.stdin.readline().strip()=='synthetic-password'
    elif args and args[0]=='push' and len(args)==2:
        if scenario=='push-failure': return 14
    else:
        print('UNEXPECTED_DOCKER_CALL',file=sys.stderr); return 99
    return 0


@contextlib.contextmanager
def build_fixture(scenario='ok', overrides=None):
    with tempfile.TemporaryDirectory(prefix='meri-build-test-') as temp:
        root = Path(temp)
        source, stubs = root/'source', root/'bin'
        source.mkdir(); stubs.mkdir()
        paths = ['infra/product-preview/image-build.sh', 'infra/product-preview/image-build-source.py',
                 'infra/product-preview/runtime-packages.lock.json', 'apps/runtime/certs/rds-global-bundle.pem',
                 'apps/runtime/certs/rds-global-bundle.lock.json']
        rows = []
        for name in paths:
            payload = (ROOT/name).read_bytes()
            if name.endswith('runtime-packages.lock.json') and scenario == 'wrong-runtime-base':
                lock = json.loads(payload)
                lock['runtimeImageUri'] = 'cgrXdev/chainguard/wolfi-base@sha256:' + 'a' * 64
                payload = json.dumps(lock).encode()
            target = source/name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload); target.chmod(0o644)
            rows.append(dict(path=name, bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest(), mode='100644'))
        manifest = json.dumps(dict(contract='meri.source-members.v1', sourceCommit=COMMIT, files=sorted(rows, key=lambda x:x['path']))).encode()
        (root/'manifest.json').write_bytes(manifest)
        inspect = [dict(Id=IMAGE_ID, Os='linux', Architecture='arm64', Size=1024, RepoDigests=[REPO+'@'+DIGEST],
                        Config=dict(User='1000:1000', Entrypoint=['node'], Cmd=['apps/runtime/agentcore-entrypoint.mjs'],
                                    Labels={'org.opencontainers.image.revision':COMMIT},
                                    Env=['NODE_EXTRA_CA_CERTS=/opt/meri/certs/rds-global-bundle.pem']))]
        if scenario == 'wrong-image': inspect[0]['Architecture']='amd64'
        if scenario == 'old-entrypoint': inspect[0]['Config']['Entrypoint']=['node','apps/runtime/cli.mjs']
        if scenario == 'wrong-command': inspect[0]['Config']['Cmd']=['apps/runtime/cli.mjs']
        if scenario == 'wrong-digest': inspect[0]['RepoDigests']=[REPO+'@sha256:'+'c'*64]
        (root/'inspect.json').write_text(json.dumps(inspect))
        scan = dict(repositoryName='meri-greenfield/qualification-worker', imageId=dict(imageDigest=DIGEST),
                    imageScanStatus=dict(status='COMPLETE'), imageScanFindings=dict(findingSeverityCounts={'LOW':2}))
        if scenario=='high': scan['imageScanFindings']['findingSeverityCounts']['HIGH']=1
        if scenario=='critical': scan['imageScanFindings']['findingSeverityCounts']['CRITICAL']=1
        if scenario=='bad-count': scan['imageScanFindings']['findingSeverityCounts']['LOW']=True
        if scenario=='wrong-scan': scan['imageId']['imageDigest']='sha256:'+'c'*64
        if scenario=='incomplete': scan['imageScanStatus']['status']='IN_PROGRESS'
        (root/'scan.json').write_text(json.dumps(scan))
        write(stubs/'uname', '#!/usr/bin/env bash\nif [[ $1 == -s ]]; then echo Linux; else echo aarch64; fi\n')
        write(stubs/'python3', '#!/usr/bin/env bash\nexec "$TEST_PYTHON" "$@"\n')
        # No real timeout command is invoked in the simulated timeout case. Other commands
        # use GNU timeout normally; the Python parent independently bounds each full fixture.
        write(stubs/'timeout', '''#!/usr/bin/env bash
if [[ $SCENARIO == timeout && "$*" == *'docker build '* ]]; then exit 124; fi
exec "$TEST_TIMEOUT" "$@"
''')
        record = '''printf '%s\\n' "BEGIN $0" "$@" END >> "$FIXTURE/calls"
'''
        write(stubs/'aws', '#!/usr/bin/env bash\nset -eu\n'+record+'''case "$*" in
 *'s3api head-object'*)
  if [[ $SCENARIO == oversized ]]; then echo '{"VersionId":"manifest-v1","ContentLength":999999999}';
  else printf '{"VersionId":"manifest-v1","ContentLength":%s}\\n' "$(wc -c < "$FIXTURE/manifest.json")"; fi;;
 *'s3api get-object'*)
  args=("$@"); for ((i=0;i<$#;i++)); do if [[ ${args[i]} == --version-id ]]; then cp "$FIXTURE/manifest.json" "${args[i+2]}"; fi; done
  echo '{"VersionId":"manifest-v1"}';;
 *'ecr describe-repositories'*)
  mutable=IMMUTABLE; [[ $SCENARIO != mutable ]] || mutable=MUTABLE
  printf '{"repositories":[{"repositoryUri":"%s","imageTagMutability":"%s","imageScanningConfiguration":{"scanOnPush":true}}]}\\n' "$TEST_REPO" "$mutable";;
 *'ecr get-login-password'*) echo synthetic-password;;
 *'ecr describe-images'*) printf '{"imageDetails":[{"imageTags":["%s"],"imageDigest":"%s"}]}\\n' "$IMAGE_TAG" "$TEST_DIGEST";;
 *'ecr wait image-scan-complete'*)
  [[ -n $AWS_DATA_PATH && $AWS_DATA_PATH == */models ]] || exit 99
  cp "$AWS_DATA_PATH/ecr/2015-09-21/waiters-2.json" "$FIXTURE/waiter.json"
  case $SCENARIO in scan-not-found|scan-failed|scan-timeout|scan-unknown) echo 'private-fixture-error' >&2; exit 254;; esac;;
 *'ecr describe-image-scan-findings'*) cat "$FIXTURE/scan.json";;
 *) echo UNEXPECTED_AWS_CALL >&2; exit 99;;
esac
''')
        write(stubs/'docker', '#!/usr/bin/env bash\nset -eu\n'+record+
              'exec "$TEST_PYTHON" -I -B -S "$TEST_FIXTURE_MODULE" --docker-fixture "$@"\n')
        env = {**os.environ, 'SCENARIO':scenario, 'FIXTURE':root.as_posix(), 'TEST_PYTHON':sys.executable.replace('\\','/'),
               'TEST_FIXTURE_MODULE':Path(__file__).resolve().as_posix(),
               'TEST_REPO':REPO, 'TEST_DIGEST':DIGEST, 'SOURCE_COMMIT':COMMIT, 'SOURCE_VERSION':'source-v1',
               'CODEBUILD_SOURCE_VERSION':'source-v1', 'SOURCE_MANIFEST_KEY':'inputs/members.json',
               'SOURCE_MANIFEST_VERSION':'manifest-v1', 'SOURCE_MANIFEST_SHA256':hashlib.sha256(manifest).hexdigest(),
               'IMAGE_TAG':'product-'+COMMIT+'-'+'d'*32}
        env.update(overrides or {})
        if scenario=='foreign-evidence':
            (root/'image-evidence').mkdir(); (root/'image-evidence/foreign').write_text('keep')
        if scenario=='source-changed': (source/paths[0]).write_bytes((source/paths[0]).read_bytes()+b'\n# changed\n')
        # Resolve the real timeout before prepending stubs, then prove every external boundary
        # resolves to our closed fixture. No default cloud/Docker client can be reached.
        command = 'export TEST_TIMEOUT=$(command -v timeout); export PATH="$FIXTURE/bin:$PATH"; [[ $(command -v aws) == "$FIXTURE/bin/aws" && $(command -v docker) == "$FIXTURE/bin/docker" ]] || exit 98; export CODEBUILD_SRC_DIR="$PWD"; exec bash infra/product-preview/image-build.sh'
        # Git Bash represents C:/ paths differently in command -v; use cygpath in this local fixture.
        if os.name=='nt': command='export FIXTURE=$(cygpath -u "$FIXTURE"); ulimit() { return 0; }; export -f ulimit; '+command
        result=subprocess.run([BASH,'-c',command],cwd=source,env=env,capture_output=True,text=True,timeout=45)
        yield root, result


class BuildFailures(unittest.TestCase):
    def test_success_cleanup_and_no_credentials_in_public_output(self):
        with build_fixture() as (root,result):
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            receipt=json.loads((root/'source/image-evidence/result.json').read_text())
            self.assertEqual(receipt['imageDigest'],DIGEST)
            self.assertEqual(json.loads((root/'source/image-evidence/cleanup.json').read_text()),dict(exitCode=0,cleanupFailed=0))
            self.assertFalse((root/'image').exists()); self.assertFalse((root/'container').exists())
            state=json.loads((root/'docker-state.json').read_text())
            self.assertEqual(state,{'containers':{},'volumes':{}})
            for role in ['control','temporal-worker','schedule-worker']:
                cleanup=json.loads((root/f'source/image-evidence/init-{role}-cleanup-result.json').read_text())
                self.assertEqual(cleanup['cleanupStatus'],0)
                self.assertEqual(cleanup['containerOwned'],0); self.assertEqual(cleanup['volumeOwned'],0)
            self.assertNotIn('synthetic-password',(root/'calls').read_text())
            self.assertEqual(result.stdout+result.stderr,'')
            unknown=subprocess.run([sys.executable,'-I','-B','-S',str(Path(__file__).resolve()),'--docker-fixture','unexpected'],
                env={**os.environ,'FIXTURE':str(root),'SCENARIO':'ok'},capture_output=True,text=True,timeout=10)
            self.assertEqual(unknown.returncode,99); self.assertEqual(unknown.stderr.strip(),'UNEXPECTED_DOCKER_CALL')

    def test_failure_and_timeout_preserve_nonzero_and_clean_owned_resources(self):
        for scenario in ['build-failure','probe-failure','ca-failure','push-failure','timeout','cleanup-failure']:
            with self.subTest(scenario=scenario), build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                self.assertTrue((root/'source/image-evidence/cleanup.json').exists(),result.stderr)
                self.assertFalse((root/'source/image-evidence/result.json').exists())
                self.assertNotIn('private-fixture-error',result.stdout+result.stderr)
                cleanup=json.loads((root/'source/image-evidence/cleanup.json').read_text())
                self.assertEqual(cleanup['cleanupFailed'],int(scenario=='cleanup-failure'))
                if scenario!='cleanup-failure': self.assertFalse((root/'image').exists())
                if scenario in ['build-failure','probe-failure','ca-failure','timeout']:
                    self.assertNotIn('get-login-password',(root/'calls').read_text())

    def test_existing_resources_are_never_removed(self):
        for scenario in ['foreign-image','foreign-container']:
            with self.subTest(scenario=scenario), build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                calls=(root/'calls').read_text()
                self.assertNotIn('\nrm\n',calls); self.assertNotIn('\nbuild\n',calls)

    def test_source_and_size_refusals_precede_docker_and_auth(self):
        for scenario in ['oversized','source-changed']:
            with self.subTest(scenario=scenario), build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                calls=(root/'calls').read_text()
                self.assertNotIn('/docker',calls)
                if scenario=='oversized': self.assertNotIn('get-object',calls)

    def test_wrong_image_and_mutable_repository_precede_auth(self):
        for scenario in ['wrong-image','old-entrypoint','wrong-command','wrong-iid','mutable']:
            with self.subTest(scenario=scenario), build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                self.assertNotIn('get-login-password',(root/'calls').read_text())

    def test_init_probe_failures_preserve_ownership_and_refuse_publication(self):
        for scenario in ['foreign-init-volume','wrong-init-owner','init-start-failure','init-cleanup-failure']:
            with self.subTest(scenario=scenario), build_fixture(scenario) as (root,result):
                self.assertNotEqual(result.returncode,0)
                calls=(root/'calls').read_text()
                self.assertNotIn('get-login-password',calls); self.assertNotIn('\npush\n',calls)
                self.assertFalse((root/'source/image-evidence/result.json').exists())
                if scenario=='foreign-init-volume':
                    self.assertNotIn('\ncreate\n',calls); self.assertNotIn('\nvolume\nrm\n',calls)
                elif scenario=='wrong-init-owner':
                    self.assertNotIn('\nstart\n',calls); self.assertNotIn('\nvolume\nrm\n',calls)
                elif scenario=='init-start-failure':
                    self.assertEqual(json.loads((root/'docker-state.json').read_text()),{'containers':{},'volumes':{}})
                else:
                    state=json.loads((root/'docker-state.json').read_text())
                    self.assertEqual(len(state['containers']),1); self.assertEqual(len(state['volumes']),1)
                    self.assertNotIn('\nvolume\nrm\n',calls)

    def test_preexisting_evidence_is_not_moved_or_removed(self):
        with build_fixture('foreign-evidence') as (root,result):
            self.assertEqual(result.returncode,2)
            self.assertEqual((root/'image-evidence/foreign').read_text(),'keep')
            self.assertFalse((root/'source/image-evidence').exists())
            self.assertFalse((root/'calls').exists())

    def test_source_version_mismatch_refuses_before_external_commands(self):
        with build_fixture(overrides={'CODEBUILD_SOURCE_VERSION':'different'}) as (root,result):
            self.assertEqual(result.returncode,2)
            self.assertFalse((root/'calls').exists())

    def test_wrong_runtime_registry_refuses_before_docker_or_auth(self):
        with build_fixture('wrong-runtime-base') as (root,result):
            self.assertNotEqual(result.returncode,0)
            calls=(root/'calls').read_text()
            self.assertNotIn('/docker',calls)
            self.assertNotIn('get-login-password',calls)
            self.assertFalse((root/'source/image-evidence/result.json').exists())


if __name__ == '__main__':
    if sys.argv[1:2]==['--docker-fixture']: sys.exit(docker_fixture(sys.argv[2:]))
    unittest.main()
