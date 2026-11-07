/** Private Objective capacity, aligned with Core's lossless context publication.
 * Ordinary conversation submit and supplementary retrieval keep their own limits.
 * Bytes bound the exact supplied text, not an estimated token conversion; the SDK's
 * explicit 1M context selection leaves room for its preset, tools and output. */
import {own,data} from '../contracts/commands-0.2/execution-boundary.mjs';
export const OBJECTIVE_PROMPT_MAX_BYTES=768*1024;
export const OBJECTIVE_PROMPT_JSON_MAX_BYTES=896*1024;
export const OBJECTIVE_PUBLICATION_MAX_BYTES=1024*1024;
export const OBJECTIVE_ACCEPTED_REQUEST_MAX_BYTES=1024*1024;
export const OBJECTIVE_SELECTION_MAX_BYTES=2*1024*1024;
// Completion identity adds the source request a third time, plus native proof.
export const OBJECTIVE_COMPLETION_MAX_BYTES=3328*1024;
export function assertObjectivePrompt(prompt){
 if(typeof prompt!=='string'||!prompt.trim()||Buffer.byteLength(prompt,'utf8')>OBJECTIVE_PROMPT_MAX_BYTES||
  Buffer.byteLength(JSON.stringify(prompt),'utf8')>OBJECTIVE_PROMPT_JSON_MAX_BYTES)throw Error('OBJECTIVE_PROMPT_CAPACITY_REFUSED');
 return prompt;
}
/** Historical stored-data shape only: this is not an admission proof. */
export function assertObjectiveStoredRequest(value){
 const request=data(own(value,['requestId','prompt','skill','window','windowRequest']));
 if(typeof request.requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(request.requestId)||
  request.skill!==null||request.window!==null||request.windowRequest!==null||
  Buffer.byteLength(JSON.stringify(request),'utf8')>OBJECTIVE_ACCEPTED_REQUEST_MAX_BYTES)throw Error('OBJECTIVE_INPUT_REFUSED');
 assertObjectivePrompt(request.prompt);return request;
}
