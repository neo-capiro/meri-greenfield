/** Offline, inert buildspec authoring. Calling this function makes no AWS/Docker
 * calls and grants no build authority. Review the returned exact bytes/hash before
 * supplying a separately approved, bounded CodeBuild StartBuild request. */
import {createHash} from 'node:crypto';

const sha=/^[a-f0-9]{64}$/u,commit=/^[a-f0-9]{40}$/u;
const refuse=()=>{throw Error('PRODUCT_IMAGE_RECIPE_REFUSED');};
function exact(value,keys){if(value===null||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value')))refuse();return value;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function object(value){const v=exact(value,['bucket','key','versionId','sha256']);if(Object.values(v).some(x=>typeof x!=='string')||!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(v.bucket)||!sha.test(v.sha256)||['key','versionId'].some(k=>v[k].length<1||v[k].length>1024||/[\x00-\x20\x7f]/u.test(v[k]))||v.versionId==='null'||v.key.startsWith('-'))refuse();}

/** All pins are nonsecret owner-reviewed data. Archive and member manifest must
 * already exist as immutable S3 versions before this override is finalized. */
export function createProductImageBuildRecipe(value){
 const p=exact(value,['sourceCommit','archive','manifest','dockerfileSha256','nodeImageUri','nodeVersion','runnerSha256','runtimeUser','codeBuildProjectArn','ecrRepositoryUri','imageTag','verifierSha256','producerSha256']);
 object(p.archive);object(p.manifest);
 if(Object.entries(p).some(([k,v])=>!['archive','manifest'].includes(k)&&typeof v!=='string')||!commit.test(p.sourceCommit)||!['dockerfileSha256','runnerSha256','verifierSha256','producerSha256'].every(k=>sha.test(p[k]))||
    !/^public\.ecr\.aws\/docker\/library\/node@sha256:[a-f0-9]{64}$/u.test(p.nodeImageUri)||!/^v24\.[0-9]+\.[0-9]+$/u.test(p.nodeVersion)||
    !/^[1-9][0-9]*:[1-9][0-9]*$/u.test(p.runtimeUser)||!/^arn:aws:codebuild:us-east-1:967807252336:project\/[A-Za-z0-9_-]+$/u.test(p.codeBuildProjectArn)||
    !/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9._/-]+$/u.test(p.ecrRepositoryUri)||
    !new RegExp(`^product-${p.sourceCommit}-[a-f0-9]{32}$`,'u').test(p.imageTag))refuse();
 // Freeze request bytes through serialization before constructing the executable
 // command. Only base64 and validated hex are interpolated into the bootstrap.
 const requestJson=JSON.stringify(p),packet=Buffer.from(requestJson).toString('base64');
 const bootstrap=`python3 -I -B -S - <<'MERI_PRODUCT_BUILD'
import base64,hashlib,pathlib,subprocess,sys,tempfile
source=pathlib.Path('infra/product-preview/image-build-source.py')
producer=pathlib.Path('infra/product-preview/image-build-producer.py')
if hashlib.sha256(source.read_bytes()).hexdigest()!='${p.verifierSha256}':
    raise SystemExit('PRODUCT_IMAGE_VERIFIER_SHA_MISMATCH')
if hashlib.sha256(producer.read_bytes()).hexdigest()!='${p.producerSha256}':
    raise SystemExit('PRODUCT_IMAGE_PRODUCER_SHA_MISMATCH')
with tempfile.TemporaryDirectory(prefix='meri-product-request-') as directory:
    request=pathlib.Path(directory)/'request.json'
    request.write_bytes(base64.b64decode('${packet}',validate=True))
    request.chmod(0o600)
    result=subprocess.run([sys.executable,'-I','-B','-S',str(producer),'--request',str(request),'--output','product-image-receipt.json'],timeout=1600,check=False)
    raise SystemExit(result.returncode)
MERI_PRODUCT_BUILD`;
 const buildspec={version:0.2,env:{shell:'bash'},phases:{build:{'on-failure':'ABORT',commands:[bootstrap]}},artifacts:{files:['product-image-receipt.json'],'discard-paths':'yes'}};
 const buildspecJson=JSON.stringify(buildspec,null,2)+'\n';
 return Object.freeze({status:'OFFLINE_RECIPE_ONLY',buildspecJson,buildspecSha256:hash(buildspecJson),requestSha256:hash(requestJson)});
}
