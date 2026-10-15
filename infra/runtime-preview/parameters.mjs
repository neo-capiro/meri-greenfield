/** Closed offline parameter checks. Values stay in a private parameter file, never logs. */
const refuse=()=>{throw Error('PRIVATE_PARAMETERS_REFUSED');};
export function validateParameters(template,values,{vpcCidr,occupiedCidrs=[]}={}){
  if(!values||Object.getPrototypeOf(values)!==Object.prototype||Object.keys(values).length!==Object.keys(template.Parameters).length||Object.keys(values).some(k=>!Object.hasOwn(template.Parameters,k)))refuse();
  for(const [name,definition] of Object.entries(template.Parameters)){
    const value=values[name];if(!['string','number'].includes(typeof value))refuse();
    const parts=definition.Type==='CommaDelimitedList'?String(value).split(','):[String(value)];
    if(parts.some(p=>!p.length||definition.AllowedPattern&&!new RegExp(definition.AllowedPattern,'u').test(p)||definition.AllowedValues&&!definition.AllowedValues.map(String).includes(p)))refuse();
    if(definition.Type==='Number'&&(!Number.isInteger(Number(value))||Number(value)<definition.MinValue||Number(value)>definition.MaxValue))refuse();
    if(name.endsWith('Image')&&/@sha256:([a-f0-9])\1{63}$/u.test(String(value)))refuse();
    if(name!=='ExpectedAccountId'&&typeof value==='string'){
      const account=/^arn:aws:[^:]+:[^:]*:([0-9]{12}):/u.exec(value)?.[1]??/^([0-9]{12})\.dkr\.ecr\./u.exec(value)?.[1];
      if(account&&account!==String(values.ExpectedAccountId))refuse();
      if(name==='BedrockResourceArns'&&value.split(',').some(v=>{const a=/^arn:aws:bedrock:[^:]+:([0-9]{12}):/u.exec(v)?.[1];return a&&a!==String(values.ExpectedAccountId);}))refuse();
    }
  }
  if(values.ClusterArn&&values.ClusterArn.split('/').at(-1)!==values.ClusterName)refuse();
  if(values.AdmissionExpiresAtUtc&&Date.parse(values.AdmissionExpiresAtUtc)!==Number(values.ExpiresAtMs))refuse();
  if(values.PrivateSubnetA===values.PrivateSubnetB||values.AvailabilityZoneA&&values.AvailabilityZoneA===values.AvailabilityZoneB)refuse();
  if(values.PublicSubnetCidrA){
    if(!vpcCidr)refuse();
    const v=cidr(vpcCidr),a=cidr(values.PublicSubnetCidrA),b=cidr(values.PublicSubnetCidrB),overlap=(x,y)=>x.first<=y.last&&y.first<=x.last;
    if(a.first<v.first||a.last>v.last||b.first<v.first||b.last>v.last||overlap(a,b)||occupiedCidrs.some(c=>overlap(a,cidr(c))||overlap(b,cidr(c))))refuse();
    cidr(values.CallerCidr);
  }
  return true;
}
function cidr(value){
  const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/u.exec(value??'');if(!m)refuse();
  const octets=m.slice(1,5).map(Number),bits=Number(m[5]);if(octets.some(n=>n>255)||bits<1||bits>32)refuse();
  const number=octets.reduce((v,n)=>v*256+n,0),size=2**(32-bits),first=Math.floor(number/size)*size;if(first!==number)refuse();return {first,last:first+size-1};
}
