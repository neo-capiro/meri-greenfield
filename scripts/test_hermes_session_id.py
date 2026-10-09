"""Offline regression fixtures; no launcher, Hermes process or files are opened."""

import unittest

from hermes_session_id import is_valid_hermes_session_id, session_footer_ids


REAL_ID = "20261009_182329_21b4bc"
OTHER_ID = "20261009_182329_29bc4d"


class SessionIdTests(unittest.TestCase):
    def test_exact_installed_format_and_valid_timestamp(self):
        for value in (REAL_ID, OTHER_ID, "20240229_235959_abcdef"):
            with self.subTest(value=value):
                self.assertTrue(is_valid_hermes_session_id(value))

    def test_resume_rejects_aliases_prose_and_malformed_ids(self):
        for value in (
            None, 123, "", "latest", "string", "sess-test",
            "20261009_182329_21B4BC", "20261009_182329_21b4b",
            "20261009_182329_21b4bc0", "20260230_182329_21b4bc",
            "20261009_246060_21b4bc", "00001009_182329_21b4bc",
            "２０２６１００９_182329_21b4bc", f" {REAL_ID}",
            f"{REAL_ID} ", f"{REAL_ID}\n", f"{REAL_ID}:suffix",
        ):
            with self.subTest(value=value):
                self.assertFalse(is_valid_hermes_session_id(value))

    def test_real_stderr_footer_lf_crlf_and_final_unterminated_line(self):
        for ending in ("\n", "\r\n", ""):
            with self.subTest(ending=repr(ending)):
                self.assertEqual(
                    session_footer_ids(["\n", f"session_id: {REAL_ID}{ending}"], stream="stderr"),
                    [REAL_ID],
                )

    def test_stdout_is_never_a_footer_source(self):
        self.assertEqual(
            session_footer_ids([f"session_id: {REAL_ID}\n"], stream="stdout"), [],
        )

    def test_type_narration_and_source_snippets_are_ignored(self):
        lines = [
            "session_id: string\n",
            "SDKUserMessage = { session_id: string }.\n",
            "parent_tool_use_id: string|null, session_id: string }.\n",
            f"Example session_id: {REAL_ID}\n",
            f"    session_id: {REAL_ID}\n",
            f"'session_id: {REAL_ID}'\n",
            f'print("session_id: {REAL_ID}")\n',
            f"session_id: {REAL_ID} (example)\n",
            f"session_id: {REAL_ID} \n",
            f"session_id:  {REAL_ID}\n",
            f"session_id:\t{REAL_ID}\n",
            f"\x1b[32msession_id: {REAL_ID}\x1b[0m\n",
            f"session_id: {REAL_ID}\n\n",
        ]
        self.assertEqual(session_footer_ids(lines, stream="stderr"), [])

    def test_malformed_footer_ids_are_ignored(self):
        lines = [
            "session_id: latest\n", "session_id: string\n",
            "session_id: 20261009_182329_21B4BC\n",
            "session_id: 20261009_182329_21b4b\n",
            "session_id: 20260230_182329_21b4bc\n",
            "session_id: 20261009_246060_21b4bc\n",
        ]
        self.assertEqual(session_footer_ids(lines, stream="stderr"), [])

    def test_duplicate_footers_count_once(self):
        self.assertEqual(
            session_footer_ids(
                [f"session_id: {REAL_ID}\n", f"session_id: {REAL_ID}\r\n"],
                stream="stderr",
            ),
            [REAL_ID],
        )

    def test_conflicting_valid_footers_remain_ambiguous(self):
        ids = session_footer_ids(
            [f"session_id: {REAL_ID}\n", f"session_id: {OTHER_ID}\n"],
            stream="stderr",
        )
        self.assertEqual(ids, [REAL_ID, OTHER_ID])
        self.assertNotEqual(len(ids), 1, "existing launcher gate must reject ambiguity")

    def test_actual_incidental_type_plus_real_footer(self):
        stdout = ["SDKUserMessage = { session_id: string }.\n"]
        stderr = ["\r\n", f"session_id: {REAL_ID}\r\n"]
        self.assertEqual(
            session_footer_ids(stdout, stream="stdout")
            + session_footer_ids(stderr, stream="stderr"),
            [REAL_ID],
        )


if __name__ == "__main__":
    unittest.main()
