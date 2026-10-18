/** One immutable autocommit statement per operation; borrowed pg8.23.1 pool. */
import {types} from 'node:util';
import {CommandError,data,deny,own,canonicalSha256,immutablePayload,readKey} from './binding.mjs';
function method(value,name){
 if(!value||types.isProxy(value))deny('COMMAND_CONFIGURATION');let p=value;
 while(p){if(types.isProxy(p))deny('COMMAND_CONFIGURATION');const d=Object.getOwnPropertyDescriptor(p,name);if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function')deny('COMMAND_CONFIGURATION');return d.value.bind(value);}p=Object.getPrototypeOf(p);}deny('COMMAND_CONFIGURATION');
}
function field(value,name){if(!value||types.isProxy(value))deny('COMMAND_CONFIGURATION');const d=Object.getOwnPropertyDescriptor(value,name);if(!d||!Object.hasOwn(d,'value'))deny('COMMAND_CONFIGURATION');return d.value;}
function rows(raw){const value=data(field(raw,'rows'));if(!Array.isArray(value)||value.length>1)deny('COMMAND_PREPARATION_REFUSED');return value;}
function decoded(row){const r=data(row);own(r,['payload','payload_sha256']);const p=immutablePayload(r.payload);if(canonicalSha256(p)!==r.payload_sha256)deny('COMMAND_PREPARATION_REFUSED');return p;}
export function createPostgresApprovalMetadataStore(configuration){
 const {pool}=own(configuration,['pool']),connect=method(pool,'connect'),settings=field(pool,'options');
 for(const key of ['connectionTimeoutMillis','query_timeout']){const n=field(settings,key);if(!Number.isSafeInteger(n)||n<1||n>(key==='query_timeout'?6000:5000))deny('COMMAND_CONFIGURATION');}
 const queryTimeout=Math.min(field(settings,'query_timeout'),5000);
 async function statement(text,values,check,mutation,decode){
  if(typeof check!=='function')deny('COMMAND_CONFIGURATION');let client,submitted=false,failed,value;
  try{
   check();client=await connect();check();const query=method(client,'query');check();submitted=true;
   const raw=await query({text,values,query_timeout:queryTimeout});check();value=decode(rows(raw));check();
  }catch{failed=Object.assign(new CommandError(mutation&&submitted?'APPROVAL_METADATA_UNKNOWN':'COMMAND_PREPARATION_REFUSED'),{outcome:mutation?(submitted?'UNKNOWN':'NOT_STORED'):'READ_UNAVAILABLE'});}
  finally{if(client)try{method(client,'release')(submitted&&failed?failed:undefined);}catch{failed??=Object.assign(new CommandError(mutation&&submitted?'APPROVAL_METADATA_UNKNOWN':'COMMAND_PREPARATION_REFUSED'),{outcome:mutation?(submitted?'UNKNOWN':'NOT_STORED'):'READ_UNAVAILABLE'});}}
  if(failed)throw failed;return value;
 }
 async function insert(value,check){
  const p=immutablePayload(value),r=p.record;
  return statement('INSERT INTO meri_commands.approval_metadata (tenant_id,actor_id,proposal_id,command_id,idempotency_key,command_sha256,payload_sha256,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING payload,payload_sha256',
   [r.binding.tenantId,r.binding.actorId,r.proposalId,r.commandId,r.idempotencyKey,p.commandSha256,canonicalSha256(p),JSON.stringify(p)],check,true,result=>{
    if(result.length!==1)deny('COMMAND_PREPARATION_REFUSED');const got=decoded(result[0]);if(canonicalSha256(got)!==canonicalSha256(p))deny('COMMAND_PREPARATION_REFUSED');return got;
   });
 }
 async function read(value,check){
  const k=readKey(value);
  return statement('SELECT payload,payload_sha256 FROM meri_commands.approval_metadata WHERE tenant_id=$1 AND actor_id=$2 AND proposal_id=$3',[k.tenantId,k.actorId,k.proposalId],check,false,result=>{
   if(!result.length)return null;const p=decoded(result[0]),r=p.record;
   if(r.binding.tenantId!==k.tenantId||r.binding.actorId!==k.actorId||r.proposalId.toLowerCase()!==k.proposalId.toLowerCase())deny('COMMAND_PREPARATION_REFUSED');return p;
  });
 }
 return Object.freeze({insert,read});
}
