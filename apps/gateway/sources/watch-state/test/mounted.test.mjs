import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {advertisedArguments} from '../../../../worker/conversation/reads/schema.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {familyOperations} from '../../../general-reads/registration.mjs';
const clientId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function scene({selected=false}={}){
 const base=billTextCase(),operation={id:'inspect_watch_state',version:'0.2.0'},contract=resolveOperationContract(operation),{authority,state,wire}=base;
 if(selected)Object.assign(authority.subject,{kind:'client',entityType:'client',entityIds:[clientId],scopes:[{tenantId:authority.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:authority.subject.policyRevision}]});
 authority.sourceIds=contract.descriptor.sourceRequirements.map(s=>s.sourceId);
 const request={family:'client_watchlist',clientId,targetKind:'client_tracker_watchlist',targetKey:'synthetic-watch'};
 const page={version:'0.1.0',state:{...request,identity:'synthetic-watch',state:'active',version:null,deliveryEnabled:null,facts:{name:'Synthetic 界 watch',leadCount:2}}};
 const normalizationContext={watchStateScope:{selectedClientId:selected?clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};
 return {...base,family:'watch-state',operation,contract,arguments:request,page,normalizationContext,visibleClientIds:[clientId],
  transport:{...base.transport,async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});state.afterSource?.();return Response.json(page);}}};
}
test('native discovery and actual inspect client preserve exact owner state without a decision or inferred version',async t=>{
 const s=scene(),f=await fixture(s.family,s.operation.id,{scene:s,privateUser:true}),m=await connect(t,f);
 assert.deepEqual(familyOperations('watch-state'),[s.operation]);assert.ok(m);
 const advertised=advertisedArguments(s.contract.descriptor.inputSchema).arguments;
 assert.deepEqual(advertised.parse(s.arguments),s.arguments);
 assert.equal(advertised.safeParse({...s.arguments,operation:'pause'}).success,false);
 const result=await m.call();assert.equal(result.isError,undefined,JSON.stringify(result));
 assert.deepEqual(JSON.parse(result.content[0].text).result,s.page);assert.equal(m.runtime.receipts().length,1);
 assert.equal(s.wire.length,1);assert.deepEqual(s.wire[0].body,{version:1,context:{conversationId:s.binding.conversationId,selectedClientId:null},target:s.arguments});
 assert.ok(s.wire[0].url.endsWith('/api/clio/tools/inspect_watch_state'));
 assert.equal(s.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
 assert.equal(s.wire[0].options.method,'POST');assert.equal(s.page.state.version,null);
 assert.equal(f.calls.some(path=>/prepare_watch|decide_watch/.test(path)),false);
});
test('selected-client mismatch is refused before source and current access loss withholds a completed inspect',async t=>{
 const s=scene({selected:true}),f=await fixture(s.family,s.operation.id,{scene:s}),m=await connect(t,f);
 assert.ok(m);const wrong={...s.arguments,clientId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'};
 const refused=await m.call(wrong);assert.equal(refused.isError,true);assert.equal(s.wire.length,0);assert.equal(m.runtime.receipts().length,0);
 s.state.afterSource=()=>f.setClients([]);
 const lost=await m.call();assert.equal(lost.isError,true);assert.equal(s.wire.length,1);assert.equal(m.runtime.receipts().length,0);
});
