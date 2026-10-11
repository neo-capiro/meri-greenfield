"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { canAdminister, useIdentity } from "@/shared/auth/identity";
import {
  initials,
  safeWebsite,
  type Client,
} from "@/features/portfolio/public";
import {
  clientToIntake,
  stepFields,
  validateIntake,
  type IntakeField,
  type IntakeForm,
} from "./form";
import { CompanyStep } from "./CompanyStep";
import { RegistrationStep } from "./RegistrationStep";
import { SectorStep } from "./SectorStep";
import { useSaveIntake, useUploadLogo } from "./mutations";
import { ClientProfileAttemptError } from "./profile-api";
import { useIntakeAuthority, type IntakeWriteScope } from "./authority";
import {
  ProfileCapacityStatus,
  useProfileCapacity,
} from "@/features/billing/public";
import { validateLogo, type LogoAttempt } from "./logo";
import styles from "./intake.module.css";

export interface ClientIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client;
  onSaved: (client: Client) => void;
  onCloseAutoFocus?: ComponentProps<typeof Dialog>["onCloseAutoFocus"];
}
export function ClientIntakeDialog(props: ClientIntakeDialogProps) {
  return props.open ? <IntakeSession {...props} /> : null;
}
function IntakeSession({
  open,
  onOpenChange,
  client,
  onSaved,
  onCloseAutoFocus,
}: ClientIntakeDialogProps) {
  const identity = useIdentity();
  const [initial] = useState(() => clientToIntake(client));
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<IntakeField, string>>>(
    {},
  );
  const [logo, setLogo] = useState<LogoAttempt>();
  const [logoValidation, setLogoValidation] = useState("");
  const [persisted, setPersisted] = useState<Client>();
  const persistedScope = useRef<IntakeWriteScope | undefined>(undefined);
  const [continuationError, setContinuationError] = useState<Error>();
  const fields = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (Object.keys(errors).length)
      fields.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [errors]);
  const capture = useIntakeAuthority(Boolean(client));
  const save = useSaveIntake(capture, client);
  const capacity = useProfileCapacity(!client && !persisted);
  const upload = useUploadLogo(capture);
  const pending = save.isPending || upload.isPending;
  const uncertainCreation =
    !client &&
    ((save.error instanceof ClientProfileAttemptError &&
      save.error.uncertain) ||
      (continuationError instanceof ClientProfileAttemptError &&
        continuationError.uncertain));
  const role = identity.data?.role;
  const permitted = client
    ? canAdminister(role)
    : role === "standard_user" || canAdminister(role);
  const set = <K extends IntakeField>(key: K, value: IntakeForm[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const finish = (saved: Client) => {
    persistedScope.current?.assert();
    onSaved(saved);
    onOpenChange(false);
  };
  const close = () => {
    if (pending) return;
    if (persisted) {
      try {
        finish(persisted);
      } catch (error) {
        setContinuationError(
          error instanceof Error
            ? error
            : new Error("Your profile session changed."),
        );
      }
    } else onOpenChange(false);
  };
  function validate(targetStep?: number) {
    const next = validateIntake(values, client ? initial : undefined);
    const relevant =
      targetStep === undefined
        ? next
        : Object.fromEntries(
            Object.entries(next).filter(([key]) =>
              stepFields[targetStep]?.includes(key as IntakeField),
            ),
          );
    setErrors(relevant);
    const first = Object.keys(relevant)[0] as IntakeField | undefined;
    if (first)
      setStep(stepFields.findIndex((fields) => fields.includes(first)));
    return !first;
  }
  async function submit() {
    if (
      pending ||
      uncertainCreation ||
      !permitted ||
      (!client && !persisted && !capacity.allowed) ||
      !validate()
    )
      return;
    try {
      setContinuationError(undefined);
      const scope = persistedScope.current ?? capture();
      scope.assert();
      const saved =
        persisted ??
        (await save.mutateAsync({
          values,
          initial: client ? initial : undefined,
        }));
      try {
        scope.assert();
      } catch {
        throw new ClientProfileAttemptError(
          "Your profile session changed after saving. Review the client list before continuing.",
          true,
        );
      }
      persistedScope.current = scope;
      setPersisted(saved);
      finish(
        logo
          ? await upload.mutateAsync({ clientId: saved.id, attempt: logo })
          : saved,
      );
    } catch (error) {
      setContinuationError(
        error instanceof Error
          ? error
          : new Error("The profile could not be confirmed."),
      );
      /* QueryState renders the operation's error without discarding input. */
    }
  }
  const stepProps = { values, set, errors };
  const logoUrl = safeWebsite(client?.logoUrl);
  return (
    <Dialog
      open={open}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      title={client ? "Edit client details" : "Add profile"}
      description={client?.name ?? "Create a client organization"}
      className={styles.dialog}
    >
      <QueryState
        pending={identity.isPending}
        error={identity.error}
        retry={() => void identity.refetch()}
      />
      {identity.data && !permitted && (
        <p role="alert">
          {client
            ? "Client edits require an administrator."
            : "Your role cannot create client profiles."}
        </p>
      )}
      {!client && !persisted && permitted && (
        <ProfileCapacityStatus capacity={capacity} />
      )}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 2 && !persisted) {
            if (validate(step)) setStep(step + 1);
          } else void submit();
        }}
      >
        <nav className={styles.steps} aria-label="Client intake steps">
          {[
            "1. Company Info",
            "2. Government Registration",
            "3. Sector & Tracks",
          ].map((label, index) => (
            <button
              type="button"
              key={label}
              className={`button ${step === index ? "primary" : "ghost"}`}
              aria-current={step === index ? "step" : undefined}
              disabled={pending || Boolean(persisted)}
              onClick={() => {
                setErrors({});
                setStep(index);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <fieldset
          ref={fields}
          className={styles.scroll}
          disabled={pending || !permitted || Boolean(persisted)}
        >
          <div className={styles.logo}>
            <span className={styles.initials}>
              {logoUrl ? (
                // Signed, service-provided branding URL; no optimizer proxy or inline SVG.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.logoImage}
                  src={logoUrl}
                  alt="Current client logo"
                />
              ) : (
                initials(values.name || "Client")
              )}
            </span>
            <div>
              <strong>Company logo</strong>
              <small className="muted">
                PNG, JPEG, SVG or WebP · Up to 2 MB
              </small>
              {logo && <small>{logo.file.name}</small>}
            </div>
            <label className="button">
              Upload logo
              <input
                className="srOnly"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                aria-label="Upload logo"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const invalid = validateLogo(file);
                  setLogoValidation(invalid ?? "");
                  if (!invalid) {
                    setLogo({ file });
                    upload.reset();
                  }
                  event.target.value = "";
                }}
              />
            </label>
            {logo && (
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  setLogo(undefined);
                  setLogoValidation("");
                }}
              >
                Remove selected logo
              </button>
            )}
          </div>
          {logoValidation && (
            <p role="alert" className="danger">
              {logoValidation}
            </p>
          )}
          {step === 0 ? (
            <CompanyStep {...stepProps} />
          ) : step === 1 ? (
            <RegistrationStep {...stepProps} />
          ) : (
            <SectorStep {...stepProps} />
          )}
        </fieldset>
        <div className={styles.feedback} aria-live="polite">
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="danger">
              Check the highlighted fields before continuing.
            </p>
          )}
          <QueryState error={save.error ?? upload.error ?? continuationError} />
          {uncertainCreation && (
            <p role="alert">
              Profile creation could not be confirmed. Review the client list
              before starting another profile. No automatic retry will be sent.
            </p>
          )}
          {persisted && upload.error && (
            <p role="status">
              The profile was saved. Its logo is not confirmed. Retry the logo
              or continue to the profile.
            </p>
          )}
        </div>
        <footer className={styles.actions}>
          <button
            className="button ghost"
            type="button"
            disabled={pending}
            onClick={close}
          >
            {persisted ? "Continue to profile" : "Cancel"}
          </button>
          <span />
          {step > 0 && !persisted && (
            <button
              className="button"
              type="button"
              disabled={pending}
              onClick={() => {
                setErrors({});
                setStep(step - 1);
              }}
            >
              Back
            </button>
          )}
          <button
            className="button primary"
            disabled={
              pending ||
              !permitted ||
              uncertainCreation ||
              (!client && !persisted && !capacity.allowed)
            }
          >
            {pending
              ? upload.isPending
                ? "Uploading logo…"
                : "Saving…"
              : persisted
                ? "Retry logo"
                : step < 2
                  ? "Next"
                  : client
                    ? "Save changes"
                    : "Create profile"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
