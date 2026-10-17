/** Compose the existing canonical mail adapter; endpoints and credential authority stay explicit. */
import {createMailHttpAdapter} from '../../sources/mail/http-adapter.mjs';
import {createMailReadHandler} from '../../sources/mail/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='mail',sourceDirectory='mail';
export function createHandlers(configuration){
 const adapter=createMailHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createMailReadHandler({operation,adapter,now:configuration.now})}));
}
