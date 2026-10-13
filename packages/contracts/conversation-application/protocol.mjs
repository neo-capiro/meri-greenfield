/** Public receiving metadata only. No credential or authority is supplied. */
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const conversationErrorStatuses = freeze({
  NOT_FOUND:[404], METHOD_NOT_ALLOWED:[405], SESSION_REFUSED:[401,403],
  UNSUPPORTED_MEDIA_TYPE:[415], INVALID_REQUEST:[400], INVALID_CURSOR:[400], REQUEST_REPLAY_REFUSED:[400],
  SCOPE_REFUSED:[403], SESSION_CHANGED:[403], STALE_WRITER:[403], CONVERSATION_SELECTOR_REFUSED:[403],
  DEADLINE:[408], CANCELLED:[408], REQUEST_TOO_LARGE:[413], CONVERSATION_UNAVAILABLE:[502],
});
export const conversationApplicationMetadata = freeze({
  packageVersion:'0.1.3', schemaId:'urn:meri:conversation-application:0.1.0', wireContractVersion:'0.1.0',
  routes:{
    submit:{method:'POST',path:'/api/conversations/submit',response:'json'},
    history:{method:'POST',path:'/api/conversations/history',response:'json'},
    cancel:{method:'POST',path:'/api/conversations/cancel',response:'json',body:{},effect:'durable run cancellation'},
    events:{method:'POST',path:'/api/conversations/events',response:'ai-sdk-ui-message-stream',intent:'view.subscribe'},
    reconnect:{method:'GET',path:'/api/conversations/events/{conversationId}/stream',response:'ai-sdk-ui-message-stream',cursorHeader:'x-meri-resume-sequence'},
  },
  authentication:{header:'authorization',scheme:'Bearer',owner:'current authenticated opaque session',validationGrantsAuthority:false},
  cursor:{minimum:0,maximum:Number.MAX_SAFE_INTEGER,meaning:'last acknowledged event sequence',progression:'contiguous after + 1',queryAllowed:false,lastEventIdAllowed:false},
  stream:{dataPart:'data-meri-event',transient:true,completion:'subscription ended; durable run state comes from run.status',abort:'subscription cleanup only; use cancel route for durable cancellation'},
  limits:{requestBytes:131072,responseBytes:2097152,eventBytes:2097152,cursorEventIds:10000},
  errorStatuses:conversationErrorStatuses,
});
