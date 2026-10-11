"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Destinations } from "@/shared/config/config";
import { ClientIntakeDialog } from "@/features/client-intake/public";
import { RegistrantImportDialog } from "@/features/intake/registrant/public";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import {
  ProfileCapacityStatus,
  useProfileCapacity,
} from "@/features/billing/public";
import { BillingSummaryPanel } from "@/features/billing/summary-public";
import styles from "./portfolio.module.css";

interface CreateProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinations: Destinations;
}
export function CreateProfileDialog(props: CreateProfileDialogProps) {
  return props.open ? <ProfileChoiceSession {...props} /> : null;
}
function ProfileChoiceSession({
  open,
  onOpenChange,
  destinations,
}: CreateProfileDialogProps) {
  const router = useRouter();
  const identity = useIdentity();
  const [manual, setManual] = useState(false);
  const [registrant, setRegistrant] = useState(false);
  const capacity = useProfileCapacity(!manual && !registrant);
  const switching = useRef(false);
  const [opener] = useState(() =>
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (opener?.isConnected) opener.focus();
  };
  const permitted =
    identity.isSuccess &&
    !identity.isFetching &&
    Boolean(identity.data?.tenant?.id) &&
    !identity.error &&
    (identity.data?.role === "standard_user" ||
      canAdminister(identity.data?.role));
  if (registrant)
    return (
      <RegistrantImportDialog
        open={open}
        onOpenChange={onOpenChange}
        onBack={() => {
          switching.current = false;
          setRegistrant(false);
        }}
        onCloseAutoFocus={restoreFocus}
      />
    );
  if (manual)
    return (
      <ClientIntakeDialog
        open={open}
        onOpenChange={onOpenChange}
        onSaved={(client) => router.push(`/portfolio/${client.id}`)}
        onCloseAutoFocus={restoreFocus}
      />
    );
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add profile"
      description="How would you like to start?"
      className={styles.profileChooser}
      onCloseAutoFocus={(event) => {
        if (switching.current) event.preventDefault();
        else restoreFocus(event);
      }}
    >
      <QueryState
        pending={identity.isPending}
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      {identity.data && !permitted && !identity.error && (
        <p className="status">Your role does not allow creating profiles.</p>
      )}
      <div className={styles.choiceGroup}>
        <p className="eyebrow">New client</p>
        {permitted && <ProfileCapacityStatus capacity={capacity} />}
        <BillingSummaryPanel
          enabled={open}
          existingApp={destinations.existingApp}
        />
        <button
          className={styles.profileChoice}
          disabled={!permitted || !capacity.allowed}
          onClick={() => {
            switching.current = true;
            setManual(true);
          }}
        >
          <ChoiceContent
            icon="pencil"
            title="Manual entry"
            description="Fill out the intake form yourself."
          />
        </button>
        <button
          className={styles.profileChoice}
          disabled={!permitted}
          onClick={() => {
            switching.current = true;
            setRegistrant(true);
          }}
        >
          <ChoiceContent
            icon="search"
            title="Search LDA"
            description="Import clients from your firm’s lobbying filings."
          />
        </button>
        <div className={styles.unavailableChoice}>
          <button
            className={styles.profileChoice}
            disabled
            aria-describedby="meri-create-unavailable"
          >
            <ChoiceContent
              icon="sparkle"
              title="Create with Meri"
              description="Share a website, notes or files and Meri drafts the profile."
            />
          </button>
          <small id="meri-create-unavailable">
            Profile drafting is not available in this preview.
          </small>
        </div>
        <p className="eyebrow">Prospect</p>
        {permitted ? (
          <Link
            className={styles.profileChoice}
            href="/portfolio/prospects?new=1"
            onClick={() => onOpenChange(false)}
          >
            <ChoiceContent
              icon="target"
              title="Add prospect"
              description="Track a potential client in Business Development."
            />
          </Link>
        ) : (
          <button className={styles.profileChoice} disabled>
            <ChoiceContent
              icon="target"
              title="Add prospect"
              description="Track a potential client in Business Development."
            />
          </button>
        )}
      </div>
    </Dialog>
  );
}
function ChoiceContent({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <span className={styles.choiceIcon} aria-hidden="true">
        <span style={{ maskImage: `url(/design/411-44629-${icon}.svg)` }} />
      </span>
      <span className={styles.choiceText}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span aria-hidden="true">›</span>
    </>
  );
}
