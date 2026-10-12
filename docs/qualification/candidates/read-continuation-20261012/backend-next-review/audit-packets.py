"""Independent Git-only accepted-packet correspondence; never executes packets."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
PREFIX = 'docs/qualification/candidates/read-continuation-20261012/backend-next-integration/'

def git_blob(ref, path):
    return subprocess.check_output(['git','show',ref+':'+path],cwd=ROOT,timeout=30)

def main(candidate):
    checks=[]
    packets=[]
    def record(label, passed):
        checks.append({'check':label,'pass':bool(passed)})
    pins=json.loads(git_blob(candidate,PREFIX+'packet-pins.json'))
    for pin in pins['packets']:
        ref,path=pin['reference'],pin['manifest']
        original=git_blob(ref,path)
        record('exact manifest '+path,git_blob(candidate,path)==original)
        manifest=json.loads(original)
        members=next(manifest[k] for k in ('entries','members','files') if k in manifest)
        record('nonempty unique membership '+path,bool(members) and len({x['path'] for x in members})==len(members))
        for member in members:
            source=git_blob(ref,member['path'])
            record('source hash and bytes '+member['path'],hashlib.sha256(source).hexdigest()==member['sha256'] and ('bytes' not in member or len(source)==member['bytes']))
            record('exact integrated bytes '+member['path'],git_blob(candidate,member['path'])==source)
        packets.append({'reference':ref,'manifest':path,'members':len(members),'sha256':hashlib.sha256(original).hexdigest()})
    for member in pins.get('additionalCode',[]):
        record('exact frozen additional code '+member['path'],git_blob(candidate,member['path'])==git_blob(member['reference'],member['path']))
    result={'candidate':candidate,'packets':packets,'passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks,'limits':'Hash correspondence and declared packet membership only; no source/native/runtime acceptance follows from manifest integrity alone.'}
    print(json.dumps(result,indent=2))
    return bool(result['failed'])

if __name__=='__main__':
    raise SystemExit(main(sys.argv[1]))
