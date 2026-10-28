#!/usr/bin/env python3
"""Apply one pinned unified diff to one file, exactly and fail-closed.

Used in the ClamAV source stage, where no `patch` binary exists and the dependency set must not change. It refuses
anything that is not the simple, fully contextual single-file diff it is written for: unknown sections, other files,
hunk headers it cannot read, a context/removed block that does not occur exactly once, or a resulting file whose
sha256 is not the expected one. There is no fuzz factor and no fallback: any surprise leaves the file untouched.

usage: apply-pinned-patch.py <patch> <target> <expected-sha256-before> <expected-sha256-after>
"""
import hashlib
import re
import sys

HUNK = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")
FILE_HEADER = re.compile(r"^(---|\+\+\+) ")


def fail(message):
    sys.stderr.write("apply-pinned-patch: %s\n" % message)
    raise SystemExit(1)


def main(argv):
    if len(argv) != 5:
        fail("usage: %s <patch> <target> <sha256-before> <sha256-after>" % argv[0])
    patch_path, target_path, want_before, want_after = argv[1:]
    raw = open(patch_path, "r", encoding="utf-8", newline="").read()
    lines = raw.split("\n")

    start = next((i for i, line in enumerate(lines) if line.startswith("--- ")), None)
    if start is None:
        fail("no --- header: this is not a unified diff")
    headers = [line for line in lines if FILE_HEADER.match(line)]
    if len(headers) != 2:
        fail("expected exactly one file in the diff, found %d header lines" % len(headers))
    if not lines[start + 1].startswith("+++ "):
        fail("malformed file header pair")

    body_lines = lines[start + 2:]
    if body_lines and body_lines[-1] == "":
        body_lines = body_lines[:-1]          # the diff's own trailing newline, not a context line

    hunks, current = [], None
    for line in body_lines:
        if not line and current is None:
            continue
        match = HUNK.match(line)
        if match:
            if current is not None:
                hunks.append(current)
            current = {"old": [], "new": []}
            continue
        if current is None:
            fail("content outside a hunk: %r" % line[:40])
        tag, body = (line[0], line[1:]) if line else (" ", "")
        if tag == " ":
            current["old"].append(body)
            current["new"].append(body)
        elif tag == "-":
            current["old"].append(body)
        elif tag == "+":
            current["new"].append(body)
        elif tag == "\\":                      # "No newline at end of file" marker
            continue
        else:
            fail("unexpected line in hunk: %r" % line[:40])
    if current is not None:
        hunks.append(current)
    if not hunks:
        fail("no hunks")

    original = open(target_path, "r", encoding="utf-8", newline="").read()
    before = hashlib.sha256(original.encode("utf-8")).hexdigest()
    if before != want_before:
        fail("target sha256 is %s, expected %s: refusing to touch an unexpected file" % (before, want_before))

    text = original
    for index, hunk in enumerate(hunks, 1):
        old = "\n".join(hunk["old"]) + "\n"
        new = "\n".join(hunk["new"]) + "\n"
        occurrences = text.count(old)
        if occurrences != 1:
            fail("hunk %d matches %d times, expected exactly 1: nothing written" % (index, occurrences))
        text = text.replace(old, new)

    after = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if after != want_after:
        fail("result sha256 is %s, expected %s: nothing written" % (after, want_after))

    with open(target_path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    print("apply-pinned-patch: %d hunks applied, sha256 %s -> %s" % (len(hunks), before[:12], after[:12]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
