/** SDK output steering for the three admitted original document compilers.
 * The compilers remain the authority for the literal result and its source evidence. */
const text=maxLength=>({type:'string',minLength:1,...(maxLength===undefined?{}:{maxLength})}),nullable=value=>({anyOf:[value,{type:'null'}]}),
 object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false}),
 list=(items,maxItems)=>({type:'array',items,maxItems});
const passage=(sourceId,recordText,quoteText)=>object({sourceId,recordId:recordText,recordVersionId:recordText,start:{type:'integer',minimum:0},end:{type:'integer',minimum:1},quote:quoteText});

/** The two ordinary recipes keep their single admitted version; the sourced cited report and the general long-form
 * cited report are admitted by their own exact installed version. */
export const selectedOutputCompiler=({pin})=>pin.skillId==='quick_skill.bill_watch'&&pin.skillVersion==='2.0.0'?'quick_skill.bill_watch':
 pin.skillId==='quick_skill.cited_report'&&pin.skillVersion==='1.0.0'?'quick_skill.cited_report':
 pin.skillVersion==='1.0.0'&&['quick_skill.commitments_audit','quick_skill.relationship_brief'].includes(pin.skillId)?pin.skillId:null;
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
 }else if(selectedOutputCompiler(selected)==='quick_skill.bill_watch'){
  // Mirror of the recipe's own private input: the seven sections, cited findings and disclosed conflicts.
  const citation=object({...object({sourceId:{type:'string',enum:sources},recordId:text(256),sourceVersionId:text(256),start:{type:'integer',minimum:0},end:{type:'integer',minimum:1}}).properties,url:text(1000)},
    ['sourceId','recordId','sourceVersionId','start','end']),
   finding=object({id:text(64),kind:{type:'string',enum:['excerpt','claim']},text:text(2000),citations:list(citation,10)}),
   disclosed=object({findingId:text(64),note:text(1000)}),
   bill=object({congress:{type:'integer',minimum:1,maximum:999},session:{type:'integer',enum:[1,2]},billId:text(60),
    billVersion:{type:'string',pattern:'^[a-z][a-z0-9_.-]{0,31}$'},fiscalYear:{type:'integer',minimum:1900,maximum:9999},
    budgetStage:{type:'string',enum:['requested','authorized','appropriated','obligated','actual','outlay']}});
  properties={skill,title:text(200),subject:bill,asOf:{type:'string'},summary:text(2000),findings:list(finding,40),
   conflicts:list(disclosed,20),recommendations:list(text(1000),20),limitations:list(text(1000),20)};
 }else if(selectedOutputCompiler(selected)==='quick_skill.cited_report'){
  // Mirror of the recipe's own private input: the seven sections, the real read locators of its citations and
  // the disclosed conflicts. There is deliberately no subject property: the subject is the trusted selected
  // subject, so no model output can widen or substitute the scope.
  const citation=Object.freeze({anyOf:Object.freeze([
    object({kind:{const:'mail'},threadId:text(36),messageId:text(36),start:{type:'integer',minimum:0},end:{type:'integer',minimum:1}}),
    object({kind:{const:'portfolio-evidence'},portfolioId:text(36),origin:{type:'string',enum:['review','snapshot','current_continuity']},recordId:text(36)}),
    object({kind:{const:'portfolio-evidence'},portfolioId:text(36),origin:{const:'current_continuity'}})])}),
   finding=object({id:text(64),kind:{type:'string',enum:['excerpt','claim']},text:text(2000),citations:list(citation,10)}),
   disclosed=object({findingId:text(64),note:text(1000)});
  properties={skill,title:text(200),asOf:{type:'string'},summary:text(2000),findings:list(finding,40),
   conflicts:list(disclosed,20),recommendations:list(text(1000),20),limitations:list(text(1000),20)};
 }else throw Object.assign(Error('SKILL_OUTPUT_FORMAT_UNAVAILABLE'),{code:'SKILL_OUTPUT_FORMAT_UNAVAILABLE'});
 return {type:'json_schema',schema:object(properties)};
}
