# Bounded session transition authority: review request

Status: PROPOSED ONLY. No session-owner or public lifecycle contract implementation is included. Source acceptance, PostgreSQL qualification, and complete two-turn acceptance are separate gates.

## Exact proposed internal interface

Add an optional trusted `readTransition` constructor port and an internal `verifyTransition` method to `apps/control/action-host/session/owner.mjs`. The lifecycle composition supplies the port from the canonical lifecycle journal, never from HTTP/browser/model arguments.

```js
await sessions.verifyTransition({
  credential, controlId, sourceBinding, targetBinding,
  admissionReceiptId, retirementReceiptId, purpose, signal, deadlineMs
});
// Success: bounded {checkedAtMs, expiresAtMs, transitionSha256}.
// Refusal: ActionSessionError('SESSION_REFUSED').
// Return facts are deadline/equality data only, never reusable authority.
// No replacement credential or updated session is returned.
```

Every invocation performs fresh checks. `purpose` is exactly `dispatch-start`, `dispatch-continued`, `commit-applied`, or `receipt-readback`, selected only by trusted lifecycle code. The first three require DISPATCHING; `dispatch-continued` also requires resume. `receipt-readback` is effect-free and permits only APPLIED. The method itself enforces purpose/state; wrappers cannot infer permission from an untyped successful check. `retirementReceiptId` is a UUID for resume and null for fork. Bindings use the existing full RunBinding schema. IDs and bindings supplied by the lifecycle service are equality assertions, not authority. The trusted reader must independently return the exact committed transition under canonical conversation locking:

```js
readTransition({sourceBinding, controlId, signal, deadlineMs})
// bounded JSON candidate; field names require root approval:
// {controlId, intent, state, inputSha256, sourceBinding, targetBinding,
//  scopes, selectedClientId, policyRevision, admissionReceiptId,
//  retirementReceiptId, admissionExpiresAtMs, retirementExpiresAtMs,
//  checkpointId, checkpointSha256, sourceRequestSha256, contextSha256,
//  targetSessionId, resumeSessionAt,
//  targetExpiresAtMs, checkedAtMs, expiresAtMs}
```

`state` must be DISPATCHING with a committed immutable target, or APPLIED solely for receipt reconciliation. UNKNOWN or missing/mismatched facts refuse and never authorize another dispatch. Fork has no retirement expiry. The reader must validate canonical projection hashes, source/control/target linkage, target currentness and nonterminal state, and admission/retirement owner receipts. Cached caller copies do not suffice. If the existing owners cannot provide a currently valid target deadline or revocation fact, refuse rather than invent one. No migration is implied by this proposal.

Define `transitionSha256` as the existing canonical SHA-256 of exactly `{controlId,intent,inputSha256,sourceBinding,targetBinding,scopes,selectedClientId,policyRevision,admissionReceiptId,retirementReceiptId,checkpointId,checkpointSha256,sourceRequestSha256,contextSha256,targetSessionId,resumeSessionAt}` from validated canonical owner facts. State, purpose, checkedAt and rolling expiry are excluded, so DISPATCHING-to-APPLIED and deadline shortening cannot spuriously change immutable equality. Preserve scope order from the canonical projection. No caller-selected hash or receipt can establish this mapping. A target that becomes terminal before a required recheck yields refusal/UNKNOWN under the stated policy; this proposal does not promise liveness for that race.

The session owner finds the existing opaque session and retains its original native credential. It checks existence, revocation, session revision, original principal/identityRevision, full original source binding, selected client and scopes. Verify current native identity and resolve target context with that credential through a dedicated trusted target-context resolution path. Compare the returned target exactly to the committed mapping; preserve tenant/actor/client/scopes/policy. Do not invoke existing `resolve(..., record)` with a target record or mutate the original context/hints: that resolver intentionally pins source context. Fork also requires an explicitly supported separately owned target conversation; no widening of the fixed-conversation selector.

The operation deadline is the minimum caller deadline, existing maxRequestMs, original session expiry, current identity/context expiry, admission expiry, required retirement expiry and target deadline. It can only decrease. Return that minimum as `expiresAtMs`; the lifecycle closure must synchronously call its existing `life.limitDeadline(facts.expiresAtMs)` and `life.check()` before invoking the exact effect through `life.run`. Thus the effect's actual signal/timer is capped, rather than merely detecting expiry afterward. Every subsequent before/after verification can only shorten the same outer lifetime. Check record membership and revocation again after each await. Never extend the stored original expiry or issue a new identity revision. Invalid identity, expiry, or revocation invalidates the session as today. A well-formed but mismatched transition refuses without making a historical session current.

