import {createChatAttachmentHandlers} from '../../sources/client-knowledge-attachments/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='client-knowledge-attachments',sourceDirectory='client-knowledge-attachments';
export const createHandlers=configuration=>createChatAttachmentHandlers(configuration,familyOperations(id));
