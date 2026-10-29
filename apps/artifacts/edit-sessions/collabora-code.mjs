/** Server-side CODE discovery and launch form. No fetch, process or deployment is
 * performed here. Trusted composition supplies the exact self-hosted origins and
 * bounded discovery response; opening the editor still requires current authority. */
import {SaxesParser} from 'saxes';
import {OFFICE_OPERATIONS} from '../../../packages/contracts/office-edit.mjs';
const EDITOR_FORMATS=Object.freeze(Object.keys(OFFICE_OPERATIONS));
const fail=code=>{throw Object.assign(Error(code),{code});};
export const CODE_DISCOVERY_MAX_BYTES=256*1024;
const origin=value=>{
 let u;try{u=new URL(value);}catch{fail('EDITOR_CODE_CONFIGURATION');}
 if(typeof value!=='string'||u.protocol!=='https:'||u.origin!==value||u.username||u.password||u.hash||u.search)fail('EDITOR_CODE_CONFIGURATION');
 return u.origin;
};
function actionUrl(value,editorOrigin){
 if(typeof value!=='string'||value.length>4096)fail('EDITOR_CODE_DISCOVERY');
 // WOPI discovery placeholders are optional. Omit them; never interpret supplied text as HTML.
 const source=value.replace(/<[A-Za-z_]+=[A-Za-z_]+&>/gu,'');
 if(/[<>\s]/u.test(source))fail('EDITOR_CODE_DISCOVERY');
 let u;try{u=new URL(source);}catch{fail('EDITOR_CODE_DISCOVERY');}
 if(u.origin!==editorOrigin||u.username||u.password||u.hash||!u.pathname.startsWith('/browser/')||!u.pathname.endsWith('/cool.html')||
  [...u.searchParams.keys()].some(k=>['wopisrc','access_token','access_token_ttl'].includes(k.toLowerCase())))fail('EDITOR_CODE_DISCOVERY');
 return u.href;
}
export function parseCodeDiscovery(bytes,{editorOrigin}){
 const expected=origin(editorOrigin);
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>CODE_DISCOVERY_MAX_BYTES)fail('EDITOR_CODE_DISCOVERY');
 let xml;try{xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('EDITOR_CODE_DISCOVERY');}
 const stack=[],actions=Object.create(null),parser=new SaxesParser({xmlns:true,position:false});let validRoot=false;
 parser.on('doctype',()=>fail('EDITOR_CODE_DISCOVERY'));
 parser.on('xmldecl',d=>{if(d.encoding&&!/^utf-8$/iu.test(d.encoding))fail('EDITOR_CODE_DISCOVERY');});
 parser.on('opentag',t=>{
  const attrs=Object.create(null);for(const a of Object.values(t.attributes))if(!a.uri)attrs[a.local]=a.value;
  stack.push({name:t.local,uri:t.uri,attrs});
  if(stack.length===1){if(t.local!=='wopi-discovery'||t.uri)fail('EDITOR_CODE_DISCOVERY');validRoot=true;}
  if(stack.length!==4||stack[1].name!=='net-zone'||stack[1].uri||stack[1].attrs.name!=='external-https'||
    stack[2].name!=='app'||stack[2].uri||t.local!=='action'||t.uri)return;
  if(!EDITOR_FORMATS.includes(attrs.ext)||!['edit','view'].includes(attrs.name))return;
  const key=`${attrs.ext}:${attrs.name}`;if(actions[key])fail('EDITOR_CODE_DISCOVERY');
  actions[key]=actionUrl(attrs.urlsrc,expected);
 });
 parser.on('closetag',()=>stack.pop());
 try{parser.write(xml).close();}catch{fail('EDITOR_CODE_DISCOVERY');}
 if(!validRoot||stack.length||!Object.keys(actions).length)fail('EDITOR_CODE_DISCOVERY');
 return Object.freeze({...actions});
}
/** DTO for a form targeted at the editor iframe. The token is never in actionUrl
 * or WOPISrc. Send with Cache-Control:no-store and do not persist or log fields. */
export function createCollaboraCodeLaunch({editorOrigin,wopiOrigin,discoveryBytes,codec,now}){
 const editor=origin(editorOrigin),host=origin(wopiOrigin),actions=parseCodeDiscovery(discoveryBytes,{editorOrigin:editor});
 if(editor===host||typeof codec?.issue!=='function'||typeof now!=='function')fail('EDITOR_CODE_CONFIGURATION');
 return Object.freeze({
  launch(claims,{format}){
   if(!EDITOR_FORMATS.includes(format)||typeof claims?.userCanWrite!=='boolean')fail('EDITOR_FORMAT_UNSUPPORTED');
   const mode=claims.userCanWrite?'edit':'view',action=actions[`${format}:${mode}`];
   if(!action)fail('EDITOR_CODE_ACTION_UNAVAILABLE');
   const token=codec.issue(claims),expiresAtMs=claims.expiresAtMs;
   if(!Number.isSafeInteger(now())||expiresAtMs<=now())fail('WOPI_TOKEN_EXPIRED');
   const url=new URL(action),wopiSrc=`${host}/api/meri/office/wopi/files/${encodeURIComponent(claims.fileId)}`;
   url.searchParams.set('WOPISrc',wopiSrc);
   return Object.freeze({edition:'collabora-code',editorOrigin:editor,actionUrl:url.href,method:'POST',
    fields:Object.freeze({access_token:token,access_token_ttl:String(expiresAtMs)}),expiresAtMs});
  },
 });
}
