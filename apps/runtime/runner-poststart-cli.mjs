/** Product runner entry point. No run credential or private key is supplied by ECS.
 * The fixed, nonsecret pins select the protected control endpoint and its CA;
 * the poststart owner then writes one task-local bundle before runtime CLI load. */
import {pathToFileURL} from 'node:url';
import {main as runRuntime} from './cli.mjs';
import {runRunnerPoststart,releaseRunnerPoststart} from './runner-poststart-bootstrap.mjs';
import {createPinnedNativeFetch} from './pinned-native-transport.mjs';

const REFUSED='RUNNER_POSTSTART_STARTUP_REFUSED';
const fail=()=>{throw Error(REFUSED);};
const hex64=/^[a-f0-9]{64}$/u;
function pins(environment){
 if(environment.MERI_PRODUCT_PREVIEW_REQUIRED!=='1'||
    typeof environment.MERI_POSTSTART_CONTROL_ORIGIN!=='string'||
    typeof environment.MERI_POSTSTART_CA_BASE64!=='string'||
    !hex64.test(environment.MERI_POSTSTART_CA_SHA256)||
    typeof environment.ECS_CONTAINER_METADATA_URI_V4!=='string'||
    !hex64.test(environment.MERI_RUNNER_SHA256))fail();
 const origin=new URL(environment.MERI_POSTSTART_CONTROL_ORIGIN);
 if(origin.protocol!=='https:'||origin.origin!==environment.MERI_POSTSTART_CONTROL_ORIGIN||
    origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||
    environment.MERI_POSTSTART_CA_BASE64.length>21848)fail();
 return Object.freeze({origin:origin.origin,controlCaBase64:environment.MERI_POSTSTART_CA_BASE64,
  controlCaSha256:environment.MERI_POSTSTART_CA_SHA256,
  metadataUri:environment.ECS_CONTAINER_METADATA_URI_V4,directory:'/run/meri/poststart'});
}

/** One constant stderr line per failed startup: the stage and a constant error code only (never a message, value or credential),
 * so an exit 2 or 3 is diagnosable from the task log. Codes that are not constant identifiers are reported as UNKNOWN. */
const constantCode=error=>typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code)?error.code:'UNKNOWN';
const constantStep=error=>typeof error?.step==='string'&&/^[a-z][a-z-]{0,31}$/u.test(error.step)?` step=${error.step}`:'';
const stderrReport=(stage,error)=>{try{process.stderr.write(`RUNNER_STARTUP_FAILED stage=${stage}${constantStep(error)} code=${constantCode(error)}
`);}catch{}};

/** The injected ports are for inert tests only; the executable uses the real owners. */
export async function startRunnerProductTask({argv=process.argv.slice(2),environment=process.env,bootstrap=runRunnerPoststart,runtime=runRuntime,release=releaseRunnerPoststart,makeNativeFetch=createPinnedNativeFetch,report=stderrReport}={}){
 if(argv.length===1&&['--help','-h'].includes(argv[0])){
  process.stdout.write('Usage: node apps/runtime/runner-poststart-cli.mjs start\nExit: 0 completed or help; 2 startup/configuration failure; 3 runtime or cleanup failure.\n');
  return 0;
 }
 if(argv.length!==1||argv[0]!=='start')return 2;
 let fields;try{fields=pins(environment);}catch(error){report('pins',error);return 2;}
 const controller=new AbortController(),abort=()=>controller.abort();
 process.once('SIGTERM',abort);process.once('SIGINT',abort);
 let material,code=2,stage='bootstrap';
 try{
  material=await bootstrap({...fields,signal:controller.signal});
  if(controller.signal.aborted||typeof material?.configFile!=='string'||typeof material?.controlCaFile!=='string'||!material?.tls||!material?.receipt)fail();
  stage='native-transport';const nativeFetch=await makeNativeFetch({origin:fields.origin,caFile:material.controlCaFile,caSha256:fields.controlCaSha256});
  if(controller.signal.aborted)fail();
  stage='runtime';code=await runtime(['conversation-runner','--config',material.configFile],{poststartTls:material.tls,nativeFetch});
 }catch(error){report(stage,error);code=2;}
 finally{
  try{if(material)await release({directory:fields.directory,receipt:material.receipt});}
  catch(error){report('release',error);code=3;}
  process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort);
 }
 return code;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await startRunnerProductTask();
