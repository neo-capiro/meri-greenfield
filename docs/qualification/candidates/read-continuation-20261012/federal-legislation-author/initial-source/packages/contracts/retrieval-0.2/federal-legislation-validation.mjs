// Private stored bill/vote boundary. No source querying, status derivation,
// ambient calendar, member resolution or authorization implementation.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const BILL='get_bill_status',VOTES='search_floor_votes';
function family(operation) {
  if (typeof operation!=='string') fail('Federal operation must be a string');
  if (operation===BILL) return 'FederalBillStatus';
  if (operation===VOTES) return 'FederalFloorVotes';
  fail('Unknown federal legislation operation');
}
const text=(value,max)=>typeof value==='string' && value.trim() ? value.trim().slice(0,max) : null;
function instant(value,dateOnly=false) {
  const at=Date.parse(value);
  if (!Number.isFinite(at) || new Date(at).toISOString()!==value || dateOnly && at%86400000!==0)
    fail('Federal stored date requires its canonical serialized instant');
  return at;
}
function ordered(rows,key) {
  let previous=Infinity;
  for (const row of rows) {const at=instant(row[key]);if(at>previous)fail('Federal source observations must descend');previous=at;}
}
function unique(rows,key) {
  if(new Set(rows.map(row=>row[key])).size!==rows.length)fail('Duplicate federal record identity');
}