## Lifecycle call-site change after approval

Keep the existing source `fresh()` checks through native retirement/admission and before committing `journal.continuation`. After commit, replace only the source `fresh()` calls that surround the exact target start, exact source continued notification, and journal DISPATCHING-to-APPLIED receipt change with a closure calling the proposed `verifyTransition` on that committed mapping. Each effect is bounded and checked before and after. The closure is private to this control invocation and cannot authorize history, publish, cancel, arbitrary target selection, new admission, or another control. Precommit behavior and all unrelated operations keep the existing source checks.

Use the existing deterministic workflow/effect identity. After start, reverify `dispatch-start`; before/after continued use `dispatch-continued`; before the journal change use `commit-applied`, then after APPLIED commit use effect-free `receipt-readback`. State/purpose mismatch refuses. A lost start/continued acknowledgment or cancellation/revocation after an effect remains UNKNOWN, even if the physical effect happened. Do not catch refusal by repinning a session, repeating admission, or retrying a model/task effect.

**Explicitly deferred replay entry:** the current control entry still calls ordinary source `fresh()` before reading its journal. After a committed same-conversation transition, that path refuses and may remove the stale session record. This proposal only repairs the original in-flight invocation; it does not make a repeated historical-source request reach `receipt-readback`. A separate narrowly reviewed read-only reconciliation entry would be needed for that behavior. Until then, tests must assert refusal and zero new effects for repeated stale-source requests, not successful receipt recovery. Existing replays while the source is still current keep their original saved-receipt behavior. No liveness or exact historical-session replay acceptance is claimed. UNKNOWN never permits dispatch through either path.

## Ownership requested from root

- Session owner and its focused tests: internal port, bounded identity/target checks and refusal semantics.
- Canonical lifecycle journal: read-only transition fact adapter with immutable mapping and current target/revocation validation.
- Lifecycle service and its focused composition tests: narrowly switch postcommit checks for this exact transition.
- Composition: inject the trusted reader/target context owner; no public endpoint, DTO, or generic historical authorization.

Root must approve this interface and allocate those shared paths before edits. Public conversation cursor/run listing remains a separate unimplemented proposal.

## Required acceptance controls

Actual composed selector/session/lifecycle pause-resume must start exactly one successor and notify once. Exercise revocation/cancellation between commit and each effect; original session expiry; identity revision/principal/client/scope/policy changes; substituted target/control/receipts; purpose/state substitution; target/admission deadline shorter than the outer lifetime (actual effect signal must abort); current-source replay versus explicitly refused historical-source replay; lost workflow ACK; fork isolation; stale run-2 session after run-3 acceptance; and UNKNOWN no redispatch. Use actual session owner, canonical journal and dispatch adapter rather than separate passing port fixtures. Linux/PG migration and trigger checks, real durable issuer binding, separately designed replay reconciliation and a complete two-turn run remain distinct gates.

Independent review identified the initial purpose, deadline propagation and unreachable replay-entry gaps. The first two are addressed above at proposal level; the third is explicitly deferred rather than represented as working. No session-owner implementation has been made.

## Source excerpts for root review

Excerpts are from source pin `9f2c04b9f566760677befbd4d2de3b1752d15bda`; line numbers refer to the real files. Full files remain the authoritative context.

`apps/control/action-host/session/owner.mjs`:31

```js
31:   own(identity.principal,['tenantId','actorId']);if(Object.values(identity.principal).some(v=>typeof v!=='string'||!v||v.length>256)||typeof identity.identityRevision!=='string'||!identity.identityRevision||identity.identityRevision.length>256)deny();
32:   if(record)valid(record,t.signal);
33:   if(record&&(!same(identity.principal,record.identity.principal)||identity.identityRevision!==record.identity.identityRevision))deny();
34:   started=active(t.signal);const current=fact(await t.run(signal=>resolveContext({identityCredential:nativeCredential,identity,identitySha256:canonicalSha256(identity),hints:selected,signal,deadlineMs:t.deadline()})),['identitySha256','binding','scopes','selectedClientId','contextRevision','checkedAtMs','expiresAtMs'],started,t);
35:   if(record)valid(record,t.signal);validateShape('RunBinding',current.binding);if(current.identitySha256!==canonicalSha256(identity)||current.binding.tenantId!==identity.principal.tenantId||current.binding.actorId!==identity.principal.actorId||typeof current.selectedClientId!=='string'||!uuid.test(current.selectedClientId)||typeof current.contextRevision!=='string'||!current.contextRevision||current.contextRevision.length>256||!Array.isArray(current.scopes)||!current.scopes.length||current.scopes.length>100)deny();
36:   for(const scope of current.scopes){validateShape('Scope',scope);if(scope.tenantId!==identity.principal.tenantId)deny();}
37:   if(new Set(current.scopes.map(canonicalSha256)).size!==current.scopes.length||!current.scopes.some(s=>s.kind==='client'&&s.resourceId.toLowerCase()===current.selectedClientId))deny();
38:   for(const key of ['conversationId','runId'])if(selected[key]!==undefined&&selected[key]!==current.binding[key])deny();if(selected.clientId!==undefined&&selected.clientId!==current.selectedClientId)deny();
39:   const context=data({binding:current.binding,scopes:current.scopes,selectedClientId:current.selectedClientId,contextRevision:current.contextRevision});if(record&&!same(context,record.context))deny();
40:   const expiresAtMs=Math.min(identity.expiresAtMs,current.expiresAtMs,record?.expiresAtMs??ceiling);t.limitDeadline(expiresAtMs);active(t.signal);t.check();return {identity,context,expiresAtMs};
```

