/** Review-only transactional SQL script, not PostgreSQL/driver durability evidence. */
export function scriptedPool({onQuery,onConnect,onRelease}={}){
 const s={row:null,events:[],queries:[],releases:[],connections:0};
 const pool={async connect(){s.connections++;if(onConnect)await onConnect(s);let tx=null;
  return {async query(sql,args){s.queries.push({sql,args});const interception=await onQuery?.(sql,args,s);if(interception)return interception;
   if(sql==='BEGIN'){tx=structuredClone({row:s.row,events:s.events});return {rows:[]};}
   if(sql==='COMMIT'){s.row=tx.row;s.events=tx.events;tx=null;if(s.loseResultAck&&s.row?.state==='RESULT'){s.loseResultAck=false;throw Error('synthetic commit acknowledgment lost');}return {rows:[]};}
   if(sql==='ROLLBACK'){tx=null;return {rows:[]};}
   if(sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql.startsWith('INSERT INTO meri_task_lookup.lookups')){if(tx.row)return {rows:[]};tx.row={payload:JSON.parse(args[3]),state:'CLAIMED',record:null};return {rows:[{lookup_id:args[1]}]};}
   if(sql.startsWith('INSERT INTO meri_task_lookup.events')){tx.events.push({kind:args[5],event:args[6]===null?null:JSON.parse(args[6])});return {rows:[],rowCount:1};}
   if(sql.startsWith('SELECT payload'))return {rows:tx.row?[structuredClone(tx.row)]:[]};
   if(sql.startsWith('SELECT record'))return {rows:tx.row?.state==='RESULT'?[{record:structuredClone(tx.row.record)}]:[]};
   if(sql.startsWith('UPDATE meri_task_lookup.lookups')){const state=/state='(\w+)'/.exec(sql)[1];tx.row.state=state;if(state==='RESULT')tx.row.record=JSON.parse(args[2]);return {rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE meri_task_lookup.events')){const slot=tx.events.find(e=>e.kind==='terminal'&&e.event===null);if(!slot)return {rows:[],rowCount:0};slot.event=JSON.parse(args[2]);return {rows:[],rowCount:1};}
   throw Error('unexpected SQL script');
  },release(error){s.releases.push(error);onRelease?.(error,s);}};
 }};return {pool,s};
}
