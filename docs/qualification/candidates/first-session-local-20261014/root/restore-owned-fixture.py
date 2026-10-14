"""Restore only the unchanged approved fixture started by this task to its prior stopped state."""
import json,subprocess
from pathlib import Path
import psycopg
root=Path(__file__).resolve().parent
before=json.loads((root/'fixture-before-snapshot.json').read_text())
after=json.loads((root/'fixture-after-snapshot.json').read_text())
assert before==after,'Protected fixture schema/data changed; stop restoration held'
engine=json.loads(Path('/workspace/cloud-onboarding/meri-native/engine.json').read_text())
assert engine=={'host':'127.0.0.1','port':55432,'database':'meri_qualification_test','user':'qualification_owner'}
engine['dbname']=engine.pop('database')
docker=['docker','--host=unix:///var/run/docker.sock']
expected=Path('/workspace/cloud-onboarding/meri-native/image-id').read_text().strip()
assert expected=='sha256:f1447071e6c8449dcf4056aa0994c81d3566ce5ee232de36b04dc25696a116dd'
def inspect():
 return subprocess.check_output(docker+['inspect','meri-native-postgres','--format','{{.Image}} {{index .Config.Labels "purpose"}} {{.State.Running}}'],text=True).strip()
assert inspect()==expected+' meri-native-tests true'
with psycopg.connect(**engine,connect_timeout=3) as conn:
 conn.execute('SET TRANSACTION READ ONLY')
 assert conn.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'").fetchone()[0]==0,'Another client joined; borrowed fixture stop held'
subprocess.run(docker+['stop','--time','5','meri-native-postgres'],check=True,stdout=subprocess.DEVNULL,timeout=15)
assert inspect()==expected+' meri-native-tests false'
print(json.dumps({'scope':'OWNED_EXISTING_FIXTURE_LIFECYCLE_ONLY','snapshotsEqual':True,'otherClientSessionsBeforeStop':0,'priorState':'stopped','restoredState':'stopped','container':'meri-native-postgres','image':expected,'purpose':'meri-native-tests'}))
