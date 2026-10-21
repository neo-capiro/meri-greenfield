/** Observe only committed run-owner results. Rejections and published objects pass through unchanged. */
export function createTurnPublishObserver({telemetry}){
 const observe=event=>{try{telemetry.summary(event);}catch{}};
 return Object.freeze({observe,observeRunOwner(service){const publish=service.publish;
  return Object.freeze({...service,async publish(...args){const event=await Reflect.apply(publish,service,args);observe(event);return event;}});
 }});
}
