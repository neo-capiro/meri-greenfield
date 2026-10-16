/** meeting-source: compose the canonical passive adapter; registration confers no availability. */
import {createMeetingHttpAdapter} from '../../sources/meetings/http-adapter.mjs';
import {createMeetingReadHandler} from '../../sources/meetings/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='meeting-source',sourceDirectory='meetings';
export function createHandlers(configuration){
 const adapter=createMeetingHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createMeetingReadHandler({operation,adapter,now:configuration.now})}));
}
