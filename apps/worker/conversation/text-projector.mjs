/** Only public top-level text blocks become display deltas; final frames do not duplicate streamed text. */
export function createTextProjector(newId){const messages=new Map();let current;
 function message(id){if(typeof id!=='string'||!id||id.length>256)throw Error('SDK_TEXT_REFUSED');if(!messages.has(id)){if(messages.size>=1000)throw Error('SDK_TEXT_LIMIT');messages.set(id,{messageId:newId(),blocks:new Set()});}return messages.get(id);}
 return function project(m){if(m?.parent_tool_use_id)return [];
  if(m?.type==='stream_event'){
   const e=m.event;if(e?.type==='message_start'){current=message(e.message?.id);return [];}
   if(e?.type==='content_block_delta'&&e.delta?.type==='text_delta'){if(!current||!Number.isSafeInteger(e.index)||e.index<0||e.index>1000)throw Error('SDK_TEXT_REFUSED');if(typeof e.delta.text!=='string'||!e.delta.text)return [];current.blocks.add(e.index);return [{messageId:current.messageId,text:e.delta.text}];}
   return [];
  }
  if(m?.type==='assistant'&&!m.error){const state=message(m.message?.id);if(!Array.isArray(m.message.content)||m.message.content.length>1000)throw Error('SDK_TEXT_REFUSED');return m.message.content.flatMap((b,index)=>{if(b.type!=='text'||typeof b.text!=='string'||!b.text||state.blocks.has(index))return [];state.blocks.add(index);return [{messageId:state.messageId,text:b.text}];});}
  return [];
 };
}
