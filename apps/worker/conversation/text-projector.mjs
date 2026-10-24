/** Public top-level text projection; final frames repair suffix loss and reject conflicting text. */
export function createTextProjector(newId){const messages=new Map();let current;
 function message(id){if(typeof id!=='string'||!id||id.length>256)throw Error('SDK_TEXT_REFUSED');if(!messages.has(id)){if(messages.size>=1000)throw Error('SDK_TEXT_LIMIT');messages.set(id,{messageId:newId(),blocks:new Map(),textBlocks:[],nextFinal:0,finals:new Map()});}return messages.get(id);}
 function appendBlock(state){if(state.textBlocks.length>=1001)throw Error('SDK_TEXT_LIMIT');const block={text:''};state.textBlocks.push(block);return block;}
 function streamed(index,text){if(!current||!Number.isSafeInteger(index)||index<0||index>1000)throw Error('SDK_TEXT_REFUSED');if(typeof text!=='string')return [];
  if(!current.blocks.has(index))current.blocks.set(index,appendBlock(current));
  current.blocks.get(index).text+=text;return text?[{messageId:current.messageId,text}]:[];
 }
 function completed(m){const state=message(m.message?.id);if(!Array.isArray(m.message.content)||m.message.content.length>1000)throw Error('SDK_TEXT_REFUSED');
  const texts=m.message.content.filter(b=>b.type==='text'&&typeof b.text==='string');if(!texts.length)return [];
  const replay=state.finals.get(m.uuid);if(replay&&replay.length!==texts.length)throw Error('SDK_TEXT_INCONSISTENT');
  // SDK 0.3.295 emits one assistant frame per completed block: its local array index is not the raw stream index.
  // Ordered text identities also retain empty starts and final-only blocks; thinking/tools never consume one.
  const matched=replay??texts.map(()=>state.textBlocks[state.nextFinal++]??appendBlock(state));
  const parts=texts.flatMap((b,index)=>{const block=matched[index];if(!b.text.startsWith(block.text))throw Error('SDK_TEXT_INCONSISTENT');const suffix=b.text.slice(block.text.length);block.text=b.text;return suffix?[{messageId:state.messageId,text:suffix}]:[];});
  if(typeof m.uuid==='string'&&m.uuid)state.finals.set(m.uuid,matched);
  return parts;
 }
 return function project(m){if(m?.parent_tool_use_id)return [];
  if(m?.type==='stream_event'){
   const e=m.event;if(e?.type==='message_start'){current=message(e.message?.id);return [];}
   if(e?.type==='content_block_start'&&e.content_block?.type==='text')return streamed(e.index,e.content_block.text);
   if(e?.type==='content_block_delta'&&e.delta?.type==='text_delta')return streamed(e.index,e.delta.text);
   return [];
  }
  if(m?.type==='assistant'&&!m.error)return completed(m);
  return [];
 };
}
