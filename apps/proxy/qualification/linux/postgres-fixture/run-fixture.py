"""One remote-Linux synthetic PG/Prisma TLS fixture. No auth activation/providers."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sys
import time

from config import CASES,HOST,PG_IMAGE,USER,is_postgres_repo_digest,mount,names,parse,read_owner,require,url
from docker_capture import DockerCapture

HERE=Path(__file__).resolve().parent

def write(path,raw,uid,mode=0o400):
    with path.open('xb') as f:f.write(raw)
    os.chown(path,uid,uid);path.chmod(mode)

def common(name,owner,network,user,image):
    return ['create','--name',name,'--label','meri.qualification.owner='+owner,
        '--network',network,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
        '--user',user,'--workdir','/tmp','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777',
        '--pids-limit','128','--memory','1g','--cpus','1']

def create(capture,argv,expected_image,owner,attempts):
    name=argv[argv.index('--name')+1]
    attempts.append((name,expected_image)) # Before dispatch; unknown ACK reconciles unique name.
    raw,_,_=capture.call('create',argv)
    identity=raw.decode('ascii').strip();require(bool(re.fullmatch('[0-9a-f]{64}',identity)),'CONTAINER_ID')
    v=capture.inspect('container',identity,owner,expected_image)
    h=v['HostConfig']
    require(h['ReadonlyRootfs'] is True and h['Privileged'] is False and h['CapDrop']==['ALL']
        and h.get('CapAdd') in (None,[]) and h['SecurityOpt']==['no-new-privileges']
        and h.get('Devices') in (None,[]) and h.get('DeviceRequests') in (None,[])
        and h['PidsLimit']==128 and h['Memory']==1073741824 and h['NanoCpus']==1000000000
        and v['Config']['User']==argv[argv.index('--user')+1]
        and h['NetworkMode']==argv[argv.index('--network')+1],'ACTUAL_ISOLATION')
    require(all(x['Type'] in ('bind','tmpfs') for x in v.get('Mounts',[])),'PERSISTENT_OR_UNKNOWN_MOUNT')
    keys=[x.split('=',1)[0].upper() for x in v['Config'].get('Env',[])]
    require(len(keys)==len(set(keys)) and not any(k.startswith(('AWS_','ANTHROPIC_','OPENAI_','AZURE_'))
        or k in ('DATABASE_URL','DIRECT_URL','PGPASSWORD','LITELLM_MASTER_KEY')
        or k.endswith(('_API_KEY','_TOKEN','_SECRET','_PASSWORD')) for k in keys),'SECRET_IMAGE_ENV')
    return identity

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config',type=Path,required=True);parser.add_argument('--config-sha256',required=True)
    parser.add_argument('--output',type=Path,required=True);args=parser.parse_args(argv)
    require(sys.platform=='linux' and os.geteuid()==0,'TRUSTED_REMOTE_LINUX_SETUP_REQUIRED')
    require(args.config.is_absolute() and args.output.is_absolute() and re.fullmatch('[0-9a-f]{64}',args.config_sha256),'FIXED_OWNER_INPUT')
    require(not args.output.exists(),'EXCLUSIVE_OUTPUT')
    for path in (args.config,*args.config.parents,*args.output.parents):require(not path.is_symlink(),'LINKED_OWNER_PATH')
    raw,input_identity=read_owner(args.config);require(hashlib.sha256(raw).hexdigest()==args.config_sha256,'OWNER_CONFIG_HASH')
    v=parse(raw);now=time.time_ns()//1000000
    require(v['t0Ms']<=now<v['startDeadlineMs'],'FRESH_ORIGINAL_START')
    args.output.mkdir(mode=0o700);private=args.output/'private';private.mkdir(mode=0o700)
    # Private file area is NEVER a result artifact; destroyed only after owned containers are absent.
    client=private/'client';client.mkdir(mode=0o700);os.chown(client,10001,10001)
    certs=private/'certs';certs.mkdir(mode=0o700);os.chown(certs,10001,10001)
    n=names(v);owner=v['runId'];attempts=[];network_attempt=False
    c=DockerCapture(args.output,v['workDeadlineMs'])
    result={'schema':'meri.postgres.tls-fixture-result/1','runId':owner,'configSha256':args.config_sha256,
        'proxyImage':v['proxyImage'],'postgresImage':PG_IMAGE,'clock':{k:v[k] for k in ('t0Ms','workDeadlineMs','cleanupDeadlineMs','originalC')},
        'controls':{},'ownedCleanup':False,'privateFilesRemoved':False,'nativeSchemaInitialized':False,
        'providerCalls':0,'runtimeAdmitted':False}
    try:
        # No pull/build here. Root binds the fresh image and separately fetches pinned PG.
        for label,image in (('proxy',v['proxyImage']),('postgres',PG_IMAGE)):
            data,_,_=c.call('image-'+label,['image','inspect',image]);im=json.loads(data)
            require(type(im)is list and len(im)==1 and im[0]['Os']=='linux' and im[0]['Architecture']=='amd64','IMAGE_PLATFORM')
            if label=='proxy':require(im[0]['Id']==image and im[0]['Config']['User']=='10001:10001','FRESH_PROXY_IDENTITY')
            else:require(any(is_postgres_repo_digest(ref) for ref in im[0].get('RepoDigests',[])),'PINNED_POSTGRES_REPODIGEST')
            result[label+'ImageId']=im[0]['Id']
        prospective=[n['client']+'-certs',n['server'],n['plain']]+[n['client']+'-'+case for case in CASES]
        for kind,name in [('network',n['network'])]+[('container',name) for name in prospective]:
            data,err,_=c.call('prior-absence',[kind,'inspect',name],allowed=(1,))
            require(json.loads(data)==[] and (b'No such container' in err if kind=='container' else b'not found' in err.lower()),'FRESH_RESOURCE_NAME_REQUIRED')
        network_attempt=True # Before dispatch; unknown ACK still requires exact-name reconciliation.
        c.call('network-create',['network','create','--internal','--driver','bridge','--label','meri.qualification.owner='+owner,n['network']])
        net=c.inspect('network',n['network'],owner);require(net['Internal'] is True and net.get('Containers') in ({},None),'PRIVATE_INTERNAL_NETWORK')
        # Certificate-only generator: no network, mounted new empty owned directory.
        certscript='umask 077; cd /fixture; openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=MeriFixtureCA -keyout ca.key -out ca.pem; openssl req -newkey rsa:2048 -nodes -subj /CN='+HOST+' -keyout server.key -out server.csr; printf "subjectAltName=DNS:'+HOST+'\\nextendedKeyUsage=serverAuth\\n" > ext; openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -days 1 -extfile ext -out server.pem; openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=MeriWrongCA -keyout wrong-ca.key -out wrong-ca.pem'
        certname=n['client']+'-certs'
        a=common(certname,owner,'none','10001:10001',v['proxyImage'])+['--mount','type=bind,source='+str(certs)+',target=/fixture','--entrypoint','/bin/sh',v['proxyImage'],'-ceu',certscript]
        cid=create(c,a,v['proxyImage'],owner,attempts);c.call('certificates',['start','--attach',cid])
        admin=secrets.token_hex(32);password=secrets.token_hex(32);wrong=secrets.token_hex(32)
        for case in CASES:write(client/(case+'-url'),url(v,wrong if case=='wrong-password' else password,case),10001)
        write(client/'database-url',url(v,password,'positive'),10001)
        for name in ('ca.pem','wrong-ca.pem'):write(client/name,(certs/name).read_bytes(),10001)
        for kind,ssl in (('server',True),('plain',False)):
            server=private/kind;server.mkdir(mode=0o700);os.chown(server,999,999)
            write(server/'admin-password',admin.encode(),999)
            for name in ('server.key','server.pem'):write(server/name,(certs/name).read_bytes(),999)
            sql=("CREATE ROLE meri_fixture_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;\n"
                "CREATE ROLE "+USER+" LOGIN PASSWORD '"+password+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;\n"
                "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_authid WHERE rolname='"+USER+"' AND rolpassword LIKE 'SCRAM-SHA-256$%') THEN RAISE EXCEPTION 'SCRAM_REQUIRED'; END IF; END $$;\n"
                "CREATE DATABASE "+n['native']+" OWNER meri_fixture_owner;\nCREATE DATABASE "+n['state']+" OWNER meri_fixture_owner;\n"
                "REVOKE ALL ON DATABASE "+n['native']+" FROM PUBLIC;\nREVOKE ALL ON DATABASE "+n['state']+" FROM PUBLIC;\n"
                "GRANT CONNECT ON DATABASE "+n['native']+" TO "+USER+";\n")
            write(server/'bootstrap.sql',sql.encode(),999)
            # No client shares this local socket; local trust exists ONLY during isolated bootstrap.
            hba='local all all reject\nhostnossl all all 0.0.0.0/0 reject\nhostnossl all all ::/0 reject\nhostssl all '+USER+' 0.0.0.0/0 scram-sha-256\nhostssl all '+USER+' ::/0 scram-sha-256\n'
            write(server/'pg_hba.conf',hba.encode(),999)
            conf="listen_addresses='*'\nport=5432\npassword_encryption='scram-sha-256'\nhba_file='/run/meri-pg/pg_hba.conf'\nssl="+('on' if ssl else 'off')+"\nssl_cert_file='/run/meri-pg/server.pem'\nssl_key_file='/run/meri-pg/server.key'\nssl_min_protocol_version='TLSv1.2'\nlog_statement='none'\nlog_min_error_statement='panic'\nlog_min_messages='fatal'\nmax_connections=20\nshared_buffers='32MB'\n"
            write(server/'postgresql.conf',conf.encode(),999)
            alias=HOST if ssl else 'meri-native-plain-pg'
            a=common(n[kind],owner,n['network'],'999:999',result['postgresImageId'])+['--network-alias',alias]
            if ssl:a+=['--network-alias','meri-native-wrong-san']
            a+=['--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=256m,uid=999,gid=999,mode=700',
                '--tmpfs','/var/run/postgresql:rw,noexec,nosuid,nodev,size=8m,uid=999,gid=999,mode=700',
                '--mount','type=bind,source='+str(server)+',target=/run/meri-pg,readonly',
                '--mount','type=bind,source='+str(HERE/'server-bootstrap.sh')+',target=/run/server-bootstrap.sh,readonly',
                '--entrypoint','/bin/sh',result['postgresImageId'],'/run/server-bootstrap.sh']
            cid=create(c,a,result['postgresImageId'],owner,attempts);c.call('server-start',['start',cid])
            ready=False
            for index in range(20):
                _,_,code=c.call('server-ready',['exec','--user','999:999',cid,'pg_isready','-h','127.0.0.1','-p','5432'],allowed=(0,1,2))
                if code==0:ready=True;break
                time.sleep(.2)
            require(ready,'POSTGRES_READY_UNKNOWN')
            logs,_,_=c.call('server-bootstrap-proof',['logs',cid])
            require(b'PG_FIXTURE_SCRAM_READY' in logs,'ACTUAL_SCRAM_BOOTSTRAP_UNPROVEN')
        for case in CASES:
            name=n['client']+'-'+case
            a=common(name,owner,n['network'],'10001:10001',v['proxyImage'])+['--mount',
                'type=bind,source='+str(client)+',target='+mount(v)+',readonly','--mount',
                'type=bind,source='+str(HERE/'prisma-peer.py')+',target=/run/prisma-peer.py,readonly',
                '--entrypoint','/opt/meri-proxy-venv/bin/python',v['proxyImage'],'-I','-B','/run/prisma-peer.py','--run',owner,'--case',case]
            cid=create(c,a,v['proxyImage'],owner,attempts)
            data,_,code=c.call('peer-'+case,['start','--attach',cid],allowed=(0,1,2))
            observed=c.inspect('container',cid,owner,v['proxyImage'])
            require(observed['State']['Running'] is False and observed['State']['ExitCode'] in (0,1,2),'NATIVE_TERMINAL')
            value=json.loads(data);result['controls'][case]=value
            require(value.get('case')==case and value.get('passed') is True and observed['State']['ExitCode']==0,'NATIVE_CONTROL_FAILED_'+case)
        result['tlsControlsPassed']=True
    except Exception as error:result.update(errorType=type(error).__name__,tlsControlsPassed=False)
    finally:
        c.deadline_ms=v['cleanupDeadlineMs'];failures=[];removed=[]
        for name,image in reversed(attempts):
            try:removed.append(c.remove_container(name,owner,image))
            except Exception as error:failures.append({'resource':name,'errorType':type(error).__name__})
        if network_attempt:
            try:result['networkRemoved']=c.remove_network(n['network'],owner)
            except Exception as error:failures.append({'resource':n['network'],'errorType':type(error).__name__})
        result.update(removedContainerIds=removed,cleanupFailures=failures,ownedCleanup=not failures)
        if not failures:
            # Only exact files/directories under this newly created private area; no symlink traversal.
            try:
                for path in sorted(private.rglob('*'),key=lambda p:len(p.parts),reverse=True):
                    require(not path.is_symlink(),'PRIVATE_LINK_DRIFT')
                    if path.is_file():path.unlink()
                    elif path.is_dir():path.rmdir()
                    else:raise ValueError('PRIVATE_NONREGULAR')
                private.rmdir();result['privateFilesRemoved']=True
            except Exception as error:result['privateCleanupErrorType']=type(error).__name__
        try:result['inputStable']=read_owner(args.config)==(raw,input_identity)
        except Exception as error:result.update(inputStable=False,inputReadbackErrorType=type(error).__name__)
        result['endedAtMs']=time.time_ns()//1000000
        result['cleanupBeforeOriginalDeadline']=result['endedAtMs']<=v['cleanupDeadlineMs']<=v['originalC']
        with (args.output/'result.json').open('x') as f:json.dump(result,f,indent=2,sort_keys=True)
    print(json.dumps(result,sort_keys=True))
    return 0 if all(result.get(k) is True for k in ('tlsControlsPassed','ownedCleanup','privateFilesRemoved','inputStable','cleanupBeforeOriginalDeadline')) else 1

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'status':'FIXTURE_REFUSED','errorType':type(error).__name__,'runtimeAdmitted':False}));raise SystemExit(2)
