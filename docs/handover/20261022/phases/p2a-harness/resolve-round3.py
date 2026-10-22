#!/usr/bin/env python3
"""Review-only trial-merge resolution for PR #196 round 3 onto main eb657920 (not for commit).
owner_startup.py: main's `with diagnostics.phase(...)` wrapping the try (its refusal handler is phase-labelled)
plus the PR's generation capture. test_owner_startup.py: keep both sides' tests."""
import re, sys
root = sys.argv[1]

def resolve(path, choose):
    text = open(path).read()
    pattern = re.compile(r"<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [0-9a-f]+\n", re.S)
    count = len(pattern.findall(text))
    assert count == 1, (path, count)
    open(path, "w").write(pattern.sub(lambda m: choose(m.group(1), m.group(2)), text))

def startup(ours, theirs):
    assert 'with diagnostics.phase("placement"):\n            try:' in ours
    assert "self._check_generation(generation)" in theirs
    return ('        generation=self.generation;policy=self.policy;state=self.state\n'
            '        self._check_generation(generation)\n'
            '        step="carrier";cutoff=deadline;lock=state[3]["admission"]\n'
            '        with diagnostics.phase("placement"):\n'
            '            try:\n')

resolve(f"{root}/apps/proxy/product/owner_startup.py", startup)
resolve(f"{root}/apps/proxy/product/test/test_owner_startup.py", lambda ours, theirs: ours + theirs)
print("resolved")
