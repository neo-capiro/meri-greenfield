#!/usr/bin/env python3
"""Offline immutable Git/data review; no target imports or external calls."""
import hashlib, json, subprocess, sys
from decimal import Decimal
BASE="73c854ea41f764eb3e3e84bfd0a0cb73fa29a329"
CANDIDATE=sys.argv[1]
checks=[]
def check(name, ok, detail=None):
    checks.append({"name":name,"pass":bool(ok),"detail":detail})
def tree(ref):
    rows=subprocess.check_output(["git","ls-tree","-r","-z",ref]).split(b"\0")
    return {r.split(b"\t",1)[1].decode():r.split(b"\t",1)[0].decode() for r in rows if r}
def raw(path): return subprocess.check_output(["git","show",CANDIDATE+":"+path])
def data(path): return json.loads(raw(path))
a,b=tree(BASE),tree(CANDIDATE)
mismatches=[path for path,identity in a.items() if b.get(path)!=identity]
check("all-originals-byte-identical",not mismatches,{"count":len(a),"mismatches":mismatches})
allowed=("docs/qualification/candidates/local-application-20261013/pilot/",)
names={"docs/coordination/tasks/CODEX-LOCAL-APPLICATION-PILOT-20261013.md","docs/coordination/reports/CODEX-LOCAL-APPLICATION-PILOT-20261013.md"}
added=sorted(set(b)-set(a))
check("exclusive-author-scope",all(x.startswith(allowed) or x in names for x in added),added)
check("eighteen-each-36",18+18==36)
check("max-input",18*8000==144000)
check("max-output",18*256==4608)
check("conditional-prior-decimal",Decimal(144000)*Decimal("3.30")/1000000+Decimal(4608)*Decimal("16.50")/1000000==Decimal("0.551232"))
# Read only the existing immutable wire capture; no app imports or replay.
wire=json.loads(subprocess.check_output(["git","show",BASE+":docs/qualification/candidates/action-wiring-20261013/integration/wire-fixtures-fetch.json"]))
q,d,p,u,approved,replay=wire["steps"]
page=q["response"]["observation"]["result"]
check("wire-query-read",q["route"]=="query" and q["httpStatus"]==200 and "observation" in q["response"])
check("one-actual-synthetic-recommendation",page["returned"]==1 and page["total"]==1 and len(page["actions"])==1)
check("recommendation-not-task",q["response"]["classification"]=="recommendations" and q["response"]["acceptedTasks"] is False and page["actions"][0]["acceptedAsTask"] is False)
check("no-invented-evidence",page["actions"][0]["evidence"]==[] and page["actions"][0]["sourceProof"]["linkedSources"]==[])
check("absence-not-supported",page["pageCoverage"]["absenceSupported"] is False)
check("draft-exact-edit",d["response"]["task"]=={"title":"Review the synthetic recommendation","clientId":"abcdef00-0000-4000-8000-000000000009","dueDate":None})
check("prepare-not-approval",p["response"]["status"]=="approval_required")
check("unapproved-no-dispatch",u["httpStatus"]==409 and u["response"]=={"error":{"code":"COMMAND_APPROVAL_REFUSED","outcome":"NOT_DISPATCHED"}})
check("historical-explicit-approval-only",approved["phase"]=="AFTER_EXPLICIT_FIXTURE_ONLY_APPROVAL")
check("historical-replay-identical",approved["response"]==replay["response"])
provenance=json.loads(subprocess.check_output(["git","show",BASE+":docs/qualification/candidates/action-host-20261013/pilot/capiro-provenance.json"]))
check("qualified-human-corpus-zero",provenance["qualifiedHumanCases"]==0)
prefix="docs/qualification/candidates/local-application-20261013/pilot/"
c=data(prefix+"cases.json");price=data(prefix+"pricing.json");cs=c["cases"];caps=price["caps"]
check("case-ids",[v["id"] for v in cs]==["P01","P02","P03","P04","P05","P06"])
check("literal-prompts",len({v["prompt"] for v in cs})==6 and all(len(v["prompt"])>30 for v in cs))
check("truthful-human-origin",c["qualifiedRealRequests"]==c["humanAuthoredCases"]==0 and all(v["humanAuthorshipVerified"] is False for v in cs))
check("implemented-exact-routes",[v["api"]["path"] for v in cs]==["/api/action-followthrough/"+v for v in ["query","query","draft","prepare","execute","query"]])
check("no-pilot-task-writes",all(v["maxSyntheticEffects"]["taskEffects"]==0 for v in cs))
check("fresh-transport-not-gold",all("old captured hashes are exact-replay evidence only" in v["freshIdentityRule"] for v in cs))
w=data(cs[0]["wireGold"]);wq,wd,wp,wu,*_=w["steps"];pg=wq["response"]["observation"]["result"];row=pg["actions"][0]
check("p01-gold",all(cs[0]["expected"][k]==row[k] for k in ["title","whatChanged","whyItMatters","recommendedAction","clientId"]) and cs[0]["expected"]["actionId"]==row["id"])
e=cs[1]["expected"]
check("p02-coverage-gold",e["coverageEnumeration"]==pg["coverage"]["enumeration"] and e["sourceFreshness"]==pg["sources"][0]["freshness"] and e["sourceAsOf"]==pg["sources"][0]["asOf"] and e["negativeAssertion"]==pg["negativeAssertion"]["kind"] and e["evidenceReady"]==pg["evidenceReady"] and e["pageCoverageComplete"]==pg["pageCoverage"]["complete"])
check("p03-draft-gold",cs[2]["expected"]["task"]==wd["response"]["task"] and cs[2]["expected"]["draftStatus"]==wd["response"]["status"])
check("p04-pending-gold",cs[3]["expected"]["resultStatus"]==wp["response"]["status"]=="approval_required" and cs[3]["expected"]["commandAction"]==wp["response"]["proposal"]["command"]["action"])
check("p05-unapproved-gold",cs[4]["expected"]["status"]==wu["httpStatus"] and cs[4]["expected"]["error"]==wu["response"]["error"])
check("p06-source-refusal",cs[5]["expected"]["status"]==401 and cs[5]["expected"]["error"]=={"code":"UNAUTHENTICATED","outcome":"NOT_DISPATCHED"} and cs[5]["maxSyntheticEffects"]["sourceReads"]==0 and "no new measured capture" in cs[5]["expected"]["basis"])
check("p06-resolver-owner",b"fail('UNAUTHENTICATED',401)" in raw("apps/control/action-application/index.mjs") and b"function errorResponse" in raw("apps/control/action-application/http.mjs"))
check("caps-preserved",caps["sessions"]==6 and caps["inferenceAttempts"]==18 and caps["countTokensAttempts"]==18 and caps["totalProviderHttpOperations"]==36 and caps["inputTokensPerInference"]==8000 and caps["outputTokensPerInference"]==256 and caps["inputTokensTotal"]==144000 and caps["outputTokensTotal"]==4608)
check("cap-unapproved",caps["proposedNewUsdCeiling"]=="0.75" and caps["approved"] is False and caps["historicalAllowanceRemainder"]=="UNKNOWN_NOT_REUSED")
check("exact-priced-route",price["provider"]=="Amazon Bedrock" and price["region"]=="us-east-1" and price["profile"]=="us.anthropic.claude-sonnet-4-6" and price["tier"]=="Standard")
check("unknown-rate-not-fabricated",price["publicAwsMatchedRate"]["inputUsdPerMillionTokens"] is None and price["publicAwsMatchedRate"]["outputUsdPerMillionTokens"] is None and price["publicAwsMatchedRate"]["sku"] is None)
check("zero-count-fee",price["countTokens"]["publishedUsdPerRequest"]=="0")
old=price["formula"]["priorConditionalIllustrationOnly"]
check("old-calculation-conditional",old["status"]=="NOT_A_VERIFIED_AWS_RATE_OR_EXECUTABLE_COST_BOUND" and Decimal(old["maximumTokenUsd"])==Decimal("0.551232") and Decimal(old["estimatedUsd"])==Decimal("0.183744"))
check("uncertainty-no-retry",caps["automaticRetries"]==0 and "uncertain" in caps["auxiliaryCalls"] and "Stop" in caps["auxiliaryCalls"])
check("unpaid-tests-not-blocked","not ordinary source-only synthetic checks" in price["stopAndCleanup"][0])
check("real-request-label-only","Templates can be used as synthetic routing smoke without this" in c["missingHumanInputs"][0])
for ref in data(prefix+"source-identities.json")["references"]:
    content=subprocess.check_output(["git","show",ref["commit"]+":"+ref["path"]])
    check("source-pin:"+ref["path"],len(content)==ref["bytes"] and hashlib.sha256(content).hexdigest()==ref["sha256"] and subprocess.check_output(["git","rev-parse",ref["commit"]+":"+ref["path"]],text=True).strip()==ref["blob"])
