/** client-knowledge-profile: compose the canonical passive adapter; registration confers no availability. */
import {createClientEvidenceHttpAdapter} from '../../sources/client-evidence/http-adapter.mjs';
import {createClientEvidenceReadHandler} from '../../sources/client-evidence/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='client-knowledge-profile',sourceDirectory='client-evidence';
export function createHandlers(configuration){
 const adapter=createClientEvidenceHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createClientEvidenceReadHandler({operation,adapter,now:configuration.now})}));
}
