/** Test browser receiver source with its real JSON schemas, without bundling or writing dist. */
import {registerHooks} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';import formats from 'ajv-formats';
import {conversationSchema} from '../conversation-application/schema.mjs';
import {historySchema} from '../conversation-history/schema.mjs';
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);
for(const folder of ['../','../retrieval-0.2/'])for(const file of readdirSync(new URL(folder,import.meta.url)))if(file.endsWith('.schema.json'))ajv.addSchema(JSON.parse(readFileSync(new URL(folder+file,import.meta.url),'utf8')));
ajv.addSchema(conversationSchema());ajv.addSchema(historySchema());
const names={
 'conversation-sources':[['validateRequest','BillTextSourceReadRequest'],['validateResponse','BillTextSourceReadResponse'],['validateEvent','NativeBillTextSourceEvent'],['validateHearingRequest','HearingSourceReadRequest'],['validateHearingResponse','HearingSourceReadResponse'],['validateHearingEvent','NativeHearingSourceEvent'],['validateHearingMediaRequest','HearingMediaReadRequest'],['validateHearingMediaResponse','HearingMediaReadResponse']],
 'conversation-application':[['validateSubmitRequest','ConversationSubmitRequest'],['validateHistoryRequest','ConversationHistoryRequest'],['validateCancelRequest','ConversationCancelRequest'],['validateEventsRequest','ConversationEventsRequest'],['validateSubmitted','ConversationSubmittedResponse'],['validateHistory','ConversationHistoryResponse'],['validateCancelled','ConversationCancelledResponse'],['validateEvent','ConversationEvent'],['validateError','ConversationErrorResponse']],
 'conversation-history':[['validateListRequest','ConversationHistoryListRequest'],['validateTranscriptRequest','ConversationHistoryTranscriptRequest'],['validateNextTurnRequest','ConversationHistoryNextTurnRequest'],['validateSummariesRequest','ConversationHistorySummariesRequest'],['validateManageRequest','ConversationHistoryManageRequest'],['validateListResponse','ConversationHistoryListResponse'],['validateTranscriptResponse','ConversationHistoryTranscriptResponse'],['validateNextTurnResponse','ConversationHistoryNextTurnResponse'],['validateSummariesResponse','ConversationHistorySummariesResponse'],['validateManageResponse','ConversationHistoryManageResponse'],['validateError','ConversationHistoryErrorResponse']]
};
export function validator(family,name){const owner=family==='conversation-sources'?(name.includes('HearingMedia')?'urn:meri:native-hearing-media:1.0.0':name.includes('Hearing')?'urn:meri:native-hearing-source:1.0.0':'urn:meri:native-bill-text-source:1.0.0'):family==='conversation-application'?conversationSchema().$id:historySchema().$id;return ajv.compile({$ref:owner+'#/$defs/'+name});}
export async function sourceReceivers(){
 const hook=registerHooks({resolve(specifier,context,next){if(specifier==='./generated-validator.mjs'){
  const family=context.parentURL.split('/').at(-2);if(names[family])return {url:'test-source-validator:'+family,shortCircuit:true};
 }return next(specifier,context);},load(url,context,next){if(url.startsWith('test-source-validator:')){const family=url.slice('test-source-validator:'.length);return {format:'module',shortCircuit:true,source:`import {validator} from ${JSON.stringify(import.meta.url)};\n`+names[family].map(([name,definition])=>`export const ${name}=validator(${JSON.stringify(family)},${JSON.stringify(definition)});`).join('\n')};}return next(url,context);}});
 try{return {sources:await import('../conversation-sources/receive.mjs'),conversation:await import('../conversation-application/receive.mjs'),history:await import('../conversation-history/receive.mjs')};}finally{hook.deregister();}
}