m=data(prefix+"manifest.json");members=m["members"]
check("manifest-members-complete",set(v["path"] for v in members)==set(added)-{prefix+"manifest.json"})
for item in members:
    content=raw(item["path"]);check("manifest:"+item["path"],len(content)==item["bytes"] and hashlib.sha256(content).hexdigest()==item["sha256"])
check("retained-direct-failures",all(v["bytes"]==0 and "403" in v["error"] and not v["candidateLocationExistenceVerified"] for v in data(prefix+"direct-price-list-reads.json")))
check("author-audit49",data(prefix+"verification.json")["passed"]==49 and data(prefix+"verification.json")["failed"]==0)

check("prior-timing-ceilings", "120 seconds per session,900 seconds overall" in price["stopAndCleanup"][2])
check("demo-max30-unmodified", "existing local demo maxTTL30 seconds is unchanged" in price["stopAndCleanup"][2] and b"ttlMs>30000" in raw("apps/control/action-application/local/demo.mjs"))
check("correction-preserved",data(prefix+"review-correction.json")["preimageCommit"]=="832120c96f33ca07862f10176797b777916ade45")
result={"base":BASE,"candidate":CANDIDATE,"checks":checks,"passed":sum(c["pass"] for c in checks),"failed":sum(not c["pass"] for c in checks),"originalCount":len(a),"newPaths":added,"targetExecution":False}
print(json.dumps(result,indent=2))
sys.exit(bool(result["failed"]))
