"""One process-owned pair proof renewer and socket generation authority.

Only this holder calls discovery. Successful observations come from the task's
own SDK clients; sockets and HTTP replies cannot change its pins or identities.
Construction is inert. Explicit start/close own the single renewal thread.
"""
import asyncio
from dataclasses import dataclass
import random
import threading
import time

from .budgets import (PAIR_LEASE_TTL_MS, PAIR_RENEW_MS, PAIR_RENEW_JITTER_MS,
    PAIR_REPROOF_MS, PAIR_REPROOFS_PER_10_MIN, PAIR_REPROOF_WINDOW_MS,
    PAIR_RENEWER_QUARANTINE_COOLDOWN_MS)
from .service_pair_discovery import ProductServicePairDiscovery, PairProofError
from . import telemetry_context as telemetry
from . import refusal_diagnostics as diagnostics


@dataclass(frozen=True)
class PairIdentity:
    task_arn: str
    ip: str
    eni: str
    created_at_ms: int

    @classmethod
    def from_observation(cls, value):
        return cls(value['taskArn'], value['privateIpv4Address'], value['eni'], value['createdAtMs'])


@dataclass(frozen=True)
class PairLease:
    generation: int
    owner: PairIdentity
    proxy: PairIdentity
    checked_at_mono_ms: float
    expires_at_mono_ms: float
    expires_at_ms: int