`apps/control/action-host/session/owner.mjs`:48

```js
48:  async function authenticateSession(value){const {credential,signal,deadlineMs}=own(value,['credential'],['signal','deadlineMs']);if(typeof credential!=='string'||!/^action_session_[A-Za-z0-9_-]{43}$/u.test(credential))deny();const r=sessions.get(hash(credential));valid(r,signal);const t=life(Math.min(deadlineMs??r.expiresAtMs,r.expiresAtMs),signal);
49:   try{const current=await resolve(r.nativeCredential,r.hints,t,r);valid(r,t.signal);r.expiresAtMs=current.expiresAtMs;const b=r.context.binding,out=data({principal:{sessionId:r.sessionId,tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId},sessionRevision:r.sessionRevision,checkedAtMs:active(t.signal),expiresAtMs:r.expiresAtMs});t.check();r.receipts.add(canonicalSha256(out));if(r.receipts.size>64)r.receipts.delete(r.receipts.values().next().value);release(r,t);return out;}catch{remove(r);deny();}finally{t.close();}
50:  }
51:  async function readCurrentState(value){const {authentication,signal,deadlineMs}=own(value,['authentication'],['signal','deadlineMs']),a=data(authentication);const r=ids.get(a.principal?.sessionId);valid(r,signal);if(!r.receipts.has(canonicalSha256(a)))deny();const t=life(Math.min(deadlineMs??r.expiresAtMs,r.expiresAtMs),signal);
52:   try{const current=await resolve(r.nativeCredential,r.hints,t,r);valid(r,t.signal);r.expiresAtMs=current.expiresAtMs;t.check();const out=data({authenticationSha256:canonicalSha256(a),binding:current.context.binding,scopes:current.context.scopes,selectedClientId:current.context.selectedClientId,checkedAtMs:active(t.signal),expiresAtMs:r.expiresAtMs});release(r,t);return out;}catch{remove(r);deny();}finally{t.close();}
53:  }
```

`apps/control/conversations/lifecycle/service.mjs`:13

```js
13:  async function operation(credential,signal,body){const life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal,errorFactory:code=>Object.assign(new Error(code),{code})});let pinned;
14:   async function fresh(){
15:    const started=now(),authentication=bounded(await life.run(signal=>sessions.authenticateSession({credential,signal,deadlineMs:started+maxRequestMs}))),current=bounded(await life.run(signal=>sessions.readCurrentState({authentication,signal,deadlineMs:started+maxRequestMs}))),saved=bounded(await life.run(signal=>service.history({credential,after:0,limit:1,signal})),2097152);
16:    if(current.authenticationSha256!==hash(authentication)||!same(current.binding,saved.run.binding)||!same(current.scopes,saved.run.scopes)||['tenantId','actorId','conversationId','runId'].some(k=>authentication.principal?.[k]!==saved.run.binding[k]))fail('SESSION_REFUSED');uuid(current.selectedClientId);if(!current.scopes.some(s=>s.kind==='client'&&s.resourceId===current.selectedClientId))fail('SCOPE_REFUSED');
17:    const at=now();for(const r of [authentication,current])if(!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at)fail('SESSION_REFUSED');life.limitDeadline(Math.min(authentication.expiresAtMs,current.expiresAtMs));
18:    const selected={binding:saved.run.binding,scopes:saved.run.scopes,versions:saved.run.versions,request:saved.request,selectedClientId:current.selectedClientId};if(pinned&&!same(pinned,selected))fail('SESSION_CHANGED');pinned??=selected;life.check();return {...saved,selectedClientId:current.selectedClientId};
19:   }
20:   try{return await body(await fresh(),life,fresh);}finally{life.close();}
21:  }
22:  async function effect(life,fresh,fn){await fresh();const result=await life.run(signal=>fn(signal));await fresh();return result===undefined?undefined:bounded(result,2097152);}
```

