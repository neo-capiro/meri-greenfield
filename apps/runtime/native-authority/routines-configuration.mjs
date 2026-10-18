/** Routines Core wiring (control only), validated without I/O: `configuration.routines.core`
 *   {origin, serviceSecretFile, cancellationProof:{issuer, kid, publicKey:{kty:'OKP', crv:'Ed25519', x}}}
 * `origin` is Core's HTTPS origin for wire A (`POST /api/clio/routines/policy/check`) and wire B
 * (`POST /api/clio/routines/cancellation-proof`); `serviceSecretFile` holds the internal service secret Core's
 * ToolServiceSecretGuard verifies (read per call, never a native candidate credential file); `cancellationProof` pins the ONE
 * Ed25519 public key, issuer and kid of Core's routine-cancellation signer (D7-2 packet; the purpose shares no key or kid).
 * Absent `core`, policy and run control remain trusted in-process owners. JSON configuration never supplies an owner: these are
 * public facts only, and every authority decision stays with Core's live answer and the routines owners. */
import {createPublicKey} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';

/** Core's CoreEd25519Signer issuer/kid grammar (capiro-backend apps/api/src/auth/core-ed25519-signer.ts). */
export const ROUTINE_CANCEL_KID=/^[A-Za-z0-9._-]{1,64}$/u;
export const ROUTINE_CANCEL_ISSUER=/^[A-Za-z0-9][A-Za-z0-9:._/-]{0,255}$/u;
export const exactMatch=(pattern,value)=>typeof value==='string'&&pattern.exec(value)?.[0]===value;
const fault=()=>Object.assign(Error('ROUTINES_CONFIGURATION'),{code:'ROUTINES_CONFIGURATION'});
const X=/^[A-Za-z0-9_-]{43}$/u;

/** The native candidate's credential files; a routines service secret file must differ from each by path (and, per call, by bytes). */
export function routinesReservedSecretFiles(configuration){
 const candidate=configuration?.nativeCandidate;if(candidate===undefined)return Object.freeze([]);
 return Object.freeze([candidate?.identity?.credentialFile,candidate?.taskCapabilityFile,candidate?.controlCapabilityFile,candidate?.proxyCredentialFile].filter(path=>path!==undefined));
}
function filePath(value){if(typeof value!=='string'||!isAbsolute(value)||value.includes('/../')||value.includes('\\..\\')||value.length>4096)throw fault();return value;}
/** Pinned public JWK → `{kty,crv,x}` (validated: canonical base64url, 32 bytes, an Ed25519 key). */
export function routineCancellationPublicJwk(raw){
 const k=data(own(raw,['kty','crv','x']));
 if(k.kty!=='OKP'||k.crv!=='Ed25519'||typeof k.x!=='string'||!X.test(k.x)||Buffer.from(k.x,'base64url').length!==32||Buffer.from(k.x,'base64url').toString('base64url')!==k.x)throw fault();
 if(createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:k.x},format:'jwk'}).asymmetricKeyType!=='ed25519')throw fault();
 return Object.freeze({kty:'OKP',crv:'Ed25519',x:k.x});
}
/** Returns the frozen compiled `core` record, or null when `routines.core` is absent. Throws ROUTINES_CONFIGURATION otherwise. */
export function compileRoutinesCoreConfiguration(configuration){
 try{
  const routines=configuration?.routines;if(routines===undefined||routines===null||typeof routines!=='object')return null;
  if(!Object.hasOwn(routines,'core'))return null;
  const core=own(routines.core,['origin','serviceSecretFile','cancellationProof']);
  const origin=retainedOrigin(core.origin),serviceSecretFile=filePath(core.serviceSecretFile);
  if(routinesReservedSecretFiles(configuration).some(path=>path===serviceSecretFile))throw fault();
  const pin=own(core.cancellationProof,['issuer','kid','publicKey']);
  if(!exactMatch(ROUTINE_CANCEL_ISSUER,pin.issuer)||!exactMatch(ROUTINE_CANCEL_KID,pin.kid))throw fault();
  return Object.freeze({origin,serviceSecretFile,cancellationProof:Object.freeze({issuer:pin.issuer,kid:pin.kid,publicKey:routineCancellationPublicJwk(pin.publicKey)})});
 }catch{throw fault();}
}
