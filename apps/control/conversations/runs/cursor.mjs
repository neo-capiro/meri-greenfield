import {hash} from '../boundary.mjs';
import {refuse} from '../../product-access/errors.mjs';
const binding=(principal,request)=>hash({principal,scope:request.scope,status:request.status,limit:request.limit,source:'meri_conversations.runs/1'});
/** Opaque selection, not a grant or a secret: every resumed page still authorizes its actual rows. */
export function encodeRunCursor(principal,request,position){return Buffer.from(JSON.stringify({binding:binding(principal,request),...position})).toString('base64url');}
export function decodeRunCursor(principal,request){
 if(request.cursor===null)return null;
 try{const bytes=Buffer.from(request.cursor,'base64url');if(bytes.toString('base64url')!==request.cursor)throw Error();const value=JSON.parse(bytes.toString('utf8'));
  if(Object.keys(value).sort().join(',')!=='binding,conversationId,createdAt,runId'||value.binding!==binding(principal,request)||typeof value.createdAt!=='string'||new Date(value.createdAt).toISOString()!==value.createdAt||
   typeof value.conversationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value.conversationId)||typeof value.runId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value.runId))throw Error();
  return {createdAt:value.createdAt,runId:value.runId,conversationId:value.conversationId};
 }catch{refuse('RUN_INDEX_CURSOR_INVALID');}
}
