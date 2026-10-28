import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {attachmentReadEnvelope} from './request-context.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
export const createChatAttachmentHandlers=(configuration,operations)=>{
 if(configuration.readSource!==undefined)deny('GATEWAY_CONFIGURATION');
 return createStoredNativeReadHandlers(configuration,operations,{
 family:'client-knowledge-attachments',routes:{read_chat_attachments:'/api/clio/attachments/read'},requestBody:attachmentReadEnvelope,requirePerCall:()=>true,
 });
};
