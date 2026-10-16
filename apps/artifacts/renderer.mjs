/** Qualified-renderer port: the one way an office converter reaches the artifact executor (PDF generation) or the preview
 * owner. A port is `available` only for a trusted renderer admission record whose sandbox requirements are all attested;
 * every other state is a closed `unavailable` reason, and an unavailable port's `transform` throws
 * ARTIFACT_RENDERER_UNAVAILABLE before any workspace or process exists.
 *
 * The admission record is issued by the renderer qualification owner for one exact image and executable; this module only
 * checks its shape and binds it. It does not qualify a host, run a probe, read files or open connections. A callback, a
 * health check or a path string is not an admission. Construction performs no IO. */
import {isAbsolute} from 'node:path';
import {createLibreOfficeTransformer} from './office-transform.mjs';

/** Every requirement must be attested `true` by the qualification owner for the admitted image. */
export const RENDERER_SANDBOX_REQUIREMENTS=Object.freeze([
 'nonRootUser',            // the converter runs as a dedicated non-root user
 'noNetwork',              // no network namespace route: no egress, no listening sockets
 'readOnlyRootFilesystem', // image filesystem read-only; only the owned per-call workspace is writable
 'noNewPrivileges',        // no_new_privs set; no setuid escalation
 'dropAllCapabilities',    // empty capability set
 'privateWorkspace',       // per-call private workspace and profile, removed after each call
 'boundedResources',       // CPU, memory, process-count and file-size limits enforced by the host
 'noCredentials',          // no cloud, database, provider or session credential in env, files or metadata reach
]);
export const RENDERER_UNAVAILABLE_REASONS=Object.freeze(['RENDERER_NOT_ADMITTED','RENDERER_ADMISSION_INVALID','RENDERER_SANDBOX_UNQUALIFIED']);
const ADMISSION_KEYS=['rendererId','rendererVersion','executable','imageDigest','qualificationId','sandbox'];
const ports=new WeakSet();
const error=code=>Object.assign(new Error(code),{code});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const exactKeys=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptors(value),k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'));

function unavailable(reason,missing=[]){
 const port=Object.freeze({state:'unavailable',reason,admission:null,missingRequirements:Object.freeze([...missing]),async transform(){throw error('ARTIFACT_RENDERER_UNAVAILABLE');}});
 ports.add(port);return port;
}
/** `{admission}` when the record is a complete, fully attested admission; otherwise `{reason, missing}`. */
function admit(value){
 if(value===undefined||value===null)return {reason:'RENDERER_NOT_ADMITTED'};
 if(!exactKeys(value,ADMISSION_KEYS)||!exactKeys(value.sandbox,Object.keys(value.sandbox??{})))return {reason:'RENDERER_ADMISSION_INVALID'};
 const a=value;
 if(a.rendererId!=='libreoffice'||typeof a.rendererVersion!=='string'||!/^[0-9][0-9A-Za-z.+-]{0,63}$/u.test(a.rendererVersion)||typeof a.executable!=='string'||!isAbsolute(a.executable)||
  typeof a.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(a.imageDigest)||typeof a.qualificationId!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/u.test(a.qualificationId)||
  Object.keys(a.sandbox).some(k=>!RENDERER_SANDBOX_REQUIREMENTS.includes(k)))return {reason:'RENDERER_ADMISSION_INVALID'};
 const missing=RENDERER_SANDBOX_REQUIREMENTS.filter(k=>a.sandbox[k]!==true);
 if(missing.length)return {reason:'RENDERER_SANDBOX_UNQUALIFIED',missing};
 return {admission:Object.freeze({...a,sandbox:Object.freeze({...a.sandbox})})};
}

/** Binds `transformer` (`{transform}`) under `admission`. The admitted receipt names the qualification it ran under. */
export function createRendererPort({admission,transformer}){
 const result=admit(admission);if(!result.admission)return unavailable(result.reason,result.missing);
 if(typeof transformer?.transform!=='function')return unavailable('RENDERER_ADMISSION_INVALID');
 const transform=transformer.transform.bind(transformer),bound=result.admission;
 const port=Object.freeze({state:'available',reason:'RENDERER_ADMITTED',admission:bound,missingRequirements:Object.freeze([]),
  async transform(call){const out=await transform(call);return {bytes:out.bytes,receipt:{...out.receipt,qualificationId:bound.qualificationId,imageDigest:bound.imageDigest}};}});
 ports.add(port);return port;
}
/** The LibreOffice binding: the admitted executable must be exactly the configured one. */
export function createLibreOfficeRendererPort({admission,executable,tempRoot}){
 const result=admit(admission);if(!result.admission)return unavailable(result.reason,result.missing);
 if(typeof executable!=='string'||executable!==result.admission.executable||typeof tempRoot!=='string'||!isAbsolute(tempRoot))return unavailable('RENDERER_ADMISSION_INVALID');
 return createRendererPort({admission,transformer:createLibreOfficeTransformer({executable,tempRoot})});
}
/** True only for ports constructed by this module (raw converters and look-alike objects are refused by composition). */
export const isRendererPort=value=>ports.has(value);
/** The converter to hand to an executor or preview owner: the port when available, otherwise null (fail closed). */
export const admittedConverter=port=>isRendererPort(port)&&port.state==='available'?port:null;
/** Inert evidence projection of a port's state; no secret or path beyond the admitted record. */
export function describeRenderer(port){
 if(!isRendererPort(port))return {state:'unavailable',reason:'RENDERER_NOT_ADMITTED',sandboxRequirements:RENDERER_SANDBOX_REQUIREMENTS};
 const a=port.admission;
 return {state:port.state,reason:port.reason,sandboxRequirements:RENDERER_SANDBOX_REQUIREMENTS,missingRequirements:port.missingRequirements,
  ...(a?{rendererId:a.rendererId,rendererVersion:a.rendererVersion,imageDigest:a.imageDigest,qualificationId:a.qualificationId}:{})};
}
