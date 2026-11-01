/** Receiving metadata describes the route and its integrity only. It grants no read authority and is not deployment evidence. */
import {DATA_ACCESS_SCHEMA_ID,DATA_ACCESS_SCHEMA_VERSION} from './schema.mjs';
export const dataAccessVersion='0.1.0';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const createDataAccessMetadata=({path,limits,errorStatuses,states,requirements})=>freeze({contractVersion:dataAccessVersion,schemaId:DATA_ACCESS_SCHEMA_ID,schemaVersion:DATA_ACCESS_SCHEMA_VERSION,
 routes:{read:{method:'POST',path,response:'json'}},
 authentication:{scheme:'Bearer',authority:'native session admitted by Core membership on every request; tenant, actor, role and clients come only from that admission, never from the body'},
 limits:{requestBytes:limits.maxRequestBytes,responseBytes:limits.maxResponseBytes,requestMs:limits.maxRequestMs,jsonDepth:64,jsonNodes:100000},
 errorStatuses,states,requirements,
 semantics:{
  read:'a read-only view over the registry of constructible read families, the control\'s installed read operations and the member\'s resolved capability policy (platform, tenant, role) for the named client or General; it reads no source and changes no policy',
  state:'not_installed: no operation of the family is in this installation; policy_off: the resolved policy does not admit the family or none of its installed operations is active; client_required: the family needs a selected client and the request named none; available: a run for this member would list the family (every gate still applies on each call)',
  requires:'mailbox means the family answers only through a mailbox connection the member owns; the caller reads their own connections to say whether one is connected',
  relations:'the relation names the describe path publishes; public relations follow the best SQL family state, client_records relations also need a selected client',
  correlation:'an answer is admitted only against the captured request: it describes the same client, lists each family and relation once, and its families are sorted',
 }});
