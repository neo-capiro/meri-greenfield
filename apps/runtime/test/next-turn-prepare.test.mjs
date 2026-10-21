/** A next turn's native prepare through the real runner path: the second turn of a conversation (writer fence 2, control's facts, the
 * next-turn lineage of turn 1's checkpoint, the task's checkpoint session mirror restored over the real continuation SDK session) runs
 * the real SDK query (resume + the mirror's sessionStore) inside the remote worker (remote-composition.mjs createRemoteNativeWorker:
 * the SDK options gate and the parked task receiver with its descriptor policy, configuration capture and shape check). Control's
 * preparation authority answers with its real descriptor match (preparation-intent.mjs matchPreparedDescriptor) against its own
 * continuation; only control's transport, session owner (in memory) and the native process (never launched: start is refused) are
 * stand-ins.
 * Live 2026-10-21 10:03:30Z (candidate 9, conversation 307e2e94): turn 2's prepare was refused by the task receiver (router
 * DOWNSTREAM_REFUSED, runner REMOTE_TASK_REFUSED 403) before control's preparation authority was asked. The SDK had materialized the
 * resumed session into os.tmpdir()/claude-resume-* and launched with that CLAUDE_CONFIG_DIR, outside the run's configParentDirectory.
 * Linux only, like the runner: POSIX paths, uid-owned configuration directories, the pinned SDK. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {basename,dirname,join} from 'node:path';
import {id} from '../../control/conversations/test/store-fixture.mjs';
import {compileNativeBrokerPlan} from '../native-authority/broker-stack.mjs';
import {createRemoteNativeWorker} from '../native-authority/remote-composition.mjs';
import {compileNativePreparationIntent,matchPreparedDescriptor,launchTemplateArgs} from '../native-authority/preparation-intent.mjs';
import {query as sdkQuery} from '../../worker/conversation/agent-sdk.mjs';
import {sdkOptionsContinuation} from '../native-authority/sdk-option-template.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {fixture,projectKeyOf} from './next-turn-fixture.mjs';

const linux={skip:process.platform!=='linux'&&'the remote runner is Linux'},taskToken='synthetic-turn2-task',controlToken='synthetic-turn2-control';
const taskArn='arn:aws:ecs:us-east-1:967807252336:task/synthetic/'+'b'.repeat(32);

/** The configured launch values, measured as the in-image measurement does: the pinned SDK's spawn descriptor for a fresh run, minus its
 * run's CLAUDE_CONFIG_DIR and proxy credential, with the run workspace placeholder (launchTemplateArgs), and the launched executable's
 * hash (apps/runtime/build/first-chat-launch-measurement.mjs captureDescriptor). */
async function measureLaunch(options){
 let d=null;try{sdkQuery({prompt:'measurement',options:{...options,spawnClaudeCodeProcess(request){d={command:request.command,args:[...request.args],env:{...request.env}};throw Error('DESCRIPTOR_CAPTURED_NO_SPAWN');}}});}catch{}
 assert.ok(d,'the SDK calls the spawn hook for a fresh run');const {CLAUDE_CONFIG_DIR:_directory,ANTHROPIC_AUTH_TOKEN:_credential,...env}=d.env;
 return {launchTemplate:{command:d.command,args:launchTemplateArgs(d.args,options.cwd),env},executableSha256:createHash('sha256').update(readFileSync(realpathSync(d.command))).digest('hex')};
}

