/** Source projection for the trusted native gateway. A pure converter is not an
 * authorization or provenance receipt; the gateway owns the authenticated read. */
import {resolveOperationContract,artifactValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {compileFederalDraft,FEDERAL_TEXT_PARSER,federalDraftSource} from './engine.mjs';
import canonicalize from 'canonicalize';
const sourceContract=resolveOperationContract({id:'read_federal_draft_source',version:'0.2.0'});
const fault=code=>{throw Object.assign(Error(code),{code});};
export function projectNativeFederalSource(selection,result){
 sourceContract.assertOutput(result,{request:selection});
 if(result.currentStatus!=='available')fault('DRAFT_SOURCE_UNAVAILABLE');
 const {text,...identity}=result.source;
 const source={documentId:identity.billId,publisher:identity.provider,sourceVersion:identity.versionCode+'/'+identity.revisionId,
  sourceUrl:identity.sourceLocator,publishedAt:identity.publishedAt?.slice(0,10)??null,parserVersion:FEDERAL_TEXT_PARSER,text,sha256:identity.textHash,
  coverage:{complete:true,limitations:[
   'One flat full-document scope; legal structure, numbering, cross-references, arithmetic and substantive law require review.',
   'Core retained UTF-8 content and extracted text hashes verified; original HTTP bytes and extraction normalization are unreported.',
   'Current at read only. Enactment and legal currency are unresolved; an enrolled bill is not proof of enactment.',
   'Canonical federal source metadata: '+canonicalize(identity),
  ]},scopes:[{id:'document',label:'the selected bill text',start:0,end:text.length,sha256:identity.textHash}]};
 return federalDraftSource(source);
}
export function prepareNativeFederalDraft(selection,result,operations){
 const source=projectNativeFederalSource(selection,result),identity=result.source;
 const draft=compileFederalDraft(source,operations);
 const titles={operative:'Operative amendment',consolidated:'Consolidated text',redline:'Legal redline'};
 let exports;
 try{exports=Object.fromEntries(Object.entries(titles).map(([kind,title])=>[kind,artifactValidators.request({operation:'create_word',format:'txt',title:`${title}: ${identity.billId}`,content:{text:draft.outputs[kind]}})]));}
 catch{fault('DRAFT_OUTPUT_UNEXPORTABLE');}
 return {tool:'prepare_federal_draft',sourceSelection:selection,nativeSource:result,draft,exports,approval:'unapproved'};
}
