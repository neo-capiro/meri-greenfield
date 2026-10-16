/** Named composition gaps, separate from infrastructure liveness. Presence never claims release or live qualification. */
export function productReadiness({ports,retention,sourceEnabled}){
 const available=new Set(ports.configuredOwners??[]),owners=[];
 for(const [name,port] of [['authority.identity','identityContext'],['lifecycle.currentAuthority','transitionAuthority'],['lifecycle.admissionRetirement','continuationAdmission'],
  ['lifecycle.approvals','approvals'],['artifacts.options','artifactOptionsOwner'],['artifacts.privateStore','artifactStore'],['actions.application','actionApplication'],
  ['tasks.selected','selectedController'],['sessions.sdk','sdkSessionOwner'],['sessions.snapshot','sdkSessionSnapshot'],['history.membership','conversationMembership'],['history.nextTurn','conversationTurns']])
  owners.push({name,state:available.has(port)?'composed':'unavailable'});
 owners.push({name:'retention.startup',state:retention?'composed':'unavailable'},
  {name:'retention.ledgerSink',state:available.has('retentionLedgerSink')?'composed':'unavailable'},
  {name:'sources.currentInstallation',state:sourceEnabled?'unavailable':'disabled'},
  {name:'proxy.modelGrants',state:'unavailable'},
  {name:'schedules.dispatchWorker',state:'unregistered-placement-pending'});
 return Object.freeze({schema:'meri.product-readiness/1',ready:owners.every(o=>o.state==='composed'),owners:Object.freeze(owners.map(Object.freeze)),
  missingOwners:Object.freeze(owners.filter(o=>o.state!=='composed').map(o=>o.name))});
}