/** Turn 2 of a conversation whose turn 1 completed, its remote worker, and control's preparation authority as the worker reaches it. */
async function secondTurn(t,{resumeSessionAt=null}={}){
 const x=await fixture({measureLaunch}),first=await x.newConversation(4000),second=await x.nextTurn(first,4100,{resumeSessionAt,memory:true});
 const preparationIntent=second.facts.preparationIntent,i=compileNativePreparationIntent(preparationIntent),{original}=compileNativeBrokerPlan({runtime:second.facts.runtime,plan:second.facts.plan,preparationIntent});
 // The runner image's directories for this run (runner-poststart and conversation-runner create them before the SDK starts).
 for(const path of [i.configParentDirectory,i.secureStorageDirectory,i.workspace])rmSync(path,{recursive:true,force:true});
 for(const path of [i.configParentDirectory,i.secureStorageDirectory,i.workspace,second.options.env.CLAUDE_CONFIG_DIR])mkdirSync(path,{recursive:true,mode:0o700});
 t.after(()=>{for(const path of [i.configParentDirectory,i.secureStorageDirectory,i.workspace])rmSync(path,{recursive:true,force:true});});
 // Control's preparation authority: its own continuation of this run (its saved lineage gives the same options as the task's
 // restoration) and its exact descriptor match. Start is refused: this turn is checked through prepare, never launched.
 const continuation=sdkOptionsContinuation(second.mirror.session.restoration(),{binding:second.binding,workspace:i.workspace}),prepared=[];
 const ack=input=>({original:input.original,descriptorSha256:input.descriptorSha256,configTreeSha256:input.configTreeSha256,preparationId:id(4199),taskArn,checkedAtMs:Date.now(),expiresAtMs:original.expiresAtMs});
 const native={async call(operation,input){
  if(operation==='runner/native/prepare'){const d=matchPreparedDescriptor(input.descriptor,preparationIntent,second.facts.runtime.proxyCredential,continuation);
   const transcript=join(d.env.CLAUDE_CONFIG_DIR,'projects',projectKeyOf(i.workspace),second.lineage.checkpoint.sessionId+'.jsonl');
   prepared.push({descriptor:d,transcript:readFileSync(transcript,'utf8')});return ack(input);}
  if(operation==='runner/native/verify')return ack(input);
  throw Error('synthetic control refusal: '+operation);
 }};
 let worker;const fetchImpl=(url,options)=>worker.application.handle(new Request(url,options));
 worker=createRemoteNativeWorker({original,preparationIntent,controlCapabilitySha256:capabilityDigest(controlToken),taskCapabilitySha256:capabilityDigest(taskToken),taskArn,native,
  processTransport:{original,origin:'https://synthetic-task.invalid',credential:taskToken,fetchImpl},session:second.mirror.session,enabled:true,limits:{maxRequestMs:12000}});
 t.after(()=>worker.close());
 // conversation-runner prepareRuntime hands the SDK the mirror's store; the activity's options are otherwise the worker's.
 const query=worker.query({prompt:'A second prompt in the same conversation.',options:{...second.options,sessionStore:second.mirror.prepared.store}});
 t.after(()=>query.close());
 const messages=query[Symbol.asyncIterator](),outcome=await messages.next().then(()=>'answered',error=>error.code??error.message);
 return {second,i,prepared,outcome,worker};
}

test('a second turn\'s resumed SDK session is prepared by the task receiver and control\'s preparation authority',linux,async t=>{
 const r=await secondTurn(t);
 assert.equal(r.prepared.length,1,`the receiver must reach control's preparation authority (turn outcome ${r.outcome})`);
 const d=r.prepared[0].descriptor;
 // The SDK's materialized session directory is the CLI's configuration directory, directly under the run's private parent.
 assert.equal(dirname(d.env.CLAUDE_CONFIG_DIR),r.i.configParentDirectory);assert.match(basename(d.env.CLAUDE_CONFIG_DIR),/^claude-resume-/u);
 assert.ok(d.args.includes('--resume='+r.second.lineage.checkpoint.sessionId),JSON.stringify(d.args));
 // It holds turn 1's transcript, restored from the checkpoint through the mirror.
 assert.match(r.prepared[0].transcript,/first turn/u);
 // Prepared; start is refused by control here, so the turn ends there.
 assert.match(String(r.outcome),/REFUSED/u);
});

test('the worker sets its temporary root to the run\'s configuration parent only while it lives',linux,async t=>{
 const before=process.env.TMPDIR,r=await secondTurn(t);
 assert.equal(process.env.TMPDIR,r.i.configParentDirectory);
 await r.worker.close();
 assert.equal(process.env.TMPDIR,before);
});
