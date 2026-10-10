"""W02-20 export protocol: build, strict validation and batch rendering.

All five bodies moved verbatim. Validation re-derives context through the
imported _context_ok; export never imports admission. Import is inert.
"""
import base64
import hashlib
import json
import os
import re
import time

from .classification import _hex64_ok, _uuid_ok
from .config import (
    EXPORT_BATCH_BYTES, EXPORT_BATCH_EVENTS, EXPORT_CHUNK_B64_MAX, EXPORT_CHUNK_RAW_MAX,
    EXPORT_EVENT_MAX, EXPORT_EVENT_OVERHEAD, EXPORT_MAX_CALLS, EXPORT_MAX_EVENTS,
    EXPORT_TOTAL_RAW_MAX,
)
from .evidence_io import _exact_keys, _finite_json, _strict_json
from .source_binding import _context_ok

def build_export_protocol(records, run_id, context=None, timestamp=None):
    if not _uuid_ok(run_id) or not _context_ok(context,run_id):return {"ok":False,"reason":"canonical run and complete context required"}
    if not isinstance(records,dict) or not records or len(records)>64 or any(not isinstance(n,str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}",n) for n in records):return {"ok":False,"reason":"bounded named records required"}
    stamp=int(time.time()*1000) if timestamp is None else timestamp
    if type(stamp) is not int or stamp<1:return {"ok":False,"reason":"positive integer millisecond timestamp required"}
    stream="host-"+run_id;events=[];entries=[];total=0
    for name in sorted(records):
        text=records[name] if isinstance(records[name],str) else _finite_json(records[name])
        if text is None:return {"ok":False,"reason":"nonfinite/malformed record"}
        raw=text.encode("utf-8");total+=len(raw)
        if total>EXPORT_TOTAL_RAW_MAX:return {"ok":False,"reason":"aggregate raw bytes exceed fixed bound"}
        chunks=[raw[i:i+EXPORT_CHUNK_RAW_MAX] for i in range(0,len(raw),EXPORT_CHUNK_RAW_MAX)] or [b""]
        entries.append({"name":name,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest(),"chunks":len(chunks)})
        for i,chunk in enumerate(chunks):
            doc={"kind":"chunk","run":run_id,"stream":stream,"record":name,"index":i,"count":len(chunks),"bytes":len(chunk),"sha256":hashlib.sha256(chunk).hexdigest(),"data":base64.b64encode(chunk).decode("ascii")}
            message=_finite_json(doc)
            if len(message.encode("utf-8"))>EXPORT_EVENT_MAX:return {"ok":False,"reason":"event exceeds fixed bound"}
            events.append({"timestamp":stamp,"message":message})
    manifest={"kind":"manifest","run":run_id,"stream":stream,"context":context,"records":entries,"count":len(entries),"totalRawBytes":total}
    msg=_finite_json(manifest)
    if msg is None or len(msg.encode("utf-8"))>EXPORT_EVENT_MAX:return {"ok":False,"reason":"manifest exceeds fixed bound"}
    end={"kind":"end","run":run_id,"stream":stream,"records":len(entries),"events":len(events)+2,"totalRawBytes":total,"manifestSha256":hashlib.sha256(msg.encode("utf-8")).hexdigest()}
    events.extend([{"timestamp":stamp,"message":msg},{"timestamp":stamp,"message":_finite_json(end)}])
    validated=validate_export(events,run_id,stream,context)
    if not validated["ok"]:return validated
    return {"ok":True,"run":run_id,"stream":stream,"events":events,"batches":validated["batches"],"manifest":manifest,"totalRawBytes":total,"calls":validated["calls"]}

def validate_export(events, expected_run=None, expected_stream=None, expected_context=None):
    def bad(reason):return {"ok":False,"reason":reason}
    if not isinstance(events,list) or not 3<=len(events)<=EXPORT_MAX_EVENTS:return bad("event count malformed/over fixed bound")
    parsed=[]
    shapes={"chunk":{"kind","run","stream","record","index","count","bytes","sha256","data"},"manifest":{"kind","run","stream","context","records","count","totalRawBytes"},"end":{"kind","run","stream","records","events","totalRawBytes","manifestSha256"}}
    for event in events:
        if not isinstance(event,dict) or set(event)-{"timestamp","message","ingestionTime","eventId","logStreamName"} or type(event.get("timestamp")) is not int or event["timestamp"]<1 or not isinstance(event.get("message"),str):return bad("event envelope malformed")
        message=event["message"]
        if len(message.encode("utf-8"))>EXPORT_EVENT_MAX:return bad("event exceeds fixed byte bound")
        try:doc=_strict_json(message)
        except (ValueError,TypeError):return bad("event JSON malformed")
        if not isinstance(doc,dict) or doc.get("kind") not in shapes or not _exact_keys(doc,shapes[doc["kind"]]) or _finite_json(doc) is None:return bad("event kind/fields malformed or nonfinite")
        parsed.append(doc)
    run=parsed[0]["run"];stream=parsed[0]["stream"]
    if not _uuid_ok(run) or stream!="host-"+run or expected_run not in (None,run) or expected_stream not in (None,stream) or any(d["run"]!=run or d["stream"]!=stream for d in parsed):return bad("run/stream binding mismatch")
    if any("logStreamName" in e and e["logStreamName"]!=stream for e in events):return bad("retrieval stream mismatch")
    if parsed[-2]["kind"]!="manifest" or parsed[-1]["kind"]!="end" or any(d["kind"]!="chunk" for d in parsed[:-2]):return bad("exact chunks/manifest/final-end sequence required")
    manifest,end=parsed[-2:]
    if not _context_ok(manifest["context"],run) or expected_context is not None and manifest["context"]!=expected_context:return bad("complete expected context mismatch")
    entries=manifest["records"]
    if not isinstance(entries,list) or not 1<=len(entries)<=64 or type(manifest["count"]) is not int or manifest["count"]!=len(entries):return bad("manifest count/records malformed")
    names=[];total=0;cursor=0;decoded={}
    for entry in entries:
        if not _exact_keys(entry,{"name","bytes","sha256","chunks"}) or not isinstance(entry["name"],str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}",entry["name"]) or entry["name"] in names or not _hex64_ok(entry["sha256"]) or type(entry["bytes"]) is not int or not 0<=entry["bytes"]<=EXPORT_TOTAL_RAW_MAX or type(entry["chunks"]) is not int or entry["chunks"]!=max(1,(entry["bytes"]+EXPORT_CHUNK_RAW_MAX-1)//EXPORT_CHUNK_RAW_MAX):return bad("manifest record malformed/duplicate")
        names.append(entry["name"]);parts=[]
        for i in range(entry["chunks"]):
            if cursor>=len(parsed)-2:return bad("missing chunk")
            doc=parsed[cursor];cursor+=1
            if doc["record"]!=entry["name"] or type(doc["index"]) is not int or doc["index"]!=i or type(doc["count"]) is not int or doc["count"]!=entry["chunks"] or type(doc["bytes"]) is not int or not _hex64_ok(doc["sha256"]) or not isinstance(doc["data"],str) or len(doc["data"])>EXPORT_CHUNK_B64_MAX:return bad("chunk sequence/count/fields mismatch")
            try:raw=base64.b64decode(doc["data"],validate=True)
            except (ValueError,TypeError):return bad("invalid base64")
            if base64.b64encode(raw).decode("ascii")!=doc["data"] or len(raw)>EXPORT_CHUNK_RAW_MAX or doc["bytes"]!=len(raw) or hashlib.sha256(raw).hexdigest()!=doc["sha256"]:return bad("chunk bytes/hash/base64 mismatch")
            parts.append(raw)
        raw=b"".join(parts)
        if len(raw)!=entry["bytes"] or hashlib.sha256(raw).hexdigest()!=entry["sha256"]:return bad("record reconstructed bytes/hash mismatch")
        try:decoded[entry["name"]]=raw.decode("utf-8","strict")
        except UnicodeError:return bad("record UTF8 malformed")
        total+=len(raw)
    if names!=sorted(names) or cursor!=len(parsed)-2:return bad("extra/reordered records")
    if type(manifest["totalRawBytes"]) is not int or manifest["totalRawBytes"]!=total or total>EXPORT_TOTAL_RAW_MAX or type(end["totalRawBytes"]) is not int or end["totalRawBytes"]!=total or type(end["records"]) is not int or end["records"]!=len(entries) or type(end["events"]) is not int or end["events"]!=len(parsed) or end["manifestSha256"]!=hashlib.sha256(_finite_json(manifest).encode("utf-8")).hexdigest():return bad("final end/count/hash/aggregate mismatch")
    batches=[];current=[];size=0
    for i,event in enumerate(events):
        amount=len(event["message"].encode("utf-8"))+EXPORT_EVENT_OVERHEAD
        if current and (len(current)>=EXPORT_BATCH_EVENTS or size+amount>EXPORT_BATCH_BYTES):batches.append(current);current=[];size=0
        current.append(i);size+=amount
    if current:batches.append(current)
    if len(batches)>EXPORT_MAX_CALLS:return bad("call count exceeds fixed bound")
    return {"ok":True,"run":run,"stream":stream,"context":manifest["context"],"records":len(entries),"totalRawBytes":total,"events":len(parsed),"calls":len(batches),"batches":batches,"reconstructed":decoded}

def classify_put_response(response):
    try:parsed=_strict_json(response) if isinstance(response,str) else response
    except (ValueError,TypeError):return {"ok":False,"reason":"malformed PutLogEvents JSON"}
    if not isinstance(parsed,dict) or set(parsed)-{"nextSequenceToken","rejectedLogEventsInfo","rejectedEntityInfo"}:return {"ok":False,"reason":"unknown/error PutLogEvents fields"}
    if "nextSequenceToken" in parsed and (not isinstance(parsed["nextSequenceToken"],str) or not parsed["nextSequenceToken"]):return {"ok":False,"reason":"malformed sequence token"}
    if "rejectedEntityInfo" in parsed:return {"ok":False,"reason":"entity rejection"}
    info=parsed.get("rejectedLogEventsInfo",{})
    if not isinstance(info,dict) or set(info)-{"tooNewLogEventStartIndex","tooOldLogEventEndIndex","expiredLogEventEndIndex"} or info:return {"ok":False,"reason":"malformed/rejected event indexes (including0)"}
    return {"ok":True}

def render_export_batches(plan, out_dir):
    if not isinstance(plan,dict) or plan.get("ok") is not True:raise ValueError("export plan failed")
    checked=validate_export(plan.get("events"),plan.get("run"),plan.get("stream"))
    if not checked["ok"] or plan.get("batches")!=checked["batches"] or plan.get("calls")!=checked["calls"]:raise ValueError("export plan not complete/canonical")
    os.mkdir(out_dir,0o700)
    for i,batch in enumerate(checked["batches"]):
        rows=[{"timestamp":plan["events"][j]["timestamp"],"message":plan["events"][j]["message"]} for j in batch]
        with open(os.path.join(out_dir,"batch-%03d.json"%i),"x",encoding="utf-8") as fh:fh.write(json.dumps(rows,ensure_ascii=False))
    return len(checked["batches"])

def assemble_export_records(record, run_id, context=None):
    records={name:record.get(key) for name,key in (("observer","observer"),("browser","browser"),("inspect","inspect"),("versions","versions"),("preflight","preflight"),("browserStdout","browserStdout"),("browserStderr","browserStderr"),("capture","capture"),("observerJoin","observerJoin"),("exit","exit"),("timer","timer"))}
    records["run-record"]=record
    ctx={"run":run_id,"supportImage":record.get("supportImage"),"workerImage":record.get("workerImage"),"profileSha":record.get("profile",{}).get("sha256"),"source":record.get("source")}
    if context is not None and context!=ctx:raise ValueError("caller context disagrees with run record")
    return {"records":records,"runId":run_id,"context":ctx}
