import assert from 'node:assert/strict';
const lookedUp=[];
const value=new Proxy({}, {get(_value,key){lookedUp.push(String(key));throw new TypeError('synthetic-then-lookup');}});
const syntheticPort=async()=>value;
let message;
try{await syntheticPort();}catch(error){message=error.message;}
assert.deepEqual(lookedUp,['then']);assert.equal(message,'synthetic-then-lookup');
console.log(JSON.stringify({classification:'REVIEWER_FIXTURE_CORRECTION',sourceCodeInvoked:false,lookedUp,errorClass:'TypeError',result:'ASYNC_RETURN_ASSIMILATES_THENABLE_BEFORE_GATEWAY_RECEIVES_VALUE'}));
