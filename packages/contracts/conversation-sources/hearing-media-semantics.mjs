import {assertHearingSourceEventSemantics} from './hearing-semantics.mjs';
import {fail,safeSourceLocator} from './semantics.mjs';

/** Media is an ephemeral current-owner read, never a URL from source text. */
export function assertHearingMediaReadSemantics(response,request){
 const event=assertHearingSourceEventSemantics(response.event),source=response.current.source,media=response.current.media;
 if(request.schemaVersion!=='meri.hearing-media-read/1'||event.eventId!==request.referenceId||event.binding.conversationId!==request.conversationId||event.binding.runId!==request.runId)fail('SOURCE_REQUEST_MISMATCH');
 if(source.hearingId!==event.data.selection.hearingId||source.recordId!==event.data.source.recordId||source.contentHash!==event.data.source.provenance.contentHash)fail('SOURCE_PAGE_MISMATCH');
 if(request.playback===null){
  if(media.playback!==null||media.manifest?.hearingId!==source.hearingId)fail('SOURCE_PAGE_MISMATCH');
  const ids=new Set();
  for(const epoch of media.manifest.epochs){if(ids.has(epoch.id)||epoch.durableEndMs<epoch.startMs)fail('INVALID_MEDIA_COVERAGE');ids.add(epoch.id);}
 }else{
  const p=media.playback;
  if(media.manifest!==null||!p||p.epochId!==request.playback.epochId||p.startMs>request.playback.positionMs||p.endMs<=request.playback.positionMs)fail('SOURCE_PAGE_MISMATCH');
  if(safeSourceLocator(p.url)!==p.url)fail('UNSAFE_SOURCE_URL');
 }
 return response;
}
