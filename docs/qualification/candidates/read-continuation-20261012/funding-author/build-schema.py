"""Author's schema construction, from pinned interface facts; no legacy code import."""
import json
from pathlib import Path
D={}
def ref(n): return {'$ref':'#/$defs/'+n}
def obj(p,optional=()): return {'type':'object','additionalProperties':False,'properties':p,'required':[k for k in p if k not in optional]}
def arr(t,cap=None): return dict(type='array',items=t,**({} if cap is None else {'maxItems':cap}))
def nullable(t): return {'anyOf':[t,{'type':'null'}]}
def enum(*v): return {'enum':list(v)}
s={'type':'string'}; ns=nullable(s); num={'type':'number'}; nn=nullable(num); boolean={'type':'boolean'}
integer={'type':'integer','minimum':0,'maximum':9007199254740991}; ni=nullable(integer)
def bound(lo,hi):return {'type':'integer','minimum':lo,'maximum':hi}
uuid={'type':'string','pattern':'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'}
D['FundingSamRecordId']=uuid
D['FundingSource']=enum('grants_gov','sam_gov'); D['FundingSourceV2']=enum('grants_gov','sam_gov','agency_forecast','dibbs','sbir_sttr','ca_portal')
D['FundingKind']=enum('grant','cooperative_agreement','sources_sought','presolicitation','solicitation','combined_synopsis_solicitation','special_notice','amendment','award_notice','other')
D['FundingReference']=obj({'source':ref('FundingSource'),'sourceRecordId':{'type':'string','minLength':1}})
D['FundingEligibility']=obj({'state':enum('eligible','ineligible','needs_review','unknown'),'reason':s})
D['FundingRecommendation']=obj({'machineRecommendation':enum('pursue','monitor','pass','needs_review'),'recommendationConfidence':enum('high','medium','low'),'primaryReason':s,'primaryRisk':ns,'recommendedNextAction':s,'reasonCodes':arr(enum('source_closed','informational_notice','not_eligible','client_profile_too_thin','eligibility_needs_review','eligibility_unknown','below_evidence_floor','strong_capability_match','moderate_capability_match','prior_agency_award_history','deadline_imminent','deadline_not_stated','no_award_history_evidence','vehicle_access_unresolved'))})
D['FundingDecision']=obj({'decision':enum('pursue','monitor','pass'),'reason':ns,'decidedAt':ns,'decidedByUserId':ns,'nextAction':ns,'nextActionDueAt':ns})
D['FundingDeadline']=obj({'at':ns,'dateOnly':ns,'timeZone':ns,'basis':enum('explicit_datetime','date_only_end_of_day','unknown'),'daysRemaining':nullable({'type':'integer'}),'status':enum('open','closed','unknown'),'rawText':s},['rawText'])
brief={'ref':ref('FundingReference'),'title':s,'agency':ns,'kind':ref('FundingKind'),'isActive':boolean,'isPursuable':boolean,'responseDeadline':ns,'responseDeadlineNote':ns,'relevanceScore':nn,'eligibility':ref('FundingEligibility'),'recommendation':nullable(ref('FundingRecommendation')),'humanDecision':nullable(ref('FundingDecision')),'workflowStatus':ns,'sourceUrl':ns,'sourceUpdatedAt':ns,'deadline':ref('FundingDeadline')}
D['FundingBrief']=obj(brief,['deadline'])
D['FundingGrantMoney']=obj({'estimatedProgramFunding':nn,'awardFloor':nn,'awardCeiling':nn,'expectedAwardCount':nn,'costSharingRequired':nullable(boolean)})
D['FundingContractValue']=obj({'estimatedValue':nn,'basis':enum('not_stated_by_source','source_backed')})
D['FundingPlace']=obj(dict.fromkeys(['city','state','zip','country'],ns))
D['FundingMissingField']=obj({'field':s,'label':s,'impact':s,'href':ns})
D['FundingProfileGap']=obj({'title':s,'tag':s,'tone':enum('warn','muted'),'body':s})
D['FundingMatchedSignal']=obj({'signal':s,'source':enum('capability','funding_priority'),'strength':enum('strong','moderate','weak'),'weight':num,'matchedOn':s},['source','weight'])
D['FundingAcquisitionEvidence']=obj({'tangoVehicleId':s,'vehicleName':ns,'vehicleType':ns,'relationship':enum('self','parent','teaming'),'recipientUei':s,'orderCount':nn,'idvObligations':nn,'idvContractsValue':nn,'lastDateToOrder':ns,'expired':nullable(boolean),'lastSyncedAt':s})
D['FundingAcquisitionPosition']=obj({'state':enum('direct_prime_access','related_entity_access','known_teaming_route','vehicle_not_identified','no_direct_access_evidence','unknown'),'evidence':arr(ref('FundingAcquisitionEvidence')),'summary':s,'recommendedRoute':s,'source':{'const':'tango'},'freshness':obj({'lastSyncedAt':ns,'neverSynced':boolean})})
D['FundingSummaryRead']=obj({'state':enum('available','missing','link_only'),'offset':integer,'totalCharacters':integer,'returnedCharacters':integer,'truncated':boolean,'nextOffset':ni,'sourceUpdatedAt':ns})
D['FundingEvidence']=obj({'recordRef':s,'recommendationConfidence':nullable(enum('high','medium','low')),'confidenceMeaning':{'const':'Canonical recommendation evidence quality, not likelihood of winning or verified eligibility.'},'disqualifiers':arr(obj({'basis':{'const':'canonical_eligibility'},'reason':s}),1),'missingFields':arr(enum('sourceUrl','sourceUpdatedAt','responseDeadline','placeOfPerformance','eligibleApplicantTypes','noticeText')),'requirements':obj({'state':enum('not_requested','notice_body'),'tool':enum('get_funding_opportunity_requirements','get_funding_opportunity')})})
facts=dict(brief)
facts.update({'clientId':nullable(uuid),'sourceReference':ns,'subAgency':ns,'office':ns,'status':ns,'kindRaw':ns,'baseKind':nullable(ref('FundingKind')),'closeOrArchiveDate':ns,'postedDate':ns,'summary':ns,'summaryIsLink':boolean,'naicsCodes':arr(s),'pscCodes':arr(s),'setAside':ns,'setAsideCode':ns,'setAsideDescription':ns,'eligibleApplicantTypes':arr(s),'fundingInstrument':ns,'category':ns,'assistanceListings':arr(s),'grantFunding':nullable(ref('FundingGrantMoney')),'contractValue':nullable(ref('FundingContractValue')),'placeOfPerformance':nullable(ref('FundingPlace')),'acquisitionPosition':nullable(ref('FundingAcquisitionPosition')),'missingProfileFields':nullable(arr(ref('FundingMissingField'))),'matchedSignals':arr(ref('FundingMatchedSignal')),'districtKey':ns,'districtBasis':nullable(enum('source_place_of_performance','linked_project_site')),'evidence':ref('FundingEvidence'),'summaryRead':ref('FundingSummaryRead')})
D['FundingFacts']=obj(facts,['deadline'])
D['FundingCounts']=obj({'activeGrants':ni,'activeContracts':ni,'saved':{'type':'null'},'pursuing':{'type':'null'},'dismissed':{'type':'null'},'deadlinesIn30Days':ni})
D['FundingFreshness']=obj({'source':ref('FundingSourceV2'),'state':enum('current','degraded','stale','never_synced','initial_partial','error_cached','unavailable','not_enabled','unknown'),'recordCount':ni,'activeRecordCount':ni,'lastSyncedAt':ns,'latestAttemptAt':ns,'lastSuccessAt':ns},['latestAttemptAt','lastSuccessAt'])
criteria={'schemaVersion':{'const':2},'mode':{'const':'matched'},'clientId':uuid,'query':s,'queryMatch':enum('keywords','phrase'),'keywordTerms':arr(s),'sources':arr(ref('FundingSource'),2),'types':arr(s),'lifecycle':arr(enum('active','closed','post_award'),3),'deadlineWindow':{'const':'any'},'deadlineFrom':{'type':'null'},'deadlineTo':{'type':'null'},'sort':{'const':'deadline'},'direction':{'const':'asc'},'page':bound(1,10000),'pageSize':bound(1,5)}
for key in ['agencies','sectors','naicsCodes','pscCodes','setAsideCodes','eligibility','posted','geography','applicantTypes','funding','costShare','methods','disbursement','grantPrerequisites','codes']:criteria[key]=arr(s)
D['FundingSearchCriteria']=obj(criteria,['queryMatch','keywordTerms'])
common={'clientId':uuid,'counts':ref('FundingCounts'),'freshness':arr(ref('FundingFreshness')),'emptyReason':ns,'emptyExplanation':ns,'missingProfileFields':nullable(arr(ref('FundingProfileGap')))}
D['FundingSearchData']=obj({**common,'criteria':ref('FundingSearchCriteria'),'total':ni,'totalIsCapped':boolean,'page':bound(1,10000),'pageSize':bound(1,5),'generatedAt':{'type':'string','format':'date-time'},'opportunities':arr(ref('FundingFacts'),5),'hasMore':boolean,'nextPage':nullable(bound(2,10001)),'coverage':obj({'sources':arr(ref('FundingSource'),2),'pageCoversMatchedResults':boolean,'totalIsCapped':boolean,'explanation':s,'procurementForecasts':obj({'state':{'const':'separate_tool'},'tool':{'const':'search_procurement_forecasts'}})})})
D['FundingClientContextData']=obj({**common,'nextDeadline':nullable(ref('FundingDeadline')),'topGrants':arr(ref('FundingBrief'),5),'topContracts':arr(ref('FundingBrief'),5)})
D['FundingRequirement']=obj({'id':s,'attachmentId':ns,'requirementType':s,'statement':s,'sourceExcerpt':s,'excerptStart':integer,'excerptEnd':integer,'sourcePage':nullable(bound(1,9007199254740991)),'fileName':ns,'extractionMethod':s,'extractionModel':s,'confidence':s,'reviewStatus':enum('pending','accepted','rejected'),'supersededAt':ns})
D['FundingRequirementsData']=obj({'source':{'const':'sam_gov'},'sourceRecordId':uuid,'requirements':arr(ref('FundingRequirement'),25),'coverage':enum('available','no_documents','no_text','read_none_found'),'coverageExplanation':s,'documentTextStatus':arr(obj({'fileName':ns,'status':s,'explanation':s})),'generatedAt':{'type':'string','format':'date-time'},'pagination':obj({'offset':bound(0,1000000),'limit':bound(1,25),'total':ni,'hasMore':boolean,'nextOffset':ni})})
D['FundingLandscapeSource']=enum('program_element','budget_movement','client_facility','congressional_district','legislation','hearing','regulation','committee','acquisition_personnel','reviewed_relationship','client_priority')
D['FundingLandscapeItem']=obj({'source':ref('FundingLandscapeSource'),'sourceId':s,'label':s,'basis':enum('source_backed','inferred'),'matchedOn':s,'evidenceRef':ns,'asOf':ns})
D['FundingLandscapeData']=obj({'fingerprint':{'type':'string','pattern':'^[0-9a-f]{64}$'},'coverage':obj({'available':bound(0,11),'wired':{'const':3},'declared':{'const':11}}),'sources':arr(obj({'source':ref('FundingLandscapeSource'),'state':enum('available','empty','not_wired','denied'),'itemCount':integer,'explanation':s}),11),'items':arr(ref('FundingLandscapeItem'),40)})
D['FundingTruncation']=obj({'collection':enum('topGrants','topContracts','items'),'kept':integer,'total':integer})
inputs={
 'FundingSearch':({'clientId':uuid,'source':s,'query':{'type':'string'},'page':bound(1,100000),'pageSize':bound(1,5),'activeState':enum('active','closed','all')},['clientId']),
 'FundingRequirements':({'clientId':uuid,'source':s,'sourceRecordId':{'type':'string','minLength':1},'offset':bound(0,1000000),'limit':bound(1,25)},['clientId','source','sourceRecordId']),
 'FundingOpportunity':({'clientId':uuid,'source':s,'sourceRecordId':{'type':'string','minLength':1},'summaryOffset':bound(0,100000000),'summaryLimit':bound(1,12000)},['clientId','source','sourceRecordId']),
 'FundingClientContext':({'clientId':uuid},['clientId']),
 'FundingGovernmentLandscape':({'clientId':uuid,'source':s,'sourceRecordId':{'type':'string','minLength':1}},['clientId','source','sourceRecordId'])}
