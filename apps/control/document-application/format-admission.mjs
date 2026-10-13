/** Fixed application admission; canonical owners retain artifact shapes and authority. */
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {same} from '../action-host/current.mjs';
import {fail} from './http.mjs';

export function admitDocumentDescriptor(value){
 const descriptor=data(value),id=descriptor?.operation?.id;
 if(id!=='create_word'&&id!=='create_excel')fail('DOCUMENT_CONFIGURATION',500);
 const entry=catalog.operations.find(e=>e.operation.id===id);
 const canonical={operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};
 if(!same(descriptor,canonical))fail('DOCUMENT_CONFIGURATION',500);
 // This application admits a bounded subset; canonical validators still own each request.
 return data({descriptor,formats:id==='create_word'?['docx','txt']:['xlsx']});
}
export const admitsDocumentFormat=(admission,format)=>admission.formats.includes(format);
export const admitsDocumentMime=(admission,mime)=>admission.formats.some(format=>ARTIFACT_MIME_TYPES[format]===mime);