export function createFederalLegislationValidators({validateShape,schema}) {
  // Grammar tables describe the accepted reference syntax; no legacy parser or
  // live resolver is imported. Explicit canonical IDs keep leading zeroes.
  const types=schema.$defs.FederalBillTypes.enum;
  const canonical=new RegExp(`^[0-9]{2,3}-(${types.join('|')})-[0-9]{1,5}$`);
  const designation=Object.entries(schema.$defs.FederalDesignationTokens.const).map(([type,tokens])=>
    [type,new RegExp(`^${tokens.map(token=>`${token}\\.?`).join('\\s*')}\\s*([0-9]{1,5})$`,'i')]);
  function billId(raw,defaultCongress) {
    if (raw===null) return null;
    const lower=raw.trim().toLowerCase();if(canonical.test(lower))return lower;
    const suffix=/\(([0-9]{2,3})(?:st|nd|rd|th)?\)\s*$/.exec(raw);
    const congress=suffix?Number(suffix[1]):defaultCongress;
    const body=suffix?raw.slice(0,suffix.index).trim():raw.trim();
    for(const [type,pattern] of designation){const match=pattern.exec(body);if(match){
      const number=Number(match[1]);return congress>0 && number>0?`${congress}-${type}-${number}`:null;
    }}
    return null;
  }
  function normalizeFederalLegislationInput(operation,request,options) {
    const name=family(operation),raw=snapshotOperationData(request),context=snapshotOperationData(options);
    validateShape('FederalLegislationContext',context);validateShape(`${name}Request`,raw);
    const selected=billId(text(raw.billId,60)??(operation===BILL?text(raw.query,60):null),context.defaultCongress);
    if(operation===BILL)return {billId:selected};
    const member=text(raw.member,80),upper=member?.toUpperCase(),chamber=text(raw.chamber,10)?.toLowerCase();
    const numeric=typeof raw.limit==='number'?raw.limit:typeof raw.limit==='string'?Number(raw.limit):NaN;
    let congress=raw.congress?Number(raw.congress):null;
    if(Number.isNaN(congress)||congress===0)congress=null;
    const input={billId:selected,query:text(raw.query,200),member,bioguideId:upper&&/^[A-Z][0-9]{6}$/.test(upper)?upper:null,
      chamber:['house','senate'].includes(chamber)?chamber:null,congress,
      limit:Number.isFinite(numeric)?Math.min(25,Math.max(1,Math.trunc(numeric))):10};
    validateShape(`${name}Input`,input);return input;
  }
  function notes(page,expected) {
    if(expected===null?Object.hasOwn(page,'note'):page.note!==expected)fail('Federal source refusal/warning note mismatch');
  }
  function bill(page,input) {
    if(input.billId===null){if(page.currentStatus!=='invalid_request')fail('Invalid bill selector cannot release status');return;}
    if(page.currentStatus==='invalid_request'||page.billId!==input.billId)fail('Bill identity or refusal substitution');
    if(!page.found){notes(page,`No bill ${input.billId} on record in the Capiro database. Say so explicitly — do not describe its status from memory.`);return;}
    const labels=schema.$defs.FederalBillStatusLabels.const;
    const label=page.status===null?'Unknown':Object.hasOwn(labels,page.status)?labels[page.status]:page.status;
    if(page.statusLabel!==label)fail('Stored bill status label mismatch');
    if(page.statusAt!==null)instant(page.statusAt);
    if(page.latestAction.date!==null)instant(page.latestAction.date,true);
    ordered(page.recentActions,'date');ordered(page.floorVotes,'voteDate');unique(page.governingRules,'ruleBillId');
    for(const rule of page.governingRules)ordered(rule.ruleVotes,'voteDate');
    const warnings=[];
    if(page.floorVotes.length===0)warnings.push(schema.$defs.FederalNoBillVoteNote.const);
    if(page.status==='rule_failed')warnings.push(schema.$defs.FederalRuleFailedNote.const);
    notes(page,warnings.length?warnings.join(' '):null);
    // Governing-rule votes are deliberately never substituted for the bill's
    // floor votes or used here to recompute its persisted status.
  }
  function votes(page,input) {
    if(page.votesFound!==page.votes.length||page.votes.length>input.limit)fail('Floor-vote returned count/window mismatch');
    const member=page.member,ambiguous=page.ambiguousMember;
    if(ambiguous){
      if(input.member===null||input.bioguideId!==null||member||page.votes.length)fail('Invalid member ambiguity branch');
      unique(ambiguous,'bioguideId');
      notes(page,`"${input.member}" matches ${ambiguous.length} members — ask the user which (by state/chamber/full name) before attributing votes. Results are NOT scoped to a member yet.`);return;
    }
    if(input.member!==null&&!member){
      if(page.votes.length)fail('Unresolved member cannot release unscoped votes');
      notes(page,input.bioguideId!==null?
        `No member with Bioguide id ${input.bioguideId} is on record. Results are NOT scoped to a member — say so; do not attribute votes.`:
        `Could not resolve a member named "${input.member}". Results are NOT scoped to that member — say so explicitly; do not attribute any vote to them.`);return;
    }
    if(member&&(input.member===null||input.bioguideId!==null&&member.bioguideId!==input.bioguideId))fail('Floor-vote member substitution');
    unique(page.votes,'id');ordered(page.votes,'voteDate');
    for(const vote of page.votes){
      if((input.billId!==null&&vote.billId!==input.billId)||(input.congress!==null&&vote.congress!==input.congress)||
          (input.chamber!==null&&vote.chamber!==input.chamber))fail('Floor-vote exact selector mismatch');
      if(member){if(!vote.memberVotes?.length)fail('Resolved-member vote requires returned position evidence');}
      else if(Object.hasOwn(vote,'memberVotes'))fail('Unscoped vote cannot carry a member attribution');
    }
    notes(page,page.votes.length?null:member?
      `No roll-call vote on record matches — including none cast by ${member.fullName} under these filters. Say so explicitly; do not infer a vote.`:
      schema.$defs.FederalNoVotesNote.const);
  }
  function assertFederalLegislationOutput(operation,value,request,options) {
    const name=family(operation),input=normalizeFederalLegislationInput(operation,request,options),page=snapshotOperationData(value);
    validateShape(`${name}Output`,page);instant(page.generatedAt);
    if(operation===BILL)bill(page,input);else votes(page,input);
    return value;
  }
  return {normalizeFederalLegislationInput,assertFederalLegislationOutput};
}
