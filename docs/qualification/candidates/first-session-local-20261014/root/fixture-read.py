import hashlib,json,sys
from pathlib import Path
import psycopg
c=json.loads(Path('/workspace/cloud-onboarding/meri-native/engine.json').read_text())
assert c=={'host':'127.0.0.1','port':55432,'database':'meri_qualification_test','user':'qualification_owner'}
c['dbname']=c.pop('database')
with psycopg.connect(**c,connect_timeout=3) as conn:
 conn.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
 schemas=conn.execute("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'meri%' ORDER BY nspname").fetchall()
 assert schemas==[('meri_qualification',)],schemas
 sessions=conn.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'").fetchone()[0]
 assert sessions==0,sessions
 tables=conn.execute("SELECT c.relname,c.relkind,c.relowner,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='meri_qualification' ORDER BY c.relname").fetchall()
 columns=conn.execute("SELECT c.relname,a.attname,a.attnum,a.atttypid,a.atttypmod,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='meri_qualification' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum").fetchall()
 constraints=conn.execute("SELECT c.conname,pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='meri_qualification' ORDER BY c.conname").fetchall()
 data=[]
 for name,kind,*_ in tables:
  if kind!='r':continue
  q=psycopg.sql.SQL('SELECT row_to_json(t)::text FROM {}.{} t').format(psycopg.sql.Identifier('meri_qualification'),psycopg.sql.Identifier(name))
  rows=sorted(r[0] for r in conn.execute(q).fetchall())
  data.append({'table':name,'rows':len(rows),'sha256':hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()})
 schema=hashlib.sha256(json.dumps([tables,columns,constraints],default=str,separators=(',',':')).encode()).hexdigest()
 result={'scope':'ACTUAL_LOCAL_FIXTURE_READ_ONLY_NOT_PRODUCT_AUTHORITY','schemas':schemas,'schemaSha256':schema,'data':data,'otherClientSessions':sessions,'engine':conn.execute('SELECT version(),current_database(),current_user').fetchone()}
 Path(sys.argv[1]).write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'scope':result['scope'],'schemaSha256':schema,'tableCount':len(data),'rows':sum(t['rows'] for t in data)}))
