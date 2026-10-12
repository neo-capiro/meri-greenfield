from pathlib import Path
import json
root=Path(__file__).resolve().parents[5]
def obj(p,optional=()):return {'type':'object','additionalProperties':False,'properties':p,'required':[k for k in p if k not in optional]}
def ref(n):return {'$ref':'#/$defs/'+n}
def null(s):return {'anyOf':[s,{'type':'null'}]}
def arr(s,**kw):return {'type':'array','items':s,**kw}
s={'type':'string'};ns=null(s);n={'type':'integer','minimum':0,'maximum':9007199254740991};i={'type':'integer','minimum':-2147483648,'maximum':2147483647};b={'type':'boolean'};stamp={'type':'string','format':'date-time'};nst=null(ref('BillTextInstant'));uuid={'type':'string','pattern':'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'};hash_={'type':'string','pattern':'^[a-f0-9]{64}$'}
cursor={'type':'string','minLength':1,'maxLength':1024,'pattern':'^[A-Za-z0-9_-]+$'}
raw={'id':s,'congress':i,'billType':s,'billNumber':s,'title':s,'introducedDate':nst,'sponsorName':ns,'sponsorState':ns,'sponsorParty':ns,'sponsorBioguideId':ns,'latestActionText':ns,'latestActionDate':nst,'policyArea':ns,'subjects':arr(s),'peCodes':arr(s),'committees':{},'cosponsorsCount':i,'originChamber':ns,'updateDate':nst,'updateDateIncludingText':nst,'status':ns,'statusAt':nst,'url':ns,'lastSyncedAt':ref('BillTextInstant')}
baseSearch={'tool':{'const':'search_congress_bills'},'generatedAt':ref('BillTextInstant')}
baseRead={'tool':{'const':'read_bill_text'},'authoritativeOwner':{'const':'federal_evidence_current'},'billId':s}
avail={**baseRead,'currentStatus':{'const':'available'},'found':{'const':True},'versionCode':s,'revisionId':ref('BillTextRevisionId'),'packageId':s,'provider':s,'lineageKey':s,'versionHash':ref('BillTextHash'),'textHash':ref('BillTextHash'),'sourceLocator':s,'sourceModifiedAt':nst,'publishedAt':nst,'fetchedAt':ref('BillTextInstant'),'text':s,'trust':{'const':'external_untrusted'},'note':s}
cover={'totalCharacters':n,'pageComplete':{'const':True},'contentComplete':b,'paginationComplete':b,'complete':b,'truncated':b,'nextCursor':null(ref('BillTextCursor'))}
defs={'BillTextActionDateSelector':{'anyOf':[{'type':'string','format':'date'},{'type':'string','format':'date-time'}]},'BillTextInstant':stamp,'BillTextRevisionId':uuid,'BillTextHash':hash_,'BillTextCursor':cursor,'BillTextContext':obj({'defaultCongress':{'type':'integer','minimum':1,'maximum':2147483647}}),
 'CongressBillSearchInput':obj({'query':ns,'search':ns,'policyArea':ns,'activeSince':ns,'congress':null(i),'page':{'type':'integer','minimum':1,'maximum':100},'limit':{'type':'integer','minimum':1,'maximum':50},'textQuery':ns},('query','search','policyArea','activeSince','congress','page','limit','textQuery')),
 'BillTextReadInput':obj({'billId':s,'versionCode':ns,'query':ns,'cursor':ref('BillTextCursor')},('versionCode','query','cursor')),
 'CongressBillRaw':obj(raw),
 'CongressBillMetadataOutput':obj({**baseSearch,'data':arr(ref('CongressBillRaw'),maxItems=50),'total':n,'page':{'type':'integer','minimum':1,'maximum':100},'limit':{'type':'integer','minimum':1,'maximum':50},'resolvedBy':{'const':'bill-id'}},('resolvedBy',)),
 'BillTextSearchPassage':obj({'snippet':s,'startOffset':n,'readCursor':null(ref('BillTextCursor'))}),
 'BillTextSearchResult':obj({'billId':s,'title':ns,'versionCode':s,'passages':arr(ref('BillTextSearchPassage'),minItems=1,maxItems=2)}),
 'CongressBillTextSearchOutput':obj({**baseSearch,'mode':{'const':'bill_text'},'textQuery':s,'results':arr(ref('BillTextSearchResult'),maxItems=10),'total':n,'totalBills':null(n),'page':{'type':'integer','minimum':1,'maximum':100},'perPage':{'type':'integer','minimum':1,'maximum':10},'hasMore':b,'nextPage':{'type':'integer','minimum':2,'maximum':101},'omittedBills':{'type':'integer','minimum':1,'maximum':9},'note':s},('nextPage','omittedBills')),
 'BillTextUnavailableOutput':obj({**baseRead,'currentStatus':{'const':'unavailable'},'found':{'const':False},'requestedVersionCode':ns,'coverage':obj({'complete':{'const':True},'truncated':{'const':False},'nextCursor':{'type':'null'}}),'note':s}),
 'BillTextSequentialOutput':obj({**avail,'coverage':obj({**cover,'locator':obj({'offset':n,'endOffset':n})})}),
 'BillTextLocatedPassage':obj({'heading':ns,'startOffset':n,'endOffset':n,'matchedTerms':arr(s,minItems=1,uniqueItems=True),'readCursor':null(ref('BillTextCursor'))}),
 'BillTextLocatedOutput':obj({**avail,'query':s,'queryParts':arr(s),'totalHits':n,'passages':arr(ref('BillTextLocatedPassage'),maxItems=6),'coverage':obj({**cover,'locator':obj({'query':s})})}),
 'CongressBillSearchOutput':{'oneOf':[ref('CongressBillMetadataOutput'),ref('CongressBillTextSearchOutput')]},
 'BillTextReadOutput':{'oneOf':[ref('BillTextUnavailableOutput'),ref('BillTextSequentialOutput'),ref('BillTextLocatedOutput')]}}
(root/'packages/contracts/retrieval-0.2/bill-text.schema.json').write_text(json.dumps({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:meri:retrieval:bill-text:0.2.0','$defs':defs},indent=2)+'\n')
