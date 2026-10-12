"""Bounded metadata-only inspection. Does not execute a target or open a socket."""
from pathlib import Path
import datetime, hashlib, importlib.metadata, json, os, platform, shutil, stat, sys, time
START = time.monotonic()
MAX_SECONDS = 20

def check_time():
    if time.monotonic() - START >= MAX_SECONDS:
        raise RuntimeError('metadata inspection deadline')

def identity(path, hash_cap=32 * 1024 * 1024):
    check_time(); p = Path(path)
    try:
        st = p.lstat(); result = {'path': str(p), 'exists': True, 'mode': st.st_mode, 'uid': st.st_uid, 'gid': st.st_gid, 'size': st.st_size, 'symlink': stat.S_ISLNK(st.st_mode), 'socket': stat.S_ISSOCK(st.st_mode)}
        if p.is_file():
            resolved = p.resolve(); result['resolvedPath'] = str(resolved); before = resolved.stat()
            if before.st_size <= hash_cap:
                digest = hashlib.sha256()
                with resolved.open('rb') as f:
                    while data := f.read(65536):
                        check_time(); digest.update(data)
                    after = os.fstat(f.fileno())
                result['sha256'] = digest.hexdigest(); result['stableMetadataDuringRead'] = (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
            else:
                result['hashStatus'] = 'not hashed: exceeds bounded metadata-inspection cap'
        return result
    except FileNotFoundError:
        return {'path': str(p), 'exists': False}
    except OSError as error:
        return {'path': str(p), 'observation': 'UNKNOWN', 'errorType': type(error).__name__}

result = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'READ_ONLY_METADATA_NOT_NATIVE_ADMISSION', 'targetExecutions': 0, 'databaseConnections': 0, 'socketConnections': 0, 'mutations': 0}
result['host'] = {'os': platform.system(), 'release': platform.release(), 'machine': platform.machine(), 'uid': os.getuid(), 'gid': os.getgid(), 'pythonVersion': platform.python_version(), 'pythonExecutable': identity(sys.executable)}
result['osRelease'] = {k: v.strip('"') for line in Path('/etc/os-release').read_text().splitlines() if '=' in line for k, v in [line.split('=', 1)] if k in {'ID', 'VERSION_ID', 'PRETTY_NAME'}}
result['commands'] = {}
for name in ['postgres','initdb','pg_ctl','psql','pg_config','docker','podman','containerd','ctr','nerdctl','bwrap','unshare','nsenter','systemd-run','firejail','node']:
    candidate = shutil.which(name)
    result['commands'][name] = identity(candidate) if candidate else {'onPath': False}
result['knownServerLocations'] = [identity(p) for p in ['/usr/lib/postgresql','/usr/local/pgsql/bin','/opt/postgresql','/usr/local/bin/postgres','/usr/bin/postgres']]
pg = Path('/usr/lib/postgresql')
if pg.is_dir():
    result['versionedServerCandidates'] = [identity(version/'bin'/name) for version in sorted(pg.iterdir())[:10] if version.is_dir() for name in ['postgres','initdb','pg_ctl']]
result['daemonEndpoints'] = [identity(p) for p in ['/var/run/docker.sock','/run/docker.sock','/run/podman/podman.sock','/run/containerd/containerd.sock']]
result['ambientEndpointVariablesPresent'] = {k: k in os.environ for k in ['DOCKER_HOST','CONTAINER_HOST','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSERVICE','PGPASSFILE']}
result['pythonDistributions'] = {}
for name in ['psycopg','psycopg-binary','psycopg2','psycopg2-binary','httpx']:
    try: result['pythonDistributions'][name] = {'version': importlib.metadata.version(name)}
    except importlib.metadata.PackageNotFoundError: result['pythonDistributions'][name] = {'installedMetadata': False}
result['relevantDpkgPackages'] = []
status = Path('/var/lib/dpkg/status')
if status.exists():
    for paragraph in status.read_text().split('\n\n'):
        fields = dict(line.split(': ',1) for line in paragraph.splitlines() if ': ' in line and not line.startswith(' '))
        name = fields.get('Package','')
        if name.startswith(('postgresql','libpq','docker','podman','containerd','bubblewrap','uidmap')):
            result['relevantDpkgPackages'].append({k:fields.get(k) for k in ['Package','Version','Architecture','Status']})
cache = Path('/var/cache/apt/archives')
result['cachedRelevantDebs'] = [identity(p, hash_cap=0) for p in sorted(cache.glob('*.deb'))[:500] if p.name.startswith(('postgresql','libpq','docker','podman','containerd','bubblewrap'))] if cache.is_dir() else []
result['matchingProcessNamesOnly'] = []
for p in sorted(Path('/proc').iterdir())[:10000]:
    check_time()
    if p.name.isdigit():
        try:
            name = (p/'comm').read_text().strip()
            if name in {'postgres','postmaster','dockerd','containerd','podman','conmon'}: result['matchingProcessNamesOnly'].append({'pid': int(p.name),'comm':name})
        except OSError: pass
status = Path('/proc/self/status').read_text()
result['selfSecurityMetadata'] = {k:v.strip() for line in status.splitlines() if ':' in line for k,v in [line.split(':',1)] if k in {'CapEff','CapBnd','NoNewPrivs','Seccomp','Seccomp_filters'}}
result['namespaceMembershipMetadataOnly'] = {}
for kind in ['user','pid','mnt','net']:
    try: result['namespaceMembershipMetadataOnly'][kind] = os.readlink('/proc/self/ns/'+kind)
    except OSError as error: result['namespaceMembershipMetadataOnly'][kind] = type(error).__name__
result['containerMarkerPresent'] = Path('/.dockerenv').exists()
result['limitations'] = ['PATH/standard-location/package metadata absence does not exhaust arbitrary host paths.', 'Package metadata/hash is not distributor trust or supported closure.', 'Namespace/capability/process metadata does not prove containment or absence of untrusted local peers.', 'No database connection, target version command, namespace creation, daemon API, image inspection or service mutation performed.']
result['durationSeconds'] = round(time.monotonic()-START,6)
print(json.dumps(result,indent=2))
