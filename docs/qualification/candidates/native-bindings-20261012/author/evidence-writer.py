"""Write the fixed diagnostic evidence into its already reserved directory.

Partial files are preserved on failure. This differs from canonical inventory
write_result's create-and-clean-up contract, while reusing its file predicates
and bounded readback. The caller's original budget is never reset. Native
publication, hostile-filesystem safety and a hard time bound remain unqualified.
"""
import hashlib
import os
from pathlib import Path
import stat

CAPS = {"stdout.bin": 32768, "stderr.bin": 65536, "command-receipt.json": 262144}


class Refusal(Exception):
    pass


class NativeWrites:
    """Concrete native adapter; never constructed or called by source checks."""

    def open_exclusive(self, path):
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        flags |= getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
        return os.open(path, flags, 0o600)

    def write(self, descriptor, raw):
        return os.write(descriptor, raw)

    def fsync(self, descriptor):
        return os.fsync(descriptor)

    def fstat(self, descriptor):
        return os.fstat(descriptor)

    def close(self, descriptor):
        return os.close(descriptor)


def write_reserved(destination, owned_identity, artifacts, *, budget, inventory, fs, writes):
    """Return bounded observations, retaining every created file on any refusal.

    All effects are explicit ports. Fake ports can check this source contract
    but cannot establish native publication. Only owned descriptor closure may
    be attempted after an expired budget, as best-effort cleanup; it never
    extends the deadline or permits another open/write/fsync/readback.
    """
    records, errors, phase, descriptor = {}, [], "configuration", None
    descriptor_identity, current_name = None, None

    def need(value, reason):
        if not value:
            raise Refusal(reason)

    def check():
        budget.check("total")

    def owned_directory():
        check()
        info = inventory.plain(destination, fs, directory=True)
        check()
        need(inventory.identity(info)[:2] == owned_identity, "reserved_directory_substituted")
        return inventory.identity(info)

    def snapshot(expected):
        before = owned_directory()
        names, metadata = set(), {}
        with fs.children(destination) as entries:
            check()
            iterator = iter(entries)
            while True:
                check()
                try:
                    path = next(iterator)
                except StopIteration:
                    check()
                    break
                check()
                need(len(names) < len(CAPS), "member_count_bound")
                need(path.parent == destination and path.name in expected
                     and path.name not in names, "unexpected_or_duplicate_member")
                names.add(path.name)
                info = inventory.plain(path, fs)
                check()
                key = inventory.identity(info)
                need(key[:2] == expected[path.name], "owned_file_substituted")
                metadata[path.name] = key
        need(names == set(expected), "missing_evidence_member")
        need(owned_directory() == before, "directory_changed_during_snapshot")
        return before, metadata

    def close_owned():
        nonlocal descriptor
        if descriptor is None:
            return
        fd, descriptor = descriptor, None  # Never retry an uncertain close.
        row = records[current_name]
        row["closeAttempted"] = True
        row["closeStartedWithinBudget"] = budget.remaining("total") > 0
        try:
            outcome = writes.close(fd)
            need(outcome is None, "invalid_close_result")
            row["closeReturned"] = True
            check()
        except Exception as error:
            errors.append({"phase": "close", "file": current_name,
                           "errorClass": type(error).__name__})

    try:
        check()
        need(type(artifacts) is dict and 1 <= len(artifacts) <= len(CAPS), "artifact_member_bound")
        need(set(artifacts) <= set(CAPS) and "command-receipt.json" in artifacts,
             "fixed_artifact_names_required")
        need(type(owned_identity) is tuple and len(owned_identity) == 2
             and all(type(value) is int for value in owned_identity), "reserved_identity_required")
        destination = Path(destination)
        prepared = []
        for name in sorted(artifacts):
            raw = artifacts[name]
            need(type(raw) is bytes and len(raw) <= CAPS[name]
                 and (name != "command-receipt.json" or len(raw) > 0), "artifact_byte_bound")
            prepared.append((name, raw, hashlib.sha256(raw).hexdigest()))
        check()
        inventory.ancestors(destination, fs)
        check()
        snapshot({})  # The caller reserved exactly this empty slot.
        identities = {}
        for name, raw, digest in prepared:
            current_name, phase = name, "open"
            snapshot(identities)
            check()
            records[name] = {"bytes": len(raw), "sha256": digest, "writtenBytes": 0,
                             "fsyncReturned": False, "closeAttempted": False,
                             "closeReturned": False, "readbackMatched": False}
            row = records[name]
            acquired = writes.open_exclusive(destination / name)
            need(type(acquired) is int and 0 <= acquired < 2**31, "invalid_owned_descriptor")
            descriptor = acquired
            check()
            opened = writes.fstat(descriptor)
            check()
            named = inventory.plain(destination / name, fs)
            check()
            need(stat.S_ISREG(opened.st_mode) and opened.st_nlink == 1
                 and (opened.st_dev, opened.st_ino, opened.st_size, opened.st_nlink) ==
                 (named.st_dev, named.st_ino, named.st_size, named.st_nlink)
                 and opened.st_size == 0, "exclusive_open_identity_mismatch")
            descriptor_identity = (opened.st_dev, opened.st_ino)
            identities[name] = descriptor_identity
            phase = "write"
            while row["writtenBytes"] < len(raw):
                check()
                owned_directory()
                offset = row["writtenBytes"]
                chunk = raw[offset:offset + 65536]
                count = writes.write(descriptor, chunk)
                need(type(count) is int and 0 < count <= len(chunk), "invalid_or_zero_write_count")
                row["writtenBytes"] += count  # Returned bytes count even if late.
                check()
            phase = "fsync"
            check()
            need(writes.fsync(descriptor) is None, "invalid_fsync_result")
            row["fsyncReturned"] = True
            check()
            final_opened = writes.fstat(descriptor)
            check()
            need((final_opened.st_dev, final_opened.st_ino) == descriptor_identity
                 and stat.S_ISREG(final_opened.st_mode) and final_opened.st_nlink == 1
                 and final_opened.st_size == len(raw), "written_descriptor_identity_mismatch")
            close_owned()
            need(not errors, "owned_close_unconfirmed")
            phase = "readback"
            check()
            observed = inventory.hash_file(destination / name, fs=fs, clock=budget.clock,
                                           end=budget.total_end, cap=max(1, len(raw)), allow_empty=True)
            check()
            need(observed["bytes"] == len(raw) and observed["sha256"] == digest,
                 "evidence_readback_mismatch")
            row["readbackMatched"] = True
        phase = "final_membership"
        initial = snapshot(identities)
        for name, raw, digest in prepared:
            check()
            observed = inventory.hash_file(destination / name, fs=fs, clock=budget.clock,
                                           end=budget.total_end, cap=max(1, len(raw)), allow_empty=True)
            check()
            need(observed["bytes"] == len(raw) and observed["sha256"] == digest,
                 "final_readback_mismatch")
        need(snapshot(identities) == initial, "final_membership_changed")
        check()
    except Exception as error:
        errors.append({"phase": phase, "file": current_name,
                       "errorClass": type(error).__name__,
                       "reason": str(error) if type(error) is Refusal else None})
    finally:
        close_owned()
    remaining = budget.remaining("total")
    return {"readbackAndMembershipMatched": not errors and remaining > 0,
            "files": records, "errors": errors, "remainingTotalSeconds": remaining,
            "partialFilesPreserved": True, "nativePublicationQualified": False,
            "hardTotalProven": False, "runtimeAccepted": False}
