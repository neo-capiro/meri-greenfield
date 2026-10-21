"""Bounded refusal lines for the product proxy, so a proxied refusal is never silent again.

Every proxied refusal so far was silent: main() runs the service inside _quiet_native_output(), which points
sys.stdout and sys.stderr at /dev/null so native logging cannot expose request bodies or task credentials. main()
therefore installs this module first, with a duplicate of the original stderr descriptor, and the lines below still
reach the container log.

One line per refusal:
    PRODUCT_PROXY_REFUSED gate=<gate> step=<step>[ phase=<phase>][ at=<stage>] code=<DEADLINE|REFUSED>
gate and step name the check that refused; phase says which owner read it served (placement, admission, session);
at is the last stage the request entered, so a timeout seen from outside still says where the time went. DEADLINE
means the check ran out of its time budget (a timeout, or its deadline had passed when it refused), REFUSED that it
refused in time. Every field is a fixed word chosen by the caller: never an error message, header, token, identifier,
address, ARN or body. Within one request() scope only the first refusal is written, which is the innermost check that
failed. At most `burst` lines per `window` seconds; the first suppressed line in a window says so once. Lines
written outside any request() scope (the startup pair wait, a not-ready service) have their own smaller budget of
`background_burst` per `window` and their own once-per-window suppression line, so a background retry loop can never
use up the budget a request's first refusal needs. Never raises.
"""
import contextlib
import contextvars
import os
import re
import threading
import time

_WORD = re.compile(r"[a-z][a-z-]{0,31}")
PHASES = frozenset(("placement", "admission", "session"))


class _Request:
    __slots__ = ("reported", "at")

    def __init__(self):
        self.reported, self.at = False, None


_request = contextvars.ContextVar("meri_proxy_refusal_request", default=None)
_phase = contextvars.ContextVar("meri_proxy_refusal_phase", default=None)
_lock = threading.Lock()
_sink = None


class _Budget:
    __slots__ = ("burst", "notice", "start", "count", "suppressed")

    def __init__(self, burst, notice):
        self.burst, self.notice = burst, notice
        self.start, self.count, self.suppressed = float("-inf"), 0, False


class _Sink:
    def __init__(self, write, now, burst, window, background_burst):
        self.write, self.now, self.window = write, now, window
        self.requests = _Budget(burst, b"PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED\n")
        self.background = _Budget(background_burst, b"PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED scope=background\n")

    def emit(self, line, background=False):
        with _lock:
            budget, at = self.background if background else self.requests, self.now()
            if at - budget.start >= self.window:
                budget.start, budget.count, budget.suppressed = at, 0, False
            if budget.count < budget.burst:
                budget.count += 1
                self.write((line + "\n").encode("ascii"))
            elif not budget.suppressed:
                budget.suppressed = True
                self.write(budget.notice)


def install(*, fd=None, write=None, now=time.monotonic, burst=20, window=60.0, background_burst=5):
    """Write lines to `fd` (a duplicate of stderr taken before the quiet scope) or through `write(bytes)`."""
    global _sink
    if ((fd is None) == (write is None) or fd is not None and (type(fd) is not int or fd < 0)
            or write is not None and not callable(write) or not callable(now)
            or type(burst) is not int or burst < 1 or type(background_burst) is not int or background_burst < 1
            or type(window) not in (int, float) or not window > 0):
        raise ValueError("PRODUCT_PROXY_DIAGNOSTICS_CONFIGURATION")
    _sink = _Sink(write or (lambda data: os.write(fd, data)), now, burst, window, background_burst)


def install_stderr():
    """main(): keep the original stderr for these lines before native output is silenced."""
    try:
        install(fd=os.dup(2))
    except Exception:
        pass


def uninstall():
    global _sink
    _sink = None


@contextlib.contextmanager
def request():
    """One proxied request: only its first refusal is written."""
    token = _request.set(_Request())
    try:
        yield
    finally:
        _request.reset(token)


@contextlib.contextmanager
def phase(name):
    """Label refusals inside one owner read (placement, admission or session)."""
    token = _phase.set(name if name in PHASES else None)
    try:
        yield
    finally:
        _phase.reset(token)


def stage(name):
    """The request entered this stage (best effort; the last one wins)."""
    current = _request.get()
    if current is not None and type(name) is str and _WORD.fullmatch(name):
        current.at = name


def code(error=None, deadline_ms=None, now_ms=None):
    if isinstance(error, TimeoutError):
        return "DEADLINE"
    try:
        if type(deadline_ms) is int and (now_ms or (lambda: time.time_ns() // 1_000_000))() >= deadline_ms:
            return "DEADLINE"
    except Exception:
        pass
    return "REFUSED"


def refused(gate, step, error=None, *, deadline_ms=None, now_ms=None):
    """Report one refusal of check `gate`/`step`; `deadline_ms` is that check's own epoch-ms deadline."""
    try:
        sink = _sink
        if sink is None or type(gate) is not str or type(step) is not str or not (_WORD.fullmatch(gate) and _WORD.fullmatch(step)):
            return
        current = _request.get()
        if current is not None:
            with _lock:  # the resolver thread and the owner loop can refuse the same request at once
                if current.reported:
                    return
                current.reported = True
        fields = [f"gate={gate}", f"step={step}"]
        if _phase.get() in PHASES:
            fields.append(f"phase={_phase.get()}")
        if current is not None and current.at is not None:
            fields.append(f"at={current.at}")
        fields.append("code=" + code(error, deadline_ms, now_ms))
        sink.emit("PRODUCT_PROXY_REFUSED " + " ".join(fields), background=current is None)
    except Exception:
        pass
