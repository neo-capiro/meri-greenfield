/** Named composition gaps, separate from infrastructure liveness. Presence never claims release or live qualification. */
export function productReadiness({ports,retention,sourceEnabled,userPreferences}){
 const available=new Set(ports.configuredOwners??[]),owners=[];
 for(const [name,port] of [['authority.identity','identityContext'],['lifecycle.currentAuthority','transitionAuthority'],['lifecycle.admissionRetirement','continuationAdmission'],
  ['lifecycle.approvals','approvals'],['artifacts.options','artifactOptionsOwner'],['artifacts.privateStore','artifactStore'],['actions.application','actionApplication'],
  ['tasks.selected','selectedController'],['sessions.sdk','sdkSessionOwner'],['sessions.snapshot','sdkSessionSnapshot'],['history.membership','conversationMembership'],['history.nextTurn','conversationTurns'],['intents.application','intentApplication'],['settings.tenant','settingsApplication']])
  owners.push({name,state:available.has(port)?'composed':'unavailable'});
 owners.push({name:'retention.startup',state:retention?'composed':'unavailable'},
  {name:'retention.ledgerSink',state:available.has('retentionLedgerSink')?'composed':'unavailable'},
  {name:'tasks.commands',state:sourceEnabled!==true?'disabled':available.has('taskCommandApplication')?'composed':available.has('taskCommandApplicationFactory')?ports.taskCommandApplicationFactory.state():'unavailable'},
  {name:'schedules.application',state:available.has('routinesApplicationFactory')?ports.routinesApplicationFactory.state():'unavailable'},
  {name:'schedules.inbox',state:available.has('routinesApplicationFactory')&&ports.routinesApplicationFactory.inboxState?ports.routinesApplicationFactory.inboxState():'unavailable'},
  {name:'sources.currentInstallation',state:sourceEnabled?'unavailable':'disabled'},
  {name:'proxy.modelGrants',state:'unavailable'},
  {name:'schedules.dispatchWorker',state:'separate-service-required'});
 const recovery=retention?.artifactRecovery?.();if(recovery?.required)owners.push({name:'retention.artifactRecovery',state:recovery.state});
 if(userPreferences!==undefined)owners.push({name:'settings.userPreferences',state:userPreferences});
 return Object.freeze({schema:'meri.product-readiness/1',ready:owners.every(o=>o.state==='composed'),owners:Object.freeze(owners.map(Object.freeze)),
  missingOwners:Object.freeze(owners.filter(o=>o.state!=='composed').map(o=>o.name))});
}
