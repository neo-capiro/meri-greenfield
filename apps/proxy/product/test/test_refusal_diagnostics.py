"""Proxy refusal lines: fixed vocabulary, one per request, DEADLINE apart from REFUSED, bounded, never raising."""
from contextlib import redirect_stderr, redirect_stdout
import contextvars
import io
import os
import threading
import unittest
from unittest.mock import patch

from apps.proxy.product import refusal_diagnostics as diagnostics
from apps.proxy.qualification.state.pricing import StateDenied


class RefusalDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.lines = []
        diagnostics.install(write=lambda data: self.lines.append(data.decode("ascii")))

    def tearDown(self):
        diagnostics.uninstall()

    def test_pair_reproof_audit_is_outside_the_refusal_budget(self):
        for background in (False, True):
            with self.subTest(background=background):
                self.lines.clear()
                diagnostics.install(write=lambda data: self.lines.append(data.decode("ascii")),
                                    burst=1, background_burst=1)
                diagnostics.pair_reproven()  # An audit must not consume either refusal budget.
                for _ in range(2):
                    if background:
                        diagnostics.refused("pair", "snapshot")
                    else:
                        with diagnostics.request():
                            diagnostics.refused("pair", "snapshot")
                diagnostics.pair_reproven()  # Exhausting either budget must not suppress the audit.
                notice = "PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED" + (" scope=background" if background else "") + "\n"
                self.assertEqual(self.lines, ["PRODUCT_PROXY_PAIR_REPROVEN\n",
                    "PRODUCT_PROXY_REFUSED gate=pair step=snapshot code=REFUSED\n", notice,
                    "PRODUCT_PROXY_PAIR_REPROVEN\n"])
        diagnostics.install(write=lambda _data: (_ for _ in ()).throw(OSError("secret")))
        diagnostics.pair_reproven()

    def test_one_line_names_the_check_and_never_its_error_text(self):
        diagnostics.refused("exchange", "reply-status", StateDenied("PRODUCT_OWNER_HTTPS_DENIED 10.40.8.170 secret"))
        self.assertEqual(self.lines, ["PRODUCT_PROXY_REFUSED gate=exchange step=reply-status code=REFUSED\n"])
        for gate, step in (("Exchange", "reply"), ("exchange", "reply status"), ("exchange", "x" * 40), (None, "reply")):
            diagnostics.refused(gate, step)
        self.assertEqual(len(self.lines), 1, "only fixed lowercase words are ever written")

    def test_deadline_is_a_timeout_or_a_refusal_after_the_checks_own_deadline(self):
        diagnostics.refused("owner", "placement", TimeoutError())
        diagnostics.refused("pair", "snapshot", StateDenied("x"), deadline_ms=100, now_ms=lambda: 100)
        diagnostics.refused("pair", "snapshot", StateDenied("x"), deadline_ms=101, now_ms=lambda: 100)
        diagnostics.refused("pair", "snapshot", StateDenied("x"), deadline_ms=True, now_ms=lambda: 100)
        self.assertEqual([line.split()[-1] for line in self.lines],
                         ["code=DEADLINE", "code=DEADLINE", "code=REFUSED", "code=REFUSED"])

    def test_a_request_writes_only_its_first_innermost_refusal_with_phase_and_last_stage(self):
        with diagnostics.request():
            diagnostics.stage("exchange-wait")
            with diagnostics.phase("placement"):
                diagnostics.refused("exchange", "call", TimeoutError())
            diagnostics.refused("owner", "placement", TimeoutError())
            diagnostics.refused("resolver", "bearer")
        self.assertEqual(self.lines, ["PRODUCT_PROXY_REFUSED gate=exchange step=call phase=placement at=exchange-wait code=DEADLINE\n"])
        with diagnostics.request():
            diagnostics.stage("Not A Word")
            with diagnostics.phase("foreign"):
                diagnostics.refused("bootstrap", "busy")
        self.assertEqual(self.lines[1], "PRODUCT_PROXY_REFUSED gate=bootstrap step=busy code=REFUSED\n")
        diagnostics.refused("pair", "snapshot"); diagnostics.refused("pair", "snapshot")
        self.assertEqual(len(self.lines), 4, "outside a request every refusal is written")

    def test_threads_of_one_request_share_its_single_line(self):
        def refuse():
            diagnostics.refused("admission", "read", TimeoutError())
        with diagnostics.request():
            threads = [threading.Thread(target=contextvars.copy_context().run, args=(refuse,)) for _ in range(8)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
        self.assertEqual(len(self.lines), 1)

    def test_lines_are_bounded_per_window_and_a_failing_writer_never_raises(self):
        at = [0.0]
        diagnostics.install(write=lambda data: self.lines.append(data.decode("ascii")), now=lambda: at[0], burst=2, window=60)
        for _ in range(5):
            with diagnostics.request():
                diagnostics.refused("bootstrap", "poisoned")
        self.assertEqual(self.lines, ["PRODUCT_PROXY_REFUSED gate=bootstrap step=poisoned code=REFUSED\n"] * 2
                         + ["PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED\n"])
        at[0] = 60
        with diagnostics.request():
            diagnostics.refused("bootstrap", "poisoned")
        self.assertEqual(len(self.lines), 4)
        diagnostics.install(write=lambda data: (_ for _ in ()).throw(OSError("closed")))
        diagnostics.refused("bootstrap", "poisoned")
        for kwargs in ({}, {"fd": 2, "write": print}, {"fd": -1}, {"write": print, "burst": 0}, {"write": print, "window": 0},
                       {"write": print, "background_burst": 0}, {"write": print, "background_burst": 2.0}):
            with self.assertRaisesRegex(ValueError, "PRODUCT_PROXY_DIAGNOSTICS_CONFIGURATION"):
                diagnostics.install(**kwargs)

    def test_lines_outside_a_request_have_their_own_budget_and_never_use_up_a_requests(self):
        at = [0.0]
        diagnostics.install(write=lambda data: self.lines.append(data.decode("ascii")), now=lambda: at[0])
        for attempt in range(24):  # one minute of the startup pair wait during a rollout overlap, one read per 2.5 s
            at[0] = 2.5 * attempt
            diagnostics.refused("pair", "snapshot")
        self.assertEqual(self.lines, ["PRODUCT_PROXY_REFUSED gate=pair step=snapshot code=REFUSED\n"] * 5
                         + ["PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED scope=background\n"])
        with diagnostics.request():  # the first chat, inside the same window
            diagnostics.stage("exchange-wait")
            diagnostics.refused("exchange", "reply-status")
        self.assertEqual(self.lines[-1], "PRODUCT_PROXY_REFUSED gate=exchange step=reply-status at=exchange-wait code=REFUSED\n")
        for _ in range(25):  # requests exhaust their own budget; the background budget is untouched by them
            with diagnostics.request():
                diagnostics.refused("bootstrap", "poisoned")
        self.assertEqual(self.lines.count("PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED\n"), 1)
        self.assertEqual(len(self.lines), 6 + 20 + 1)
        at[0] = 60.0
        diagnostics.refused("pair", "snapshot")
        self.assertEqual(self.lines[-1], "PRODUCT_PROXY_REFUSED gate=pair step=snapshot code=REFUSED\n")

    def test_the_kept_stderr_still_receives_lines_while_native_output_is_silenced(self):
        read, write = os.pipe()
        try:
            with patch.object(diagnostics.os, "dup", return_value=write) as dup:
                diagnostics.install_stderr()
            dup.assert_called_once_with(2)
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()) as silenced:
                diagnostics.refused("service", "not-ready")
            self.assertEqual(silenced.getvalue(), "")
            self.assertEqual(os.read(read, 4096), b"PRODUCT_PROXY_REFUSED gate=service step=not-ready code=REFUSED\n")
        finally:
            os.close(read); os.close(write)
        diagnostics.uninstall()
        diagnostics.refused("service", "not-ready")  # not installed: silent, never raises
        with patch.object(diagnostics.os, "dup", side_effect=OSError("no stderr")):
            diagnostics.install_stderr()


if __name__ == "__main__":
    unittest.main()