`apps/control/conversations/lifecycle/service.mjs`:48

```js
48:    if(typeof nativeAdmission?.admit!=='function'||i.intent==='resume'&&typeof nativeAdmission?.retire!=='function')fail('NATIVE_ADMISSION_UNAVAILABLE');let retirement=null;
49:    if(i.intent==='resume'){retirement=await effect(life,fresh,signal=>nativeAdmission.retire({controlId:i.controlId,binding:b,checkpoint:verified.checkpoint,signal}));own(retirement,['binding','retirementReceiptId','expiresAtMs']);uuid(retirement.retirementReceiptId);if(!same(retirement.binding,b)||!Number.isSafeInteger(retirement.expiresAtMs)||retirement.expiresAtMs<=now())fail('NATIVE_ADMISSION_REFUSED');}
50:    const admission=await effect(life,fresh,signal=>nativeAdmission.admit({controlId:i.controlId,mode:i.intent,sourceBinding:b,checkpoint:verified.checkpoint,checkpointSha256:i.checkpointSha256,request:saved.request,scopes,selectedClientId:saved.selectedClientId,versions:saved.run.versions,signal}));own(admission,['binding','scopes','selectedClientId','admissionReceiptId','targetSessionId','expiresAtMs']);validateShape('RunBinding',admission.binding);uuid(admission.admissionReceiptId);
51:    if(i.intent==='fork'){uuid(admission.targetSessionId);if(admission.targetSessionId===verified.checkpoint.sessionId)fail('NATIVE_ADMISSION_REFUSED');}
52:    if(admission.selectedClientId!==saved.selectedClientId||!same(admission.scopes,scopes)||!scopes.some(s=>s.kind==='client'&&s.resourceId===admission.selectedClientId)||!Number.isSafeInteger(admission.expiresAtMs)||admission.expiresAtMs<=now())fail('NATIVE_ADMISSION_REFUSED');
53:    const proposed={...p,target:admission,retirement};receipt(proposed);const t=admission.binding,continuation=assertContinuationEnvelope({mode:i.intent,controlId:i.controlId,checkpoint:verified.checkpoint,checkpointSha256:i.checkpointSha256,sourceRequestSha256:hash(saved.request),contextSha256:contextHash(saved),resumeSessionAt:verified.resumeSessionAt,targetSessionId:admission.targetSessionId});
54:    const createdAt=new Date(now()).toISOString(),run={...saved.run,binding:t,state:'queued',createdAt},request={...saved.request,requestId:newId()},conversation={conversationId:t.conversationId,owner:{tenantId:t.tenantId,actorId:t.actorId},scopes,createdAt,policyRevision:run.policyRevision};const queued={...event('run.status',{state:'queued',reasonCode:null}),binding:t,scopes,sequence:1};
55:    p=await life.run(()=>journal.continuation({binding:b,scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId,admission,retirement,proof:verified,conversation,run,request,continuation,event:queued},life.check));await fresh();await effect(life,fresh,signal=>dispatcher.start({binding:t,signal}));
56:    if(i.intent==='resume'){if(typeof dispatcher.continued!=='function')fail('TEMPORAL_LIFECYCLE_UNAVAILABLE');await effect(life,fresh,signal=>dispatcher.continued({binding:b,input:{controlId:i.controlId,sourceRunId:b.runId,targetRunId:t.runId,admissionReceiptId:admission.admissionReceiptId,retirementReceiptId:retirement.retirementReceiptId},signal}));}
57:    p=await life.run(()=>journal.change({binding:b,scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId,from:'DISPATCHING',to:'APPLIED'},life.check));await fresh();return receipt(p);
58:   }catch(error){try{await life.run(()=>journal.change({binding:b,scopes,selectedClientId:saved.selectedClientId,controlId:i.controlId,from:'DISPATCHING',to:'UNKNOWN'},life.check));}catch{}throw Object.assign(new Error('LIFECYCLE_EFFECT_UNKNOWN'),{code:'LIFECYCLE_EFFECT_UNKNOWN',outcome:'UNKNOWN'});}
```

`apps/control/conversations/lifecycle/journal.mjs`:48

