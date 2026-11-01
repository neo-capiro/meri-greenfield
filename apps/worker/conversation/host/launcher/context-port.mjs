/** One native browser prepared independently of the SDK shim. Context state,
 * model filtering, authority and destruction remain the existing session owner. */
import {createRequire} from 'node:module';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {createContextTransport} from './context-transport.mjs';
import {pinnedChromium} from './context-child.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
const fail=()=>{throw Error('HOST_BROWSER_CONTEXT_REFUSED');};
export function createConfinedContextPort({native,binding,policy,installation,paths,signal,now=Date.now,
 chromium=pinnedChromium(installation.cliPath)}){
 policy=validateBrowserPolicy(policy);const pins=canonicalSha256({binding,installation,paths});
 const narrowed=raw=>{const p=validateBrowserPolicy(raw);return p.enabled===true&&policy.enabled===true&&
  p.tools.every(value=>policy.tools.includes(value))&&p.allowedOrigins.every(value=>policy.allowedOrigins.includes(value))&&
  p.timeouts.actionMs<=policy.timeouts.actionMs&&p.timeouts.navigationMs<=policy.timeouts.navigationMs&&
  (!p.downloads.enabled||policy.downloads.enabled)&&p.downloads.formats.every(value=>policy.downloads.formats.includes(value))&&
  p.downloads.maxBytes<=policy.downloads.maxBytes&&p.downloads.maxFiles<=policy.downloads.maxFiles;};
 let stopping;const stop=()=>stopping??=Promise.resolve(native.close());
 const wire=createContextTransport({readable:native.readable,writable:native.writable,stop});
 let taken=false,context;
 signal?.addEventListener('abort',wire.close,{once:true});if(signal?.aborted)wire.close();
 return Object.freeze({close(){wire.close();return stop();},async create(request){
  if(taken||signal?.aborted||pins!==canonicalSha256({binding:request.binding,installation:request.installation,paths:request.paths})||!narrowed(request.policy)||
   !Number.isSafeInteger(request.deadlineMs)||request.deadlineMs<=now())fail();
  taken=true;const life=createOperationLifetime({deadlineMs:Math.min(request.deadlineMs,now()+30000),now,signal,errorFactory:()=>Error('HOST_BROWSER_CONTEXT_REFUSED')});
  life.signal.addEventListener('abort',wire.close,{once:true});
  try{
   await life.run(()=>wire.ready);
   // Chromium's public CDP transport consumes send/close directly; unlike
   // WebKit it does not call an optional transport.open callback.
   wire.open();
   const connecting=chromium.connectOverCDP(wire.transport,{timeout:Math.max(1,life.deadline()-now())});
   connecting.then(browser=>{if(life.signal.aborted)void browser.close().catch(()=>{});}).catch(()=>{});
   const browser=await life.run(()=>connecting),contexts=browser.contexts();
   if(contexts.length!==1)fail();context=contexts[0];return context;
  }catch(error){wire.close();throw error;}
  finally{life.signal.removeEventListener('abort',wire.close);life.close();}
 },async logout({context:requested,url}){
  if(!context||requested!==context||signal?.aborted)fail();const page=await context.newPage();
  // The outcome is what the site answered: a successful response from the logout URL is `confirmed`, a refusal
  // is `failed`, and no response (navigation timeout, same-document, transport loss) stays `unknown`.
  try{const response=await page.goto(url,{timeout:10000,waitUntil:'domcontentloaded'});
   if(!response||typeof response.ok!=='function')return {outcome:'unknown'};
   return {outcome:response.ok()?'confirmed':'failed'};}
  catch{return {outcome:'unknown'};}
  finally{await page.close();}
 }});
}
export function pinnedBrowserUpstream(installation){
 pinnedChromium(installation.cliPath);const require=createRequire(installation.cliPath);
 const upstream=require('./index.js');if(typeof upstream.createConnection!=='function')fail();
 return Object.freeze({version:installation.version,createConnection:upstream.createConnection});
}
