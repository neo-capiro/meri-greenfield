import test from 'node:test';
import assert from 'node:assert/strict';
import {createAwsEc2CallerVerifier} from '../native-ec2-caller.mjs';

const accountId='967807252336',region='us-east-1';
function fake(raw,configured=region){
 return {config:{async region(){return configured;}},async send(){if(raw instanceof Error)throw raw;return raw;}};
}
test('actual STS caller is bound to the requested account and explicit region',async()=>{
 const verifier=createAwsEc2CallerVerifier({sts:fake({Account:accountId,Arn:`arn:aws:sts::${accountId}:assumed-role/MeriHost/i-1`,UserId:'AROAEXAMPLE:i-1'}),now:()=>1000});
 assert.deepEqual(await verifier.verify({accountId,region}),{accountId,region,
  arn:`arn:aws:sts::${accountId}:assumed-role/MeriHost/i-1`,userId:'AROAEXAMPLE:i-1'});
});
test('wrong account, region, principal or STS failure is refused',async()=>{
 const cases=[
  [{Account:'111122223333',Arn:'arn:aws:sts::111122223333:assumed-role/X/y',UserId:'u'},region],
  [{Account:accountId,Arn:`arn:aws:sts::${accountId}:assumed-role/X/y`,UserId:'u'},'us-west-2'],
  [{Account:accountId,Arn:'not-a-principal',UserId:'u'},region],
  [Object.assign(Error('transport lost'),{code:'ECONNRESET'}),region],
 ];
 for(const [raw,configured] of cases){
  const verifier=createAwsEc2CallerVerifier({sts:fake(raw,configured),now:()=>1000});
  await assert.rejects(async()=>verifier.verify({accountId,region}));
 }
});
