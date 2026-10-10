"""Import-inert ASGI inference caller; TLS/LiteLLM/ECS composition is not supplied."""
import asyncio
from dataclasses import dataclass
import time

from .ingress import IngressAdmission
from .lifetime import LifetimeLimits, PendingWork, RequestLifetime, _request_lifetime
from ..state.pricing import StateDenied


@dataclass(frozen=True)
class TrustedRequest:
    admission: IngressAdmission
    observer: object
    deadline: float


class InferenceApp:
    def __init__(self, upstream_app, trusted_resolver, limits):
        if not callable(upstream_app) or not callable(trusted_resolver) or type(limits) is not LifetimeLimits:
            raise StateDenied("INVALID_SERVER_COMPOSITION")
        self.upstream_app, self.trusted_resolver, self.limits = upstream_app, trusted_resolver, limits
        self.pending = PendingWork()

    @property
    def ready(self):
        return self.pending.ready

    async def _refuse(self, send):
        async def response():
            await send({"type": "http.response.start", "status": 403, "headers": []})
            await send({"type": "http.response.body", "body": b"INFERENCE_DENIED", "more_body": False})
        task = asyncio.create_task(response())
        try:
            await asyncio.wait({task}, timeout=self.limits.cleanup_seconds)
        finally:
            if not task.done():
                task.cancel()
                task.add_done_callback(lambda value: None if value.cancelled() else value.exception())
                self.pending.quarantine({task})
            elif not task.cancelled():
                task.exception()

    async def __call__(self, scope, receive, send):
        if type(scope) is not dict or scope.get("type") != "http":
            raise StateDenied("HTTP_INFERENCE_ONLY")
        life = None
        started = False
        try:
            if not self.ready:
                raise StateDenied("SERVER_PENDING_WORK")
            trusted = self.trusted_resolver(scope)
            if type(trusted) is not TrustedRequest:
                raise StateDenied("TRUSTED_REQUEST_REQUIRED")
            life = RequestLifetime(trusted.admission, trusted.observer, trusted.deadline, self.limits, self.pending)
            await life.start(scope)  # Sibling watcher exists BEFORE body/upstream.
            channel = asyncio.Queue(maxsize=2)
            ended = False
            body_bytes = output_bytes = events = output_events = 0
            response_done = False

            async def pump():
                nonlocal ended, body_bytes, events
                try:
                    while True:
                        event = await receive()  # Sole owner of actual receive.
                        life.check()
                        if type(event) is not dict:
                            raise StateDenied("INVALID_REQUEST_EVENT")
                        if event.get("type") == "http.disconnect":
                            life.deny("CLIENT_DISCONNECTED")
                            return
                        if (event.get("type") != "http.request" or ended
                                or set(event)-{"type", "body", "more_body"}
                                or type(event.get("body", b"")) is not bytes
                                or type(event.get("more_body", False)) is not bool):
                            raise StateDenied("INVALID_REQUEST_EVENT")
                        events += 1
                        body_bytes += len(event.get("body", b""))
                        if events > self.limits.max_events or body_bytes > self.limits.max_body_bytes:
                            raise StateDenied("REQUEST_BODY_BOUND")
                        ended = not event.get("more_body", False)
                        await channel.put(event)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    life.deny("REQUEST_RECEIVE_DENIED")

            async def upstream_receive():
                life.check()
                event = await channel.get()
                life.check()
                return event

            async def upstream_send(event):
                nonlocal started, response_done, output_bytes, output_events
                life.check()
                output_events += 1
                if output_events > self.limits.max_events:
                    raise StateDenied("RESPONSE_EVENT_BOUND")
                if type(event) is not dict or response_done:
                    raise StateDenied("INVALID_RESPONSE_EVENT")
                if event.get("type") == "http.response.start":
                    if (started or type(event.get("status")) is not int or not 100 <= event["status"] <= 599
                            or type(event.get("headers", [])) is not list
                            or set(event)-{"type", "status", "headers"}):
                        raise StateDenied("INVALID_RESPONSE_START")
                    headers = event.get("headers", [])
                    if (len(headers) > 64 or any(type(x) not in (tuple, list) or len(x) != 2
                        or type(x[0]) is not bytes or type(x[1]) is not bytes for x in headers)
                        or sum(len(x[0])+len(x[1]) for x in headers) > 16384):
                        raise StateDenied("INVALID_RESPONSE_HEADERS")
                    started = True
                elif event.get("type") == "http.response.body":
                    if (not started or type(event.get("body", b"")) is not bytes
                            or type(event.get("more_body", False)) is not bool
                            or set(event)-{"type", "body", "more_body"}):
                        raise StateDenied("INVALID_RESPONSE_BODY")
                    output_bytes += len(event.get("body", b""))
                    if output_bytes > self.limits.max_body_bytes:
                        raise StateDenied("RESPONSE_BODY_BOUND")
                    response_done = not event.get("more_body", False)
                else:
                    raise StateDenied("INVALID_RESPONSE_EVENT")
                await send(event)  # Watcher remains independent under backpressure.
                life.check()

            async def invoke():
                token = _request_lifetime.set(life)
                try:
                    await self.upstream_app(scope, upstream_receive, upstream_send)
                    if not response_done:
                        raise StateDenied("INCOMPLETE_UPSTREAM_RESPONSE")
                finally:
                    _request_lifetime.reset(token)

            life.spawn(pump())
            app_task = life.spawn(invoke())
            denied = life.spawn(life.denied.wait())
            done, _ = await asyncio.wait({app_task, denied}, timeout=max(0, life.deadline-time.monotonic()),
                                         return_when=asyncio.FIRST_COMPLETED)
            if denied in done or not done:
                life.deny("ORIGINAL_DEADLINE_EXPIRED")
                raise StateDenied(life.reason)
            app_task.result()
        except asyncio.CancelledError:
            if life is not None:
                life.deny("REQUEST_CANCELLED")
            raise
        except Exception:
            if life is not None:
                life.deny("UPSTREAM_OR_ADMISSION_DENIED")
            if not started:
                await self._refuse(send)
        finally:
            if life is not None:
                await life.close()


def create_app(upstream_app, trusted_resolver, limits=LifetimeLimits()):
    """Composition must provide canonical trusted resolver and actual upstream."""
    return InferenceApp(upstream_app, trusted_resolver, limits)
