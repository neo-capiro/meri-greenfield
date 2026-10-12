// One inert wire decoder. A cursor correlates text lineage, never authority.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw new Error('Invalid bill-text continuation');};
export function decodeBillTextCursor(value){
 if(typeof value!=='string'||value.length>1024||!value.length||!/^[A-Za-z0-9_-]+$/.test(value))fail();
 const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)fail();
 let data;try{data=snapshotOperationData(JSON.parse(bytes.toString('utf8')));}catch{fail();}
 if(!Array.isArray(data)||data.length!==5)fail();
 const [billId,versionCode,revisionId,textHash,offset]=data;
 if(typeof billId!=='string'||typeof versionCode!=='string'||typeof revisionId!=='string'||
  !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(revisionId)||
  typeof textHash!=='string'||!/^[a-f0-9]{64}$/.test(textHash)||!Number.isSafeInteger(offset)||offset<1||offset>30000000)fail();
 return Object.freeze({billId,versionCode,revisionId,textHash,offset});
}
export function assertBillTextCursor(value,expected){
 const decoded=decodeBillTextCursor(value),binding=snapshotOperationData(expected);
 for(const [key,entry] of Object.entries(binding))if(!Object.hasOwn(decoded,key)||decoded[key]!==entry)fail();
 return decoded;
}
