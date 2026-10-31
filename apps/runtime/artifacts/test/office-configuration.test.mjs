import test from 'node:test';
import assert from 'node:assert/strict';
import {compileOfficeConfiguration} from '../office-configuration.mjs';
const base={http:{frontendOrigin:'https://app.example.com'},privateHttp:{}};
const valid={enabled:true,editorOrigin:'https://editor.example.com',wopiOrigin:'https://control.example.internal',
 browserOrigin:'https://app.example.com',coreOrigin:'https://core.example.com',keyFile:'/run/meri/office.key',
 serviceSecretFile:'/run/meri/core.secret'};
test('absent and disabled compose nothing and carry no material keys',()=>{
 assert.equal(compileOfficeConfiguration(base),null);
 assert.deepEqual(compileOfficeConfiguration({...base,office:{enabled:false}}),{enabled:false});
 assert.throws(()=>compileOfficeConfiguration({...base,office:{enabled:false,keyFile:'/run/x'}}),/OFFICE_CONFIGURATION/);
});
test('valid enabled declaration is frozen with exact origins',()=>{
 const c=compileOfficeConfiguration({...base,office:valid});
 assert.equal(c.wopiOrigin,'https://control.example.internal');assert.ok(Object.isFrozen(c));
});
test('refuses same editor/wopi, browser mismatch, missing private listener and key aliasing',()=>{
 assert.throws(()=>compileOfficeConfiguration({...base,office:{...valid,wopiOrigin:valid.editorOrigin}}),/OFFICE_CONFIGURATION/);
 assert.throws(()=>compileOfficeConfiguration({...base,office:{...valid,browserOrigin:'https://other.example.com'}}),/OFFICE_CONFIGURATION/);
 assert.throws(()=>compileOfficeConfiguration({http:base.http,office:valid}),/OFFICE_CONFIGURATION/);
 assert.throws(()=>compileOfficeConfiguration({...base,office:{...valid,serviceSecretFile:valid.keyFile}}),/OFFICE_CONFIGURATION/);
});
test('signing and service material cannot alias download or read-mode signers',()=>{
 const protectedConfig={...base,downloadLinks:{keyFile:'/run/meri/download.key'},reads:{serviceSecretFile:'/run/meri/reads.secret',readModeServiceSecretFile:'/run/meri/read-mode.secret'}};
 assert.throws(()=>compileOfficeConfiguration({...protectedConfig,office:{...valid,keyFile:'/run/meri/download.key'}}),/OFFICE_CONFIGURATION/);
 assert.throws(()=>compileOfficeConfiguration({...protectedConfig,office:{...valid,keyFile:'/run/meri/read-mode.secret'}}),/OFFICE_CONFIGURATION/);
 assert.throws(()=>compileOfficeConfiguration({...protectedConfig,office:{...valid,serviceSecretFile:'/run/meri/download.key'}}),/OFFICE_CONFIGURATION/);
 assert.throws(()=>compileOfficeConfiguration({...protectedConfig,office:{...valid,serviceSecretFile:'/run/meri/read-mode.secret'}}),/OFFICE_CONFIGURATION/);
 assert.equal(compileOfficeConfiguration({...protectedConfig,office:{...valid,serviceSecretFile:'/run/meri/reads.secret'}}).enabled,true);
});
