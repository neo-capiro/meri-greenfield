/** The browser run's artifact port: exactly the `artifacts.ingest` seam `createDownloadPort` already calls, backed
 * by the canonical ArtifactService. The run's binding and scopes travel with each request; the run deadline and
 * byte cap are this run's facts, not values the browser may choose. Nothing here invents a renderer result. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const KEYS=['binding','scopes','filename','format','mimeType','bytes','sha256','idempotencyKey','source'];
export function createBrowserArtifactPort({service,deadlineMs,maxBytes}){
 if(typeof service?.ingest!=='function'||typeof deadlineMs!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1)fail('ARTIFACT_PORT_CONFIGURATION');
 return Object.freeze({
  async ingest(request,{signal}={}){
   const input=own(request,KEYS);
   const deadline=deadlineMs();
   if(!Number.isSafeInteger(deadline)||deadline<=0)fail('ARTIFACT_PORT_DEADLINE');
   // Bytes stay a Buffer; the service owns the single hash and length check.
   return service.ingest({...input,bytes:Buffer.from(input.bytes)},{
    binding:input.binding,scopes:input.scopes,evidence:[],assets:[],deadlineMs:deadline,maxBytes},{signal});
  },
 });
}