class ProductPairLease:
    """Serialized proofs, monotonic leases, and close-before-install replacement.

    Subscribers must be synchronous and bounded. The transport closes sockets
    before notifying session owners; no new generation is visible until every
    old-generation close callback has returned. A callback failure retires.
    """
    def __init__(self, discovery, *, now_ms=None, monotonic_ms=None, random_value=None):
        if type(discovery) is not ProductServicePairDiscovery:
            raise PairProofError('PAIR_UNAVAILABLE')
        self._reader = discovery
        self._old_readers = []
        self._pins = discovery.pins
        self._now = now_ms or discovery._now
        self._mono = monotonic_ms or (lambda: time.monotonic()*1000)
        self._random = random_value or random.random
        self._ttl = min(PAIR_LEASE_TTL_MS, discovery.max_lease_ms)
        if self._ttl < 2 * PAIR_RENEW_MS:
            raise PairProofError('PAIR_UNAVAILABLE')
        self._state = threading.RLock()
        self._renew_lock = threading.Lock()
        self._closed = self._retired = False
        self._lease = None
        self._identity = None
        self._generation = 0
        self._seen = set()
        self._reproofs = []
        self._reproving_since = None
        self._quarantine_until = None
        self._close_listeners = []
        self._install_listeners = []
        self._warm = None
        self._stop = threading.Event()
        self._thread = None
        observed = discovery.last_observation
        if observed is not None:
            self._install(observed, discovery._last_checked_mono_ms)

    @property
    def discovery(self):
        return self._reader

    @property
    def generation(self):
        with self._state:
            return self._generation

    @property
    def current(self):
        with self._state:
            return self._lease

    @property
    def available(self):
        """Process liveness; a transient proof failure never poisons it."""
        with self._state:
            return not self._closed and not self._retired and self._now() < self._pins['expiresAtMs']

    @property
    def ready(self):
        with self._state:
            if not self.available:
                return False
            if self._reproving_since is not None:
                return self._mono()-self._reproving_since < PAIR_REPROOF_MS
            return (self._lease is not None and self._mono() < self._lease.expires_at_mono_ms
                    and self._now() < self._lease.expires_at_ms)

    @property
    def reproving(self):
        with self._state:
            return self._reproving_since is not None

    def subscribe_generation_close(self, callback):
        with self._state:
            self._close_listeners.append(callback)
        return lambda: self._remove(self._close_listeners, callback)

    def subscribe_generation_install(self, callback):
        with self._state:
            self._install_listeners.append(callback)
        return lambda: self._remove(self._install_listeners, callback)

    def _remove(self, listeners, callback):
        with self._state:
            if callback in listeners:
                listeners.remove(callback)

    def set_warmup(self, callback):
        if not callable(callback):
            raise PairProofError('PAIR_UNAVAILABLE')
        with self._state:
            self._warm = callback

    def _install(self, observation, checked_mono):
        owner, proxy = (PairIdentity.from_observation(observation[r]) for r in ('owner', 'proxy'))
        with self._state:
            if not self.available:
                raise PairProofError('PAIR_UNAVAILABLE')
            at = self._mono()
            replacement = self._identity is not None and owner != self._identity[0]
            if self._identity is not None:
                old_owner, own = self._identity
                if proxy != own or replacement and (owner.task_arn in self._seen
                        or owner.created_at_ms < old_owner.created_at_ms):
                    self.retire()
                    raise PairProofError('PAIR_DRIFT')
            if replacement:
                self._reproofs = [stamp for stamp in self._reproofs if at-stamp < PAIR_REPROOF_WINDOW_MS]
                if len(self._reproofs) >= PAIR_REPROOFS_PER_10_MIN:
                    self.retire()
                    raise PairProofError('PAIR_DRIFT')
                self._reproofs.append(at)
                # Refuse the old generation before closing even its first socket.
                self._lease = None
                try:
                    for callback in tuple(self._close_listeners):
                        callback(self._generation)
                except BaseException:
                    self.retire()
                    raise PairProofError('PAIR_DRIFT')
                self._reproving_since = at
            if self._identity is None or replacement:
                self._generation += 1
                self._seen.add(owner.task_arn)
            self._identity = owner, proxy
            absolute = min(self._pins['expiresAtMs'], observation['expiresAtMs'])
            expires_mono = min(checked_mono+self._ttl, at+max(0, absolute-self._now()))
            if at >= expires_mono:
                raise PairProofError('PAIR_UNAVAILABLE')
            self._lease = PairLease(self._generation, owner, proxy, checked_mono, expires_mono, absolute)
            if replacement:
                try:
                    for callback in tuple(self._install_listeners):
                        callback(self._generation)
                except BaseException:
                    self.retire()
                    raise PairProofError('PAIR_DRIFT')
            return self._lease

    def renew(self, *, deadline_ms):
        """One fresh proof. A waiting socket proof never reuses a pre-handshake read."""
        remaining = max(0, (deadline_ms-self._now())/1000)
        if not self._renew_lock.acquire(timeout=remaining):
            raise PairProofError('PAIR_UNAVAILABLE')
        try:
            if not self.available or self._now() >= deadline_ms:
                raise PairProofError('PAIR_UNAVAILABLE')
            if self._reader.quarantined:
                self._quarantine_until = self._quarantine_until or self._mono()+PAIR_RENEWER_QUARANTINE_COOLDOWN_MS
                if self._mono() < self._quarantine_until:
                    raise PairProofError('PAIR_UNAVAILABLE')
                self._old_readers.append(self._reader)
                self._reader = self._reader.recreate()
                self._quarantine_until = None
            if self._reader.pins != self._pins:
                self.retire()
                raise PairProofError('PAIR_DRIFT')
            try:
                observation = self._reader.read(deadline_ms=deadline_ms)
                return self._install(observation, self._mono())
            except PairProofError as error:
                if error.code == 'PAIR_DRIFT' and self._identity is not None:
                    self.retire()
                elif self._reader.quarantined and self._quarantine_until is None:
                    self._quarantine_until = self._mono()+PAIR_RENEWER_QUARANTINE_COOLDOWN_MS
                raise
        finally:
            self._renew_lock.release()

    def read(self, *, deadline_ms):
        """Startup adapter: still exactly one renewer owns discovery."""
        lease = self.renew(deadline_ms=deadline_ms)
        return {role: {'taskArn': getattr(lease, role).task_arn,
            'privateIpv4Address': getattr(lease, role).ip, 'eni': getattr(lease, role).eni,
            'createdAtMs': getattr(lease, role).created_at_ms} for role in ('owner', 'proxy')}

    def require(self, *, deadline_ms=None, generation=None, allow_reproving=False):
        with self._state:
            if not self.available:
                raise PairProofError('PAIR_DRIFT' if self._retired else 'PAIR_UNAVAILABLE')
            lease = self._lease
            valid = lease is not None and self._mono() < lease.expires_at_mono_ms and self._now() < lease.expires_at_ms
        if not valid and deadline_ms is not None:
            lease = self.renew(deadline_ms=deadline_ms)
        with self._state:
            if (lease is None or lease is not self._lease or not self.available
                    or self._mono() >= lease.expires_at_mono_ms or self._now() >= lease.expires_at_ms):
                raise PairProofError('PAIR_UNAVAILABLE')
            if generation is not None and generation != lease.generation:
                raise PairProofError('PAIR_REPROVING')
            if self._reproving_since is not None and not allow_reproving:
                raise PairProofError('PAIR_REPROVING')
            return lease

    def prove_socket(self, lease, *, owner_ip, proxy_ip, deadline_ms):
        # Called only AFTER do_handshake. renew() starts its own fresh read after
        # acquiring the serialization lock; earlier in-flight proofs never count.
        fresh = self.renew(deadline_ms=deadline_ms)
        if (fresh.generation != lease.generation or fresh.owner != lease.owner or fresh.proxy != lease.proxy
                or fresh.owner.ip != owner_ip or fresh.proxy.ip != proxy_ip):
            raise PairProofError('PAIR_REPROVING')
        return fresh

    def socket_ready(self, generation):
        with self._state:
            self.require(generation=generation, allow_reproving=True)
            if self._reproving_since is not None:
                self._reproving_since = None
                telemetry.health('pair', 'reproven', 'PAIR_REPROVEN')
                diagnostics.pair_reproven()

    def retire(self):
        with self._state:
            if self._retired:
                return
            self._retired = True
            self._lease = None
            self._stop.set()
            self._reader.abort()
            for callback in tuple(self._close_listeners):
                try:
                    callback(self._generation)
                except BaseException:
                    pass
            telemetry.health('pair', 'retired', 'PAIR_DRIFT')

    def start(self):
        with self._state:
            if self._thread is not None or not self.available:
                raise PairProofError('PAIR_UNAVAILABLE')
            self._thread = threading.Thread(target=self._run, name='meri-pair-renewer', daemon=True)
            self._thread.start()

    def _run(self):
        delay = 0
        while not self._stop.wait(delay/1000):
            if not self.available:
                return
            began = self._mono()
            try:
                self.renew(deadline_ms=min(self._pins['expiresAtMs'], self._now()+self._reader._max_request_ms))
                if self._warm is not None:
                    self._warm()
                delay = max(PAIR_RENEW_JITTER_MS, PAIR_RENEW_MS+(self._random()*2-1)*PAIR_RENEW_JITTER_MS
                            -(self._mono()-began))
            except PairProofError as error:
                if error.code == 'PAIR_DRIFT':
                    return
                delay = PAIR_RENEW_JITTER_MS*(1+self._random())
            except Exception:
                # Socket warmup can be unavailable without changing the proof.
                delay = PAIR_RENEW_JITTER_MS*(1+self._random())

    def stop(self):
        with self._state:
            if self._closed:
                return
            self._closed = True
            self._lease = None
            self._stop.set()
            self._reader.abort()
            for callback in tuple(self._close_listeners):
                callback(self._generation)
    def close(self):
        self.stop()
        if self._thread is not None and self._thread is not threading.current_thread():
            self._thread.join(self._reader._max_request_ms/1000+1)
        if self._thread is not None and self._thread.is_alive():
            raise PairProofError('PAIR_UNAVAILABLE')
        if any(reader._active for reader in [self._reader, *self._old_readers]):
            raise PairProofError('PAIR_UNAVAILABLE')

    async def aclose(self):
        await asyncio.to_thread(self.close)
