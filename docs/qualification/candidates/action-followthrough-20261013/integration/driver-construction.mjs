/** Local installed-driver compatibility check only. Never calls connect/query. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createPostgresApprovalMetadataStore} from '../../../../../apps/control/commands/approval-metadata/index.mjs';
const require=createRequire('/tmp/meri-pg-8.23.1-action-followthrough-20261013/package.json');
assert.equal(require('pg/package.json').version,'8.23.1');
const {Pool}=require('pg');
const pool=new Pool({host:'127.0.0.1',port:1,database:'synthetic-unused',user:'synthetic-unused',connectionTimeoutMillis:5000,query_timeout:6000,idleTimeoutMillis:1000});
try{
  const store=createPostgresApprovalMetadataStore({pool});
  assert.equal(typeof store.insert,'function');assert.equal(typeof store.read,'function');
  assert.equal(pool.totalCount,0);assert.equal(pool.idleCount,0);assert.equal(pool.waitingCount,0);
}finally{await pool.end();}
assert.equal(pool.totalCount,0);
console.log(JSON.stringify({pgVersion:'8.23.1',canonicalPoolOptionsAccepted:true,databaseConnections:0,sqlStatements:0,ownedPoolClosed:true,runtimeQualified:false}));
