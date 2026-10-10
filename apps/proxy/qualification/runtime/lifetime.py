"""Server-owned request lifetime; no grant/budget mutations or forced-stop claim."""
import asyncio
from contextvars import ContextVar
from dataclasses import dataclass
import math
import time

from .ingress import IngressAdmission, PeerLease
from ..state.pricing import StateDenied

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
        for name, maximum in (("poll_seconds", 5), ("check_seconds", 5), ("cleanup_seconds", 1)):
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
            self.ready = False
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
        self.check()

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
        if self.reason is not None:
            raise StateDenied(self.reason)

    def spawn(self, coroutine, *, thread=False):
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        if thread:
            self.threads.add(task)
        def done(value):
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
        return task.result()

    async def refresh(self):
        self.check()
        try:
            peer = await self._bounded(self.observer)
            if (type(peer) is not PeerLease or peer.ipv4 != self.peer.ipv4
                    or peer.binding != self.admission.authority.binding
                    or peer.grant_id != self.admission.authority.grant_id
                    or peer.observed_at < self.peer.observed_at):
                raise StateDenied("PEER_RENEWAL_MISMATCH")
            peer.check()
            self.peer = peer
            await self._bounded(lambda: asyncio.to_thread(self.admission.authority.check), thread=True)
            self.check()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.deny("FRESH_ADMISSION_DENIED")
            raise StateDenied(self.reason) from None

    async def start(self, scope):
        self.admission.validate_scope(scope)
        await self.refresh()
        self.spawn(self._watch())

    async def _watch(self):
        try:
            while True:
                await asyncio.sleep(min(self.limits.poll_seconds, max(0, self.deadline-time.monotonic())))
                await self.refresh()
        except asyncio.CancelledError:
            raise
        except Exception:
            self.deny("FRESH_ADMISSION_DENIED")

    async def close(self):
        self.deny("REQUEST_CLOSED")
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
