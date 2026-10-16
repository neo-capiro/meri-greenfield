/** Actual upstream pg Pool/Client against an injected inert wire stream, no socket/DB. */
import test from 'node:test';import assert from 'node:assert/strict';import {Duplex} from 'node:stream';import pg from 'pg';
import {sqlFixture,record,commit} from './sql-fixture.mjs';
const i16=n=>{const b=Buffer.alloc(2);b.writeInt16BE(n);return b;},i32=n=>{const b=Buffer.alloc(4);b.writeInt32BE(n);return b;},z=s=>Buffer.from(s+'\0');
const message=(kind,body=Buffer.alloc(0))=>Buffer.concat([Buffer.from(kind),i32(body.length+4),body]);
function wire(fixture){let started=false,sql='',values=[],queued=Promise.resolve();const types={record:3802,projection:3802,versions:3802,heads:3802};
 const stream=new Duplex({read(){},write(chunk,encoding,done){queued=queued.then(async()=>{if(!started){started=true;stream.push(message('R',i32(0)));stream.push(message('S',Buffer.concat([z('server_version'),z('16.6')])));stream.push(message('Z',Buffer.from('I')));return;}
  let offset=0;while(offset<chunk.length){const kind=String.fromCharCode(chunk[offset]),size=chunk.readInt32BE(offset+1),body=chunk.subarray(offset+5,offset+size+1);offset+=size+1;
   if(kind==='P'){const begin=body.indexOf(0)+1,end=body.indexOf(0,begin);sql=body.subarray(begin,end).toString();stream.push(message('1'));}
   if(kind==='B'){let at=body.indexOf(0)+1;at=body.indexOf(0,at)+1;const formats=body.readInt16BE(at);at+=2+2*formats;const count=body.readInt16BE(at);at+=2;values=[];for(let n=0;n<count;n++){const length=body.readInt32BE(at);at+=4;const text=length<0?null:body.subarray(at,at+length).toString();at+=Math.max(0,length);values.push(text!==null&&text.startsWith('{')?JSON.parse(text):text);}stream.push(message('2'));}
   if(kind==='D'){const result=await fixture.client.query(sql,values);stream.pending=result;const names=result.rows.length?Object.keys(result.rows[0]):[];stream.names=names;
    if(!names.length)stream.push(message('n'));else stream.push(message('T',Buffer.concat([i16(names.length),...names.map(name=>Buffer.concat([z(name),i32(0),i16(0),i32(types[name]??25),i16(-1),i32(-1),i16(0)]))])));}
   if(kind==='E'){const result=stream.pending;for(const row of result.rows)stream.push(message('D',Buffer.concat([i16(stream.names.length),...stream.names.map(name=>{const val=row[name];if(val===null)return i32(-1);const b=Buffer.from(typeof val==='object'?JSON.stringify(val):String(val));return Buffer.concat([i32(b.length),b]);})])));stream.push(message('C',z(sql.startsWith('SELECT')?'SELECT '+result.rows.length:sql.startsWith('UPDATE')?'UPDATE '+result.rowCount:sql.startsWith('INSERT')?'INSERT 0 '+result.rowCount:'OK')));}
   if(kind==='Q'){sql=body.subarray(0,-1).toString();await fixture.client.query(sql);stream.push(message('C',z(sql)));stream.push(message('Z',Buffer.from('I')));}
   if(kind==='S')stream.push(message('Z',Buffer.from('I')));if(kind==='X'){stream.push(null);stream.destroy();}
  }}).then(()=>done(),done);}});
 stream.connect=()=>queueMicrotask(()=>stream.emit('connect'));stream.setNoDelay=()=>{};stream.setKeepAlive=()=>{};stream.ref=()=>{};stream.unref=()=>{};return stream;}
test('upstream pg Pool performs parameterized JSON/UUID queries and releases borrowed transaction leases without network',async()=>{const f=sqlFixture(),streams=[];
 const pool=new pg.Pool({user:'synthetic',password:'synthetic',database:'synthetic',host:'synthetic.invalid',port:5432,ssl:false,max:1,connectionTimeoutMillis:200,stream:()=>{const s=wire(f);streams.push(s);return s;}});
 try{const versions=f.create({pool,now:Date.now,maxRequestMs:1500}),a=record(),b=record(11,a.version.versionId);await versions.commit(commit(a));await versions.commit(commit(b));assert.deepEqual(await versions.read(a.version.versionId),a);assert.equal((await versions.commit(commit(a))).status,'duplicate');assert.equal(pool.idleCount,1);assert.equal(streams.length,1);assert.equal(f.state.versions.size,2);}finally{await pool.end();assert.ok(streams.every(s=>s.destroyed));}
});
