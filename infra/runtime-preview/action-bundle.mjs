import {createHash} from 'node:crypto';
import {validateParameters} from './parameters.mjs';
import {templateBytes} from './common.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);

/** Review packet only. No AWS commands or executor. Privately resolved values must stay private. */
export function buildActionBundle({templates,parameterSets,evidence,source,pricing,owners,bindings,existingPolicyPatches=[],now=Date.now}){
  if(!templates||!parameterSets||!evidence||!source||!pricing||!owners||!bindings||typeof now!=='function')throw Error('PACKET_CONFIGURATION');
  const records=Object.entries(templates).map(([name,value])=>{const bytes=templateBytes(value);return {name,bytes:bytes.length,sha256:hash(bytes)};});
  const blocked=[];
  for(const [name,value] of Object.entries(templates)){
    if(!parameterSets[name]){blocked.push(name+':private-parameters-unbound');continue;}
    try{validateParameters(value,parameterSets[name],evidence.network);}catch{blocked.push(name+':private-parameters-refused');}
  }
  if(!/^[a-f0-9]{40}$/u.test(source.infrastructureCommit??''))blocked.push('infrastructure-source-pin');
  for(const name of ['runtimeSourceCommit','runtimeImageDigest','bootstrapImageDigest','tlsImageDigest','temporalImageDigest','proxyImageDigest','relayImageDigest','volumeOwnershipSha256','migrationManifestSha256','issuerBindingSha256','bootstrapBindingSha256','temporalAuthorizationSha256','backendBindingSha256','frontendBindingSha256','publicCallerAllowlistSha256']){
    const value=bindings[name];if(name==='runtimeSourceCommit'?!/^[a-f0-9]{40}$/u.test(value??''):!digest(value))blocked.push(name);
  }
  for(const name of ['freshInventorySha256','sourceImageAdmissionSha256','publicPrivateTlsReadbackSha256','exactExistingPolicyReadbacksSha256'])if(!digest(evidence[name]))blocked.push(name);
  if(!Number.isSafeInteger(evidence.observedAtMs)||evidence.observedAtMs>now()||now()-evidence.observedAtMs>3600000)blocked.push('fresh-action-time-readback');
  if(pricing.currentQuotes!==true||!digest(pricing.receiptSha256)||!(pricing.totalAwsUSD>0&&pricing.totalAwsUSD<=25)||!Number.isSafeInteger(pricing.windowHours)||pricing.windowHours!==24)blocked.push('current-priced-24h-within-25USD');
  for(const name of ['shipping','watchdog','retentionDecision'])if(typeof owners[name]!=='string'||!owners[name].trim())blocked.push('owner:'+name);
  if(bindings.modelBudgetRenewed!==true)blocked.push('separate-model-budget');
  if(!digest(bindings.paidResourceStopPlanSha256))blocked.push('exact-paid-resource-stop-plan');
  for(const p of existingPolicyPatches)if(!digest(p.baselineSha256)||!digest(p.proposedSha256)||typeof p.target!=='string'||!p.target)throw Error('POLICY_PATCH_REFUSED');
  const phases=[
    {id:'P1',scope:'New Foundations template and exact existing ECR/log SG plus DNS policy patches; no production/shared routes.',template:'MeriRuntime-Preview-Foundations'},
    {id:'P2',scope:'Exact service/execution/control/proxy policies, one source-emitted original execution tuple; roleless runner.',template:'MeriRuntime-Preview-Services'},
    {id:'P3',scope:'CAS-reviewed checkpoint bucket/S3 endpoint policy additions; exact key/prefix/control role; no deletes.'},
    {id:'P4',scope:'Data template and separately hash-reviewed trusted SQL/Temporal initialization; no SQL executes from template.',template:'MeriRuntime-Preview-Data'},
    {id:'P5',scope:'Exact issuer/capsule/leaf/private DNS/bootstrap actions; no shared CA-store/hosts change.'},
    {id:'P6',scope:'One admitted source/image build and zero-count Services template; public certificate/host and actual caller binding.',template:'MeriRuntime-Preview-Services'},
    {id:'P7',scope:'Separate source-qualified service activation and bounded authentic runs/model allocation; not emitted by synthesis.'},
    {id:'P8',scope:'Exact newly owned service/task stop and paid-network withdrawal at24h; retain data. Final irreversible deletion needs fresh confirmation.'},
  ].map(p=>({...p,status:blocked.length?'HOLD_MISSING_EXECUTION_BINDINGS':'REVIEWABLE_NOT_AUTHORIZED',templateSha256:records.find(r=>r.name===p.template)?.sha256??null,approvalRequired:true}));
  return {schema:'meri.preview.action-review/1',status:blocked.length?'HOLD_MISSING_EXECUTION_BINDINGS':'REVIEWABLE_NOT_AUTHORIZED',P0:'APPROVED_24H_25USD_ONLY',P1P8Authorized:false,cloudWritesPerformed:false,source,templates:records,privateParameterSets:parameterSets,evidence,pricing,owners,existingPolicyPatches,phases,blockedBy:blocked,irreversibleDeletionAuthorized:false};
}
