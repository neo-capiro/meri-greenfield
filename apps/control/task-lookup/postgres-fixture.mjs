/** Test-only fixed-SQL scripted port. No SQL parser/engine, network or durability proof. */
export function createTaskLookupPoolFixture(){
 const calls=[],lookups=new Map(),events=new Map();let active=false;
 const copy=map=>new Map([...map].map(([k,v])=>[k,structuredClone(v)]));
 const result=(rows=[],rowCount=rows.length)=>({rows:structuredClone(rows),rowCount});
 const pool={async connect(){
  if(active)throw Error('Fixture supports one transaction at a time');active=true;
  let rows=copy(lookups),slots=copy(events);
  return {async query(sql,p=[]){
   calls.push({sql,values:structuredClone(p)});
   if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return result();
   if(sql==='COMMIT'){lookups.clear();events.clear();for(const [k,v]of rows)lookups.set(k,v);for(const [k,v]of slots)events.set(k,v);return result();}
   if(sql==='ROLLBACK')return result();
   const key=`${p[0]}:${String(p[1]).toLowerCase()}`;
   if(sql.startsWith('INSERT INTO meri_task_lookup.lookups')){if(rows.has(key)||[...rows.values()].some(r=>r.tenant===p[0]&&r.reference.toLowerCase()===p[2].toLowerCase()))return result();rows.set(key,{tenant:p[0],reference:p[2],payload:JSON.parse(p[3]),state:'CLAIMED',record:null});return result([{lookup_id:p[1]}]);}
   if(sql.startsWith('INSERT INTO meri_task_lookup.events')){const k=`${p[0]}:${p[1].toLowerCase()}:${p[2]}`;if(slots.has(k)||[...slots.values()].some(e=>e.tenant===p[0]&&e.id.toLowerCase()===p[3].toLowerCase()))throw Error('Fixture event reservation collision');slots.set(k,{tenant:p[0],id:p[3],lookup:p[4],kind:p[5],event:p[6]===null?null:JSON.parse(p[6])});return result([],1);}
   if(sql.startsWith('SELECT payload')){const r=rows.get(key);return result(r?[{payload:r.payload,state:r.state,record:r.record}]:[]);}
   if(sql.startsWith('SELECT record'))return result([...rows.values()].filter(r=>r.tenant===p[0]&&r.reference.toLowerCase()===p[1].toLowerCase()&&r.state==='RESULT').map(r=>({record:r.record})));
   if(sql.startsWith('UPDATE meri_task_lookup.lookups')){const r=rows.get(key);if(!r)return result();if(sql.includes("state='DISPATCHING'"))r.state='DISPATCHING';else if(sql.includes("state='RESULT'")){r.state='RESULT';r.record=JSON.parse(p[2]);}else if(sql.includes("state='ERROR'"))r.state='ERROR';else throw Error('Unknown fixture transition');return result([],1);}
   if(sql.startsWith('UPDATE meri_task_lookup.events')){const e=[...slots.values()].find(e=>e.tenant===p[0]&&e.lookup.toLowerCase()===p[1].toLowerCase()&&e.kind==='terminal'&&e.event===null);if(!e)return result();e.event=JSON.parse(p[2]);return result([],1);}
   throw Error('Unsupported fixture SQL');
  },release(){active=false;}};
 }};
 return {pool,calls,lookups,events};
}
