/** Synthetic discovery and consulted-page DTOs; no URL/provider/parser implementation. */
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createPublicWebHandlers} from '../handler.mjs';

export const ids=['search_public_web','scrape_web_page'];
export const requests={search_public_web:{query:'Synthetic public research'},scrape_web_page:{url:'https://public.example.invalid/article'}};
export function storedPage(id,{provider='tavily',kind='html',url=requests.scrape_web_page.url}={}){
 const generatedAt='2026-10-12T12:00:00.000Z';
 if(id==='search_public_web')return {tool:id,contentStatus:'discovered',generatedAt,provider,total:1,results:[{
  title:'Synthetic discovery',url:'https://public.example.invalid/discovered',snippet:'Synthetic discovery snippet',source:provider,
  ...(provider==='duckduckgo'?{}:{publishedAt:null}),
 }]};
 const text='Synthetic consulted page text',pdf=kind==='pdf';
 return {tool:id,generatedAt,url,title:pdf?null:'Synthetic page',contentType:pdf?'application/pdf':'text/html; charset=utf-8',
  text,totalChars:text.length,truncated:false,
  links:pdf?[]:[{url:'https://public.example.invalid/reference',text:'Synthetic reference'}],
  contentHash:'a'.repeat(64),authoritativeOwner:'public_url',currentStatus:'available',trust:'external_untrusted',
  coverage:{locator:{url,characterStart:0,characterEnd:text.length},complete:true,truncated:false,...(pdf?{pages:2}:{})},
  ...(pdf?{kind:'pdf',pages:2}:{}),
 };
}

export function storedCase(id=ids[0],{request=requests[id],provider='tavily',kind='html'}={}){
 const scene=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext={};
 const {authority,state,now,wire}=scene;
 authority.decision.operation=`${id}@0.2.0`;
 authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))];
 const normalized=contract.normalizeInput(request,{}),page=storedPage(id,{provider,kind,url:normalized.input.url}),transport={...scene.transport,
  async fetchImpl(url,options){
   wire.push({url,options,body:JSON.parse(options.body)});
   const value=structuredClone(state.page??page);state.nativeValue=value;
   state.resultMutator?.(value);state.afterSource?.();
   return state.responseFactory?state.responseFactory(value):Response.json(value);
  },
 };
 const nativeReadContextPorts={async readCurrent({request:ignored,deadlineMs,signal,...proof}){
  if(signal?.aborted)throw Error('CANCELLED');
  return JSON.stringify({...proof,context:{},checkedAtMs:now(),expiresAtMs:Math.min(deadlineMs,authority.deadlineMs)});
 }};
 const call=(raw=request,current=authority,context=normalizationContext)=>{
  const currentInput=contract.normalizeInput(raw,context);
  return {request:raw,input:currentInput.input,argumentsSha256:currentInput.argumentsSha256,normalizationContext:context,authority:current};
 };
 return {...scene,family:'public-web',operation,contract,arguments:request,normalizationContext,transport,page,nativeReadContextPorts,call,
  handler:(changes={})=>createPublicWebHandlers({...transport,now,...changes},[operation])[0].execute};
}