```js
48:  async function continuation({binding:b,scopes,selectedClientId,controlId,admission,retirement,proof,conversation,run,request,continuation,event},check){return tx(b,check,async c=>{const r=await verifyRun(c,b,scopes);const p=await lookup(c,b,controlId);check();if(!p)fail('LIFECYCLE_REFUSED');pins(p,r,b,scopes,selectedClientId);validateProof(proof,p);assertContinuationEnvelope(continuation);assertLifecycleReceipt({controlId:p.input.controlId,intent:p.input.intent,sourceBinding:b,inputSha256:p.inputSha256,state:'APPLIED',checkpointId:proof.checkpoint.checkpointId,targetBinding:admission.binding,admissionReceiptId:admission.admissionReceiptId,retirementReceiptId:retirement?.retirementReceiptId??null,replayed:false});if(!same({...p.sourceRequest,requestId:request.requestId},request)||!same(run.binding,admission.binding)||!same(run.scopes,p.scopes)||!same(run.versions,p.versions)||!same(continuation.checkpoint,proof.checkpoint)||continuation.sourceRequestSha256!==p.sourceRequestSha256||continuation.contextSha256!==p.contextSha256||continuation.controlId!==controlId||continuation.mode!==p.input.intent)fail('STORE_CORRUPT');if(p.target){if(!same(p.target,admission)||!same(p.retirement,retirement)||!same(p.proof,proof))fail('LIFECYCLE_REPLAY_REFUSED');return p;}if(p.state!=='DISPATCHING')fail('LIFECYCLE_STATE_REFUSED');
49:   if(p.input.intent==='resume'){
50:    // Authenticated cancellation can occur while native admission is awaiting a receipt.
51:    // Recheck under the same locked source-run transaction that inserts the target.
52:    if(!['paused','waiting-for-approval'].includes(r.projection.state)||!r.hold_control_id)fail('LIFECYCLE_STATE_REFUSED');
53:    const retained=await checkpointOwner(c,b,r,scopes,selectedClientId,p.input.checkpointId,check);
54:    if(r.hold_control_id!==retained.control.input.controlId||r.projection.state!==(retained.control.input.intent==='pause'?'paused':'waiting-for-approval')||retained.row.proof.checkpointSha256!==p.input.checkpointSha256||!same({...retained.row.proof,readReceiptId:proof.readReceiptId},proof))fail('CHECKPOINT_REFUSED');
55:   }
56:   const t=admission.binding;const old=(await c.query('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[t.tenantId,t.conversationId])).rows[0];check();
57:   if(old){if(p.input.intent==='fork'||hash(old.projection)!==old.projection_sha256||old.owner_actor_id!==t.actorId||!same({...old.projection,createdAt:conversation.createdAt},conversation))fail('TARGET_BINDING_REFUSED');}
58:   else await c.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[t.tenantId,t.conversationId,t.actorId,conversation,hash(conversation)]);
59:   const sequenceBase=p.input.intent==='resume'?await closeSequenceRange(c,b,rowRun,check):0;
60:   await c.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,continuation,continuation_sha256,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11)',[t.tenantId,t.conversationId,t.runId,run,hash(run),request.requestId,request,hash(request),{continuation,sourceRequest:p.sourceRequest},hash({continuation,sourceRequest:p.sourceRequest}),sequenceBase]);
61:   await c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[t.tenantId,t.conversationId,t.runId,1,event.eventId,event,hash(event)]);
62:   const next={...p,target:admission,retirement,proof,checkpointId:proof.checkpoint.checkpointId};delete next.controlSequence;await save(c,b,next);return {...next,controlSequence:p.controlSequence};});}
```

`apps/control/conversations/test/next-run-owner.test.mjs`:19

```js
19: test('known integration HOLD: source session becomes stale after resume commit, so existing postcommit fresh cannot dispatch',async()=>{const f=await fixture();try{await f.running();f.state.checkCurrentBinding=b=>f.owner.currentRun(b);await f.control({controlId:id(770),intent:'pause'});await f.claim(id(770));await f.checkpoint(id(770));const proof=f.proofs.get(id(220)),before=f.state.starts;await assert.rejects(f.control({controlId:id(771),intent:'resume',checkpointId:id(220),checkpointSha256:proof.checkpointSha256}),/LIFECYCLE_EFFECT_UNKNOWN/);assert.equal(f.state.runs.size,2,'successor insertion committed before stale authorization refused dispatch');assert.equal(f.state.starts,before,'historical source session grants no target dispatch');assert.equal(f.state.continued,0);await assert.rejects(f.owner.currentRun(binding),/NEXT_RUN_NOT_LATEST/);}finally{f.close();}});
```
