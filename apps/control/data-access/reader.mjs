/** The data-access center read: one row per general read family the worker can construct, for the admitted member and their
 * selected client, composed from the sources that already decide a run's reads and nothing else:
 *
 * - the registry: the catalog rows of the constructible families (`reads/availability.mjs` `familyReads`, the same rows the
 *   worker gates and `scripts/retrieval-audit.mjs` reconciles) with their model-facing guidance (`reads/family-guidance.mjs`);
 * - the installation: the control's approved read operations (`agentcore.approvedReads.operations`), the gateway's
 *   `installation.operations` for every run;
 * - the policy: platform ∧ tenant ∧ role from the canonical resolver (`capability-policy.mjs` `forActor`), the gate the
 *   gateway's `readAvailability` applies per run (`generalReads`, `readFamilies`, `activeReadOperations`);
 * - the describe path's retained relation names (`sources/capiro-data/handler.mjs`, `capiro-data-validation.mjs`).
 *
 * It is a view: it reads no source, mints nothing and changes no policy. Current membership is the product gate's; the client
 * must be one the admitted principal holds. A run still applies every gate again on each call. */
import {familyReads} from '../../worker/conversation/reads/availability.mjs';
import {READ_FAMILIES} from '../../worker/conversation/reads/families.mjs';
import {READ_FAMILY_GUIDANCE} from '../../worker/conversation/reads/family-guidance.mjs';
import {RETAINED_PUBLIC_RELATIONS} from '../../gateway/sources/capiro-data/handler.mjs';
import {RETAINED_CAPIRO_PRIVATE_RELATIONS} from '../../../packages/contracts/retrieval-0.2/capiro-data-validation.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
import {DATA_ACCESS_STATES} from './protocol.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const fail=(code,field=null)=>{throw new ProductError(code,null,field);};
/** Families whose reads need a connection the member owns besides policy (the gateway refuses a mail read without a mailbox). */
const REQUIREMENTS=Object.freeze({mail:'mailbox'});
/** The text-to-SQL families: the published relations are readable when any of them is. */
const SQL_FAMILIES=Object.freeze(['capiro-data','capiro-data-v3','capiro-data-v4','capiro-data-v5']);
const rank=state=>DATA_ACCESS_STATES.indexOf(state);
/** The registry rows grouped by family, sorted, each with its guidance. Computed once: the catalog and guidance are static. */
function registry(){
 const byFamily=new Map();
 for(const row of familyReads()){if(!byFamily.has(row.family))byFamily.set(row.family,[]);byFamily.get(row.family).push(row.operation);}
 return Object.freeze([...byFamily.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([family,operations])=>{
  const guidance=READ_FAMILY_GUIDANCE[family];
  return Object.freeze({family,operations:Object.freeze(operations),clientScope:READ_FAMILIES[family].clientScope,
   covers:guidance?.covers??null,freshness:guidance?.returns??null,structured:guidance?.structured===true,requires:REQUIREMENTS[family]??null});
 }));
}
export function createDataAccessReader(configuration){
 const c=own(configuration,['installed','policyForActor','now']);
 if(!Array.isArray(c.installed)||typeof c.policyForActor!=='function'||typeof c.now!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const installed=new Set(data(c.installed).map(hash)),families=registry();
 function request(value,principal){
  let r;try{r=data(own(value,['clientId']));}catch{fail('DATA_ACCESS_REQUEST_INVALID');}
  if(r.clientId!==null&&(typeof r.clientId!=='string'||!UUID.test(r.clientId)))fail('DATA_ACCESS_REQUEST_INVALID','clientId');
  // The client is a presentation hint; only a client the current admission holds is described.
  if(r.clientId!==null&&!principal.clientIds.includes(r.clientId))fail('DATA_ACCESS_CLIENT_REFUSED','clientId');
  return r;
 }
 function state(entry,policy,clientId){
  const present=entry.operations.filter(op=>installed.has(hash(op)));
  if(present.length===0)return 'not_installed';
  const active=new Set(policy?.activeReadOperations?.map(hash)??[]);
  if(policy?.generalReads!==true||!policy.readFamilies.includes(entry.family)||!present.some(op=>active.has(hash(op))))return 'policy_off';
  if(entry.clientScope==='required'&&clientId===null)return 'client_required';
  return 'available';
 }
 return Object.freeze({
  async read({principal,request:raw,signal}){
   nativeSignal(signal);const r=request(raw,principal);
   let policy;
   try{policy=await c.policyForActor({tenantId:principal.tenantId,actorRole:principal.role,signal});}
   catch(error){const owned=productFailure(error);if(owned&&['DEADLINE','CANCELLED'].includes(owned.code))throw error;fail('DATA_ACCESS_POLICY_UNAVAILABLE');}
   signal?.throwIfAborted();
   const rows=families.map(entry=>({family:entry.family,covers:entry.covers,freshness:entry.freshness,structured:entry.structured,clientScope:entry.clientScope,
    state:state(entry,policy,r.clientId),requires:entry.requires}));
   const sql=rows.filter(row=>SQL_FAMILIES.includes(row.family)).reduce((best,row)=>rank(row.state)>rank(best)?row.state:best,'not_installed');
   const relations=[...RETAINED_PUBLIC_RELATIONS.map(name=>({name,source:'public',state:sql})),
    ...RETAINED_CAPIRO_PRIVATE_RELATIONS.map(name=>({name,source:'client_records',state:sql==='available'&&r.clientId===null?'client_required':sql}))];
   return data({schemaVersion:'meri.data-access/1',checkedAt:new Date(c.now()).toISOString(),clientId:r.clientId,generalReads:policy?.generalReads===true,families:rows,relations});
  },
 });
}
