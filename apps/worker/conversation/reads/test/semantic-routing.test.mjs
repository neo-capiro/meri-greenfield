/** The routing sentence sends topic, intent and similarity questions about bills, grants and contract opportunities
 * to the semantic reads first, and how-many, which-field, trend, join and exact-filter questions to text-to-SQL. The
 * routing is prose the model follows; this test holds the sentence to its own cue vocabulary against ten sample
 * questions, so a rewrite that drops a cue the questions rely on fails here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readPromptSentence} from '../options.mjs';
import {READ_FAMILY_GUIDANCE} from '../family-guidance.mjs';
import {READ_FAMILIES} from '../families.mjs';

const prefix='mcp__meri_reads__';
const sql=[prefix+'describe_capiro_data',prefix+'query_capiro_data'];
const semantic=['semantic_search_bills','semantic_search_grants','semantic_search_contract_opportunities'].map(name=>prefix+name);
const sentence=prompt=>{const m=prompt.match(/Bills, grants and contract opportunities by meaning: [^]*?never name the search method or tool to the user\./);assert.ok(m,'routing sentence');return m[0];};

const SEMANTIC_QUESTIONS=[
 ['Which bills address rural broadband affordability?','bills'],
 ['Find grants for wildfire resilience in small rural counties.','grants'],
 ['Are there contract opportunities like our counter-drone capability statement?','contract opportunities'],
 ['Summarize the bills about PFAS cleanup liability and how they differ.','bills'],
 ['Recommend federal grants similar to the Community Wildfire Defense program.','grants'],
];
const SQL_QUESTIONS=[
 ['How many bills did Senator Warren sponsor in the 119th Congress?','how many'],
 ['Which fields does the grants table carry for award ceilings?','which fields'],
 ['Show the trend of SAM notices posted per month this year.','trend'],
 ['Join tracked bills to their cosponsors and list the ones from Texas.','join'],
 ['List grants from the Department of Energy with a close date after March 1.','exact filters'],
];

test('the semantic routing sentence appears only with a mounted semantic read and sits between SQL and memory routing',()=>{
 assert.doesNotMatch(readPromptSentence(true,sql),/by meaning/);
 for(const tool of semantic)assert.match(readPromptSentence(true,[tool]),/Bills, grants and contract opportunities by meaning:/);
 const all=readPromptSentence(true,[...sql,...semantic,prefix+'search_memory']);
 assert.ok(all.indexOf('Structured questions')<all.indexOf('by meaning:')&&all.indexOf('by meaning:')<all.indexOf('Saved knowledge'),'SQL, then semantic, then memory');
 assert.ok(all.length<3600,`${all.length} characters`);
});

test('each semantic sample question carries a cue the sentence routes to the semantic reads, and none of the SQL cues',()=>{
 const text=sentence(readPromptSentence(true,[...sql,...semantic]));
 for(const verb of ['find','compare','summarize','recommend'])assert.ok(text.includes(verb),verb);
 for(const cue of ['topic','intent','need','similarity','"which bills address"','"grants for"','"opportunities like"','"similar to"'])assert.ok(text.includes(cue),cue);
 for(const [question,subject] of SEMANTIC_QUESTIONS){
  const q=question.toLowerCase();
  assert.ok(['which bills address','grants for','opportunities like','similar to','summarize','recommend','find'].some(cue=>q.includes(cue)),question);
  assert.ok(!['how many','which fields','trend','join','close date after'].some(cue=>q.includes(cue)),question);
  assert.ok(text.includes(subject.split(' ')[0]),subject);
 }
 assert.match(text,/goes to semantic_search_bills, semantic_search_grants or semantic_search_contract_opportunities first/);
 assert.match(text,/then use text-to-SQL for exact facts, counts or joins about the references it returned/);
});

test('each SQL sample question carries a cue the sentence routes to text-to-SQL, not to semantic search',()=>{
 const text=sentence(readPromptSentence(true,[...sql,...semantic]));
 assert.match(text,/how many, which fields, trends, totals, joins or exact filters \(sponsor, date, agency, status\) goes to text-to-SQL, not semantic search/);
 for(const [question,cue] of SQL_QUESTIONS){
  const q=question.toLowerCase();
  const cues={'how many':['how many'],'which fields':['which fields'],trend:['trend'],join:['join'],'exact filters':['close date after','from the department']};
  assert.ok(cues[cue].some(c=>q.includes(c)),question);
  assert.ok(!['which bills address','grants for','opportunities like','similar to','summarize','recommend'].some(c=>q.includes(c)),question);
 }
});

test('the answer cites records and never names the method or tool; the family guidance says what is returned to cite',()=>{
 const text=sentence(readPromptSentence(true,[...sql,...semantic]));
 assert.match(text,/Cite each record you use by its title and identifier from the returned reference/);
 assert.match(text,/say the page is the nearest matches and not a count/);
 assert.match(text,/never name the search method or tool to the user/);
 const guidance=READ_FAMILY_GUIDANCE['semantic-search'];
 assert.equal(READ_FAMILIES['semantic-search'].clientScope,'optional');
 assert.equal(guidance.structured,false,'a semantic read never carries the SQL-first sentence of a structured family');
 assert.match(guidance.returns,/stable reference \(congress_bill, federal_grant or sam_opportunity plus id\) to cite/);
 assert.match(guidance.states,/total is the page size, never a count/);
 // The legacy cross-domain candidate search no longer advertises bills, grants or contract opportunities as its coverage.
 assert.doesNotMatch(READ_FAMILY_GUIDANCE['data-search'].covers,/outreach, bills, grants, awards/);
 assert.match(READ_FAMILY_GUIDANCE['data-search'].covers,/topic questions about bills, grants and contract opportunities go to the semantic reads/);
});
