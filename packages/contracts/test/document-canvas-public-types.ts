import {receiveCanvasRequest,receiveCanvasResponse,type CanvasSelection,type DocumentCanvasContent,type DocumentCanvasSource,type AdmittedCanvasRequest,type CanvasRoute} from '@capiro/meri-contracts/document-canvas';
const selection:CanvasSelection={artifactId:'a',versionId:'v',objectSha256:'hash'};
const content:DocumentCanvasContent={operation:'create_word',format:'docx',title:'Draft',content:{blocks:[{kind:'paragraph',runs:[{text:'Body',bold:true}]}]}};
const bytes=new TextEncoder().encode(JSON.stringify({selection,deliveryId:'save',request:content}));
const call:AdmittedCanvasRequest<'canvas-save'>=receiveCanvasRequest('canvas-save',bytes);
const route:CanvasRoute='canvas-save';
const result=await receiveCanvasResponse(route,200,bytes,call);
if(!('error'in result))result.version.parentVersionId satisfies string|null;
declare const source:DocumentCanvasSource;
source.inspection.currentBytesVerified satisfies true;
// @ts-expect-error Office originals are not an editable native canvas source.
const wrong:DocumentCanvasContent={operation:'create_powerpoint',format:'pptx',title:'Slides',content:{}};
// @ts-expect-error Source authority is not browser input.
const authority:CanvasSelection={...selection,credential:'token'};
void wrong;void authority;
