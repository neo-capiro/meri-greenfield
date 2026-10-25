/** SDK output steering for the two admitted original document compilers.
 * The compilers remain the authority for the literal result and its source evidence. */
const text=maxLength=>({type:'string',minLength:1,...(maxLength===undefined?{}:{maxLength})}),nullable=value=>({anyOf:[value,{type:'null'}]}),
 object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false}),
 list=(items,maxItems)=>({type:'array',items,maxItems});
const passage=(sourceId,recordText,quoteText)=>object({sourceId,recordId:recordText,recordVersionId:recordText,start:{type:'integer',minimum:0},end:{type:'integer',minimum:1},quote:quoteText});

export const selectedOutputCompiler=({pin})=>pin.skillVersion==='1.0.0'&&['quick_skill.commitments_audit','quick_skill.relationship_brief'].includes(pin.skillId)?pin.skillId:null;
export function selectedOutputFormat(selected){
 const {pin,manifest}=selected,skill=object(Object.fromEntries(Object.entries(pin).map(([key,value])=>[key,{const:value}]))),
  sources=[...new Set(manifest.requiredSources.map(source=>source.sourceId))];
 let properties;
 if(selectedOutputCompiler(selected)==='quick_skill.commitments_audit'){
  const observation=object({id:text(128),kind:{type:'string',enum:['promise','suggestion','tracking','delivery-claim']},relatedPromiseId:nullable({type:'string'}),owner:nullable(text(256)),dueDate:nullable({type:'string',pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'}),passage:passage({type:'string',enum:sources},text(),text())});
  properties={skill,title:text(200),target:object({query:text(200)}),asOf:{type:'string'},observations:list(observation,250)};
 }else if(selectedOutputCompiler(selected)==='quick_skill.relationship_brief'){
  const quote=object({...passage(text(256),text(256),text(4000)).properties,url:text(2000)},['sourceId','recordId','recordVersionId','start','end','quote']);
  properties={skill,title:text(200),target:text(200),asOf:{type:'string'},quotes:list(quote,20),interpretations:list(text(4000),20),risks:list(text(4000),20),nextSteps:list(text(4000),20)};
 }else throw Object.assign(Error('SKILL_OUTPUT_FORMAT_UNAVAILABLE'),{code:'SKILL_OUTPUT_FORMAT_UNAVAILABLE'});
 return {type:'json_schema',schema:object(properties)};
}
