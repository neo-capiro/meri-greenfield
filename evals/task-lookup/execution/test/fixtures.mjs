import {fixture} from '../../../../apps/control/task-lookup/fixtures.mjs';
import {input,sign,options} from '../../test/fixtures.mjs';
import {hash,semanticResult} from '../../contracts.mjs';
import {freezeCorpus,runnerCases} from '../../corpus.mjs';
export async function setup({mode='correct-tool',expected='returned'}={}){
 const f=fixture();const gold=JSON.parse(await f.gateway.executeOwned());f.calls.length=0;
 const raw=input(),c=raw.cases[0];c.mode=mode;c.context={binding:structuredClone(f.context.binding),clientResolution:{reference:f.context.selectedClientId,clientId:f.context.selectedClientId}};c.request={...f.request,clientId:f.context.selectedClientId};c.scopes=structuredClone(f.context.scopes);c.expected={outcome:expected,semanticSha256:expected==='returned'?hash(semanticResult(gold)):null,replaySha256:null,recordIds:[],absence:false,exhaustive:false};sign(raw);
 const frozen=freezeCorpus(raw,options(raw)),runners=['development','calibration','held-out'].map(split=>runnerCases(frozen,{split}));
 const args={runners,runnerSha256:runners.map(hash),runBindings:[{caseId:c.caseId,binding:structuredClone(f.context.binding)}],runId:'typed-replay',deadlineMs:f.state.now+2000};
 let prepareCalls=0;const config={gateway:f.gateway,store:f.store,authorize:f.authorize,clock:f.clock,prepareCase:async()=>{prepareCalls++;return {context:f.context,readContext:f.readContext,credential:'inert-secret-not-evidence'};}};
 return {f,raw,frozen,args,config,get prepareCalls(){return prepareCalls;}};
}
