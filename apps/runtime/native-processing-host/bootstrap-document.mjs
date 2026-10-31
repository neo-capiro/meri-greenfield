/** FIXED protected SSM Command document for the native bootstrap. Source-only contract enforcement: schema 2.2, exactly one
 *  `aws:runShellScript` step named nativeBootstrap, exactly one ENV_VAR `Payload` String parameter, no interpolation into the
 *  command text, fixed 60 s plugin timeout, Linux only. The program path is the fixed installed one; no request data can choose
 *  a command, path, environment, user, Target or document default/latest. */
export const NATIVE_BOOTSTRAP_STEP='nativeBootstrap';
export const NATIVE_BOOTSTRAP_DOCUMENT_SCHEMA='2.2';
export const NATIVE_BOOTSTRAP_INTERPOLATION='ENV_VAR';
export const NATIVE_BOOTSTRAP_ALLOWED_PATTERN='^[A-Za-z0-9_-]+$';
export const NATIVE_BOOTSTRAP_PLUGIN_TIMEOUT_SECONDS='60';
export const NATIVE_BOOTSTRAP_PROGRAM='/opt/meri/native-bootstrap.mjs';
export const NATIVE_BOOTSTRAP_NODE='/usr/local/bin/node';
export const NATIVE_BOOTSTRAP_MAX_PAYLOAD_BYTES=16384;

const fault=code=>{throw Object.assign(new Error(code),{code});};
const closed=(value,keys)=>{if(value===null||typeof value!=='object'||Array.isArray(value))fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 const actual=Object.keys(value);if(actual.length!==keys.length||keys.some(key=>!actual.includes(key)))
  fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');return value;};

/** The ONE fixed operation document. No caller-supplied input reaches this function. */
export function createNativeBootstrapDocument(){
 const command=`${NATIVE_BOOTSTRAP_NODE} ${NATIVE_BOOTSTRAP_PROGRAM}`;
 return Object.freeze({
  schemaVersion:NATIVE_BOOTSTRAP_DOCUMENT_SCHEMA,
  description:'Meri native bootstrap (prepare/install)',
  parameters:Object.freeze({Payload:Object.freeze({type:'String',interpolationType:NATIVE_BOOTSTRAP_INTERPOLATION,
   allowedPattern:NATIVE_BOOTSTRAP_ALLOWED_PATTERN})}),
  mainSteps:Object.freeze([Object.freeze({action:'aws:runShellScript',name:NATIVE_BOOTSTRAP_STEP,
   precondition:Object.freeze({StringEquals:Object.freeze(['platformType','Linux'])}),
   inputs:Object.freeze({timeoutSeconds:NATIVE_BOOTSTRAP_PLUGIN_TIMEOUT_SECONDS,runCommand:Object.freeze([command])})})]),
 });
}

/** Closed validation of the document actually published/used. Shape-only success grants nothing; the caller must also pin the
 *  reviewed document name/version/hash from protected configuration. */
export function assertNativeBootstrapDocument(document){
 const doc=closed(document,['schemaVersion','description','parameters','mainSteps']);
 if(doc.schemaVersion!==NATIVE_BOOTSTRAP_DOCUMENT_SCHEMA||typeof doc.description!=='string'||doc.description.length>200)
  fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 const parameters=closed(doc.parameters,['Payload']);
 const payload=closed(parameters.Payload,['type','interpolationType','allowedPattern']);
 if(payload.type!=='String'||payload.interpolationType!==NATIVE_BOOTSTRAP_INTERPOLATION||
  payload.allowedPattern!==NATIVE_BOOTSTRAP_ALLOWED_PATTERN)fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 if(!Array.isArray(doc.mainSteps)||doc.mainSteps.length!==1)fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 const step=closed(doc.mainSteps[0],['action','name','precondition','inputs']);
 if(step.action!=='aws:runShellScript'||step.name!==NATIVE_BOOTSTRAP_STEP)fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 const precondition=closed(step.precondition,['StringEquals']);
 if(!Array.isArray(precondition.StringEquals)||precondition.StringEquals.length!==2||
  precondition.StringEquals[0]!=='platformType'||precondition.StringEquals[1]!=='Linux')
  fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 const inputs=closed(step.inputs,['timeoutSeconds','runCommand']);
 if(inputs.timeoutSeconds!==NATIVE_BOOTSTRAP_PLUGIN_TIMEOUT_SECONDS)fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 if(!Array.isArray(inputs.runCommand)||inputs.runCommand.length!==1||
  inputs.runCommand[0]!==`${NATIVE_BOOTSTRAP_NODE} ${NATIVE_BOOTSTRAP_PROGRAM}`)
  fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 // The command text may never contain payload interpolation or a shell-interpolated variable.
 const commandText=inputs.runCommand[0];
 if(commandText.includes('{{')||commandText.includes('$'+'{')||commandText.includes('$Payload')||commandText.includes('SSM_Payload'))fault('NATIVE_BOOTSTRAP_DOCUMENT_REFUSED');
 return Object.freeze({schemaVersion:doc.schemaVersion,step:step.name,program:NATIVE_BOOTSTRAP_PROGRAM});
}

/** Bounded guest stdout rule: canonical body plus exactly ONE final LF, UTF-8 <= 20000 bytes. */
export function assertNativeBootstrapStdout(stdout){
 if(typeof stdout!=='string'||stdout.length===0||!stdout.endsWith('\n'))fault('NATIVE_BOOTSTRAP_STDOUT_REFUSED');
 if(stdout.length>20000)fault('NATIVE_BOOTSTRAP_STDOUT_REFUSED');
 if(stdout.slice(0,-1).includes('\n'))fault('NATIVE_BOOTSTRAP_STDOUT_REFUSED');
 const body=stdout.slice(0,-1);
 if(Buffer.byteLength(body,'utf8')+1>20000)fault('NATIVE_BOOTSTRAP_STDOUT_REFUSED');
 return body;
}
