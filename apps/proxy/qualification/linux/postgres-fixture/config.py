"""Closed synthetic TLS fixture data, not deployment authority."""
import hashlib
import json
import os
import re
import stat
import uuid
from pathlib import Path
from urllib.parse import urlencode

PG_IMAGE='docker.io/library/postgres@sha256:3cec7eb015ba8adb28139fa5c83b8489cdf0e666e53dfdf20f598ae0cc8739e3'
OLD_IMAGE='sha256:73ae63e6e2a6db5371f8b6754546830a3208cb1efc47b7065e7223f90b431aaa'
HOST='meri-native-auth-pg'
USER='meri_native_auth_app'
CASES=('positive','wrong-ca','wrong-san','plaintext','wrong-password')

def is_postgres_repo_digest(value):
    """Docker's full and familiar names identify this one pinned official image."""
    return type(value) is str and value in (PG_IMAGE, PG_IMAGE.removeprefix('docker.io/library/'))

def require(ok,reason):
    if not ok:raise ValueError(reason)

def pairs(items):
    value={}
    for key,item in items:
        require(key not in value,'DUPLICATE_JSON_KEY');value[key]=item
    return value

def read_owner(path):
    require(type(path)is Path or isinstance(path,Path),'OWNER_PATH')
    require(path.is_absolute(),'ABSOLUTE_OWNER_PATH')
    for item in (path,*path.parents):
        s=item.lstat();require(not stat.S_ISLNK(s.st_mode),'LINKED_OWNER_PATH')
    before=path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and 0<before.st_size<=4096,'OWNER_FILE_BOUND')
    def key(s):return(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
    fd=os.open(path,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_CLOEXEC',0))
    with os.fdopen(fd,'rb') as stream:
        first=os.fstat(stream.fileno())
        require(key(first)==key(before),'OWNER_OPEN_DRIFT')
        raw=stream.read(4097);require(key(os.fstat(stream.fileno()))==key(first),'OWNER_READ_DRIFT')
    require(key(path.lstat())==key(before) and len(raw)==before.st_size,'OWNER_POST_DRIFT')
    return raw,key(before)

def parse(raw):
    require(type(raw)is bytes and len(raw)<=4096,'CONFIG_BOUND')
    v=json.loads(raw.decode('utf-8'),object_pairs_hook=pairs,
        parse_constant=lambda _:require(False,'NONFINITE_JSON'))
    require(type(v)is dict and set(v)=={'schema','runId','proxyImage','postgresImage','t0Ms',
        'startDeadlineMs','workDeadlineMs','cleanupDeadlineMs','originalC'},'CONFIG_SHAPE')
    require(v['schema']=='meri.postgres.tls-fixture/1' and v['postgresImage']==PG_IMAGE,'FIXED_PG_IMAGE')
    require(type(v['runId'])is str and str(uuid.UUID(v['runId']))==v['runId'],'RUN_UUID')
    require(type(v['proxyImage'])is str and re.fullmatch('sha256:[0-9a-f]{64}',v['proxyImage'])
        and v['proxyImage']!=OLD_IMAGE,'FRESH_BUILT_PROXY_IMAGE_REQUIRED')
    fields=('t0Ms','startDeadlineMs','workDeadlineMs','cleanupDeadlineMs','originalC')
    require(all(type(v[k])is int for k in fields),'INTEGER_CLOCK')
    require(0<v['t0Ms']<v['startDeadlineMs']<=v['t0Ms']+60000
        and v['startDeadlineMs']<v['workDeadlineMs']<=v['t0Ms']+300000
        and v['workDeadlineMs']<v['cleanupDeadlineMs']<=v['workDeadlineMs']+30000
        and v['cleanupDeadlineMs']<=v['originalC']==v['t0Ms']+900000,'ORIGINAL_BOUNDED_CLOCK')
    return v

def names(v):
    suffix=v['runId'].replace('-','')
    return {'network':'meri-tls-'+suffix,'server':'meri-tls-pg-'+suffix,
        'plain':'meri-tls-plain-'+suffix,'client':'meri-tls-client-'+suffix,
        'native':'meri_native_auth_'+suffix,'state':'meri_qualification_'+suffix}

def mount(v):return '/run/meri-native-auth/'+v['runId']

def url(v,password,case):
    require(case in CASES and re.fullmatch('[0-9a-f]{64}',password),'SYNTHETIC_INPUT')
    host='meri-native-wrong-san' if case=='wrong-san' else ('meri-native-plain-pg' if case=='plaintext' else HOST)
    ca=mount(v)+('/wrong-ca.pem' if case=='wrong-ca' else '/ca.pem')
    query=urlencode([('sslmode','require'),('sslaccept','strict'),('sslcert',ca)])
    return ('postgresql://'+USER+':'+password+'@'+host+':5432/'+names(v)['native']+'?'+query).encode('ascii')
