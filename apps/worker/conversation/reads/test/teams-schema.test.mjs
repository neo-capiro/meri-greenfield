/** Real catalog/SDK setup with synthetic literals only; no SDK query or external calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {familyReads} from '../availability.mjs';
import {advertisedArguments,canonicalInputSchema,isNarrowerOrEqual} from '../schema.mjs';
import {defineReadTool,assertConvertible} from '../tools.mjs';

const rows=familyReads();
const uuid='71000000-0000-4000-8000-000000000001';
for(const id of ['list_teams_channels','get_teams_channel_messages'])test(`${id}: canonical UUID conjunction survives SDK tool setup`,()=>{
 const row=rows.find(r=>r.operation.id===id);assert.ok(row);
 assert.equal(row.descriptor.inputSchema.sha256,'7aa95d8ef33b1179e29225ab5eaf927357d1bbfbd3003b7f7ed5530f33c8af3d');
 const canonical=canonicalInputSchema(row.descriptor.inputSchema);
 const {shape}=defineReadTool(row,async()=>{throw Error('No tool invocation expected');},false);
 assertConvertible(shape);
 const schema=shape.arguments;
 assert.ok(isNarrowerOrEqual(z.toJSONSchema(schema,{io:'input'}),canonical));
 const request={connectionId:uuid,teamId:uuid,clientId:uuid,...(id==='get_teams_channel_messages'?{channelId:'19:synthetic@thread.tacv2'}:{})};
 assert.deepEqual(schema.parse(request),request);
 for(const field of ['connectionId','teamId','clientId'])for(const value of [null,'not-a-uuid','71000000-0000-0000-8000-000000000001','71000000-0000-4000-0000-000000000001'])
  assert.equal(schema.safeParse({...request,[field]:value}).success,false,field);
 for(const field of canonical.required){const missing={...request};delete missing[field];assert.equal(schema.safeParse(missing).success,false,field);}
 for(const extra of [{tenantId:'forged'},{actorRole:'admin'},{normalizationContext:{}},{continuation:''},{continuation:'x'.repeat(16385)}])
  assert.equal(schema.safeParse({...request,...extra}).success,false);
 if(id==='get_teams_channel_messages')for(const channelId of ['', 'a/b','x'.repeat(513)])assert.equal(schema.safeParse({...request,channelId}).success,false);
});

test('UUID conjunction proof still refuses widened, disjunctive and unsupported constraints',()=>{
 const canonical=canonicalInputSchema(rows.find(r=>r.operation.id==='list_teams_channels').descriptor.inputSchema).properties.connectionId;
 const converted=z.toJSONSchema(z.fromJSONSchema(canonical),{io:'input'});
 assert.ok(isNarrowerOrEqual(converted,canonical));
 for(const advertised of [{type:'string'},{type:'string',pattern:'.*'},{type:'string',format:'uuid'},
  {type:'string',anyOf:[{pattern:canonical.pattern},{pattern:'.*'}]},
  {type:['string','null'],allOf:converted.allOf}])assert.equal(isNarrowerOrEqual(advertised,canonical),false);
 assert.equal(isNarrowerOrEqual(converted,{...canonical,format:'date-time'}),false);
 assert.equal(isNarrowerOrEqual(converted,{...canonical,minLength:40}),false);
 assert.equal(isNarrowerOrEqual(converted,{...canonical,unevaluatedProperties:false}),false);
 assert.equal(isNarrowerOrEqual({...converted,type:['string','null']},{...canonical,type:['string','null']}),true);
});

test('every available read descriptor remains constructible with the installed converter',()=>{
 for(const row of rows)assert.equal(advertisedArguments(row.descriptor.inputSchema).mode,'canonical',row.operation.id);
});
