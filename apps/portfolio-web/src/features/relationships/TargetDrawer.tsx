"use client";
import { useState } from "react";
import { z } from "zod";
import { Dialog } from "@/shared/ui/Dialog";
import { SelectField } from "@/shared/ui/SelectField";
import { QueryState } from "@/shared/ui/QueryState";
import { initials } from "@/features/portfolio/public";
import {
  type GovernmentTarget,
  targetKind,
  targetProfileLink,
} from "./target-contracts";
import { useTargetContact } from "./directory-queries";
import { useTargetMutation } from "./target-queries";
import { ContactMail } from "./ContactMail";
import { MemberNoteForm } from "./member-notes/public";
export function TargetDrawer({
  clientId,
  target,
  base,
  onClose,
}: {
  clientId: string;
  target: GovernmentTarget;
  base?: string;
  onClose: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState("");
  const details = useTargetContact(target);
  const save = useTargetMutation(clientId);
  const remove = useTargetMutation(clientId, onClose);
  const emails = [
    ...new Set(
      (details.data?.emails ?? []).filter(
        (value) => z.email().safeParse(value).success,
      ),
    ),
  ];
  const email = emails.includes(selectedEmail)
    ? selectedEmail
    : (emails[0] ?? null);
  return (
    <Dialog
      open
      drawer
      title={target.memberName ?? target.memberId}
      description={targetKind(target)}
      onOpenChange={(open) => {
        if (!open && !save.isPending && !remove.isPending) onClose();
      }}
    >
      <section className="card stack">
        <div className="row">
          <span className="monogram">
            {initials(target.memberName ?? target.memberId)}
          </span>
          <div>
            <strong>{target.memberName ?? target.memberId}</strong>
            <p className="muted">
              {target.committee ?? "Office not available"}
            </p>
          </div>
          <span className="chip">Current target</span>
        </div>
      </section>
      <section className="card stack">
        <h3>Target record</h3>
        <p>
          {[target.chamber, target.state, target.party]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <SelectField
          label="Tier"
          value={target.tier ?? ""}
          disabled={save.isPending}
          onChange={(event) =>
            save.mutate({
              kind: "tier",
              memberId: target.memberId,
              tier: event.target.value ? Number(event.target.value) : null,
            })
          }
        >
          <option value="">Untiered</option>
          {[1, 2, 3].map((value) => (
            <option value={value} key={value}>
              Tier {value}
            </option>
          ))}
        </SelectField>
        <small>
          Added via {target.source} ·{" "}
          {new Date(target.addedAt).toLocaleDateString()}
        </small>
        <QueryState error={save.error} />
      </section>
      <QueryState
        pending={details.isPending}
        error={details.error}
        retry={() => void details.refetch()}
      />
      {details.data?.positions.map((position, index) => (
        <article className="card stack" key={index}>
          <strong>{position.title ?? position.officeName ?? "Office"}</strong>
          <p className="muted">{position.officeName}</p>
          <small>
            {position.isCurrent ? "Current" : "Former"} ·{" "}
            {position.startDate?.slice(0, 10) ?? "Start unknown"} –{" "}
            {position.endDate?.slice(0, 10) ?? "End not stated"}
          </small>
        </article>
      ))}
      {emails.length > 1 && (
        <SelectField
          label="Directory email"
          value={email ?? ""}
          onChange={(event) => setSelectedEmail(event.target.value)}
        >
          {emails.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </SelectField>
      )}
      {details.data && (
        <ContactMail
          key={email}
          clientId={clientId}
          person={{
            name: target.memberName ?? target.memberId,
            title: target.committee,
            email,
          }}
        />
      )}
      <section className="card stack">
        <h3>Target context</h3>
        <p className="muted">
          Linked strategy, ask and next-action information is not available from
          this target record.
        </p>
      </section>
      {target.sourceDirectory === "congress" &&
        details.isSuccess &&
        !details.error && (
          <section className="card stack" aria-label="Member Directory note">
            <h3>Directory note</h3>
            <p className="muted">
              This note is shared in Directory. It is not linked to this client.
            </p>
            <MemberNoteForm
              member={{
                id: target.memberId,
                name: target.memberName ?? target.memberId,
              }}
            />
          </section>
        )}
      <div className="formActions">
        <button className="button" onClick={() => setRemoving(true)}>
          Remove target
        </button>
        {base && (
          <a className="button primary" href={targetProfileLink(base, target)}>
            Open directory profile
          </a>
        )}
      </div>
      <Dialog
        open={removing}
        title="Remove target"
        description="Remove this saved government target from this client? The directory record is retained."
        onOpenChange={(open) => {
          if (!remove.isPending) setRemoving(open);
        }}
      >
        <QueryState error={remove.error} />
        <button
          className="button danger"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate({ kind: "remove", memberId: target.memberId })
          }
        >
          {remove.isPending ? "Removing…" : "Confirm removal"}
        </button>
      </Dialog>
    </Dialog>
  );
}
