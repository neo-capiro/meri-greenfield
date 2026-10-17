import test from 'node:test';
import assert from 'node:assert/strict';
import {projectNativeQueryResult} from '../native-result.mjs';
import {storedCase,nativeSql} from './fixture.mjs';

test('native query projection drops only SQL and leaves source rows and original object unchanged',()=>{
 const f=storedCase(),native=structuredClone(f.nativePage),saved=structuredClone(native),result=projectNativeQueryResult(f.call(),native);
 assert.deepEqual(result,f.page);assert.deepEqual(native,saved);assert.equal(native.sql,nativeSql);assert.notEqual(result.rows,native.rows);
});
test('native error values pass unchanged for the existing receiving contract',()=>{
 const f=storedCase(),error={tool:'query_global_data',generatedAt:f.page.generatedAt,ok:false,error:'Source unavailable.'};
 assert.deepEqual(projectNativeQueryResult(f.call(),error),error);
});
test('native projection rejects getter, proxy and extra-key shapes without executing hooks',()=>{
 const f=storedCase();let effects=0;const getter={...f.nativePage};Object.defineProperty(getter,'sql',{enumerable:true,get(){effects++;return nativeSql;}});
 const proxy=new Proxy(f.nativePage,{ownKeys(){effects++;return [];}});
 for(const value of [getter,proxy,{...f.nativePage,extra:true},null,[]])assert.throws(()=>projectNativeQueryResult(f.call(),value),{message:'INVALID_RESULT'});assert.equal(effects,0);
});
