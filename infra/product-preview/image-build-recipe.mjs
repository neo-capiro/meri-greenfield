/** Offline, inert buildspec authoring. Calling this function makes no AWS/Docker
 * calls and grants no build authority. Review the returned exact bytes/hash before
 * supplying a separately approved, bounded CodeBuild StartBuild request. */
import {createHash} from 'node:crypto';

const sha=/^[a-f0-9]{64}$/u,commit=/^[a-f0-9]{40}$/u;
const resultBucket='meri-greenfield-qual-build-967807252336-us-east-1';
const refuse=()=>{throw Error('PRODUCT_IMAGE_RECIPE_REFUSED');};
function exact(value,keys){if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))refuse();return value;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function object(value){const v=exact(value,['bucket','key','versionId','sha256']);if(Object.values(v).some(x=>typeof x!=='string')||!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(v.bucket)||!sha.test(v.sha256)||['key','versionId'].some(k=>v[k].length<1||v[k].length>1024||/[\x00-\x20\x7f]/u.test(v[k]))||v.versionId==='null'||v.key.startsWith('-'))refuse();}

/** All pins are nonsecret owner-reviewed data. Archive and member manifest must
 * already exist as immutable S3 versions before this override is finalized. */
export function createProductImageBuildRecipe(value){
 const p=exact(value,['schemaVersion','sourceCommit','archive','manifest','dockerfileSha256','nodeImageUri','nodeVersion','runtimeBaseImageUri','runtimePackagesSha256','runnerSha256','runtimeUser','codeBuildProjectArn','ecrRepositoryUri','imageTag','verifierSha256','producerSha256']);
 object(p.archive);object(p.manifest);
 if(p.schemaVersion!==2||Object.entries(p).some(([k,v])=>!['schemaVersion','archive','manifest'].includes(k)&&typeof v!=='string')||!commit.test(p.sourceCommit)||!['dockerfileSha256','runtimePackagesSha256','runnerSha256','verifierSha256','producerSha256'].every(k=>sha.test(p[k]))||
    !/^public\.ecr\.aws\/docker\/library\/node@sha256:[a-f0-9]{64}$/u.test(p.nodeImageUri)||!/^v24\.[0-9]+\.[0-9]+$/u.test(p.nodeVersion)||
    !/^cgr\.dev\/chainguard\/wolfi-base@sha256:[a-f0-9]{64}$/u.test(p.runtimeBaseImageUri)||
    !/^[1-9][0-9]*:[1-9][0-9]*$/u.test(p.runtimeUser)||!/^arn:aws:codebuild:us-east-1:967807252336:project\/[A-Za-z0-9_-]+$/u.test(p.codeBuildProjectArn)||
    !/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9._/-]+$/u.test(p.ecrRepositoryUri)||
    !new RegExp(`^product-${p.sourceCommit}-[a-f0-9]{32}$`,'u').test(p.imageTag)||p.archive.bucket!==resultBucket||p.manifest.bucket!==resultBucket)refuse();
 // Freeze request bytes through serialization before constructing the executable
 // command. Only base64 and validated hex are interpolated into the bootstrap.
 const requestJson=JSON.stringify(p),packet=Buffer.from(requestJson).toString('base64');
 const bootstrap=`python3 -I -B -S - <<'MERI_PRODUCT_BUILD'
import atexit,base64,hashlib,json,os,pathlib,re,subprocess,sys,tempfile
source=pathlib.Path('infra/product-preview/image-build-source.py')
producer=pathlib.Path('infra/product-preview/image-build-producer.py')
diagnostic=pathlib.Path('product-image-diagnostic.json')
owner=os.urandom(16).hex()
result_bucket='${p.archive.bucket}'
result_key='results/product-image/${p.sourceCommit}/${p.imageTag.slice(p.sourceCommit.length+9)}/product-image-failure.json'
result_kms='arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042'
def save(status,phase,code=None,detail=None):
    primary=None if code is None else {'phase':phase,'category':'BOOTSTRAP','code':code,'detail':detail}
    cleanup_status='UNKNOWN' if phase=='BOOTSTRAP_CHILD' else 'NOT_RUN'
    try:
        if diagnostic.is_symlink():
            raise ValueError()
        if diagnostic.exists():
            if diagnostic.stat().st_size>4096 or json.loads(diagnostic.read_text(encoding='ascii')).get('diagnosticOwner')!=owner:
                raise ValueError()
        payload=json.dumps({'schemaVersion':1,'status':status,'phase':phase,'diagnosticOwner':owner,'primary':primary,'cleanup':{'status':cleanup_status,'failure':None,'additionalFailures':[]}},sort_keys=True,separators=(',',':'))+'\\n'
        with diagnostic.open('w' if diagnostic.exists() else 'x',encoding='ascii') as stream:
            stream.write(payload)
        return True
    except Exception:
        print('PRODUCT_IMAGE_CHECK_FAILED phase=DIAGNOSTIC category=WRITE code=PRODUCT_IMAGE_CHECK_FAILED',file=sys.stderr)
        return False
def child_receipt():
    try:
        if diagnostic.is_symlink() or diagnostic.stat().st_size>4096:
            return None
        row=json.loads(diagnostic.read_text(encoding='ascii'))
        phases=set('REQUEST BUILD_IDENTITY BUILD_READBACK REPOSITORY_READBACK WORKDIR SOURCE_ARCHIVE SOURCE_MANIFEST SOURCE_VERIFY SOURCE_EXTRACT DOCKER_PREFLIGHT DOCKER_BUILD IMAGE_INSPECT SANDBOX_HELP SANDBOX_MEASURE LINUX_TESTS ECR_AUTH ECR_PUSH ECR_READBACK ECR_SCAN CLEANUP WORKDIR_CLEANUP RECEIPT'.split())
        types=set('MISSING_FILE PERMISSION OS JSON IMPORT KEY TYPE VALUE TIMEOUT UNEXPECTED'.split())
        categories=types|{'COMMAND','CHECK'}
        codes={'PRODUCT_IMAGE_CHECK_FAILED'}|{'PRODUCT_IMAGE_'+name for name in 'ARCHIVE_BOUND ARCHIVE_SHA_MISMATCH BUILD_IDENTITY BUILD_SOURCE CLEANUP_UNKNOWN COMMAND_BOUND COMMAND_FAILED COMMAND_UNAVAILABLE_OR_TIMEOUT DUPLICATE_KEY DUPLICATE_MEMBER FILE_BOUND IMAGE_IDENTITY IMAGE_MEASUREMENT IMAGE_READBACK LINUX_CASES_UNPROVEN LINUX_REPORTER_UNPROVEN LINUX_FIXTURE_UNPROVEN LOCAL_IMAGE_EXISTS LOCAL_PROBE_EXISTS MANIFEST_BOUND MANIFEST_ORDER MANIFEST_SHA_MISMATCH MANIFEST_SHAPE MEMBER_ANCESTOR MEMBER_PATH MEMBER_TYPE NODE_PIN OBJECT_BINDING OBJECT_BOUND PRIVATE_MEMBER PRODUCER_DEADLINE PRODUCER_PLATFORM_OR_OUTPUT PROJECT_PIN PUBLIC_CA_BUNDLE RDS_CA_LOCK REPOSITORY_PIN REPOSITORY_POLICY REQUEST_OBJECT REQUEST_PIN RUNNER_BOUND RUNTIME_USER RUNTIME_BASE_PIN RUNTIME_PACKAGES_UNPROVEN RUNTIME_NATIVE_UNPROVEN SCAN_FINDINGS_HOLD SCAN_INCOMPLETE SHAPE_REFUSED SOURCE_COMMIT SOURCE_MEMBERS_MISMATCH SOURCE_PIN_MISMATCH TAG_PIN'.split()}
        statuses={'EXIT_NONZERO','TIMEOUT','BOUND','UNAVAILABLE'}
        def checked(record):
            if type(record) is not dict or set(record)!={'phase','category','code','detail'}:
                return None
            phase,category,code,detail=(record[key] for key in ('phase','category','code','detail'))
            if type(phase) is not str or phase not in phases or type(category) is not str or category not in categories or type(code) is not str or code not in codes or type(detail) is not dict:
                return None
            if category=='COMMAND':
                if set(detail)!={'status','exitCode','outputBytes','elapsedMs'} or type(detail['status']) is not str or detail['status'] not in statuses:
                    return None
                exit_code,count,elapsed=(detail[key] for key in ('exitCode','outputBytes','elapsedMs'))
                if exit_code is not None and (type(exit_code) is not int or not -255<=exit_code<=255) or type(count) is not int or not 0<=count<=17*1024**2 or type(elapsed) is not int or not 0<=elapsed<=1600000:
                    return None
            else:
                if set(detail)!={'errorType','errno'} or type(detail['errorType']) is not str or detail['errorType'] not in types:
                    return None
                errno=detail['errno']
                if errno is not None and (type(errno) is not int or not 0<=errno<=255):
                    return None
            return record
        base={'schemaVersion','status','phase','diagnosticOwner','primary','cleanup'}
        extras={'bootstrapFailure','bootstrapCleanup','childCleanupStatus','linuxTests'}
        if type(row) is not dict or not base<=set(row) or set(row)-base-extras or row['schemaVersion']!=1 or row['status']!='FAILED' or row['diagnosticOwner']!=owner or type(row['phase']) is not str or row['phase'] not in phases:
            return None
        primary=checked(row['primary'])
        cleanup=row['cleanup']
        if primary is None or type(cleanup) is not dict or set(cleanup)!={'status','failure','additionalFailures'} or cleanup['status'] not in ('NOT_RUN','OK','FAILED') or type(cleanup['additionalFailures']) is not list or len(cleanup['additionalFailures'])>1:
            return None
        if cleanup['status']=='FAILED':
            first=checked(cleanup['failure'])
            more=[checked(item) for item in cleanup['additionalFailures']]
            if first is None or any(item is None for item in more):
                return None
        else:
            if cleanup['failure'] is not None or cleanup['additionalFailures']:
                return None
            first,more=None,[]
        safe=dict(row)
        safe['schemaVersion']=1
        if ('linuxTests' in row)!=(primary['phase']=='LINUX_TESTS'):
            return None
        if 'linuxTests' in row:
            linux=row['linuxTests']
            case_ids={'B'+str(i).zfill(2) for i in range(1,7)}|{'R'+str(i).zfill(2) for i in range(1,7)}|{'W'+str(i).zfill(2) for i in range(1,13)}
            if type(linux) is not dict or set(linux)!={'status','observedCases','failedCaseIds','unknownFailures','unknownOutcomes','duplicateCases','skippedCases','fileCaseCounts','fileFailureIds','failureDetails','detailTruncated'} or linux['status'] not in ('COMPLETE','UNAVAILABLE') or type(linux['observedCases']) is not int or not 0<=linux['observedCases']<=24 or type(linux['failedCaseIds']) is not list or len(linux['failedCaseIds'])>24 or any(type(case) is not str or case not in case_ids for case in linux['failedCaseIds']) or len(set(linux['failedCaseIds']))!=len(linux['failedCaseIds']):
                return None
            if any(type(linux[name]) is not int or not 0<=linux[name]<=25 for name in ('unknownFailures','unknownOutcomes','duplicateCases','skippedCases')) or linux['unknownFailures']>linux['unknownOutcomes'] or len(linux['failedCaseIds'])>linux['observedCases']:
                return None
            per_file,file_failures,details=linux['fileCaseCounts'],linux['fileFailureIds'],linux['failureDetails']
            if type(per_file) is not dict or set(per_file)!={'B','R','W'} or any(type(per_file[key]) is not int or not 0<=per_file[key]<=maximum for key,maximum in (('B',6),('R',6),('W',12))) or sum(per_file.values())!=linux['observedCases']:
                return None
            if type(file_failures) is not list or len(file_failures)>3 or any(type(key) is not str or key not in per_file for key in file_failures) or len(set(file_failures))!=len(file_failures) or any(case[0] not in file_failures for case in linux['failedCaseIds']):
                return None
            if type(details) is not list or len(details)>4 or type(linux['detailTruncated']) is not bool:
                return None
            stages=set('NONE START FIRST_METADATA FIRST_READ REFRESH SECOND_METADATA SECOND_READ STATUS CLOSE CLEANUP'.split())
            error_codes=set('OTHER ERR_ASSERTION ERR_MODULE_NOT_FOUND MODULE_NOT_FOUND ERR_WORKER_INIT_FAILED ERR_WORKER_OUT_OF_MEMORY EAGAIN ENOENT EACCES EPERM RUNTIME_SECRET_FILE TASK_BOOTSTRAP_REFUSED'.split())|{'TEMPORAL_PRODUCT_TOKEN_'+name for name in 'CONFIGURATION DELIVERY PLATFORM DIRECTORY OWNERSHIP PATH_OCCUPIED CLEANUP_UNKNOWN IO_UNKNOWN CURRENTNESS EXPIRY CLOCK CLOSED INTERRUPTED REVOKED UNAVAILABLE REFUSED'.split()}
            failure_types=set('UNKNOWN testCodeFailure subtestsFailed hookFailed cancelledByParent testTimeoutFailure testAborted uncaughtException unhandledRejection'.split())
            signals=set('NONE OTHER SIGABRT SIGSEGV SIGKILL SIGTERM SIGBUS'.split())
            seen=set()
            for item in details:
                if type(item) is not dict or set(item)!={'id','stage','code','checkId','exception','failureType','exitCode','signal'}:
                    return None
                key=item['id']
                if type(key) is not str or key not in case_ids|{'B_FILE','R_FILE','W_FILE','UNMAPPED'} or key in seen:
                    return None
                seen.add(key)
                if any(type(item[name]) is not str or item[name] not in allowed for name,allowed in (('stage',stages),('code',error_codes),('failureType',failure_types),('signal',signals))) or key!='W08' and item['stage']!='NONE':
                    return None
                point=item['checkId']
                if type(point) is not int or not 0<=point<=30 or type(item['exception']) is not str or item['exception'] not in ('NONE','Error','AssertionError','TypeError','RangeError','SyntaxError','OTHER') or (point==0)!=(item['exception']=='NONE') or point and (key!='W08' or item['stage']=='NONE'):
                    return None
                if item['exitCode'] is not None and (type(item['exitCode']) is not int or not -255<=item['exitCode']<=255):
                    return None
            if linux['status']=='UNAVAILABLE' and (linux['observedCases'] or linux['failedCaseIds'] or file_failures or details or linux['detailTruncated'] or any(linux[name] for name in ('unknownFailures','unknownOutcomes','duplicateCases','skippedCases'))):
                return None
            safe['linuxTests']=dict(linux,failedCaseIds=sorted(linux['failedCaseIds']),fileFailureIds=sorted(file_failures))
        if 'childCleanupStatus' in row:
            if row['childCleanupStatus']!='UNKNOWN':
                return None
        bootstrap_codes={'PRODUCT_IMAGE_BOOTSTRAP_TIMEOUT','PRODUCT_IMAGE_BOOTSTRAP_CHILD_UNAVAILABLE','PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN'}
        for name in set(row)-base-{'childCleanupStatus','linuxTests'}:
            extra=row[name]
            if type(extra) is not dict or set(extra)!={'phase','category','code','detail'} or extra['category']!='BOOTSTRAP' or extra['phase'] not in ('BOOTSTRAP_CHILD','BOOTSTRAP_CLEANUP') or extra['code'] not in bootstrap_codes:
                return None
            detail=extra['detail']
            if detail is not None and not (type(detail) is dict and (detail=={'timeoutSeconds':1600} or set(detail)=={'exitCode'} and type(detail['exitCode']) is int and -255<=detail['exitCode']<=255)):
                return None
            safe[name]=extra
        def line(prefix,record):
            detail=record['detail']
            if record['category']=='COMMAND':
                suffix=' commandStatus='+detail['status']+' exitCode='+(str(detail['exitCode']) if detail['exitCode'] is not None else 'none')+' outputBytes='+str(detail['outputBytes'])+' elapsedMs='+str(detail['elapsedMs'])
            else:
                suffix=' errorType='+detail['errorType']+' errno='+(str(detail['errno']) if detail['errno'] is not None else 'none')
            return prefix+' phase='+record['phase']+' category='+record['category']+' code='+record['code']+suffix
        lines=[line('PRODUCT_IMAGE_CHECK_FAILED',primary)]
        if first is not None:
            lines.extend(line('PRODUCT_IMAGE_CLEANUP_FAILED',item) for item in (first,*more))
        if 'linuxTests' in safe:
            row=safe['linuxTests']
            lines.append('PRODUCT_IMAGE_LINUX_TESTS status='+row['status']+' observedCases='+str(row['observedCases'])+' failedCaseIds='+(','.join(row['failedCaseIds']) or 'none')+' unknownOutcomes='+str(row['unknownOutcomes'])+' skippedCases='+str(row['skippedCases'])+' duplicateCases='+str(row['duplicateCases']))
            lines.append('PRODUCT_IMAGE_LINUX_FILES B='+str(row['fileCaseCounts']['B'])+' R='+str(row['fileCaseCounts']['R'])+' W='+str(row['fileCaseCounts']['W'])+' failedFiles='+(','.join(row['fileFailureIds']) or 'none'))
            for detail in row['failureDetails']:
                lines.append('PRODUCT_IMAGE_LINUX_FAILURE caseId='+detail['id']+' stage='+detail['stage']+' checkId='+str(detail['checkId'])+' exception='+detail['exception']+' code='+detail['code']+' type='+detail['failureType']+' exitCode='+(str(detail['exitCode']) if detail['exitCode'] is not None else 'none')+' signal='+detail['signal'])
        if safe.get('childCleanupStatus')=='UNKNOWN':
            lines.append('PRODUCT_IMAGE_CHILD_CLEANUP_UNKNOWN phase=BOOTSTRAP_CHILD')
        return safe,lines
    except Exception:
        return None
def bootstrap_receipt():
    try:
        if diagnostic.is_symlink() or diagnostic.stat().st_size>4096:
            return None
        row=json.loads(diagnostic.read_text(encoding='ascii'))
        base={'schemaVersion','status','phase','diagnosticOwner','primary','cleanup'}
        if type(row) is not dict or not base<=set(row) or set(row)-base-{'bootstrapCleanup'} or row['schemaVersion']!=1 or row['status']!='FAILED' or row['diagnosticOwner']!=owner:
            return None
        primary=row['primary']
        if type(primary) is not dict or set(primary)!={'phase','category','code','detail'} or primary['category']!='BOOTSTRAP' or row['phase']!=primary['phase']:
            return None
        codes={'BOOTSTRAP_SOURCE':{'PRODUCT_IMAGE_BOOTSTRAP_SOURCE_UNAVAILABLE','PRODUCT_IMAGE_VERIFIER_SHA_MISMATCH','PRODUCT_IMAGE_PRODUCER_SHA_MISMATCH'},'BOOTSTRAP_REQUEST':{'PRODUCT_IMAGE_BOOTSTRAP_REQUEST_UNAVAILABLE'},'BOOTSTRAP_CHILD':{'PRODUCT_IMAGE_BOOTSTRAP_TIMEOUT','PRODUCT_IMAGE_BOOTSTRAP_CHILD_UNAVAILABLE','PRODUCT_IMAGE_BOOTSTRAP_CHILD_FAILED','PRODUCT_IMAGE_BOOTSTRAP_CHILD_INCOMPLETE'},'BOOTSTRAP_CLEANUP':{'PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN'}}
        phase,code,detail=primary['phase'],primary['code'],primary['detail']
        if type(phase) is not str or type(code) is not str or code not in codes.get(phase,set()):
            return None
        if code=='PRODUCT_IMAGE_BOOTSTRAP_TIMEOUT':
            if detail!={'timeoutSeconds':1600}:return None
        elif code=='PRODUCT_IMAGE_BOOTSTRAP_CHILD_FAILED':
            if type(detail) is not dict or set(detail)!={'exitCode'} or type(detail['exitCode']) is not int or not -255<=detail['exitCode']<=255:return None
        elif detail is not None:return None
        cleanup=row['cleanup']
        expected='UNKNOWN' if phase=='BOOTSTRAP_CHILD' else 'NOT_RUN'
        if type(cleanup) is not dict or cleanup!={'status':expected,'failure':None,'additionalFailures':[]}:
            return None
        safe=dict(row)
        safe['schemaVersion']=1
        if 'bootstrapCleanup' in row:
            extra=row['bootstrapCleanup']
            if type(extra) is not dict or extra!={'phase':'BOOTSTRAP_CLEANUP','category':'BOOTSTRAP','code':'PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN','detail':None}:
                return None
        lines=['PRODUCT_IMAGE_CHECK_FAILED phase='+phase+' category=BOOTSTRAP code='+code]
        if expected=='UNKNOWN':lines.append('PRODUCT_IMAGE_CHILD_CLEANUP_UNKNOWN phase=BOOTSTRAP_CHILD')
        if 'bootstrapCleanup' in safe:lines.append('PRODUCT_IMAGE_CHECK_FAILED phase=BOOTSTRAP_CLEANUP category=BOOTSTRAP code=PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN')
        return safe,lines
    except Exception:
        return None
def fail(phase,code,detail=None,preserve_child=False):
    child=(child_receipt() or bootstrap_receipt()) if preserve_child else None
    if child is None:
        save('FAILED',phase,code,detail)
    else:
        safe,lines=child
        safe['bootstrapCleanup' if phase=='BOOTSTRAP_CLEANUP' else 'bootstrapFailure']={'phase':phase,'category':'BOOTSTRAP','code':code,'detail':detail}
        if phase=='BOOTSTRAP_CHILD':
            safe['childCleanupStatus']='UNKNOWN'
        try:
            diagnostic.write_text(json.dumps(safe,sort_keys=True,separators=(',',':'))+'\\n',encoding='ascii')
        except Exception:
            print('PRODUCT_IMAGE_CHECK_FAILED phase=DIAGNOSTIC category=WRITE code=PRODUCT_IMAGE_CHECK_FAILED',file=sys.stderr)
        for line in lines:
            print(line,file=sys.stderr)
    print('PRODUCT_IMAGE_CHECK_FAILED phase='+phase+' category=BOOTSTRAP code='+code,file=sys.stderr)
    if phase=='BOOTSTRAP_CHILD':
        print('PRODUCT_IMAGE_CHILD_CLEANUP_UNKNOWN phase=BOOTSTRAP_CHILD',file=sys.stderr)
    raise SystemExit(2)
def write_owned(row):
    temporary=pathlib.Path('product-image-diagnostic.retention.tmp')
    created=False
    try:
        if diagnostic.is_symlink() or temporary.exists() or temporary.is_symlink():return None
        old=json.loads(diagnostic.read_text(encoding='ascii'))
        if type(old) is not dict or old.get('diagnosticOwner')!=owner:return None
        payload=(json.dumps(row,sort_keys=True,separators=(',',':'))+'\\n').encode('ascii')
        if not 0<len(payload)<=6144:return None
        with temporary.open('xb') as stream:
            created=True
            stream.write(payload);stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,diagnostic)
        return payload
    except Exception:
        if created:
            try:temporary.unlink(missing_ok=True)
            except Exception:pass
        return None
def put_once(args,environment):
    import threading,time
    process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=environment)
    output=bytearray();deadline=time.monotonic()+15;state={'overflow':False,'error':False}
    def read_bounded():
        try:
            while True:
                block=os.read(process.stdout.fileno(),min(1024,4097-len(output)))
                if not block:return
                output.extend(block)
                if len(output)>4096:
                    state['overflow']=True;return
        except Exception:
            state['error']=True
    reader=threading.Thread(target=read_bounded,daemon=True);reader.start()
    try:
        reader.join(timeout=max(0.001,deadline-time.monotonic()))
        if reader.is_alive():raise TimeoutError()
        if state['overflow']:raise BufferError()
        if state['error']:raise OSError()
        return process.wait(timeout=max(0.001,deadline-time.monotonic())),bytes(output)
    except BaseException:
        if process.poll() is None:process.kill()
        process.wait(timeout=2)
        raise
    finally:
        process.stdout.close()
        reader.join(timeout=2)
def retain_failure():
    try:
        if diagnostic.is_symlink() or diagnostic.stat().st_size>4096:
            print('PRODUCT_IMAGE_RETENTION status=FAILED code=ARTIFACT_UNAVAILABLE',file=sys.stderr);return
        original=json.loads(diagnostic.read_text(encoding='ascii'))
        if type(original) is dict and original.get('diagnosticOwner')==owner and original.get('status')=='SUCCEEDED':return
        accepted=child_receipt() or bootstrap_receipt()
        if accepted is None:
            print('PRODUCT_IMAGE_RETENTION status=FAILED code=ARTIFACT_UNAVAILABLE',file=sys.stderr);return
        safe,_=accepted
        build_id=os.environ.get('CODEBUILD_BUILD_ID','')
        project='${p.codeBuildProjectArn.split('/')[1]}'
        if os.environ.get('CODEBUILD_PROJECT_ARN')!='${p.codeBuildProjectArn}' or re.fullmatch(re.escape(project)+r':[a-f0-9-]{36}',build_id) is None:
            safe['retention']={'status':'FAILED','code':'BUILD_IDENTITY_UNAVAILABLE'}
            write_owned(safe)
            print('PRODUCT_IMAGE_RETENTION status=FAILED code=BUILD_IDENTITY_UNAVAILABLE',file=sys.stderr);return
        safe['retention']={'status':'ATTEMPTED','code':'ONE_SHOT_PUT'}
        payload=write_owned(safe)
        if payload is None:
            print('PRODUCT_IMAGE_RETENTION status=FAILED code=ARTIFACT_WRITE_FAILED',file=sys.stderr);return
        digest=hashlib.sha256(payload).digest()
        checksum=base64.b64encode(digest).decode('ascii')
        intent=pathlib.Path('product-image-diagnostic.retention.intent')
        try:
            with intent.open('xb') as stream:
                stream.write((json.dumps({'key':result_key,'sha256':digest.hex(),'bytes':len(payload)},sort_keys=True,separators=(',',':'))+'\\n').encode('ascii'))
                stream.flush();os.fsync(stream.fileno())
        except Exception:
            safe['retention']={'status':'FAILED','code':'INTENT_WRITE_FAILED'}
            write_owned(safe)
            print('PRODUCT_IMAGE_RETENTION status=FAILED code=INTENT_WRITE_FAILED',file=sys.stderr);return
        environment=dict(os.environ,AWS_MAX_ATTEMPTS='1',AWS_RETRY_MODE='standard')
        args=['aws','--region','us-east-1','--no-cli-pager','s3api','put-object','--bucket',result_bucket,'--key',result_key,'--body',str(diagnostic),'--if-none-match','*','--checksum-sha256',checksum,'--server-side-encryption','aws:kms','--ssekms-key-id',result_kms,'--query','{VersionId:VersionId,ChecksumSHA256:ChecksumSHA256,ServerSideEncryption:ServerSideEncryption,SSEKMSKeyId:SSEKMSKeyId}','--output','json']
        version=None
        try:
            exit_code,response=put_once(args,environment)
            if exit_code!=0:
                status,code='FAILED','PUT_FAILED'
            else:
                answer=json.loads(response)
                candidate=answer.get('VersionId') if type(answer) is dict else None
                correct=type(candidate) is str and candidate!='null' and re.fullmatch(r'[A-Za-z0-9._~+/=-]{1,1024}',candidate) is not None and answer.get('ChecksumSHA256')==checksum and answer.get('ServerSideEncryption')=='aws:kms' and answer.get('SSEKMSKeyId')==result_kms
                if correct:version=candidate
                status,code=('CONFIRMED','PUT_ACK') if correct else ('UNCONFIRMED','ACK_INVALID')
        except BufferError:
            status,code='UNCONFIRMED','ACK_UNBOUNDED'
        except (TimeoutError,subprocess.TimeoutExpired):
            status,code='UNCONFIRMED','PUT_TIMEOUT'
        except Exception:
            status,code='UNCONFIRMED','PUT_UNAVAILABLE'
        safe['retention']={'status':status,'code':code,'versionId':version,'checksumSha256':checksum,'bytes':len(payload)}
        if write_owned(safe) is None:
            print('PRODUCT_IMAGE_RETENTION status=UNCONFIRMED code=ARTIFACT_WRITE_FAILED',file=sys.stderr)
        suffix=(' versionIdBase64='+base64.b64encode(version.encode('ascii')).decode('ascii')+' checksumSha256='+checksum+' bytes='+str(len(payload))) if version is not None else ''
        print('PRODUCT_IMAGE_RETENTION status='+status+' code='+code+suffix,file=sys.stderr)
    except Exception:
        print('PRODUCT_IMAGE_RETENTION status=FAILED code=UNEXPECTED',file=sys.stderr)
atexit.register(retain_failure)
if not save('STARTED','BOOTSTRAP_SOURCE'):
    raise SystemExit(2)
try:
    source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
    producer_hash=hashlib.sha256(producer.read_bytes()).hexdigest()
except Exception:
    fail('BOOTSTRAP_SOURCE','PRODUCT_IMAGE_BOOTSTRAP_SOURCE_UNAVAILABLE')
if source_hash!='${p.verifierSha256}':
    fail('BOOTSTRAP_SOURCE','PRODUCT_IMAGE_VERIFIER_SHA_MISMATCH')
if producer_hash!='${p.producerSha256}':
    fail('BOOTSTRAP_SOURCE','PRODUCT_IMAGE_PRODUCER_SHA_MISMATCH')
try:
    with tempfile.TemporaryDirectory(prefix='meri-product-request-') as directory:
        request=pathlib.Path(directory)/'request.json'
        try:
            request.write_bytes(base64.b64decode('${packet}',validate=True))
            request.chmod(0o600)
        except Exception:
            fail('BOOTSTRAP_REQUEST','PRODUCT_IMAGE_BOOTSTRAP_REQUEST_UNAVAILABLE')
        try:
            child_env=dict(os.environ,MERI_PRODUCT_DIAGNOSTIC_OWNER=owner)
            result=subprocess.run([sys.executable,'-I','-B','-S',str(producer),'--request',str(request),'--output','product-image-receipt.json'],timeout=1600,check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=child_env)
        except subprocess.TimeoutExpired:
            fail('BOOTSTRAP_CHILD','PRODUCT_IMAGE_BOOTSTRAP_TIMEOUT',{'timeoutSeconds':1600},preserve_child=True)
        except Exception:
            fail('BOOTSTRAP_CHILD','PRODUCT_IMAGE_BOOTSTRAP_CHILD_UNAVAILABLE',preserve_child=True)
except SystemExit:
    raise
except Exception:
    fail('BOOTSTRAP_CLEANUP','PRODUCT_IMAGE_BOOTSTRAP_CLEANUP_UNKNOWN',preserve_child=True)
try:
    final=json.loads(diagnostic.read_text(encoding='ascii'))
    state=final.get('status') if type(final) is dict and final.get('diagnosticOwner')==owner else None
except Exception:
    state=None
if result.returncode!=0:
    child=child_receipt()
    if child is None:
        fail('BOOTSTRAP_CHILD','PRODUCT_IMAGE_BOOTSTRAP_CHILD_FAILED',{'exitCode':max(-255,min(255,result.returncode))})
    for line in child[1]:
        print(line,file=sys.stderr)
    raise SystemExit(2)
if state!='SUCCEEDED':
    fail('BOOTSTRAP_CHILD','PRODUCT_IMAGE_BOOTSTRAP_CHILD_INCOMPLETE')
raise SystemExit(0)
MERI_PRODUCT_BUILD`;
 // Keep authored names readable while fitting CodeBuild's fixed override limit.
 // Only these private Python bindings are shortened; protocol strings stay exact.
 const bindings={file_failures:'ff',per_file:'pf',bootstrap_receipt:'br',child_receipt:'cr',result_bucket:'rb',result_key:'rk',result_kms:'rm',error_codes:'ec',failure_types:'ft',bootstrap_codes:'bc',record:'rc',payload:'pl',environment:'ev',temporary:'tp',statuses:'ss',result:'rs',answer:'an',candidate:'cd',cleanup_status:'ct',lines:'ln',first:'fi',source_hash:'sh',producer_hash:'ph',checked:'ck',categories:'cg',child:'ch'};
 const identifiers=new RegExp(`\\b(?:${Object.keys(bindings).join('|')})\\b`,'gu');
 if(new RegExp(`['"](?:${Object.keys(bindings).join('|')})['"]`,'u').test(bootstrap))refuse();
 const command=bootstrap.replace(identifiers,name=>bindings[name]).replace(/^ +/gmu,spaces=>{if(spaces.length%4)refuse();return ' '.repeat(spaces.length/4);});
 const buildspec={version:0.2,env:{shell:'bash'},phases:{build:{'on-failure':'ABORT',commands:[command]}},artifacts:{files:['product-image-receipt.json','product-image-diagnostic.json'],'discard-paths':'yes'}};
 const buildspecJson=JSON.stringify(buildspec)+'\n';
 if(Buffer.byteLength(buildspecJson)>25600)refuse();
 return Object.freeze({status:'OFFLINE_RECIPE_ONLY',buildspecJson,buildspecSha256:hash(buildspecJson),requestSha256:hash(requestJson)});
}
