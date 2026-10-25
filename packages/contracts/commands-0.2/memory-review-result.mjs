/** Governed review custody only: a pending candidate is neither an approval nor published memory. */
import {data,own} from './execution-boundary.mjs';
import {validateCommandShape} from './validate.mjs';
import {validateShape} from '../validate.mjs';
import {assertNativeConversationScope} from '../runtime-0.2/session.mjs';
export function assertMemoryReviewResult(raw){
 const value=data(own(raw,['status','binding','scopes','result']));
 if(value.status!=='review_pending')throw Error('INVALID_MEMORY_REVIEW_RESULT');
 validateShape('RunBinding',value.binding);validateCommandShape('MemoryProposeResult',value.result);
 if(!Array.isArray(value.scopes)||value.scopes.length!==1)throw Error('INVALID_MEMORY_REVIEW_RESULT');
 const scope=value.scopes[0];validateShape('Scope',scope);
 assertNativeConversationScope({binding:value.binding,scopes:value.scopes,selectedClientId:scope.kind==='client'?scope.resourceId:null});
 return value;
}
