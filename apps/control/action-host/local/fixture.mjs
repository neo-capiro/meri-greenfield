/** Explicit local verification only: synthetic host ports, retained scripted SQL. */
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createActionHostApplication} from '../index.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));

export async function createLocalActionHostFixture(configuration){
 const {mode}=own(configuration,['mode']);
 if(mode!=='synthetic-local'||!process.env.MERI_REVIEW_SOURCE_ROOT||resolve(process.env.MERI_REVIEW_SOURCE_ROOT)!==resolve(root))throw Error('LOCAL_HOST_CONFIGURATION');
 const {setupDurableFixture}=await import('../durable/test/fixture.mjs');
 const fixture=await setupDurableFixture(),base=fixture.config.now(),started=performance.now(),cutoff=base+8000;
 let closed=false,revoked=false,hosts=0;
 const now=()=>{const value=base+Math.floor(performance.now()-started);fixture.setClock(value);return value;};
 const credential=`local_host_${randomBytes(32).toString('base64url')}`;
 const principal=data({sessionId:randomUUID(),...Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(key=>[key,fixture.f.binding[key]]))});
 function active(signal){if(closed||revoked||signal?.aborted||now()>=cutoff)throw Error('LOCAL_HOST_REFUSED');}
 const stamp=()=>({checkedAtMs:now(),expiresAtMs:cutoff});
 const receipt=call=>({authenticationSha256:canonicalSha256(call.authentication),binding:call.current.binding,...stamp()});
 const ports={
  async authenticateSession({credential:token,signal}){active(signal);if(token!==credential)throw Error('LOCAL_HOST_REFUSED');return {principal,sessionRevision:'synthetic-revision-1',...stamp()};},
  async readCurrentState({authentication,signal}){active(signal);return {authenticationSha256:canonicalSha256(authentication),binding:fixture.f.binding,scopes:fixture.t.scopes,selectedClientId:fixture.t.clientId,...stamp()};},
  async reserveLookup(call){active(call.signal);const context=fixture.lookupContext();return {...receipt(call),lookupId:context.lookupId,resultReference:context.resultReference,requestId:context.requestId,deliveryJson:context.deliveryJson,slots:context.slots};},
  async issueLookupCredential(call){active(call.signal);await fixture.t.identity.authorityPorts.verifyCapability(fixture.lookupCredential,{signal:call.signal});active(call.signal);return {...receipt(call),credential:fixture.lookupCredential};},
  async issueExecution(call){active(call.signal);return {...receipt(call),execution:fixture.call(call.proposal).execution,credential:'synthetic'};},
 };
 const close=()=>{if(!closed){closed=true;fixture.close();}};
 try{await fixture.ready(fixture.reconstruct({now}));}catch(error){close();throw error;}
 const stats=()=>data({sourceReads:fixture.state.sourceReads,taskEffects:fixture.f.state.fetches,metadataRows:fixture.metadataSql.rows.size,
  lookupRows:fixture.lookupSql.lookups.size,commandRows:fixture.f.pg.rows.size,commandInvocations:fixture.h.state().produced.size,
  commandReservations:fixture.h.state().reservations.size,commandChargeMicroUsd:fixture.h.state().budget.consumed_micro_usd,
  lookupChargeMicroUsd:fixture.readH.state().budget.consumed_micro_usd,hostsOpened:hosts,closed,revoked});
 return Object.freeze({mode,
  openHost(){active();const services=fixture.reconstruct({now});const app=createActionHostApplication({services,...ports,now,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:131072}});hosts++;return {app,credential};},
  approve(proposal){active();fixture.approve(proposal);},
  revoke(){if(closed)throw Error('LOCAL_HOST_CLOSED');revoked=true;fixture.revoke();},stats,close,
 });
}
