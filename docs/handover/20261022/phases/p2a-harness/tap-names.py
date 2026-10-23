#!/usr/bin/env python3
"""Review helper (not for commit): compare TAP test names between two logs. Usage: tap-names.py BASE_LOG HEAD_LOG"""
import re, sys

def names(path):
    out = {}
    for line in open(path, errors="replace"):
        m = re.match(r"^\s*(not ok|ok) \d+ - (.+?)(?: # (SKIP|TODO).*)?$", line.rstrip())
        if m:
            out[m.group(2).strip()] = "skip" if m.group(3) else ("pass" if m.group(1) == "ok" else "fail")
    return out

base, head = names(sys.argv[1]), names(sys.argv[2])
print("base", len(base), "head", len(head))
print("removed (in base, not head):", len(set(base) - set(head)))
for n in sorted(set(base) - set(head)):
    print("  -", n)
print("added (in head, not base):", len(set(head) - set(base)))
for n in sorted(set(head) - set(base)):
    print("  +", n, "[%s]" % head[n])
changed = [n for n in set(base) & set(head) if base[n] != head[n]]
print("status changed:", len(changed))
for n in sorted(changed):
    print("  ~", n, base[n], "->", head[n])
