/** Read-only SQL qualification of the exact new installer role predicate.
 * Fixtures shadow pg_roles in a CTE; no actual role or grant is changed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
if(process.env.MERI_HOST_ALLOCATIONS_PG_ATTEST!=='isolated-local')throw Error('HOST_ALLOCATION_PG_ATTESTATION_REQUIRED');
test('existing Control LOGIN remains valid without permitting elevated role attributes',async t=>{
 const pool=new pg.Pool({host:'127.0.0.1',port:55487,database:'wave6_browser_custody_20261030',user:'wave6_host_reader_20261030',connectionTimeoutMillis:1500,max:1});t.after(()=>pool.end());
 const source=await readFile(new URL('../../infra/product-preview/first-chat-browser-host-control-grants.sql',import.meta.url),'utf8');
 const predicate=/IF NOT EXISTS\((SELECT 1 FROM pg_roles WHERE rolname='meri_control_runtime'[^\n]+)\) THEN/u.exec(source)?.[1];assert.ok(predicate);
 const fields=['rolcanlogin','rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls'];
 const sql=`WITH pg_roles(rolname,${fields.join(',')}) AS (VALUES ($1::text,$2::boolean,$3::boolean,$4::boolean,$5::boolean,$6::boolean,$7::boolean)) SELECT EXISTS(${predicate}) AS accepted`;
 const accepted=async(name,values)=>(await pool.query(sql,[name,...fields.map(f=>values[f]??false)])).rows[0].accepted;
 for(const rolcanlogin of [false,true])assert.equal(await accepted('meri_control_runtime',{rolcanlogin}),true);
 for(const elevated of fields.slice(1))assert.equal(await accepted('meri_control_runtime',{rolcanlogin:true,[elevated]:true}),false,elevated);
 assert.equal(await accepted('unrelated_service',{rolcanlogin:true}),false);
 assert.doesNotMatch(source,/ALTER ROLE|PASSWORD|GRANT meri_host_allocator/u);
 t.diagnostic('Exact installer predicate executed on PostgreSQL with synthetic role metadata; no role mutation or deployed installer acceptance.');
});
