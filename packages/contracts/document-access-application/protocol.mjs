/** Receiving metadata describes isolated source routes and integrity only. It grants no authority, qualifies no renderer and is not
 * deployment, composition or runtime-mount evidence. */
import {DOCUMENT_ACCESS_SCHEMA_ID} from './schema.mjs';
export const documentAccessVersion='0.2.0';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const createDocumentAccessMetadata=({formats,mimeTypes,previewFormats,operationFormats,errorStatuses})=>freeze({contractVersion:documentAccessVersion,schemaId:DOCUMENT_ACCESS_SCHEMA_ID,
 routes:{inspect:{method:'POST',path:'/api/documents/inspect',response:'json'},download:{method:'POST',path:'/api/documents/download',response:'bytes'},history:{method:'POST',path:'/api/documents/history',response:'json'},list:{method:'POST',path:'/api/documents/list',response:'json'}},
 formats,mimeTypes,previewFormats,operationFormats,errorStatuses,
 semantics:{
  nativeFiles:'native-file identifies a committed workspace path and immutable object with currently verified bytes; it makes no format, rendering, generation-status or preview-status claim',
  inspection:'structural facts about one exact stored version; nativeOpened, rendered and recalculated are always false, pptx visualInspection and pdf renderInspection are always pending, so no inspection describes a rendered or visually checked file',
  download:'a download is admitted only for a version this receiver admitted from an inspect answer in the same session of use; inspect first, never a link or bytes alone',
  history:'currently authorized metadata for one immutable artifact chain, newest first, with an anchor-correlated response and a context/query/head-bound opaque continuation; it verifies no object bytes and admits no version for download; history is not cross-conversation library discovery',
  list:'currently authorized original head metadata for the same owner in conversation, selected client, or owner scope; each origin requires fresh Core access and retention before release; a bounded candidate window may yield an empty page with nextCursor, without totals or hidden counts; cursors select a context/query/snapshot-bound page and convey no authority; versions are not admitted for download',
  preview:'previewFormats are the only formats the artifact preview owner will render (any other format answers ARTIFACT_PREVIEW_UNSUPPORTED); every previewFormat except pdf also needs a qualified converter or answers ARTIFACT_RENDERER_UNAVAILABLE; this contract carries no preview route and no renderer qualification',
  statuses:'the document application releases only generationStatus draft and previewStatus pending, so previewStatus never reports unsupported or validated here',
  composition:'a document application instance is composed with one operation descriptor (operationFormats) and answers DOCUMENT_RESULT_REFUSED for versions of formats outside it; which descriptor serves a conversation is a composition fact this contract cannot assert',
  integration:'isolated source contract; mounting, Core authority wiring and renderer qualification remain handoff work',
 }});
