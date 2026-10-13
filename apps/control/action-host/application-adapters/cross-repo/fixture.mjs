/** Synthetic external records; actual pinned owners evaluate every emitted predicate. */
import {createPinnedEndpoint} from './endpoint.mjs';
const clone=value=>structuredClone(value);
function match(row,where){
 if(!row)return false;
 for(const [key,value]of Object.entries(where??{})){
  if(key==='OR'){if(!value.some(w=>match(row,w)))return false;continue;}
  if(key==='AND'){if(!value.every(w=>match(row,w)))return false;continue;}
  const current=row[key];
  if(value&&typeof value==='object'&&!(value instanceof Date)){
   if(Object.hasOwn(value,'in')){if(!value.in.includes(current))return false;}
   else if(Object.hasOwn(value,'not')){if(current===value.not)return false;}
   else if(Object.hasOwn(value,'some')){if(!Array.isArray(current)||!current.some(r=>match(r,value.some)))return false;}
   else if(Object.hasOwn(value,'gt')){if(!(current>value.gt))return false;}
   else if(!match(current,value))return false;
  }else if(current!==value)return false;
 }
 return true;
}
export function createPinnedCapiroEndpointFixture({sourceRepository,typescriptModulePath,now,principal,conversationId,clientId,expiresAtMs}){
 const nativeCredential='fixture-native-token',created=now()-1000;
 const tenant={id:principal.tenantId,slug:'fixture',status:'active',clerkOrgId:'org_fixture'};
 const state={closed:false,jwtValid:true,session:{id:'sess_fixture',userId:'user_fixture',status:'active',createdAt:created,expireAt:expiresAtMs,abandonAt:expiresAtMs,actor:null},
  user:{id:principal.actorId,clerkUserId:'user_fixture'},membership:{id:'membership_fixture',userId:principal.actorId,tenantId:principal.tenantId,status:'active',role:'standard_user',updatedAt:new Date(created),tenant},
  claims:{sub:'user_fixture',sid:'sess_fixture',iss:'https://fixture.invalid',exp:Math.floor(expiresAtMs/1000),capiro_tenant_id:principal.tenantId,capiro_tenant_slug:'fixture',org_id:'org_fixture'},
  conversation:{id:conversationId,tenantId:principal.tenantId,userId:principal.actorId,clientId,status:'active',archivedAt:null,metadata:{}},
  client:{id:clientId,tenantId:principal.tenantId,status:'active',memoryWall:true},
  grants:[{id:'grant_fixture',tenantId:principal.tenantId,clientId,userId:principal.actorId,createdAt:new Date(created)}],hooks:{},calls:{verifyToken:0,getSession:0,system:0,tenant:0,lastSeenUpdates:0,queries:[]}};
 const active=()=>{if(state.closed)throw Error('FIXTURE_CLOSED');};
 const query=async(model,method,args,rows)=>{active();state.calls.queries.push({model,method,where:clone(args.where??{})});await state.hooks.query?.({model,method,args});const selected=rows().filter(r=>match(r,args.where));let result=method==='findMany'?selected:selected[0]??null;
  if(model==='client'&&method==='findFirst'&&result&&args.select?.memoryAccessGrants){result={...result,memoryAccessGrants:result.memoryAccessGrants.filter(g=>match(g,args.select.memoryAccessGrants.where))};}
  return clone(result);
 };
 const userRows=()=>[state.user],memberRows=()=>[state.membership],clientRows=()=>[{...state.client,memoryAccessGrants:state.grants.filter(g=>g.clientId===state.client.id)}];
 const tx={user:{findUnique:a=>query('user','findFirst',a,userRows),findFirst:a=>query('user','findFirst',a,userRows),async update(a){active();state.calls.lastSeenUpdates++;return clone(state.user);}},tenantMembership:{findMany:a=>query('membership','findMany',a,memberRows),findFirst:a=>query('membership','findFirst',a,memberRows)},
  client:{findMany:a=>query('client','findMany',a,clientRows),findFirst:a=>query('client','findFirst',a,clientRows)},clioConversation:{findFirst:a=>query('conversation','findFirst',a,()=>[state.conversation])},auditLog:{async create(){active();return {};}}};
 const prisma={async withSystem(callback){active();state.calls.system++;return callback(tx);},async withTenant(tenantId,callback){active();state.calls.tenant++;if(tenantId!==principal.tenantId)throw Error('FOREIGN_FIXTURE_TENANT');return callback(tx);}};
 const clerkSdk={async verifyToken(token){active();state.calls.verifyToken++;if(!state.jwtValid||token!==nativeCredential)throw Error('INVALID_FIXTURE_TOKEN');return clone(state.claims);},createClerkClient(){return {sessions:{async getSession(id){active();state.calls.getSession++;await state.hooks.getSession?.();if(id!==state.session.id)throw Error('FOREIGN_FIXTURE_SESSION');return clone(state.session);}}};}};
 const endpoint=createPinnedEndpoint({sourceRepository,typescriptModulePath,now,prisma,clerkSdk});
 return Object.freeze({...endpoint,nativeCredential,state,close(){state.closed=true;},stats(){return {...endpoint.stats(),closed:state.closed,verifyToken:state.calls.verifyToken,getSession:state.calls.getSession,lastSeenUpdates:state.calls.lastSeenUpdates,tenantQueries:state.calls.tenant,realClerk:false,realDatabase:false};}});
}
