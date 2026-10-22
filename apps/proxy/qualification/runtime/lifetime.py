"""Server-owned request lifetime; no grant/budget mutations or forced-stop claim."""
import asyncio
from contextvars import ContextVar
from dataclasses import dataclass
import math
import time

from .ingress import IngressAdmission, PeerLease
from ..state.pricing import StateDenied
from ...product import telemetry_context as telemetry

_request_lifetime = ContextVar("meri_trusted_request_lifetime", default=None)


def _current_lifetime_check():
    """Private server composition, never obtained from an HTTP scope/header."""
    lifetime = _request_lifetime.get()
    return None if lifetime is None else lifetime.check


@dataclass(frozen=True)
class LifetimeLimits:
    poll_seconds: float = 5.0
    check_seconds: float = 5.0
    cleanup_seconds: float = 1.0
    max_body_bytes: int = 4 * 1024 * 1024
    max_events: int = 4096

    def __post_init__(self):
        # check and cleanup may reach the product's owner carrier wait plus exchange budget (product/budgets.py): an
        # in-request check is one owner exchange that may first wait for its carrier, and close waits for one still running.
        for name, maximum in (("poll_seconds", 5), ("check_seconds", 30), ("cleanup_seconds", 30)):
            value = getattr(self, name)
            if type(value) not in (int, float) or not math.isfinite(value) or not 0 < value <= maximum:
                raise StateDenied("INVALID_LIFETIME_LIMITS")
        for name, maximum in (("max_body_bytes", 4 * 1024 * 1024), ("max_events", 4096)):
            value = getattr(self, name)
            if type(value) is not int or not 1 <= value <= maximum:
                raise StateDenied("INVALID_LIFETIME_LIMITS")


class PendingWork:
    """Strong references and sticky readiness denial; not a second authority."""
    def __init__(self):
        self.tasks = set()
        self.ready = True

    def quarantine(self, tasks):
        if tasks:
            transitioned = self.ready
            self.ready = False
            if transitioned:
                telemetry.health("pending-work", "quarantined", "PENDING_WORK")
        for task in tasks:
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)


