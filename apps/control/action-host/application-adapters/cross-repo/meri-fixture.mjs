/** Reuses the accepted Meri local fixture; never a production mounting entry. */
import {fixture,NOW} from '../../test/fixture.mjs';
import {createPinnedCapiroEndpointFixture} from './fixture.mjs';
import {createCapiroApplicationAuthorityClient} from '../authority-http.mjs';
import {createApplicationContextAdapters} from '../context-adapter.mjs';
import {createApplicationActionHost} from '../mount.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {receiveActionResponse} from '../../../../../packages/contracts/dist/action-application.mjs';
export async function createCrossRepoMeriFixture({sourceRepository,typescriptModulePath}){
 const f=await fixture(),clock=f.t.clock,binding=f.t.f.binding,native=createPinnedCapiroEndpointFixture({sourceRepository,typescriptModulePath,now:clock,principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,clientId:f.t.clientId,expiresAtMs:NOW+8000});
 const hooks={},client=createCapiroApplicationAuthorityClient({origin:'https://capiro-fixture.invalid',fetchImpl:(...args)=>hooks.fetch?hooks.fetch(...args):native.fetchImpl(...args),now:clock,limits:{maxRequestMs:1000,maxResponseBytes:65536},enabled:true});
 const currentRun=(...args)=>hooks.run?hooks.run(...args):f.t.identity.authorityPorts.currentRun(...args);
 const adapters=createApplicationContextAdapters({client,currentRun,commandContext:f.t.commandOptions.commandContext,now:clock,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const host=createApplicationActionHost({services:f.config.services,client,currentRun,hostPorts:Object.fromEntries(['reserveLookup','issueLookupCredential','issueExecution'].map(k=>[k,f.config[k]])),now:clock,limits:f.config.limits,sessionLimits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:8000,maxFactBytes:65536},enabled:true});
 const readIdentity=()=>adapters.verifyIdentity({credential:native.nativeCredential,deadlineMs:clock()+1000});
 const readContext=identity=>adapters.resolveContext({identityCredential:native.nativeCredential,identity,identitySha256:canonicalSha256(identity),hints:{},deadlineMs:clock()+1000});
 const send=async(route,body,credential)=>{const r=await host.app.handle(new Request('http://meri-fixture.invalid/api/action-followthrough/'+route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify(body)}));const text=await r.text();return {status:r.status,value:route==='session'?JSON.parse(text):await receiveActionResponse(route,r.status,text)};};
 return {f,native,client,adapters,host,hooks,readIdentity,readContext,send,close(){host.close();native.close();f.t.identity.close();}};
}
