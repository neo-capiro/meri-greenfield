/** Public top-level text projection; final frames repair suffix loss and reject conflicting text. */
export function createTextProjector(newId){const messages=new Map();let current;
 function message(id){if(typeof id!=='string'||!id||id.length>256)throw Error('SDK_TEXT_REFUSED');if(!messages.has(id)){if(messages.size>=1000)throw Error('SDK_TEXT_LIMIT');messages.set(id,{messageId:newId(),blocks:new Map()});}return messages.get(id);}
 function streamed(index,text){if(!current||!Number.isSafeInteger(index)||index<0||index>1000)throw Error('SDK_TEXT_REFUSED');if(typeof text!=='string'||!text)return [];current.blocks.set(index,(current.blocks.get(index)??'')+text);return [{messageId:current.messageId,text}];}
 return function project(m){if(m?.parent_tool_use_id)return [];
  if(m?.type==='stream_event'){
   const e=m.event;if(e?.type==='message_start'){current=message(e.message?.id);return [];}
   if(e?.type==='content_block_start'&&e.content_block?.type==='text')return streamed(e.index,e.content_block.text);
   if(e?.type==='content_block_delta'&&e.delta?.type==='text_delta')return streamed(e.index,e.delta.text);
   return [];
  }
  if(m?.type==='assistant'&&!m.error){const state=message(m.message?.id);if(!Array.isArray(m.message.content)||m.message.content.length>1000)throw Error('SDK_TEXT_REFUSED');return m.message.content.flatMap((b,index)=>{if(b.type!=='text'||typeof b.text!=='string')return [];const sent=state.blocks.get(index)??'';if(!b.text.startsWith(sent))throw Error('SDK_TEXT_INCONSISTENT');const suffix=b.text.slice(sent.length);state.blocks.set(index,b.text);return suffix?[{messageId:state.messageId,text:suffix}]:[];});}
  return [];
 };
}
