/** Synthetic current Intel owner response, separate from the saved source event. */
export function mediaResult(event,playback=null){
 const source={hearingId:event.data.selection.hearingId,recordId:event.data.source.recordId,contentHash:event.data.source.provenance.contentHash};
 const media=playback===null?{manifest:{hearingId:source.hearingId,mode:'server',format:'audio/wav',epochs:[{id:'epoch',startMs:1000,durableEndMs:3000,durableBytes:64044,state:'retained',transcriptState:'unavailable',expiresAt:'2099-01-01T00:00:00.000Z',reason:null}]},playback:null}:{manifest:null,playback:{epochId:playback.epochId,partId:'part',startMs:1000,endMs:2000,url:'https://media.example.test/saved-audio?synthetic=1',expiresAt:'2099-01-01T00:00:00.000Z'}};
 return {schemaVersion:'capiro.hearing-media-read/1',source,media};
}