ops=['search_funding_opportunities','get_funding_opportunity_requirements','get_funding_opportunity','get_opportunity_client_context','get_opportunity_government_landscape']
data=['FundingSearchData','FundingRequirementsData','FundingFacts','FundingClientContextData','FundingLandscapeData']
for (name,(p,required)),operation,result in zip(inputs.items(),ops,data):
 D[name+'Input']=obj(p,[k for k in p if k not in required])
 output=obj({'tool':{'const':operation},'state':enum('available','disabled','denied','not_found','unsupported_source','invalid_request'),'explanation':{'type':'string','minLength':1},'asOf':{'type':'string','format':'date-time'},'data':nullable(ref(result)),'truncated':{**arr(ref('FundingTruncation'),2),'minItems':1}},['truncated'])
 output['allOf']=[{'if':{'properties':{'state':{'const':'available'}},'required':['state']},'then':{'properties':{'data':ref(result)}},'else':{'properties':{'data':{'type':'null'},'truncated':False}}}]
 D[name+'Output']=output
out={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:meri:retrieval:funding-opportunities:0.2.0','title':'Private unavailable funding read projections','$defs':D}
Path('packages/contracts/retrieval-0.2/funding-opportunities.schema.json').write_text(json.dumps(out,indent=2)+'\n')
