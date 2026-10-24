import test from 'node:test';
import assert from 'node:assert/strict';
import {createTextProjector} from '../text-projector.mjs';

const stream=event=>({type:'stream_event',parent_tool_use_id:null,event});
const start=id=>stream({type:'message_start',message:{id}});
const block=(index,type='text',text='')=>stream({type:'content_block_start',index,content_block:{type,text}});
const delta=(index,text)=>stream({type:'content_block_delta',index,delta:{type:'text_delta',text}});
const final=(id,uuid,...content)=>({type:'assistant',parent_tool_use_id:null,uuid,message:{id,content}});
const text=value=>({type:'text',text:value});
const thinking={type:'thinking',thinking:'PRIVATE'};
function fixture(){let next=0;const parts=[],project=createTextProjector(()=>`public-${++next}`);return {parts,project,accept(...frames){for(const frame of frames)parts.push(...project(frame));},joined:()=>parts.map(part=>part.text).join('')};}

test('a singleton text completion after thinking repairs only its missing suffix',()=>{
 const f=fixture();f.accept(start('m'),block(0,'thinking'),final('m','thinking',thinking),block(1),delta(1,'Hel'));
 assert.deepEqual(f.project(final('m','text',text('Hello'))),[{messageId:'public-1',text:'lo'}]);
 assert.equal(f.joined(),'Hel');
});

test('text, tool and text singleton completions sharing one message ID publish each block once',()=>{
 const f=fixture();f.accept(start('m'),block(0),delta(0,'First'),final('m','first',text('First')),
  block(1,'tool_use'),final('m','tool',{type:'tool_use',id:'tool',name:'Read',input:{}}),
  block(2),delta(2,'Second'),final('m','second',text('Second')));
 assert.equal(f.joined(),'FirstSecond');assert.deepEqual([...new Set(f.parts.map(part=>part.messageId))],['public-1']);
});

test('identical distinct blocks survive and an already-completed UUID does not consume the next block',()=>{
 const f=fixture(),first=final('m','first',text('same'));
 f.accept(start('m'),block(0),delta(0,'same'),first,block(1),delta(1,'same'),first,final('m','second',text('same')));
 assert.equal(f.joined(),'samesame');
});

test('empty text starts retain block identity for completion and the next streamed block',()=>{
 const f=fixture();f.accept(start('m'),block(1),final('m','first',text('First')),block(3),delta(3,'Sec'),final('m','second',text('Second')));
 assert.equal(f.joined(),'FirstSecond');
});

test('final-only singleton frames sharing a message ID retain separate block identities',()=>{
 const f=fixture(),first=final('m','first',text('Final one'));
 f.accept(first,final('m','second',text('Final two')),first);assert.equal(f.joined(),'Final oneFinal two');
});

test('a conflicting completion is refused at its matched streamed block',()=>{
 const f=fixture();f.accept(start('m'),block(0,'thinking'),block(1),delta(1,'Original'));
 assert.throws(()=>f.project(final('m','text',text('Changed'))),/SDK_TEXT_INCONSISTENT/);
});

test('subagent frames never disturb the top-level message or block ordering',()=>{
 const f=fixture();f.accept(start('m'),block(1),delta(1,'Hel'));
 for(const frame of [start('sub'),block(0),delta(0,'PRIVATE'),final('sub','sub-final',text('PRIVATE'))])f.accept({...frame,parent_tool_use_id:'tool-agent'});
 f.accept(final('m','text',text('Hello')));assert.equal(f.joined(),'Hello');assert.equal(f.parts.length,2);
});

test('existing full-array completions reconcile ordered text blocks across nontext positions',()=>{
 const f=fixture();f.accept(start('m'),block(0),delta(0,'A'),block(1,'thinking'),block(2),delta(2,'B'),
  final('m','full',text('A'),thinking,text('Bee')));
 assert.equal(f.joined(),'ABee');
});
