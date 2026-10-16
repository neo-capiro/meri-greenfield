"""One atomic UNKNOWN send slot and explicit trusted reconciliation, no TTL refund."""
import asyncio
from dataclasses import dataclass
import re

from .grants import Grants, RunBinding, identifier, same_binding
from .pricing import Pricing, StateDenied, digest, liability
from .sql import budget_tables, store_namespace

REQUEST = re.compile(r"[A-Za-z0-9_-]{1,128}\Z")


@dataclass(frozen=True)
class Settlement:
    native_body_sha256: str
    raw_request_sha256: str
    pricing_revision: str
    evidence_sha256: str
    input_tokens: int
    output_tokens: int
    origin: str = "trusted-complete-native-usage"

    def __post_init__(self):
        for value in (self.native_body_sha256,self.raw_request_sha256,self.pricing_revision,self.evidence_sha256):
            digest(value)
        liability(self.input_tokens,self.output_tokens)
        if self.origin!="trusted-complete-native-usage":
            raise StateDenied("UNTRUSTED_USAGE_ORIGIN")


class PostgresLedger:
    def __init__(self,store,*,grant_id,binding,capability_sha256,raw_request_sha256,pricing,expected_count_origin):
        identifier(grant_id);digest(capability_sha256);digest(raw_request_sha256)
        if type(binding) is not RunBinding or type(pricing) is not Pricing:
            raise StateDenied("TYPED_ADMISSION_REQUIRED")
        if expected_count_origin not in ("fixture","aws-counttokens"):
            raise StateDenied("INVALID_COUNT_ORIGIN")
        self.store=store;self.grant_id=grant_id;self.binding=binding
        self.capability_sha256=capability_sha256;self.raw_request_sha256=raw_request_sha256
        self.pricing=pricing;self.expected_count_origin=expected_count_origin
        self.namespace=store_namespace(store);self.tables=budget_tables(self.namespace)
        if self.namespace=="product" and expected_count_origin!="aws-counttokens":
            raise StateDenied("PRODUCT_NATIVE_COUNT_REQUIRED")

    async def reserve_and_arm_once(self,request_id,body,count):
        # Cancellation cannot undo a possibly committed transaction. The thread
        # may finish after the caller stops waiting; its UNKNOWN row still counts.
        return await asyncio.to_thread(self.reserve_sync,request_id,body,count)

    def reserve_sync(self,request_id,body,count):
        from ..runtime.bedrock_body import BodyLimits, NativeBody, COUNT_MODEL_ID, PROFILE_ID, INVOKE_URLS, inspect_native_request
        from ..runtime.bedrock_transport import CountObservation, HoldReceipt
        if type(request_id) is not str or not REQUEST.fullmatch(request_id):
            raise StateDenied("INVALID_REQUEST_SLOT")
        if type(body) is not NativeBody or type(count) is not CountObservation:
            raise StateDenied("TYPED_NATIVE_EVIDENCE_REQUIRED")
        checked=inspect_native_request("POST",sorted(INVOKE_URLS)[0],body.raw,BodyLimits())
        if checked!=body or count.native_body_sha256!=body.sha256 or count.model_id!=COUNT_MODEL_ID or count.origin!=self.expected_count_origin:
            raise StateDenied("NATIVE_COUNT_BINDING_MISMATCH")
        hold=liability(count.input_tokens,body.max_output_tokens,reserve=True)
        def operation(cursor):
            budget=self.store.budget(cursor)
            if budget["quarantined"]:
                raise StateDenied("BUDGET_QUARANTINED")
            if self.pricing.valid_until<=budget["now"]:
                raise StateDenied("PRICING_EXPIRED")
            Grants._current(cursor,self.binding,namespace=self.namespace)
            cursor.execute(f"SELECT * FROM {self.tables['grants']} WHERE grant_id=%s",(self.grant_id,));grant=cursor.fetchone()
            if (not grant or grant["state"]!="ACTIVE" or not same_binding(grant,self.binding)
                or grant["capability_sha256"]!=self.capability_sha256 or grant["expires_at"]<=budget["now"]):
                raise StateDenied("GRANT_ADMISSION_DENIED")
            cursor.execute(f"SELECT 1 FROM {self.tables['budget_liabilities']} WHERE (kind='model' AND slot=%s) OR (grant_id=%s AND state='UNKNOWN')",(request_id,self.grant_id))
            if cursor.fetchone():
                raise StateDenied("REQUEST_SLOT_ALREADY_USED")
            cursor.execute(f"SELECT COALESCE(sum(hold_micro_usd),0) AS held FROM {self.tables['budget_liabilities']} WHERE state='UNKNOWN'")
            held=cursor.fetchone()["held"]
            cursor.execute(f"SELECT max_cost_micro_usd FROM {self.tables['tool_run_allocations']} WHERE run_id=%s",(self.binding.run_id,))
            allocation=cursor.fetchone()
            if self.namespace=="product" and allocation is None:raise StateDenied("PRODUCT_ALLOCATION_REQUIRED")
            cursor.execute(f"SELECT COALESCE(sum(CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE consumed_micro_usd END),0) AS total FROM {self.tables['budget_liabilities']} WHERE run_id=%s",(self.binding.run_id,))
            run_total=cursor.fetchone()["total"]
            if (budget["consumed_micro_usd"]+held+hold>budget["cap_micro_usd"]
                or (allocation and run_total+hold>allocation["max_cost_micro_usd"])):
                raise StateDenied("AGGREGATE_BUDGET_EXHAUSTED")
            cursor.execute(f"INSERT INTO {self.tables['requests']}(request_id,grant_id,run_id,attempt,worker_arn,fence,policy_revision,native_body_sha256,raw_request_sha256,model_id,profile_id,pricing_revision,pricing_valid_until,input_tokens,max_output_tokens,hold_micro_usd,state) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'UNKNOWN')",(request_id,self.grant_id,*self.binding.values(),body.sha256,self.raw_request_sha256,COUNT_MODEL_ID,PROFILE_ID,self.pricing.revision,self.pricing.valid_until,count.input_tokens,body.max_output_tokens,hold))
            return HoldReceipt(request_id,body.sha256,"UNKNOWN")
        return self.store.transact(operation)

    def _original(self,cursor,request_id,native_sha,raw_sha,pricing_revision):
        if type(request_id) is not str or not REQUEST.fullmatch(request_id):
            raise StateDenied("INVALID_REQUEST_SLOT")
        cursor.execute(f"SELECT * FROM {self.tables['requests']} WHERE request_id=%s",(request_id,));row=cursor.fetchone()
        if (not row or row["state"]!="UNKNOWN" or str(row["grant_id"])!=self.grant_id or not same_binding(row,self.binding)
            or row["native_body_sha256"]!=native_sha or row["raw_request_sha256"]!=raw_sha
            or row["pricing_revision"]!=pricing_revision or pricing_revision!=self.pricing.revision
            or row["pricing_valid_until"]!=self.pricing.valid_until):
            raise StateDenied("RECONCILIATION_BINDING_DENIED")
        return row

    def settle_complete(self,request_id,evidence):
        """Trusted complete usage only. An origin string is NOT authentication.

        No worker HTTP route is supplied. The eventual trusted parser/dispatcher
        must establish complete native response, exact request and provenance.
        """
        if type(evidence) is not Settlement:
            raise StateDenied("TYPED_SETTLEMENT_REQUIRED")
        actual=liability(evidence.input_tokens,evidence.output_tokens)
        def operation(cursor):
            budget=self.store.budget(cursor)
            row=self._original(cursor,request_id,evidence.native_body_sha256,evidence.raw_request_sha256,evidence.pricing_revision)
            inconsistent=(evidence.input_tokens!=row["input_tokens"] or evidence.output_tokens>row["max_output_tokens"])
            cursor.execute(f"SELECT COALESCE(sum(hold_micro_usd),0) AS held FROM {self.tables['budget_liabilities']} WHERE state='UNKNOWN' AND NOT (kind='model' AND slot=%s)",(request_id,))
            remaining=cursor.fetchone()["held"]
            cursor.execute(f"SELECT max_cost_micro_usd FROM {self.tables['tool_run_allocations']} WHERE run_id=%s",(self.binding.run_id,))
            allocation=cursor.fetchone()
            if self.namespace=="product" and allocation is None:raise StateDenied("PRODUCT_ALLOCATION_REQUIRED")
            cursor.execute(f"SELECT COALESCE(sum(CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE consumed_micro_usd END),0) AS total FROM {self.tables['budget_liabilities']} WHERE run_id=%s AND NOT (kind='model' AND slot=%s)",(self.binding.run_id,request_id))
            run_remaining=cursor.fetchone()["total"]
            quarantine=(inconsistent or actual>row["hold_micro_usd"] or budget["consumed_micro_usd"]+remaining+actual>budget["cap_micro_usd"]
                        or bool(allocation and run_remaining+actual>allocation["max_cost_micro_usd"]))
            cursor.execute(f"UPDATE {self.tables['budget']} SET consumed_micro_usd=consumed_micro_usd+%s,quarantined=quarantined OR %s WHERE id=1",(actual,quarantine))
            cursor.execute(f"UPDATE {self.tables['requests']} SET state='SETTLED',actual_micro_usd=%s,evidence_sha256=%s,settled_at=clock_timestamp() WHERE request_id=%s",(actual,evidence.evidence_sha256,request_id))
            return {"actual_micro_usd":actual,"quarantined":bool(budget["quarantined"] or quarantine)}
        return self.store.transact(operation)

    def reconcile_no_dispatch(self,request_id,*,native_body_sha256,raw_request_sha256,pricing_revision,evidence_sha256):
        """Privileged positive no-dispatch evidence; never timeout/error/TTL inference."""
        for value in (native_body_sha256,raw_request_sha256,pricing_revision,evidence_sha256):digest(value)
        def operation(cursor):
            self.store.budget(cursor)
            self._original(cursor,request_id,native_body_sha256,raw_request_sha256,pricing_revision)
            cursor.execute(f"UPDATE {self.tables['requests']} SET state='NO_DISPATCH',actual_micro_usd=0,evidence_sha256=%s,settled_at=clock_timestamp() WHERE request_id=%s",(evidence_sha256,request_id))
        self.store.transact(operation)

    def snapshot(self):
        """Trusted operator/test read; unresolved rows never expire here."""
        def operation(cursor):
            budget=self.store.budget(cursor)
            cursor.execute(f"SELECT COALESCE(sum(hold_micro_usd),0) AS held,count(*) AS unresolved FROM {self.tables['budget_liabilities']} WHERE state='UNKNOWN'")
            return {**budget,**cursor.fetchone()}
        return self.store.transact(operation)