class RequestLifetime:
    def __init__(self, admission, observer, deadline, limits, pending):
        if (type(admission) is not IngressAdmission or not callable(observer)
                or type(limits) is not LifetimeLimits or type(pending) is not PendingWork
                or type(deadline) not in (int, float) or not math.isfinite(deadline)):
            raise StateDenied("INVALID_REQUEST_LIFETIME")
        self.admission, self.observer, self.deadline = admission, observer, deadline
        self.limits, self.pending, self.peer = limits, pending, admission.peer
        self.denied = asyncio.Event()
        self.reason = None
        self.tasks, self.threads = set(), set()
        self.original_body = None
        self.proxy_credential = None
        self._owner_reader = self._admission_lease = None
        self._admission_started = False
        self._admission_renewal_task = None
        self.check()
        product = getattr(admission.authority, "_product_owner", None)
        if product is not None:
            self._owner_reader = product[0]
            self._admission_lease = self._owner_reader.bind_lifetime(self)

    def deny(self, reason):
        if self.reason is None:
            self.reason = reason
            self.denied.set()  # Publish deny BEFORE any cancellation request.

    def check(self):
        if self.reason is not None:
            raise StateDenied(self.reason)
        if not self.pending.ready:
            self.deny("SERVER_PENDING_WORK")
        elif time.monotonic() >= self.deadline:
            self.deny("ORIGINAL_DEADLINE_EXPIRED")
        else:
            try:
                self.peer.check()
            except StateDenied:
                self.deny("PEER_OBSERVATION_EXPIRED")
        if self.reason is None and self._owner_reader is not None and self._admission_started:
            try:
                self._owner_reader.current_lifetime(self)
            except Exception:
                self.deny("ADMISSION_LEASE_EXPIRED")
        if self.reason is not None:
            raise StateDenied(self.reason)

    def spawn(self, coroutine, *, thread=False, mandatory=None):
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        if thread:
            self.threads.add(task)
        def done(value):
            # A mandatory owner must not disappear, even if canceled before its
            # coroutine starts. Intentional close/request cancellation denies first.
            if mandatory is not None:
                self.deny(mandatory)
            self.tasks.discard(value)
            self.threads.discard(value)
            if not value.cancelled():
                value.exception()  # Observe exceptions even after caller timeout.
        task.add_done_callback(done)
        return task

    async def _bounded(self, factory, *, thread=False):
        self.check()
        task = self.spawn(factory(), thread=thread)
        done, _ = await asyncio.wait({task}, timeout=min(self.limits.check_seconds, self.deadline-time.monotonic()))
        if not done:
            self.deny("ORIGINAL_DEADLINE_EXPIRED" if time.monotonic() >= self.deadline
                      else "FRESH_OBSERVATION_TIMEOUT")
            raise StateDenied(self.reason)
        if task.cancelled():
            self.deny("FRESH_ADMISSION_CANCELLED")
            raise StateDenied(self.reason)
        return task.result()

    @property
    def has_admission_lease(self):
        return self._owner_reader is not None

    def current_conversation(self):
        self.check()
        if self._owner_reader is None:
            raise StateDenied("PRODUCT_ADMISSION_LEASE_REQUIRED")
        return self._owner_reader.conversation_for_lifetime(self)

    async def refresh(self):
        """Request-path checks reuse only this lifetime's successful receipt."""
        self.check()
        if self._owner_reader is not None:
            if self._admission_lease.receipt is None:
                await self.renew()
            self._owner_reader.current_lifetime(self)
            self._admission_started = True
            self.check()
            return
        await self.renew()

    async def _renewal_result(self, factory, *, thread=False):
        # Renewal may be unanswered. Unlike _bounded(), it does not invalidate a
        # still-valid lease on timeout; the independent expiry watcher does that.
        self.check()
        task = self._admission_renewal_task if thread else None
        if task is None:
            task = self.spawn(factory(), thread=thread)
            if thread:
                self._admission_renewal_task = task
        timeout = min(self.limits.check_seconds, self.deadline-time.monotonic())
        receipt = self._admission_lease.receipt
        if receipt is not None:
            timeout = min(timeout, receipt.expires_at_mono-self._owner_reader.monotonic())
        done, _ = await asyncio.wait({task}, timeout=max(0, timeout))
        if not done:
            if thread:
                # Keep the unanswered work tracked for late refusal and close,
                # but the next watch tick must initiate its own fresh read.
                self._admission_renewal_task = None
            else:
                task.cancel()
            raise TimeoutError("ADMISSION_RENEWAL_UNANSWERED")
        if thread:
            self._admission_renewal_task = None
        if task.cancelled():
            raise StateDenied("FRESH_ADMISSION_CANCELLED")
        return task.result()

    @staticmethod
    def _unanswered(error):
        from ...product.owner_channel import OwnerCarrierBusy
        from ...product.service_pair_discovery import PairProofError
        return (isinstance(error, (TimeoutError, ConnectionError, OwnerCarrierBusy))
                or isinstance(error, PairProofError) and error.code == "PAIR_UNAVAILABLE")

    async def renew(self):
        """The five-second watcher owns runner observation and admission reads."""
        self.check()
        try:
            bounded = self._renewal_result if self._owner_reader is not None else self._bounded
            peer = await bounded(self.observer)
            if (type(peer) is not PeerLease or peer.ipv4 != self.peer.ipv4
                    or peer.binding != self.admission.authority.binding
                    or peer.grant_id != self.admission.authority.grant_id
                    or peer.observed_at < self.peer.observed_at):
                raise StateDenied("PEER_RENEWAL_MISMATCH")
            peer.check()
            self.peer = peer
            if self._owner_reader is None:
                await self._bounded(lambda: asyncio.to_thread(self.admission.authority.check), thread=True)
            else:
                await self._renewal_result(lambda: asyncio.to_thread(
                    self._owner_reader.renew_lifetime_sync, self), thread=True)
                self._admission_started = True
            self.check()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            if self._owner_reader is not None and self._unanswered(error):
                try:
                    self._owner_reader.current_lifetime(self)
                    self.check()
                    return
                except Exception:
                    pass
            self.deny("FRESH_ADMISSION_DENIED")
            raise StateDenied(self.reason) from None

    async def start(self, scope):
        self.admission.validate_scope(scope)
        # This is read only after the direct TLS peer, exact route and bearer
        # have passed ingress validation. The complete body is captured by the
        # sole ASGI receive owner, never from a worker attribution header.
        self.proxy_credential = next(value[7:] for name, value in scope["headers"]
                                     if name == b"authorization")
        await self.refresh()
        self.spawn(self._watch(), mandatory="ADMISSION_WATCH_STOPPED")
        if self._owner_reader is not None:
            self.spawn(self._watch_admission_expiry(), mandatory="ADMISSION_EXPIRY_WATCH_STOPPED")

    async def _watch(self):
        try:
            while True:
                await asyncio.sleep(min(self.limits.poll_seconds, max(0, self.deadline-time.monotonic())))
                await self.renew()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.deny("FRESH_ADMISSION_DENIED")

    async def _watch_admission_expiry(self):
        try:
            while True:
                receipt = self._owner_reader.current_lifetime(self)
                await asyncio.sleep(max(0, min(self.deadline-time.monotonic(),
                    receipt.expires_at_mono-self._owner_reader.monotonic())))
                self.check()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.deny("ADMISSION_LEASE_EXPIRED")

    async def close(self):
        self.deny("REQUEST_CLOSED")
        if self._owner_reader is not None:
            self._owner_reader.release_lifetime(self)
        self.original_body = None
        self.proxy_credential = None
        tasks = set(self.tasks)
        for task in tasks - self.threads:
            task.cancel()
        try:
            if tasks:
                await asyncio.wait(tasks, timeout=self.limits.cleanup_seconds)
        finally:
            # A second owner cancellation must not lose unresolved work.
            self.pending.quarantine({task for task in tasks if not task.done()})
        # Threads may still commit UNKNOWN. No refund or forced stop occurs here.
